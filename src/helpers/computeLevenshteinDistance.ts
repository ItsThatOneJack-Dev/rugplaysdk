export function computeLevenshteinDistance(a: unknown, b: unknown): number {
    const s = String(a);
    const t = String(b);

    const m = s.length;
    const n = t.length;

    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) =>
            i === 0 ? j : j === 0 ? i : 0,
        ),
    );

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s[i - 1] === t[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] =
                    1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}
