import { Chat } from "./Chat";
import { Events } from "./Events";
import { sdkFetch } from "../helpers/sdkFetch";
import { baseUrl } from "../helpers/baseURL";

declare const GM_info: { script: { version: string } } | undefined;

const VERSION = "2";
const CHANGELOG = `
v2.0.0
- Full TypeScript rewrite
- User, Coin, Channel, Message, RugpayRequest classes
- Chat and Events WebSocket systems with auto-reconnect and backoff
- Shop, Arcade, Hopium, Leaderboard, DailyReward systems
- Achievement sentinels and helpers
- Backoff helpers (linear, exponential, logarithmic, stepped, custom)
- HTML sanitisation helpers
- Server-side support via ServerAuth
- Dual ESM/CJS/userscript build output
`.trim();

class InfoSingleton {
    readonly version: string;
    readonly changelog: string;

    constructor() {
        this.version =
            typeof GM_info !== "undefined" ? GM_info.script.version : VERSION;
        this.changelog = CHANGELOG;
    }

    async measureLatency(): Promise<{
        events: number | null;
        chat: number | null;
    }> {
        const [events, chat] = await Promise.all([
            Events.measureLatency(),
            Chat.measureLatency(),
        ]);
        return { events, chat };
    }

    async isOnline(): Promise<boolean> {
        try {
            const res = await sdkFetch(
                baseUrl("/api/leaderboard?search=&offset=0"),
            );
            return res.ok;
        } catch {
            return false;
        }
    }
}

export const Info = new InfoSingleton();
