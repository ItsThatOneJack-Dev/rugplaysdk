import { sdkFetch } from "../helpers/sdkFetch";
import { interpretResponse } from "../helpers/interpretResponse";
import { results } from "./results";
import { resolveAmount, type PercentAmount } from "../helpers/resolveAmount";
import { User } from "./User";
import type { TowerDifficultySentinel } from "./towerDifficulty";

const BASE_URL = "https://rugplay.com/api/arcade";

// -------------------------
// Mines types
// -------------------------

export interface MinesCashoutResult {
    payout: number;
    amountWagered: number;
    newBalance: number;
    minePositions: number[];
    aborted: boolean;
}

// -------------------------
// Tower types
// -------------------------

export interface TowerCashoutResult {
    payout: number;
    amountWagered: number;
    newBalance: number;
    bombPositions: number[][];
    aborted: boolean;
}

// -------------------------
// MinesGame class
// -------------------------

export class MinesGame {
    readonly sessionToken: string;
    readonly mineCount: number;
    readonly bet: number;

    private _active: boolean = true;
    private _lastMultiplier: number | null = null;
    private _autoTimeout: ReturnType<typeof setTimeout> | null = null;
    private _autoTimeoutMs: number | null;

    constructor(
        sessionToken: string,
        mineCount: number,
        bet: number,
        autoTimeoutMs: number | null,
    ) {
        this.sessionToken = sessionToken;
        this.mineCount = mineCount;
        this.bet = bet;
        this._autoTimeoutMs = autoTimeoutMs;
        this._resetTimeout();
    }

    get active(): boolean {
        return this._active;
    }
    get lastMultiplier(): number | null {
        return this._lastMultiplier;
    }

    private _resetTimeout(): void {
        if (this._autoTimeoutMs === null) return;
        if (this._autoTimeout) clearTimeout(this._autoTimeout);
        this._autoTimeout = setTimeout(async () => {
            if (this._active) {
                console.warn(
                    "RugplaySDK [Arcade]: Mines auto-cashing out due to inactivity.",
                );
                await this.cashout();
            }
        }, this._autoTimeoutMs);
    }

    private _clearTimeout(): void {
        if (this._autoTimeout) {
            clearTimeout(this._autoTimeout);
            this._autoTimeout = null;
        }
    }

    private _resolveIndex(xOrIndex: number, y?: number): number {
        if (y === undefined) return xOrIndex;
        if (xOrIndex < 0 || xOrIndex > 4 || y < 0 || y > 4)
            throw new Error(
                "RugplaySDK Arcade: Tile coordinates must be between 0 and 4.",
            );
        return y * 5 + xOrIndex;
    }

    async reveal(xOrIndex: number, y?: number): Promise<unknown> {
        if (!this._active)
            throw new Error(
                "RugplaySDK Arcade: This Mines game is no longer active.",
            );

        const tileIndex = this._resolveIndex(xOrIndex, y);

        const res = await sdkFetch(`${BASE_URL}/mines/reveal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionToken: this.sessionToken,
                tileIndex,
            }),
        });

        const err = interpretResponse(res);
        if (err) throw new Error(`RugplaySDK Arcade: Failed to reveal tile.`);

        const data = await res.json();

        if (data.hitMine) {
            this._active = false;
            this._clearTimeout();
            return results.MINES_HIT;
        }

        this._lastMultiplier = data.currentMultiplier ?? null;

        if (data.status !== "active") {
            this._active = false;
            this._clearTimeout();
            return results.MINES_COMPLETE;
        }

        this._resetTimeout();
        return results.MINES_SAFE;
    }

    async cashout(): Promise<MinesCashoutResult> {
        if (!this._active)
            throw new Error(
                "RugplaySDK Arcade: This Mines game is no longer active.",
            );

        this._clearTimeout();

        const res = await sdkFetch(`${BASE_URL}/mines/cashout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionToken: this.sessionToken }),
        });

        const err = interpretResponse(res);
        if (err) throw new Error(`RugplaySDK Arcade: Failed to cashout.`);

        const data = await res.json();
        this._active = false;

        return {
            payout: data.payout,
            amountWagered: data.amountWagered,
            newBalance: data.newBalance,
            minePositions: data.minePositions ?? [],
            aborted: data.isAbort ?? false,
        };
    }
}

// -------------------------
// TowerGame class
// -------------------------

export class TowerGame {
    readonly sessionToken: string;
    readonly difficulty: TowerDifficultySentinel;
    readonly bet: number;

    private _active: boolean = true;
    private _currentFloor: number = 0;
    private _lastMultiplier: number | null = null;
    private _autoTimeout: ReturnType<typeof setTimeout> | null = null;
    private _autoTimeoutMs: number | null;

    constructor(
        sessionToken: string,
        difficulty: TowerDifficultySentinel,
        bet: number,
        autoTimeoutMs: number | null,
    ) {
        this.sessionToken = sessionToken;
        this.difficulty = difficulty;
        this.bet = bet;
        this._autoTimeoutMs = autoTimeoutMs;
        this._resetTimeout();
    }

    get active(): boolean {
        return this._active;
    }
    get currentFloor(): number {
        return this._currentFloor;
    }
    get lastMultiplier(): number | null {
        return this._lastMultiplier;
    }

