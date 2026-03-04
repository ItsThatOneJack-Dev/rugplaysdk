import { sdkFetch } from "../helpers/sdkFetch";
import { cache } from "../helpers/cache";

import { NameStyleSentinel, resolveNameStyle } from "./nameStyles";
import { interpretResponse } from "../helpers/interpretResponse";
import { results } from "./results";
import { resolveAmount, type PercentAmount } from "../helpers/resolveAmount";
import { Coin } from "./Coin";
import CoinFactory from "./Coin";
import { Channel } from "./Channel";
import { RugpayRequest } from "./RugpayRequest";
import { decodeSvelteData } from "../helpers/decodeSvelteData";
import { composeGeckoForm } from "../helpers/composeGeckoForm";
import { vaaqFetch } from "../helpers/vaaqFetch";
import type { CrateTierSentinel } from "./crateTiers";
import { achievements, AchievementSentinel } from "./achievements";
import {
    getDailyRewardStatus,
    claimDailyReward,
    type DailyRewardStatus,
    type DailyRewardResult,
} from "./DailyReward";
import { exponentialBackoff } from "../helpers/backoff";
import { baseUrl } from "../helpers/baseURL";

const S3_PROXY = baseUrl("/api/proxy/s3/");
const DATA_URL = (id: string | number) =>
    baseUrl(`/user/${id}/__data.json?x-sveltekit-invalidated=11`);
const EQUIP_URL = baseUrl("/api/shop/equip");
const INVENTORY_URL = baseUrl("/api/shop/inventory");
const CRATE_URL = baseUrl("/api/shop/crate");

export interface UserData {
    id: number;
    name: string;
    username: string;
    email?: string | null;
    image?: string | null;
    bio?: string | null;
    baseCurrencyBalance?: number;
    isAdmin?: boolean;
    prestigeLevel?: number;
}

export interface Inventory {
    gems: number;
    ownedNameStyles: NameStyleSentinel[];
}

export interface CrateCashReward {
    type: "cash";
    amount: number;
    newGems: number;
}

export interface CrateNameStyleReward {
    type: "nameStyle";
    style: NameStyleSentinel | null;
    label: string;
    rarity: string;
    alreadyOwned: boolean;
    newGems: number;
}

export type CrateReward = CrateCashReward | CrateNameStyleReward;

export interface HoldingData {
    symbol: string;
    iconUrl: string | null;
    quantity: number;
    currentPrice: number;
    value: number;
    change24h: number;
    avgPurchasePrice: number;
    percentageChange: number;
    costBasis: number;
}

export interface UserAchievement {
    achievement: AchievementSentinel;
    unlocked: boolean;
    unlockedAt: Date | null;
    claimed: boolean;
    progress: number | null;
    targetValue: number | null;
}

export interface BuyTransaction {
    type: "BUY";
    id: number | null;
    symbol: string;
    price: number;
    quantity: number;
    totalValue: number;
    timestamp: Date;
    user: User | null;
}

export interface SellTransaction {
    type: "SELL";
    id: number | null;
    symbol: string;
    price: number;
    quantity: number;
    totalValue: number;
    timestamp: Date;
    user: User | null;
}

export interface RugpayTransaction {
    type: "RUGPAY";
    id: string;
    amount: number;
    creatorUsername: string;
    recipientUsername: string | null;
    payerUsername: string | null;
    status: string;
    createdAt: Date;
    creator: User | null;
    recipient: User | null;
}

export interface PrestigeSuccess {
    success: true;
    newPrestigeLevel: number;
    costPaid: number;
    coinsSold: number;
    totalSaleValue: number;
    message: string;
}

export interface PrestigeError {
    success: false;
    error: string;
}

export interface PrestigeInfo {
    prestigeLevel: number;
    totalPortfolioValue: number;
    baseCurrencyBalance: number;
    holdingsValue: number;
    holdingsCount: number;
}

export type PrestigeResult = PrestigeSuccess | PrestigeError;

