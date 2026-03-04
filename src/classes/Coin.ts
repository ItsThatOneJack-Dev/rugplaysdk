import { sdkFetch } from "../helpers/sdkFetch";
import { cache } from "../helpers/cache";

import { decodeSvelteData } from "../helpers/decodeSvelteData";
import { interpretResponse } from "../helpers/interpretResponse";
import { resolveAmount, type PercentAmount } from "../helpers/resolveAmount";
import { results } from "./results";
import { User } from "./User";
import UserFactory from "./User";
import { Comment } from "./Comment";
import { exponentialBackoff } from "../helpers/backoff";
import { warn } from "../helpers/log";
import { baseUrl } from "../helpers/baseURL";

const S3_PROXY = baseUrl("/api/proxy/s3/");
const DATA_URL = (symbol: string) =>
    baseUrl(`/coin/${symbol}/__data.json?x-sveltekit-invalidated=11`);
const USER_DATA_URL = (id: string | number) =>
    baseUrl(`/user/${id}/__data.json?x-sveltekit-invalidated=11`);

export interface CoinData {
    id: number;
    name: string;
    symbol: string;
    icon?: string | null;
    currentPrice: number | string;
    marketCap: number | string;
    volume24h: number | string;
    change24h: number | string;
    circulatingSupply?: number;
    isListed?: boolean;
    createdAt?: string | null;
    creatorId?: number | null;
}

export interface HolderEntry {
    rank: number;
    username: string;
    name: string;
    avatarUrl: string | null;
    quantity: number;
    percentage: number;
    liquidationValue: number;
    user: User | null;
}

export interface HoldersResult {
    totalHolders: number;
    circulatingSupply: number;
    currentPrice: number;
    holders: HolderEntry[];
}

export class Coin {
    readonly id: number;
    readonly name: string;
    readonly symbol: string;
    readonly iconUrl: string | null;
    readonly currentPrice: number;
    readonly marketCap: number;
    readonly volume24h: number;
    readonly change24h: number;
    readonly circulatingSupply: number;
    readonly isListed: boolean;
    readonly createdAt: Date | null;
    readonly creator: User | null;

