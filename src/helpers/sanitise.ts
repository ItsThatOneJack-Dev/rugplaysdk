// src/helpers/sanitise.ts

const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

// Tags whose content is raw text and must never be entity-encoded
const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

// Numeric and named entity patterns that could decode to dangerous chars
const ENTITY_BYPASS = /&(#x?[0-9a-f]+|lt|gt|amp|quot|apos|nbsp);?/gi;

// CDATA pattern
const CDATA_PATTERN = /<!\[CDATA\[/gi;

/**
 * Escapes a plain text string for safe insertion into HTML.
 * No tags are preserved.
 */
export function escapeHTML(input: string): string {
    let s = input;
    s = s.replace(ENTITY_BYPASS, (match) => `&amp;${match.slice(1)}`);
    s = s.replace(CDATA_PATTERN, "&lt;![CDATA[");
    s = s.replace(/</g, "&lt;");
    s = s.replace(/>/g, "&gt;");
    s = s.replace(/"/g, "&quot;");
    s = s.replace(/'/g, "&#39;");
    return s;
}

/**
 * Sanitises an HTML string, preserving only allowlisted tags with safe attributes.
 *
 * - Tags not in the allowlist are fully escaped.
 * - Attributes starting with "on" are stripped (event handlers).
 * - Attributes whose value contains "javascript" (case-insensitive) are stripped.
 * - Raw text elements (script, style) have their content passed through unescaped
 *   when allowlisted, since entity encoding would break their content.
 * - Any </ sequence inside raw text content is rewritten as <\/ to prevent
 *   premature closing tag matches (e.g. </script> inside a string literal).
 * - All & encoding bypass attempts are neutralised in regular text nodes.
 * - CDATA sections are escaped in regular text nodes.
 */
export function sanitiseHTML(input: string, allowlist: string[] = []): string {
    const allowed = new Set(allowlist.map((t) => t.toLowerCase().trim()));

    const TAG_RE = /(<)(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?>)/g;

    let result = "";
    let lastIndex = 0;
    let rawTextTag: string | null = null;
    let rawTextStart: number = 0;

    for (const match of input.matchAll(TAG_RE)) {
        const fullMatch = match[0];
        const closingSlash = match[2];
        const tagName = match[3].toLowerCase();
        const rawAttrs = match[4];
        const matchIndex = match.index!;

        // -------------------------
        // Inside a raw text element — look only for its closing tag
        // -------------------------
        if (rawTextTag !== null) {
            if (closingSlash === "/" && tagName === rawTextTag) {
                // Emit raw content with </ rewritten to <\/ to prevent injection
                result += input
                    .slice(rawTextStart, matchIndex)
                    .replace(/<\//g, "<\\/");
                result += `</${rawTextTag}>`;
                lastIndex = matchIndex + fullMatch.length;
                rawTextTag = null;
            }
            // Ignore any other tags while inside a raw text element
            continue;
        }

        // -------------------------
        // Normal processing
        // -------------------------

        // Process text node before this tag
        result += sanitiseTextNode(input.slice(lastIndex, matchIndex));
        lastIndex = matchIndex + fullMatch.length;

        if (!allowed.has(tagName)) {
            result += escapeHTML(fullMatch);
            continue;
        }

        if (closingSlash === "/") {
            result += `</${tagName}>`;
            continue;
        }

        // Allowed opening tag — filter attributes
        const safeAttrs = parseAndFilterAttrs(rawAttrs);
        result += safeAttrs ? `<${tagName} ${safeAttrs}>` : `<${tagName}>`;

        // If this is a raw text element, enter raw text mode
        if (RAW_TEXT_ELEMENTS.has(tagName) && !VOID_ELEMENTS.has(tagName)) {
            rawTextTag = tagName;
            rawTextStart = lastIndex;
        }
    }

    // Emit any remaining content
    if (rawTextTag !== null) {
        // Unclosed raw text element — emit content verbatim with </ rewritten
        result += input.slice(rawTextStart).replace(/<\//g, "<\\/");
    } else {
        result += sanitiseTextNode(input.slice(lastIndex));
    }

    return result;
}

// -------------------------
// Internals
// -------------------------

function sanitiseTextNode(text: string): string {
    if (!text) return "";

    let s = text;
    s = s.replace(ENTITY_BYPASS, (match) => `&amp;${match.slice(1)}`);
    s = s.replace(CDATA_PATTERN, "&lt;![CDATA[");
    s = s.replace(/</g, "&lt;");
    s = s.replace(/>/g, "&gt;");
    s = s.replace(/"/g, "&quot;");
    s = s.replace(/'/g, "&#39;");
    return s;
}

function parseAndFilterAttrs(rawAttrs: string): string {
    if (!rawAttrs.trim()) return "";

    const ATTR_RE =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
    const safe: string[] = [];

    for (const match of rawAttrs.matchAll(ATTR_RE)) {
        const attrName = match[1].toLowerCase();
        const attrValue = match[2] ?? match[3] ?? match[4] ?? null;

        if (attrName.startsWith("on")) continue;
        if (attrValue && /javascript/i.test(attrValue)) continue;

        if (attrValue) {
            const decoded = decodeNumericEntities(attrValue);
            if (/javascript/i.test(decoded)) continue;
            if (decoded.trimStart().startsWith("on")) continue;
        }

        if (attrValue !== null) {
            const escaped = attrValue
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            safe.push(`${attrName}="${escaped}"`);
        } else {
            safe.push(attrName);
        }
    }

    return safe.join(" ");
}

function decodeNumericEntities(value: string): string {
    return value
        .replace(/&#x([0-9a-f]+);?/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16)),
        )
        .replace(/&#([0-9]+);?/g, (_, dec) =>
            String.fromCharCode(parseInt(dec, 10)),
        );
}