export type TradeTransaction = BuyTransaction | SellTransaction;
export type AnyTransaction =
    | BuyTransaction
    | SellTransaction
    | RugpayTransaction;

export interface AchievementFilters {
    unlocked?: boolean;
    claimed?: boolean;
    category?: string;
    difficulty?: string;
}

export class User {
    readonly id: number;
    readonly displayName: string;
    readonly username: string;
    readonly email: string | null;
    readonly avatarUrl: string | null;
    readonly bio: string;
    readonly balance: number;
    readonly isAdmin: boolean;
    readonly prestigeLevel: number;
    private _isCurrentUserCache: boolean | null = null;

    constructor(data: UserData) {
        this.id = data.id;
        this.displayName = data.name;
        this.username = data.username;
        this.email = data.email ?? null;
        this.avatarUrl = data.image ? `${S3_PROXY}${data.image}` : null;
        this.bio = data.bio ?? "";
        this.balance = data.baseCurrencyBalance ?? 0;
        this.isAdmin = data.isAdmin ?? false;
        this.prestigeLevel = data.prestigeLevel ?? 0;
        this._isCurrentUserCache = null;
    }

    toJSON() {
        return {
            id: this.id,
            displayName: this.displayName,
            username: this.username,
            email: this.email,
            avatarUrl: this.avatarUrl,
            bio: this.bio,
            balance: this.balance,
            isAdmin: this.isAdmin,
            prestigeLevel: this.prestigeLevel,
        };
    }

    toString(): string {
        return `User(${this.username}#${this.id})`;
    }

    async getCreatedCoins(): Promise<Coin[]> {
        return Coin.byCreator(this);
    }

    // Fetch and decode node 1 profile data for a given user
    static async _fetch(idOrUsername: string | number): Promise<User | null> {
        const key = `user:${idOrUsername}`;
        const cached = cache.get<User>(key);
        if (cached) return cached;

        const user = await exponentialBackoff<User | null>(
            async (_step, _last, _config, _peek, accept) => {
                const res = await sdkFetch(DATA_URL(idOrUsername));
                if (res.status === 429)
                    return { __result: "RATE_LIMITED" } as any;
                if (!res.ok) {
                    accept(null);
                    return null;
                }

                const json = await res.json();
                const decoded = (await decodeSvelteData(json, 1)) as any;
                if (!decoded?.profileData?.profile) {
                    accept(null);
                    return null;
                }

                const user = new User(decoded.profileData.profile);
                accept(user);
                return user;
            },
            { initialDelay: 1000, maxDelay: 30_000, maxRetries: 5, base: 2 },
        );

        if (user) cache.set(key, user);
        return user;
    }

    // Fetch and decode node 0 session data
    private static async _fetchSession(): Promise<User | null> {
        const res = await sdkFetch(DATA_URL(300));
        if (!res.ok) return null;

        const json = await res.json();
        const decoded = (await decodeSvelteData(json, 0)) as any;
        if (!decoded?.userSession) return null;

        return new User(decoded.userSession);
    }

    async isCurrentUser(): Promise<boolean> {
        if (this._isCurrentUserCache !== null) return this._isCurrentUserCache;
        const me = await User.me();
        this._isCurrentUserCache = me?.id === this.id;
        return this._isCurrentUserCache;
    }

