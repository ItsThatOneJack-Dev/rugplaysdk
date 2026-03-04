import { sdkFetch } from "./sdkFetch";
import { exponentialBackoff } from "./backoff";

export async function vaaqFetch<T = any>(
    baseUrl: string,
    count: number,
): Promise<T[]> {
    if (count <= 0) return [];

    const limit = Math.min(count, 99);
    const results: T[] = [];
    let page = 1;

    while (results.length < count) {
        const separator = baseUrl.includes("?") ? "&" : "?";
        const url = `${baseUrl}${separator}limit=${limit}&page=${page}`;

        const items = await exponentialBackoff<T[]>(
            async (_step, _last, _config, _peek, accept) => {
                const res = await sdkFetch(url);

                if (res.status === 429) {
                    // Return a RATE_LIMITED-like sentinel so shouldRetry triggers
                    return { __result: "RATE_LIMITED" } as any;
                }

                if (!res.ok) {
                    accept([]);
                    return [];
                }

                const data = await res.json();
                const items: T[] = data.results ?? data.data ?? [];
                accept(items);
                return items;
            },
            {
                initialDelay: 1000,
                maxDelay: 30_000,
                maxRetries: 5,
                base: 2,
                onRetry: (step, lastBackoff, nextBackoff) => {
                    console.warn(
                        `RugplaySDK vaaqFetch: rate limited, retrying in ${nextBackoff}ms (attempt ${step + 1})`,
                    );
                },
                onAbort: () => [],
            },
        );

        if (!Array.isArray(items) || items.length === 0) break;

        results.push(...items);

        // Re-fetch to check pagination — reuse last response shape isn't available here
        // so we rely on item count to detect end of pages
        if (items.length < limit) break;
        if (results.length >= count) break;

        page++;
    }

    return results.slice(0, count);
}