    constructor(data: CoinData, creator: User | null = null) {
        this.id = data.id;
        this.name = data.name;
        this.symbol = data.symbol.toUpperCase();
        this.iconUrl = data.icon ? `${S3_PROXY}${data.icon}` : null;
        this.currentPrice = parseFloat(String(data.currentPrice));
        this.marketCap = parseFloat(String(data.marketCap));
        this.volume24h = parseFloat(String(data.volume24h));
        this.change24h = parseFloat(String(data.change24h));
        this.circulatingSupply = data.circulatingSupply ?? 0;
        this.isListed = data.isListed ?? false;
        this.createdAt = data.createdAt ? new Date(data.createdAt) : null;
        this.creator = creator;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            symbol: this.symbol,
            iconUrl: this.iconUrl,
            currentPrice: this.currentPrice,
            marketCap: this.marketCap,
            volume24h: this.volume24h,
            change24h: this.change24h,
            circulatingSupply: this.circulatingSupply,
            isListed: this.isListed,
            createdAt: this.createdAt,
            creator: this.creator?.toJSON() ?? null,
        };
    }

    toString(): string {
        return `Coin(${this.symbol}: ${this.name})`;
    }

    // -------------------------
    // Internal fetch
    // -------------------------

    static async _fetch(symbol: string): Promise<Coin | null> {
        const key = `coin:${symbol.toUpperCase().replace("*", "")}`;
        const cached = cache.get<Coin>(key);
        if (cached) return cached;

        const coin = await exponentialBackoff<Coin | null>(
            async (_step, _last, _config, _peek, accept) => {
                const res = await sdkFetch(DATA_URL(symbol.toUpperCase()));
                if (res.status === 429)
                    return { __result: "RATE_LIMITED" } as any;
                if (!res.ok) {
                    accept(null);
                    return null;
                }

                const json = await res.json();
                const decoded = (await decodeSvelteData(json, 1)) as any;
                if (!decoded?.coin) {
                    accept(null);
                    return null;
                }

                const c = decoded.coin;
                const creator = c.creatorId
                    ? ((await (UserFactory as any)(c.creatorId)) as User | null)
                    : null;

                const coin = new Coin(c, creator);
                accept(coin);
                return coin;
            },
            {
                initialDelay: 1000,
                maxDelay: 30_000,
                maxRetries: 5,
                base: 2,
                onRetry: (step, _last, nextBackoff) => {
                    warn(
                        `rate limited fetching ${symbol}, retrying in ${nextBackoff}ms (attempt ${step + 1})`,
                        "Coin",
                    );
                },
                onAbort: () => null,
            },
        );

        if (coin) cache.set(key, coin);
        return coin;
    }

    // -------------------------
    // Static factory methods
    // -------------------------

    static async byCreator(userOrUsername: User | string): Promise<Coin[]> {
        const username = (
            typeof userOrUsername === "string"
                ? userOrUsername
                : userOrUsername.username
        )
            .toLowerCase()
            .replace("@", "");

        const res = await sdkFetch(USER_DATA_URL(username));
        const json = await res.json();
        const decoded = (await decodeSvelteData(json, 1)) as any;

        return (decoded.profileData.createdCoins ?? []).map(
            (c: CoinData) =>
                new Coin(
                    c,
                    typeof userOrUsername === "string" ? null : userOrUsername,
                ),
        );
    }

    // -------------------------
    // Maths
    // -------------------------

    dollarsToCoins(dollars: number): number {
        return dollars / this.currentPrice;
    }

    coinsToDollars(coins: number): number {
        return coins * this.currentPrice;
    }

    predictPrice(percentChange: number): number {
        return this.currentPrice * (1 + percentChange / 100);
    }

    predictMarketCap(percentChange: number): number {
        return this.marketCap * (1 + percentChange / 100);
    }

    supplyPercent(coins: number): number {
        return (coins / this.circulatingSupply) * 100;
    }

    coinsForSupplyPercent(percent: number): number {
        return this.circulatingSupply * (percent / 100);
    }

    priceAtMarketCap(targetMarketCap: number): number {
        return targetMarketCap / this.circulatingSupply;
    }

    marketCapAtPrice(targetPrice: number): number {
        return targetPrice * this.circulatingSupply;
    }

    predictHoldingsValue(coins: number, percentChange: number): number {
        return coins * this.predictPrice(percentChange);
    }

    // -------------------------
    // Actions
    // -------------------------

    async getHolders(limit: number = 50): Promise<HoldersResult> {
        const res = await sdkFetch(
            baseUrl(`/api/coin/${this.symbol}/holders?limit=${limit}`),
        );
        if (!res.ok)
            return {
                totalHolders: 0,
                circulatingSupply: this.circulatingSupply,
                currentPrice: this.currentPrice,
                holders: [],
            };

        const data = await res.json();

        const holders: HolderEntry[] = (data.holders ?? []).map(
            (h: any): HolderEntry => ({
                rank: h.rank,
                username: h.username,
                name: h.name,
                avatarUrl: h.image ? `${S3_PROXY}${h.image}` : null,
                quantity: h.quantity,
                percentage: h.percentage,
                liquidationValue: h.liquidationValue,
                user: null,
            }),
        );

        for (let i = 0; i < holders.length; i++) {
            User._fetch((data.holders[i] as any).userId).then((user) => {
                holders[i].user = user;
            });
        }

        return {
            totalHolders: data.totalHolders,
            circulatingSupply: data.circulatingSupply,
            currentPrice: data.poolInfo?.currentPrice ?? this.currentPrice,
            holders,
        };
    }

    async refresh(): Promise<Coin | null> {
        return Coin._fetch(this.symbol);
    }

    async buy(amount: number | PercentAmount): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        me.refresh();
        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(baseUrl(`/api/coin/${this.symbol}/trade`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "BUY", amount: resolved }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    async sell(amount: number | PercentAmount): Promise<unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;
        me.refresh();
        const held = await me.getHeldAmount(this.symbol);
        const resolved = resolveAmount(amount, held);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(baseUrl(`/api/coin/${this.symbol}/trade`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "SELL", amount: resolved }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.success ? results.SUCCESS : results.FAILURE;
    }

    async comment(content: string): Promise<unknown> {
        const res = await sdkFetch(
            baseUrl(`/api/coin/${this.symbol}/comments`),
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            },
        );

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        return data.comment ? results.SUCCESS : results.FAILURE;
    }

    async getComments(): Promise<Comment[]> {
        const res = await sdkFetch(
            baseUrl(`/api/coin/${this.symbol}/comments`),
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.comments ?? []).map(
            (c: any) => new Comment(c, this.symbol),
        );
    }
}

// Proxy so Coin("CATBOI") works as a factory call
export default new Proxy(Coin, {
    apply(_Target, _thisArg, [symbol]: [string]) {
        return Coin["_fetch"](symbol);
    },
});
