import { Chat } from "./Chat";
import { Events } from "./Events";
import { sdkFetch } from "../helpers/sdkFetch";
import { baseUrl } from "../helpers/baseURL";

declare const GM_info: { script: { version: string } } | undefined;

const VERSION = "2.0.1";
const CHANGELOG = `
v2.0.1
- Add autoupdate headers.
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
