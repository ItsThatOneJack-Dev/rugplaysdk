import { baseUrl } from "../helpers/baseURL";
import { sdkFetch } from "../helpers/sdkFetch";
import { User } from "./User";

const LEADERBOARD_URL = baseUrl("/api/leaderboard?search=&offset=0");
const S3_PROXY = baseUrl("/api/proxy/s3/");

// -------------------------
// Entry types
// -------------------------

export interface RugpullerEntry {
    username: string;
    name: string;
    avatarUrl: string | null;
    totalSold: number;
    totalBought: number;
    totalExtracted: number;
    user: User | null;
}

export interface BiggestLoserEntry {
    username: string;
    name: string;
    avatarUrl: string | null;
    moneySpent: number;
    moneyReceived: number;
    currentValue: number;
    totalLoss: number;
    user: User | null;
}

export interface CashKingEntry {
    username: string;
    name: string;
    avatarUrl: string | null;
    balance: number;
    coinValue: number;
    totalPortfolio: number;
    liquidityRatio: number;
    user: User | null;
}

export interface PaperMillionaireEntry {
    username: string;
    name: string;
    avatarUrl: string | null;
    balance: number;
    coinValue: number;
    totalPortfolio: number;
    liquidityRatio: number;
    user: User | null;
}

export interface Leaderboards {
    rugpullers: RugpullerEntry[];
    biggestLosers: BiggestLoserEntry[];
    cashKings: CashKingEntry[];
    paperMillionaires: PaperMillionaireEntry[];
}

// -------------------------
// Helpers
// -------------------------

function resolveAvatarUrl(image: string | null): string | null {
    return image ? `${S3_PROXY}${image}` : null;
}

function resolveEntryUsers<T extends { user: User | null }>(
    entries: T[],
    userIds: number[],
): void {
    for (let i = 0; i < entries.length; i++) {
        const userId = userIds[i];
        if (!userId) continue;
        User._fetch(userId).then((user) => {
            entries[i].user = user;
        });
    }
}

// -------------------------
// Leaderboard singleton
// -------------------------

class LeaderboardSingleton {
    async fetch(): Promise<Leaderboards> {
        const res = await sdkFetch(LEADERBOARD_URL);
        if (!res.ok)
            return {
                rugpullers: [],
                biggestLosers: [],
                cashKings: [],
                paperMillionaires: [],
            };

        const data = await res.json();

        const rugpullers: RugpullerEntry[] = (data.topRugpullers ?? []).map(
            (e: any): RugpullerEntry => ({
                username: e.username,
                name: e.name,
                avatarUrl: resolveAvatarUrl(e.image),
                totalSold: parseFloat(e.totalSold),
                totalBought: parseFloat(e.totalBought),
                totalExtracted: e.totalExtracted,
                user: null,
            }),
        );

        const biggestLosers: BiggestLoserEntry[] = (
            data.biggestLosers ?? []
        ).map(
            (e: any): BiggestLoserEntry => ({
                username: e.username,
                name: e.name,
                avatarUrl: resolveAvatarUrl(e.image),
                moneySpent: e.moneySpent,
                moneyReceived: e.moneyReceived,
                currentValue: e.currentValue,
                totalLoss: e.totalLoss,
                user: null,
            }),
        );

        const cashKings: CashKingEntry[] = (data.cashKings ?? []).map(
            (e: any): CashKingEntry => ({
                username: e.username,
                name: e.name,
                avatarUrl: resolveAvatarUrl(e.image),
                balance: e.baseCurrencyBalance,
                coinValue: e.coinValue,
                totalPortfolio: e.totalPortfolioValue,
                liquidityRatio: e.liquidityRatio,
                user: null,
            }),
        );

        const paperMillionaires: PaperMillionaireEntry[] = (
            data.paperMillionaires ?? []
        ).map(
            (e: any): PaperMillionaireEntry => ({
                username: e.username,
                name: e.name,
                avatarUrl: resolveAvatarUrl(e.image),
                balance: e.baseCurrencyBalance,
                coinValue: e.coinValue,
                totalPortfolio: e.totalPortfolioValue,
                liquidityRatio: e.liquidityRatio,
                user: null,
            }),
        );

        // Resolve users in background by userId
        resolveEntryUsers(
            rugpullers,
            (data.topRugpullers ?? []).map((e: any) => e.userId),
        );
        resolveEntryUsers(
            biggestLosers,
            (data.biggestLosers ?? []).map((e: any) => e.userId),
        );
        resolveEntryUsers(
            cashKings,
            (data.cashKings ?? []).map((e: any) => e.userId),
        );
        resolveEntryUsers(
            paperMillionaires,
            (data.paperMillionaires ?? []).map((e: any) => e.userId),
        );

        return { rugpullers, biggestLosers, cashKings, paperMillionaires };
    }

    async rugpullers(): Promise<RugpullerEntry[]> {
        return (await this.fetch()).rugpullers;
    }
    async biggestLosers(): Promise<BiggestLoserEntry[]> {
        return (await this.fetch()).biggestLosers;
    }
    async cashKings(): Promise<CashKingEntry[]> {
        return (await this.fetch()).cashKings;
    }
    async paperMillionaires(): Promise<PaperMillionaireEntry[]> {
        return (await this.fetch()).paperMillionaires;
    }
}

export const Leaderboard = new LeaderboardSingleton();
