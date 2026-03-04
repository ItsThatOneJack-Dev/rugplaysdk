import { baseUrl } from "./baseURL";
import { sdkFetch } from "./sdkFetch";

export interface PromoCodeResult {
    success: boolean;
    won: number;
    error?: string;
}

export async function redeemPromoCode(code: string): Promise<PromoCodeResult> {
    const res = await sdkFetch(baseUrl("/api/promo/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
    });

    if (res.status === 400) {
        const data = await res.json();
        return {
            success: false,
            won: 0,
            error: data.error ?? "Unknown error.",
        };
    }

    if (!res.ok) return { success: false, won: 0, error: "Request failed." };

    const data = await res.json();
    return { success: true, won: data.rewardAmount ?? 0 };
}