    private _resetTimeout(): void {
        if (this._autoTimeoutMs === null) return;
        if (this._autoTimeout) clearTimeout(this._autoTimeout);
        this._autoTimeout = setTimeout(async () => {
            if (this._active) {
                console.warn(
                    "RugplaySDK [Arcade]: Tower auto-cashing out due to inactivity.",
                );
                await this.cashout();
            }
        }, this._autoTimeoutMs);
    }

    private _clearTimeout(): void {
        if (this._autoTimeout) {
            clearTimeout(this._autoTimeout);
            this._autoTimeout = null;
        }
    }

    async reveal(tileIndex: number): Promise<unknown> {
        if (!this._active)
            throw new Error(
                "RugplaySDK Arcade: This Tower game is no longer active.",
            );

        if (tileIndex < 0 || tileIndex > 2)
            throw new Error(
                "RugplaySDK Arcade: Tower tile index must be 0, 1, or 2.",
            );

        const res = await sdkFetch(`${BASE_URL}/tower/step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionToken: this.sessionToken,
                tileIndex,
            }),
        });

        const err = interpretResponse(res);
        if (err)
            throw new Error(`RugplaySDK Arcade: Failed to reveal tower tile.`);

        const data = await res.json();

        if (data.hitBomb) {
            this._active = false;
            this._clearTimeout();
            return results.TOWER_HIT;
        }

        this._currentFloor = data.currentFloor;
        this._lastMultiplier = data.currentMultiplier ?? null;

        // All 10 floors cleared
        if (data.status !== "active") {
            this._active = false;
            this._clearTimeout();
            return results.TOWER_COMPLETE;
        }

        this._resetTimeout();
        return results.TOWER_SAFE;
    }

    async cashout(): Promise<TowerCashoutResult> {
        if (!this._active)
            throw new Error(
                "RugplaySDK Arcade: This Tower game is no longer active.",
            );

        this._clearTimeout();

        const res = await sdkFetch(`${BASE_URL}/tower/cashout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionToken: this.sessionToken }),
        });

        const err = interpretResponse(res);
        if (err) throw new Error(`RugplaySDK Arcade: Failed to cashout tower.`);

        const data = await res.json();
        this._active = false;

        return {
            payout: data.payout,
            amountWagered: data.amountWagered,
            newBalance: data.newBalance,
            bombPositions: data.allBombPositions ?? [],
            aborted: data.isAbort ?? false,
        };
    }
}

// -------------------------
// Arcade singleton
// -------------------------

class ArcadeSingleton {
    async coinflip(amount: number | PercentAmount): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(`${BASE_URL}/coinflip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ side: "heads", amount: resolved }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.won ? results.COINFLIP_WIN : results.COINFLIP_LOSS;
    }

    async dice(amount: number | PercentAmount): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(`${BASE_URL}/dice`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedNumber: 1, amount: resolved }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.won ? results.DICE_WIN : results.DICE_LOSS;
    }

    async slots(amount: number | PercentAmount): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(`${BASE_URL}/slots`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: resolved }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        if (!data.won) return results.SLOTS_LOSS;
        if (data.winType === "3 OF A KIND") return results.SLOTS_3_OF_A_KIND;
        return results.SLOTS_2_OF_A_KIND;
    }

    async mines(
        amount: number | PercentAmount,
        autoTimeoutMs: number | null = 10000,
        mineCount: number = 3,
    ): Promise<MinesGame> {
        if (mineCount < 3 || mineCount > 24)
            throw new Error(
                "RugplaySDK Arcade: mineCount must be between 3 and 24.",
            );

        const me = await User.me();
        if (!me)
            throw new Error(
                "RugplaySDK Arcade: Could not resolve current user.",
            );
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0)
            throw new Error("RugplaySDK Arcade: Bet amount cannot be 0.");

        const res = await sdkFetch(`${BASE_URL}/mines/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ betAmount: resolved, mineCount }),
        });

        const err = interpretResponse(res);
        if (err)
            throw new Error(`RugplaySDK Arcade: Failed to start Mines game.`);

        const data = await res.json();
        return new MinesGame(
            data.sessionToken,
            mineCount,
            resolved,
            autoTimeoutMs,
        );
    }

    async tower(
        amount: number | PercentAmount,
        difficulty: TowerDifficultySentinel,
        autoTimeoutMs: number | null = 10000,
    ): Promise<TowerGame> {
        const me = await User.me();
        if (!me)
            throw new Error(
                "RugplaySDK Arcade: Could not resolve current user.",
            );
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0)
            throw new Error("RugplaySDK Arcade: Bet amount cannot be 0.");

        const res = await sdkFetch(`${BASE_URL}/tower/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                betAmount: resolved,
                difficulty: difficulty.id,
            }),
        });

        const err = interpretResponse(res);
        if (err)
            throw new Error(`RugplaySDK Arcade: Failed to start Tower game.`);

        const data = await res.json();
        return new TowerGame(
            data.sessionToken,
            difficulty,
            resolved,
            autoTimeoutMs,
        );
    }
}

export const Arcade = new ArcadeSingleton();
