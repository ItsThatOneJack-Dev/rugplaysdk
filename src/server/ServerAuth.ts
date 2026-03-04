import { baseUrl } from "../helpers/baseURL";
import { sdkFetch } from "../helpers/sdkFetch";
import { setSdkFetch } from "../helpers/sdkFetch";

export interface ServerAuthConfig {
    sessionData: string;
    sessionToken: string;
    cfClearance: string;
    userAgent?: string;
}

const DEFAULT_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0";

export const ServerAuth = {
    _config: null as ServerAuthConfig | null,

    init(config: ServerAuthConfig): void {
        this._config = config;

        const cookieHeader = [
            `__Secure-better-auth.session_data=${config.sessionData}`,
            `__Secure-better-auth.session_token=${config.sessionToken}`,
            `cf_clearance=${config.cfClearance}`,
        ].join("; ");

        setSdkFetch((url, init) =>
            fetch(url, {
                ...init,
                headers: {
                    ...init?.headers,
                    Cookie: cookieHeader,
                    "User-Agent": config.userAgent ?? DEFAULT_UA,
                    Origin: baseUrl(""),
                    Referer: baseUrl("/"),
                },
            }),
        );
    },

    // Check if the session is still valid by fetching portfolio
    async validate(): Promise<boolean> {
        if (!this._config) return false;
        const res = await sdkFetch(baseUrl("/api/portfolio/total"));
        return res.ok;
    },

    // Decode the session data to get expiry
    getExpiry(): Date | null {
        if (!this._config) return null;
        try {
            const raw = atob(this._config.sessionData);
            const decoded = JSON.parse(raw);
            return new Date(decoded.session.session.expiresAt);
        } catch {
            return null;
        }
    },

    isExpired(): boolean {
        const expiry = this.getExpiry();
        if (!expiry) return true;
        return Date.now() > expiry.getTime();
    },
};
