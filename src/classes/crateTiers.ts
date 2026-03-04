export interface CrateTierSentinel {
    __crateTierID: string;
}

const t = (id: string): CrateTierSentinel =>
    Object.freeze({ __crateTierID: id });

export const crateTiers = {
    STANDARD: t("standard"),
    PREMIUM: t("premium"),
    LEGENDARY: t("legendary"),
    MYTHIC: t("mythic"),
} as const;
