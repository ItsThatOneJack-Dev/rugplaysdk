export interface PercentAmount {
    readonly __percent: number;
}

export function percent(value: number): PercentAmount {
    if (value < 0 || value > 100)
        throw new Error("RugplaySDK: percent() must be between 0 and 100.");
    return Object.freeze({ __percent: value });
}

export function isPercentAmount(value: unknown): value is PercentAmount {
    return (
        typeof value === "object" &&
        value !== null &&
        Object.isFrozen(value) &&
        "__percent" in value &&
        typeof (value as PercentAmount).__percent === "number"
    );
}

export function resolveAmount(
    amount: number | PercentAmount,
    total: number,
): number {
    if (typeof amount === "number") return amount;

    if (isPercentAmount(amount)) {
        if (amount.__percent === 0) return 0;
        return total * (amount.__percent / 100);
    }

    throw new Error(
        "RugplaySDK: Invalid amount — must be a number or a percent() value.",
    );
}
