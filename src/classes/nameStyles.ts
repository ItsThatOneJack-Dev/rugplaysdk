export interface NameStyleSentinel {
    readonly __nameStyle: string;
}

const createStyle = (key: string): NameStyleSentinel =>
    Object.freeze({ __nameStyle: key });

export const nameStyles = {
    NONE: Object.freeze({ __nameStyle: "" }) as NameStyleSentinel,
    GREEN: createStyle("green"),
    BLUE: createStyle("blue"),
    ORANGE: createStyle("orange"),
    PURPLE: createStyle("purple"),
    RED: createStyle("red"),
    GOLD: createStyle("gold"),
    DEGEN: createStyle("degen"),
    OCEAN: createStyle("ocean"),
    RAINBOW: createStyle("rainbow"),
    DIAMOND: createStyle("diamond"),
} as const;

export type NameStyles = typeof nameStyles;
export type NameStyleKey = keyof NameStyles;

export function resolveNameStyle(
    nameColor: string | null,
): NameStyleSentinel | null {
    if (!nameColor) return null;
    return (
        Object.values(nameStyles).find((s) => s.__nameStyle === nameColor) ??
        null
    );
}
