import { sdkFetch } from "../helpers/sdkFetch";
import { interpretResponse } from "../helpers/interpretResponse";
import { results } from "./results";
import { resolveAmount, type PercentAmount } from "../helpers/resolveAmount";
import { User } from "./User";
import { baseUrl } from "../helpers/baseURL";

const BASE_URL = baseUrl("/api/hopium/questions");

// -------------------------
// Supporting types
// -------------------------

export interface UserBets {
    yesAmount: number;
    noAmount: number;
    totalAmount: number;
    estimatedYesWinnings: number;
    estimatedNoWinnings: number;
}

export interface RecentBet {
    id: number;
    side: boolean;
    amount: number;
    createdAt: Date;
    username: string;
    user: User | null;
}

export interface BetResult {
    betId: number;
    side: boolean;
    amount: number;
    potentialWinnings: number;
    newBalance: number;
}

export interface HopiumCreateSuccess {
    success: true;
    id: number;
    question: string;
    resolutionDate: Date;
    requiresWebSearch: boolean;
}

export interface HopiumCreateError {
    success: false;
    error: string;
}

export type HopiumCreateResult = HopiumCreateSuccess | HopiumCreateError;

export type HopiumStatus = "ACTIVE" | "RESOLVED" | "CANCELLED";

// -------------------------
// HopiumQuestion class
// -------------------------

export class HopiumQuestion {
    readonly id: number;
    readonly question: string;
    readonly status: HopiumStatus;
    readonly resolutionDate: Date;
    readonly totalAmount: number;
    readonly yesAmount: number;
    readonly noAmount: number;
    readonly yesPercentage: number;
    readonly noPercentage: number;
    readonly createdAt: Date;
    readonly resolvedAt: Date | null;
    readonly requiresWebSearch: boolean;
    readonly aiResolution: boolean | null;
    readonly creatorUsername: string;
    readonly userBets: UserBets | null;

    private _creator: User | null = null;
    private _recentBets: RecentBet[] | null;

    constructor(data: any) {
        this.id = data.id;
        this.question = data.question;
        this.status = data.status;
        this.resolutionDate = new Date(data.resolutionDate);
        this.totalAmount = data.totalAmount;
        this.yesAmount = data.yesAmount;
        this.noAmount = data.noAmount;
        this.yesPercentage = data.yesPercentage;
        this.noPercentage = data.noPercentage;
        this.createdAt = new Date(data.createdAt);
        this.resolvedAt = data.resolvedAt ? new Date(data.resolvedAt) : null;
        this.requiresWebSearch = data.requiresWebSearch;
        this.aiResolution = data.aiResolution ?? null;
        this.creatorUsername = data.creator?.username ?? null;
        this.userBets = data.userBets ?? null;

        this._recentBets = data.recentBets
            ? data.recentBets.map(
                  (b: any): RecentBet => ({
                      id: b.id,
                      side: b.side,
                      amount: b.amount,
                      createdAt: new Date(b.createdAt),
                      username: b.user?.username ?? null,
                      user: null,
                  }),
              )
            : null;

        // Resolve creator in background
        if (data.creator?.id) {
            User._fetch(data.creator.id).then((user) => {
                this._creator = user;
            });
        }

        // Resolve recent bet users in background
        if (this._recentBets) {
            for (let i = 0; i < this._recentBets.length; i++) {
                const bet = this._recentBets[i];
                const rawUser = data.recentBets[i]?.user;
                if (rawUser?.id) {
                    User._fetch(rawUser.id).then((user) => {
                        (this._recentBets as RecentBet[])[i].user = user;
                    });
                }
            }
        }
    }

    get creator(): User | null {
        return this._creator;
    }

    // Only populated when fetched via getQuestion(id), not from the list
    get recentBets(): RecentBet[] | null {
        return this._recentBets;
    }

    async resolveCreator(): Promise<User | null> {
        if (this._creator) return this._creator;
        this._creator = await User._fetch(this.creatorUsername);
        return this._creator;
    }

    async bet(
        side: boolean,
        amount: number | PercentAmount,
    ): Promise<BetResult | unknown> {
        const me = await User.me();
        if (!me) return results.FAILURE;

        const balance = await me.getBalance();
        const resolved = resolveAmount(amount, balance);
        if (resolved === 0) return results.SUCCESS;

        const res = await sdkFetch(`${BASE_URL}/${this.id}/bet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ side, amount: resolved }),
        });

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        if (!data.success) return results.FAILURE;

        return {
            betId: data.bet.id,
            side: data.bet.side,
            amount: data.bet.amount,
            potentialWinnings: data.bet.potentialWinnings,
            newBalance: data.newBalance,
        } satisfies BetResult;
    }

    async refresh(): Promise<HopiumQuestion | null> {
        return Hopium.getQuestion(this.id);
    }

    toJSON() {
        return {
            id: this.id,
            question: this.question,
            status: this.status,
            resolutionDate: this.resolutionDate,
            totalAmount: this.totalAmount,
            yesAmount: this.yesAmount,
            noAmount: this.noAmount,
            yesPercentage: this.yesPercentage,
            noPercentage: this.noPercentage,
            createdAt: this.createdAt,
            resolvedAt: this.resolvedAt,
            requiresWebSearch: this.requiresWebSearch,
            aiResolution: this.aiResolution,
            creatorUsername: this.creatorUsername,
            userBets: this.userBets,
        };
    }

    toString(): string {
        return `HopiumQuestion(${this.id}: "${this.question}")`;
    }
}

// -------------------------
// Hopium singleton
// -------------------------

class HopiumSingleton {
    async getQuestions(
        status: HopiumStatus = "ACTIVE",
        limit: number = 50,
        allPages: boolean = false,
    ): Promise<HopiumQuestion[]> {
        const url = `${BASE_URL}?status=${status}&limit=${limit}`;
        const res = await sdkFetch(url);
        if (!res.ok) return [];

        const data = await res.json();
        const questions = (data.questions ?? []).map(
            (q: any) => new HopiumQuestion(q),
        );

        if (!allPages || data.totalPages <= 1) return questions;

        for (let page = 2; page <= data.totalPages; page++) {
            const r = await sdkFetch(`${url}&page=${page}`);
            if (!r.ok) break;
            const d = await r.json();
            questions.push(
                ...(d.questions ?? []).map((q: any) => new HopiumQuestion(q)),
            );
        }

        return questions;
    }

    async getQuestion(id: number): Promise<HopiumQuestion | null> {
        const res = await sdkFetch(`${BASE_URL}/${id}`);
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.question) return null;

        return new HopiumQuestion(data.question);
    }

    async create(question: string): Promise<HopiumCreateResult | unknown> {
        const res = await sdkFetch(`${BASE_URL}/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question }),
        });

        // 400 means AI rejected the question — return the error message
        if (res.status === 400) {
            const data = await res.json();
            return {
                success: false,
                error: data.error ?? "Question validation failed.",
            } satisfies HopiumCreateError;
        }

        const err = interpretResponse(res);
        if (err) return err;

        const data = await res.json();
        if (!data.success) return results.FAILURE;

        const q = data.question;
        return {
            success: true,
            id: q.id,
            question: q.question,
            resolutionDate: new Date(q.resolutionDate),
            requiresWebSearch: q.requiresWebSearch,
        } satisfies HopiumCreateSuccess;
    }
}

export const Hopium = new HopiumSingleton();
