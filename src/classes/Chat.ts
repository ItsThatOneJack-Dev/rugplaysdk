import { sdkFetch } from "../helpers/sdkFetch";
import { WSConnection } from "../helpers/WSConnection";
import type { BaseWSEvents } from "../helpers/WSConnection";
import { Message } from "./Message";
import { RugpayRequest } from "./RugpayRequest";
import type { ChannelData } from "./Channel";
import { decodeSvelteData } from "../helpers/decodeSvelteData";
import { results } from "./results";
import User from "./User";
import {
    memoryTokenStore,
    localStorageTokenStore,
    type TokenStore,
} from "../helpers/tokenStore";
import { info, warn } from "../helpers/log";
import { baseUrl } from "../helpers/baseURL";

const WS_URL = "wss://api.vaaq.dev/";
const VAAQ_DATA_URL = baseUrl(
    "/user/300/__data.json?x-sveltekit-invalidated=11",
);
const REFRESH_INTERVAL = 60_000;

type ChatEvents = BaseWSEvents & {
    connect: [];
    ready: [];
    disconnect: [];
    retry: [number];
    error: [Event];
    authenticated: [string];
    chatsUpdated: [ChannelData[]];
    message: [Message];
    rugpayCompleted: [RugpayRequest];
};

class ChatSingleton extends WSConnection<ChatEvents> {
    get wsUrl(): string {
        return WS_URL;
    }

    private _refreshInterval: ReturnType<typeof setInterval> | null = null;
    private _authenticated: boolean = false;
    private _tokenStore: TokenStore =
        typeof window !== "undefined"
            ? localStorageTokenStore()
            : memoryTokenStore();

    _currentUsername: string | null = null;
    _chats: ChannelData[] = [];
    _globalOnline: number = 0;

    // -------------------------
    // Public getters
    // -------------------------

    get authenticated(): boolean {
        return this._authenticated;
    }

    // -------------------------
    // Token store
    // -------------------------

    setTokenStore(store: TokenStore): void {
        this._tokenStore = store;
    }

    // -------------------------
    // Auth
    // -------------------------

    logout(): void {
        this._tokenStore.remove();
        this._authenticated = false;
    }

    // -------------------------
    // Chat list
    // -------------------------

    getChats(): ChannelData[] {
        return this._chats;
    }

    getGlobalOnline(): number {
        return this._globalOnline;
    }

    refreshChats(): void {
        this.send({ action: "get_chats" });
    }

    // -------------------------
    // DM management (used by Channel)
    // -------------------------

