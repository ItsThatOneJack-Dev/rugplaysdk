const r = <T extends string>(result: T) => Object.freeze({ __result: result });

export const results = {
    SUCCESS: r("SUCCESS"),
    FAILURE: r("FAILURE"),
    RATE_LIMITED: r("RATE_LIMITED"),
    UNAUTHORIZED: r("UNAUTHORIZED"),
    FORBIDDEN: r("FORBIDDEN"),
    NOT_FOUND: r("NOT_FOUND"),
    BAD_REQUEST: r("BAD_REQUEST"),

    COINFLIP_WIN: r("COINFLIP_WIN"),
    COINFLIP_LOSS: r("COINFLIP_LOSS"),

    DICE_WIN: r("DICE_WIN"),
    DICE_LOSS: r("DICE_LOSS"),

    SLOTS_LOSS: r("SLOTS_LOSS"),
    SLOTS_2_OF_A_KIND: r("SLOTS_2_OF_A_KIND"),
    SLOTS_3_OF_A_KIND: r("SLOTS_3_OF_A_KIND"),

    MINES_SAFE: r("MINES_SAFE"),
    MINES_HIT: r("MINES_HIT"),
    MINES_COMPLETE: r("MINES_COMPLETE"),

    TOWER_SAFE: r("TOWER_SAFE"),
    TOWER_HIT: r("TOWER_HIT"),
    TOWER_COMPLETE: r("TOWER_COMPLETE"),

    // Daily rewards
    REWARD_NOT_AVAILABLE: r("REWARD_NOT_AVAILABLE"),
} as const;

export type Result = (typeof results)[keyof typeof results];
