// src/classes/DailyReward.ts

import { sdkFetch } from "../helpers/sdkFetch";
import { interpretResponse } from "../helpers/interpretResponse";
import { results } from "./results";
import { baseUrl } from "../helpers/baseURL";

const REWARDS_URL = baseUrl("/api/rewards/claim");

export interface DailyRewardStatus {
    canClaim: boolean;
    rewardAmount: number;
    baseReward: number;
    prestigeBonus: number;
    prestigeLevel: number;
    timeRemaining: number;
    nextClaimTime: Date;
    totalRewardsClaimed: number;
    lastRewardClaim: Date | null;
    loginStreak: number;
}

export interface DailyRewardResult {
    amount: number;
    newBalance: number;
    loginStreak: number;
}

export async function getDailyRewardStatus(): Promise<DailyRewardStatus | null> {
    const res = await sdkFetch(REWARDS_URL);
    if (!res.ok) return null;
    const data = await res.json();

    return {
        canClaim: data.canClaim,
        rewardAmount: data.rewardAmount,
        baseReward: data.baseReward,
        prestigeBonus: data.prestigeBonus,
        prestigeLevel: data.prestigeLevel,
        timeRemaining: data.timeRemaining,
        nextClaimTime: new Date(data.nextClaimTime),
        totalRewardsClaimed: data.totalRewardsClaimed,
        lastRewardClaim: data.lastRewardClaim
            ? new Date(data.lastRewardClaim)
            : null,
        loginStreak: data.loginStreak,
    };
}

export async function claimDailyReward(): Promise<DailyRewardResult | unknown> {
    const res = await sdkFetch(REWARDS_URL, { method: "POST" });

    // 400 means not yet available
    if (res.status === 400) return results.REWARD_NOT_AVAILABLE;

    const err = interpretResponse(res);
    if (err) return err;

    const data = await res.json();
    if (!data.success) return results.FAILURE;

    return {
        amount: data.rewardAmount,
        newBalance: data.newBalance,
        loginStreak: data.loginStreak,
    } satisfies DailyRewardResult;
}