    async _openDM(username: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.send({ action: "new_chat", target_username: username });

            const timeout = setTimeout(() => {
                this._socket?.removeEventListener("message", onMsg);
                reject(
                    new Error(
                        `RugplaySDK Chat: Timed out waiting for DM with ${username}.`,
                    ),
                );
            }, 5000);

            const onMsg = (event: MessageEvent) => {
                let data: any;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (data.type === "chats_list") {
                    clearTimeout(timeout);
                    this._socket?.removeEventListener("message", onMsg);
                    this._handleChatsList(data);

                    const chat = this._chats.find(
                        (c) => c.target_username === username,
                    );
                    if (!chat) {
                        reject(
                            new Error(
                                `RugplaySDK Chat: Could not find DM with ${username} after creation.`,
                            ),
                        );
                        return;
                    }

                    resolve(chat.chat_id);
                }
            };

            this._socket?.addEventListener("message", onMsg);
        });
    }

    // -------------------------
    // WSConnection implementation
    // -------------------------

    protected async _onOpen(): Promise<void> {
        info("Connected.", "Chat");
        this.emit("connect");

        this._currentUsername = await this._resolveUsername();
        if (!this._currentUsername)
            throw new Error(
                "RugplaySDK Chat: Could not resolve current username.",
            );

        try {
            const hasToken = this._tokenStore.get() !== null;
            if (hasToken) {
                this._doTokenAuth();
            } else {
                await this._doAuth();
            }
        } catch (e: any) {
            warn("Authentication failed, reconnecting.", "Chat");
            this._tokenStore.remove();
            this._socket?.close();
            return;
        }

        this._refreshInterval = setInterval(() => {
            if (this._authenticated) this.send({ action: "get_chats" });
        }, REFRESH_INTERVAL);

        this.emit("ready");
    }

    protected _onMessage(event: MessageEvent): void {
        let data: any;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        if (data.type === "ping") {
            this.send({ type: "pong" });
            return;
        }
        if (data.type === "pong") {
            this._handlePong();
            return;
        }

        if (data.type === "auth_success") {
            this._authenticated = true;
            this.emit("authenticated", data.username);
            return;
        }

        if (data.type === "chats_list") {
            this._handleChatsList(data);
            return;
        }

        if (data.type === "new_message") {
            this._handleNewMessage(data);
            return;
        }

        if (data.type === "rugpay_completed") {
            this._handleRugpayCompleted(data);
            return;
        }
    }

    protected _cleanup(): void {
        super._cleanup();
        this._authenticated = false;
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }
    }

    // -------------------------
    // Internal helpers
    // -------------------------

    private async _resolveUsername(): Promise<string | null> {
        const res = await sdkFetch(VAAQ_DATA_URL);
        if (!res.ok) return null;
        const json = await res.json();
        const decoded = (await decodeSvelteData(json, 0)) as any;
        return decoded?.userSession?.username ?? null;
    }

    private _doTokenAuth(): void {
        const token = this._tokenStore.get()!;
        this.send({ action: "auth", token, hidden: false });
    }

    private async _doAuth(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.send({
                action: "request_auth",
                username: this._currentUsername,
            });

            const onChallenge = (event: MessageEvent) => {
                let data: any;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (data.type === "auth_challenge") {
                    this._socket?.removeEventListener("message", onChallenge);
                    this._handleChallenge(data.code, resolve, reject);
                }
            };

            this._socket?.addEventListener("message", onChallenge);
        });
    }

    private async _handleChallenge(
        code: string,
        resolve: () => void,
        reject: (err: Error) => void,
    ): Promise<void> {
        const res = await sdkFetch(VAAQ_DATA_URL);
        const json = await res.json();
        const decoded = (await decodeSvelteData(json, 0)) as any;
        const savedBio: string = decoded?.userSession?.bio ?? "";

        const me = await User.me();
        if (!me) {
            reject(
                new Error(
                    "RugplaySDK Chat: Could not resolve current user for auth challenge.",
                ),
            );
            return;
        }

        const bioResult = await me.updateProfile({ bio: code });
        if (bioResult !== results.SUCCESS) {
            reject(
                new Error(
                    "RugplaySDK Chat: Failed to set bio for auth challenge.",
                ),
            );
            return;
        }

        this.send({ action: "verify_bio", username: this._currentUsername });

        const onVerify = async (event: MessageEvent) => {
            let data: any;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            if (data.type === "error") {
                this._socket?.removeEventListener("message", onVerify);
                await me.updateProfile({ bio: savedBio });
                reject(new Error("RugplaySDK Chat: Bio verification failed."));
                return;
            }

            if (data.type === "verify_success") {
                this._socket?.removeEventListener("message", onVerify);
                await me.updateProfile({ bio: savedBio });

                setTimeout(() => {
                    this._tokenStore.set(data.token);
                    this.send({
                        action: "auth",
                        token: data.token,
                        hidden: false,
                    });
                    resolve();
                }, 100);
            }
        };

        this._socket?.addEventListener("message", onVerify);
    }

    private _handleChatsList(data: any): void {
        this._chats = data.chats ?? [];
        this._globalOnline = data.global_online ?? 0;
        this.emit("chatsUpdated", this._chats);
    }

    private async _handleNewMessage(data: any): Promise<void> {
        const { Channel } = await import("./Channel");

        const channelData = this._chats.find(
            (c) => c.chat_id === data.chat_id,
        ) ?? {
            chat_id: data.chat_id,
            target_username: data.chat_id,
        };

        const channel = new Channel(channelData);
        const msg = new Message({
            id: data.message.id,
            channel,
            content: data.message.content,
            timestamp: data.message.timestamp,
            senderUsername: data.message.sender_username,
        });

        channel._appendToHistory(msg);
        msg.resolveSender();
        this.emit("message", msg);
    }

    private async _handleRugpayCompleted(data: any): Promise<void> {
        const { Channel } = await import("./Channel");
        for (const chat of this._chats) {
            const channel = new Channel(chat);
            channel._patchHistory(data.txId);
        }
    }
}

export const Chat = new ChatSingleton();