    async getDailyRewardStatus(): Promise<DailyRewardStatus | null> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getDailyRewardStatus can only be called on the current user.",
            );
        return getDailyRewardStatus();
    }

    async claimDailyReward(): Promise<DailyRewardResult | unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: claimDailyReward can only be called on the current user.",
            );
        return claimDailyReward();
    }

    async prestige(): Promise<PrestigeResult | PrestigeError | unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: prestige can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/prestige"), {
            method: "POST",
        });

        if (res.status === 400) {
            const data = await res.json();
            return {
                success: false,
                error: data.error ?? "Prestige failed.",
            } satisfies PrestigeError;
        }

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        if (!data.success) return results.FAILURE;

        return {
            success: true,
            newPrestigeLevel: data.newPrestigeLevel,
            costPaid: data.costPaid,
            coinsSold: data.coinsSold,
            totalSaleValue: data.totalSaleValue,
            message: data.message,
        } satisfies PrestigeResult;
    }

    async getPrestigeInfo(): Promise<PrestigeInfo | null> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getPrestigeInfo can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/prestige"));
        if (!res.ok) return null;

        const data = await res.json();
        const profile = data.profile;
        const stats = data.stats;

        return {
            prestigeLevel: profile.prestigeLevel,
            totalPortfolioValue: stats.totalPortfolioValue,
            baseCurrencyBalance: stats.baseCurrencyBalance,
            holdingsValue: stats.holdingsValue,
            holdingsCount: stats.holdingsCount,
        };
    }

    async getAchievements(
        filters: AchievementFilters = {},
    ): Promise<UserAchievement[]> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getAchievements can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/achievements"));
        if (!res.ok) return [];

        const data = await res.json();

        let mapped: UserAchievement[] = (data.achievements ?? []).map(
            (a: any): UserAchievement => {
                const sentinel = achievements.getByID(a.id);
                return {
                    achievement: sentinel ?? {
                        __achievement: true,
                        id: a.id,
                        name: a.name,
                        description: a.description,
                        category: a.category,
                        difficulty: a.difficulty,
                        cashReward: a.cashReward,
                        gemReward: a.gemReward,
                        derivedId: a.name
                            .toLowerCase()
                            .replace(/[^a-z0-9 ]/g, "")
                            .trim()
                            .replace(/ +/g, "_"),
                    },
                    unlocked: a.unlocked,
                    unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : null,
                    claimed: a.claimed,
                    progress: a.progress ?? null,
                    targetValue: a.targetValue ?? null,
                };
            },
        );

        if (filters.unlocked !== undefined)
            mapped = mapped.filter((r) => r.unlocked === filters.unlocked);

        if (filters.claimed !== undefined)
            mapped = mapped.filter((r) => r.claimed === filters.claimed);

        if (filters.category !== undefined)
            mapped = mapped.filter(
                (r) =>
                    r.achievement.category === filters.category!.toLowerCase(),
            );

        if (filters.difficulty !== undefined)
            mapped = mapped.filter(
                (r) =>
                    r.achievement.difficulty ===
                    filters.difficulty!.toLowerCase(),
            );

        return mapped;
    }

    async openCrate(tier: CrateTierSentinel): Promise<CrateReward | unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: openCrate can only be called on the current user.",
            );

        const res = await sdkFetch(CRATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tier: tier.__crateTierID }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        const reward = data.reward;

        if (reward.type === "buss") {
            return {
                type: "cash",
                amount: reward.bussAmount,
                newGems: data.newGems,
            } satisfies CrateCashReward;
        }

        if (reward.type === "color") {
            return {
                type: "nameStyle",
                style: resolveNameStyle(reward.colorKey),
                label: reward.colorLabel,
                rarity: reward.colorRarity,
                alreadyOwned: reward.alreadyOwned,
                newGems: data.newGems,
            } satisfies CrateNameStyleReward;
        }

        return results.FAILURE;
    }

    async equipNameStyle(style: NameStyleSentinel): Promise<unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: equipNameStyle can only be called on the current user.",
            );

        const res = await sdkFetch(EQUIP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                itemType: "namecolor",
                itemKey: style.__nameStyle,
            }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    async unequipNameStyle(): Promise<unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: unequipNameStyle can only be called on the current user.",
            );

        const res = await sdkFetch(EQUIP_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                itemType: "namecolor",
                itemKey: null,
            }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    async getInventory(): Promise<Inventory> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getInventory can only be called on the current user.",
            );

        const res = await sdkFetch(INVENTORY_URL);
        if (!res.ok) return { gems: 0, ownedNameStyles: [] };
        const data = await res.json();

        const ownedNameStyles = (data.nameColors ?? [])
            .map((key: string) => resolveNameStyle(key))
            .filter(
                (s: NameStyleSentinel | null): s is NameStyleSentinel =>
                    s !== null,
            );

        return {
            gems: data.gems ?? 0,
            ownedNameStyles,
        };
    }

    async getOwnedNameStyles(): Promise<NameStyleSentinel[]> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getOwnedNameStyles can only be called on the current user.",
            );

        const res = await sdkFetch(INVENTORY_URL);
        if (!res.ok) return [];
        const data = await res.json();

        return (data.nameColors ?? [])
            .map((key: string) => resolveNameStyle(key))
            .filter(
                (s: NameStyleSentinel | null): s is NameStyleSentinel =>
                    s !== null,
            );
    }

    async getBalance(): Promise<number> {
        return this.balance;
    }

    async getEquippedNameStyle(): Promise<NameStyleSentinel | null> {
        const res = await sdkFetch(DATA_URL(this.username));
        if (!res.ok) return null;

        const json = await res.json();
        const decoded = (await decodeSvelteData(json, 1)) as any;
        const nameColor = decoded?.profileData?.profile?.nameColor ?? null;
        return resolveNameStyle(nameColor);
    }

    async getNetWorth(): Promise<number> {
        const res = await sdkFetch(baseUrl(`/api/portfolio/${this.username}`));
        if (!res.ok) return 0;
        const data = await res.json();
        return data.totalValue ?? 0;
    }

    async getGems(): Promise<number> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getGems can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/shop/inventory"));
        if (!res.ok) return 0;
        const data = await res.json();
        return data.gems ?? 0;
    }

    async getIlliquid(): Promise<number> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getIlliquid can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/portfolio/total"));
        if (!res.ok) return 0;
        const data = await res.json();
        return data.totalValue - (data.baseCurrencyBalance ?? 0);
    }

    async getHeldAmount(symbol: string): Promise<number> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                `RugplaySDK: getHeldAmount can only be called on the current user.`,
            );

        const res = await sdkFetch(baseUrl("/api/portfolio/total"));
        if (!res.ok) return 0;
        const data = await res.json();
        const holding = (data.coinHoldings ?? []).find(
            (h: any) => h.symbol === symbol.toUpperCase(),
        );
        return holding?.quantity ?? 0;
    }

    async getHoldings(): Promise<Record<string, HoldingData>> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: getHoldings can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/portfolio/total"));
        if (!res.ok) return {};
        const data = await res.json();

        const holdings: Record<string, HoldingData> = {};
        for (const h of data.coinHoldings ?? []) {
            holdings[h.symbol] = {
                symbol: h.symbol,
                iconUrl: h.icon ? `${S3_PROXY}${h.icon}` : null,
                quantity: h.quantity,
                currentPrice: h.currentPrice,
                value: h.value,
                change24h: h.change24h,
                avgPurchasePrice: h.avgPurchasePrice,
                percentageChange: h.percentageChange,
                costBasis: h.costBasis,
            };
        }
        return holdings;
    }

    async claimAchievement(
        achievement: AchievementSentinel,
    ): Promise<{ cashReward: number; gemReward: number } | unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: claimAchievement can only be called on the current user.",
            );

        const res = await sdkFetch(baseUrl("/api/achievements/claim"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ achievementId: achievement.id }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        if (!data.claimed) return results.FAILURE;

        return { cashReward: data.cashReward, gemReward: data.gemReward };
    }

    // -------------------------
    // Static factory methods
    // -------------------------

    // User.me() — returns the currently logged-in user
    static async me(): Promise<User | null> {
        return User._fetchSession();
    }

    // User.creatorOf(symbol) — returns the creator of a coin
    static async creatorOf(
        symbolOrCoin: string | InstanceType<any>,
    ): Promise<User | null> {
        if (typeof symbolOrCoin === "string") {
            const coin = await (CoinFactory as any)(symbolOrCoin);
            return coin?.creator ?? null;
        }
        // Already a Coin object
        return symbolOrCoin.creator ?? null;
    }

    // -------------------------
    // Instance methods
    // -------------------------

    async updateProfile({
        displayName,
        username,
        bio,
    }: {
        displayName?: string;
        username?: string;
        bio?: string;
    } = {}): Promise<unknown> {
        if (!(await this.isCurrentUser()))
            throw new Error(
                "RugplaySDK: updateProfile can only be called on the current user.",
            );

        // Use current values for any fields not provided
        const { body, contentType } = composeGeckoForm({
            name: displayName ?? this.displayName,
            username: username ?? this.username,
            bio: bio ?? this.bio,
        });

        const res = await sdkFetch(baseUrl("/api/settings"), {
            method: "POST",
            headers: { "Content-Type": contentType },
            body,
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    // Returns a fresh User with updated data
    async refresh(): Promise<User | null> {
        return User._fetch(this.username);
    }

    async sendCash(amount: number | PercentAmount): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        me.refresh();
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(baseUrl("/api/transfer"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                recipientUsername: this.username,
                type: "CASH",
                amount: resolved,
            }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    async sendCoin(
        amount: number | PercentAmount,
        coin: Coin,
    ): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        me.refresh();
        const held = await me.getHeldAmount(coin.symbol);
        const resolved = resolveAmount(amount, held);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(baseUrl("/api/transfer"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                recipientUsername: this.username,
                type: "COIN",
                amount: resolved,
                coinSymbol: coin.symbol,
            }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    async sendMessage(content: string): Promise<unknown> {
        const channel = await Channel.withUser(this);
        return channel.sendMessage(content);
    }

    async sendRugpay(amount: number): Promise<RugpayRequest> {
        const channel = await Channel.withUser(this);
        return channel.sendRugpay(amount);
    }

    async getTransactionHistory(
        count: number = 50,
        type: "BUY" | "SELL" | null = null,
    ): Promise<TradeTransaction[]> {
        let url = `https://api.vaaq.dev/rugplay/v1/search/?username=${this.username}`;
        if (type != null) url += `&type=${type}`;

        const raw = await vaaqFetch<any>(url, count);

        const mapped = await Promise.all(
            raw.map(async (t): Promise<TradeTransaction> => {
                const user = await User._fetch(String(t.userId));
                const base = {
                    id: t.id,
                    symbol: t.symbol,
                    price: t.price,
                    quantity: t.quantity,
                    totalValue: t.totalValue,
                    timestamp: new Date(t.timestamp),
                    user,
                };
                return t.type === "BUY"
                    ? { type: "BUY", ...base }
                    : { type: "SELL", ...base };
            }),
        );

        // Filter client-side since vaaq may not honour the type param
        return type !== null ? mapped.filter((tx) => tx.type === type) : mapped;
    }

    async getRugpayTransactions(
        count: number = 50,
        filters: { status?: string | null; sender?: string | null } = {},
    ): Promise<RugpayTransaction[]> {
        const params: string[] = [`creator=${this.username}`];
        if (filters.status != null) params.push(`status=${filters.status}`);
        if (filters.sender != null) params.push(`sender=${filters.sender}`);

        const url = `https://api.vaaq.dev/rugpay/v1/transactions?${params.join("&")}`;
        const raw = await vaaqFetch<any>(url, count);

        return Promise.all(
            raw.map(async (t): Promise<RugpayTransaction> => {
                const creator = await User._fetch(t.creator_username);
                const recipient = t.recipient_username
                    ? await User._fetch(t.recipient_username)
                    : null;

                return {
                    type: "RUGPAY",
                    id: t.id,
                    amount: t.amount,
                    creatorUsername: t.creator_username,
                    recipientUsername: t.recipient_username ?? null,
                    payerUsername: t.payer_username ?? null,
                    status: t.status,
                    createdAt: new Date(t.created_at.replace(" ", "T")),
                    creator,
                    recipient,
                };
            }),
        );
    }
}

// Proxy so User("itoj") and User(300) work as factory calls
export default new Proxy(User, {
    apply(_Target, _thisArg, [idOrUsername]: [string | number]) {
        return User["_fetch"](idOrUsername);
    },
});
