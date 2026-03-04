import { computeLevenshteinDistance } from "../helpers/computeLevenshteinDistance";

export interface AchievementSentinel {
    readonly __achievement: true;
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly category: string;
    readonly difficulty: string;
    readonly cashReward: number;
    readonly gemReward: number;
    readonly derivedId: string;
}

function derivedId(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim()
        .replace(/ +/g, "_");
}

function a(
    id: string,
    name: string,
    description: string,
    category: string,
    difficulty: string,
    cashReward: number,
    gemReward: number,
): AchievementSentinel {
    return Object.freeze({
        __achievement: true as const,
        id,
        name,
        description,
        category,
        difficulty,
        cashReward,
        gemReward,
        derivedId: derivedId(name),
    });
}

const _all: AchievementSentinel[] = [
    // Trading
    a(
        "first_buy",
        "Baby's First Buy",
        "Buy any coin for the first time",
        "trading",
        "easy",
        1000,
        5,
    ),
    a(
        "first_sell",
        "Paper Hands",
        "Sell a coin for the first time",
        "trading",
        "easy",
        1000,
        5,
    ),
    a(
        "trades_50",
        "Market Regular",
        "Complete 50 trades",
        "trading",
        "medium",
        5000,
        15,
    ),
    a(
        "trades_500",
        "Trading Machine",
        "Complete 500 trades",
        "trading",
        "hard",
        15000,
        50,
    ),
    a(
        "trades_5000",
        "Wolf of Wall Street",
        "Complete 5,000 trades",
        "trading",
        "legendary",
        50000,
        150,
    ),
    a(
        "dip_buyer",
        "Dip Buyer",
        "Buy a coin that's down 50%+ in the last 24h",
        "trading",
        "medium",
        5000,
        15,
    ),
    a(
        "whale_trade",
        "Whale Trade",
        "Make a single trade worth $100,000+",
        "trading",
        "hard",
        15000,
        50,
    ),
    a(
        "hold_10_coins",
        "Diversified",
        "Hold 10 different coins at the same time",
        "trading",
        "medium",
        5000,
        15,
    ),
    a(
        "hold_25_coins",
        "Index Fund",
        "Hold 25 different coins at the same time",
        "trading",
        "hard",
        15000,
        50,
    ),
    a(
        "yolo",
        "YOLO",
        "Spend $50,000+ on a single trade",
        "trading",
        "hard",
        10000,
        50,
    ),
    a(
        "volume_10m",
        "Volume King",
        "Accumulate $10,000,000 in total trading volume",
        "trading",
        "legendary",
        50000,
        150,
    ),
    a(
        "diamond_hands",
        "Diamond Hands",
        "Hold a single coin for 30+ days",
        "trading",
        "hard",
        15000,
        75,
    ),
    a(
        "true_dedication",
        "True dedication",
        "Invest $1,000+ in a coin 14 days in a row without ever selling",
        "trading",
        "hard",
        20000,
        50,
    ),

    // Wealth
    a(
        "portfolio_1k",
        "First Comma",
        "Reach $1,000 total portfolio value",
        "wealth",
        "easy",
        1000,
        5,
    ),
    a(
        "portfolio_100k",
        "Six Figures",
        "Reach $100,000 total portfolio value",
        "wealth",
        "medium",
        5000,
        25,
    ),
    a(
        "portfolio_1m",
        "Millionaire",
        "Reach $1,000,000 total portfolio value",
        "wealth",
        "hard",
        15000,
        75,
    ),
    a(
        "portfolio_1b",
        "Billionaire",
        "Reach $1,000,000,000 total portfolio value",
        "wealth",
        "legendary",
        100000,
        250,
    ),
    a(
        "broke",
        "Down Bad",
        "Have less than $1 in your account",
        "wealth",
        "easy",
        2500,
        10,
    ),

    // Creation
    a(
        "create_coin",
        "Minter",
        "Create your first coin",
        "creation",
        "easy",
        2000,
        10,
    ),
    a(
        "create_5",
        "Serial Minter",
        "Create 5 coins",
        "creation",
        "medium",
        5000,
        25,
    ),
    a(
        "create_25",
        "Coin Factory",
        "Create 25 coins",
        "creation",
        "hard",
        25000,
        100,
    ),
    a(
        "moon_100x",
        "To The Moon",
        "Have a coin you created reach $1 (1,000,000x its starting price)",
        "creation",
        "legendary",
        50000,
        150,
    ),
    a(
        "rug_pull",
        "Rug Lord",
        "Crash a coin's price by 50% or more in a single sell",
        "creation",
        "hard",
        10000,
        50,
    ),

    // Arcade
    a(
        "first_arcade",
        "Feeling Lucky",
        "Play your first arcade game",
        "arcade",
        "easy",
        1000,
        5,
    ),
    a(
        "slots_jackpot",
        "Jackpot!",
        "Hit a 3-of-a-kind on slots",
        "arcade",
        "medium",
        5000,
        25,
    ),
    a(
        "mines_15",
        "Minesweeper Pro",
        "Reveal 15+ safe tiles in a single mines game and cash out",
        "arcade",
        "hard",
        10000,
        50,
    ),
    a(
        "mines_24",
        "Minesweeper God",
        "Win with 24 mines enabled",
        "arcade",
        "hard",
        15000,
        50,
    ),
    a(
        "mines_21",
        "Cloud 9",
        "Reveal all 22 safe tiles with 3 mines and cash out",
        "arcade",
        "legendary",
        50000,
        150,
    ),
    a(
        "arcade_100",
        "Degen",
        "Play 100 arcade games",
        "arcade",
        "medium",
        5000,
        25,
    ),
    a(
        "arcade_wager_100k",
        "High Roller",
        "Wager $100,000+ total across arcade games",
        "arcade",
        "hard",
        15000,
        50,
    ),
    a(
        "arcade_losses_50k",
        "House Always Wins",
        "Lose $50,000+ total in the arcade",
        "arcade",
        "medium",
        5000,
        25,
    ),
    a(
        "win_streak_5",
        "Lucky Streak",
        "Win 5 arcade games in a row",
        "arcade",
        "hard",
        15000,
        75,
    ),
    a(
        "arcade_wins_500k",
        "Professional Gambler",
        "Win $500,000+ total in the arcade",
        "arcade",
        "legendary",
        50000,
        150,
    ),
    a(
        "arcade_wins_1m",
        "All I do is Win",
        "Make $1,000,000 winnings with arcade games",
        "arcade",
        "legendary",
        100000,
        225,
    ),
    a(
        "risk_biscuit",
        "Risk it for the biscuit",
        "Go all in with at least $25,000 and win",
        "arcade",
        "hard",
        10000,
        50,
    ),
    a(
        "arcade_losses_1m",
        "All I do is Lose",
        "Lose $1,000,000 within arcade games",
        "arcade",
        "legendary",
        100000,
        225,
    ),

    // Streaks
    a(
        "first_claim",
        "Early Bird",
        "Claim your first daily reward",
        "streaks",
        "easy",
        1000,
        5,
    ),
    a(
        "streak_7",
        "Dedicated",
        "Reach a 7-day login streak",
        "streaks",
        "medium",
        5000,
        15,
    ),
    a(
        "streak_14",
        "Committed",
        "Reach a 14-day login streak",
        "streaks",
        "medium",
        7500,
        25,
    ),
    a(
        "streak_30",
        "Obsessed",
        "Reach a 30-day login streak",
        "streaks",
        "hard",
        20000,
        75,
    ),
    a(
        "rewards_100k",
        "Rewards Collector",
        "Claim $100,000 total in daily rewards",
        "streaks",
        "hard",
        15000,
        50,
    ),

    // Prestige
    a(
        "prestige_1",
        "Reset Button",
        "Prestige for the first time",
        "prestige",
        "medium",
        5000,
        25,
    ),
    a(
        "prestige_3",
        "Grindset",
        "Reach Prestige III",
        "prestige",
        "hard",
        15000,
        50,
    ),
    a(
        "prestige_5",
        "Ascended",
        "Reach Prestige V (max prestige)",
        "prestige",
        "legendary",
        50000,
        200,
    ),

    // Hopium
    a(
        "first_bet",
        "Crystal Ball",
        "Place your first Hopium bet",
        "hopium",
        "easy",
        1000,
        5,
    ),
    a(
        "create_10_questions",
        "Question Master",
        "Create 10 Hopium questions",
        "hopium",
        "medium",
        5000,
        25,
    ),
    a(
        "win_10_bets",
        "Oracle",
        "Win 10 Hopium bets",
        "hopium",
        "medium",
        10000,
        25,
    ),
    a(
        "win_50_bets",
        "Prophet",
        "Win 50 Hopium bets",
        "hopium",
        "legendary",
        50000,
        150,
    ),

    // Social
    a(
        "comments_25",
        "Socialite",
        "Post 25 comments on coin pages",
        "social",
        "medium",
        5000,
        15,
    ),
    a(
        "comments_50",
        "Yapper",
        "Write 50 comments in total",
        "social",
        "medium",
        7500,
        15,
    ),
    a(
        "top_rugpuller",
        "Top Rugpuller",
        "Be the #1 rugpuller on the daily leaderboard",
        "social",
        "hard",
        10000,
        50,
    ),
    a(
        "transfers_10_users",
        "Generous",
        "Send transfers to 10 different users",
        "social",
        "medium",
        5000,
        25,
    ),
    a(
        "transfer_500k",
        "Big Tipper",
        "Transfer $500,000+ total to other users",
        "social",
        "hard",
        25000,
        75,
    ),
    a(
        "received_from_15",
        "A Celebrity?",
        "Have 15 unique people send you cash",
        "social",
        "hard",
        20000,
        25,
    ),
    a(
        "update_bio",
        "Who are you?",
        "Update your About Me section",
        "social",
        "easy",
        2000,
        10,
    ),

    // Shop
    a(
        "own_10_colors",
        "Collector",
        "Own 10 different name colours",
        "shop",
        "hard",
        10000,
        50,
    ),
    a(
        "open_50_crates",
        "Crate Addict",
        "Open 50 crates",
        "shop",
        "hard",
        15000,
        75,
    ),

    // Special
    a(
        "all_in",
        "All In",
        "Spend 95%+ of your balance in a single trade",
        "special",
        "medium",
        5000,
        25,
    ),
    a(
        "account_6mo",
        "Veteran",
        "Have an account older than 6 months",
        "special",
        "medium",
        10000,
        50,
    ),
];

// Build sentinel map keyed by derivedId uppercased
type AchievementMap = Record<string, AchievementSentinel>;

const _map: AchievementMap = {};
for (const achievement of _all) {
    _map[achievement.derivedId.toUpperCase()] = achievement;
}

// -------------------------
// Helpers
// -------------------------

function sortByDistance(
    query: string,
    field: keyof AchievementSentinel,
): AchievementSentinel[] {
    return [..._all]
        .map((achievement) => ({
            achievement,
            distance: computeLevenshteinDistance(
                query.toLowerCase(),
                String(achievement[field]).toLowerCase(),
            ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .map(({ achievement }) => achievement);
}

// -------------------------
// Achievements object
// -------------------------

export const achievements = {
    ..._map,

    // Return all achievements
    all(): AchievementSentinel[] {
        return [..._all];
    },

    // Exact match by ID (e.g. "mines_21")
    getByID(id: string): AchievementSentinel | null {
        return _all.find((a) => a.id === id) ?? null;
    },

    // Exact match by derivedId (e.g. "cloud_9")
    getByDerivedID(derivedId: string): AchievementSentinel | null {
        return (
            _all.find((a) => a.derivedId === derivedId.toLowerCase()) ?? null
        );
    },

    // Fuzzy match by name, ordered by Levenshtein distance
    getByName(query: string): AchievementSentinel[] {
        return sortByDistance(query, "name");
    },

    // Fuzzy match by description, ordered by Levenshtein distance
    getByDescription(query: string): AchievementSentinel[] {
        return sortByDistance(query, "description");
    },

    // Filter by category (exact)
    getByCategory(category: string): AchievementSentinel[] {
        return _all.filter((a) => a.category === category.toLowerCase());
    },

    // Filter by difficulty (exact)
    getByDifficulty(difficulty: string): AchievementSentinel[] {
        return _all.filter((a) => a.difficulty === difficulty.toLowerCase());
    },
} as const satisfies Record<string, unknown>;
