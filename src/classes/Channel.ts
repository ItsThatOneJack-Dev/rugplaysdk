import { Message } from "./Message";
import { RugpayRequest } from "./RugpayRequest";
import type { User } from "./User";
import { Chat } from "./Chat";

const GLOBAL_GENERAL_ID = "global_general";
const WS_TIMEOUT = 5000;

export interface ChannelData {
    chat_id: string;
    target_username: string;
    last_message?: string | null;
    last_time?: string | null;
    last_sender_username?: string | null;
    is_online?: boolean;
    unread_count?: number;
    is_muted?: boolean;
    is_group?: boolean;
}

export class Channel {
    readonly id: string;
    readonly name: string;
    readonly isGroup: boolean;
    readonly isGlobal: boolean;
    readonly isMuted: boolean;
    readonly isOnline: boolean;
    readonly unreadCount: number;
    readonly lastMessage: string | null;
    readonly lastMessageTime: Date | null;
    readonly lastSenderUsername: string | null;

    private _history: Message[] = [];

    constructor(data: ChannelData) {
        this.id = data.chat_id;
        this.name = data.target_username;
        this.isGroup = data.is_group ?? false;
        this.isGlobal = data.chat_id === GLOBAL_GENERAL_ID;
        this.isMuted = data.is_muted ?? false;
        this.isOnline = data.is_online ?? false;
        this.unreadCount = data.unread_count ?? 0;
        this.lastMessage = data.last_message ?? null;
        this.lastMessageTime = data.last_time ? new Date(data.last_time) : null;
        this.lastSenderUsername = data.last_sender_username ?? null;
    }

    // -------------------------
    // Static factory methods
    // -------------------------

    static general(): Channel {
        return new Channel({
            chat_id: GLOBAL_GENERAL_ID,
            target_username: "general",
            is_group: false,
            is_online: true,
        });
    }

    static async withUser(user: User): Promise<Channel> {
        const existing = Chat.getChats().find(
            (c) => c.target_username === user.username,
        );
        if (existing) return new Channel(existing);
        const chatId = await Chat._openDM(user.username);
        return new Channel({
            chat_id: chatId,
            target_username: user.username,
            is_group: false,
        });
    }

    static async createGroup(name: string, members: User[]): Promise<Channel> {
        return new Promise((resolve, reject) => {
            Chat.send({
                action: "create_group",
                name,
                members: members.map((m) => m.username),
            });

            const timeout = setTimeout(
                () =>
                    reject(
                        new Error(
                            "RugplaySDK: Timed out waiting for group creation.",
                        ),
                    ),
                WS_TIMEOUT,
            );

            const unsub = Chat.on("chatsUpdated", (chats: ChannelData[]) => {
                const created = chats.find(
                    (c) => c.target_username === name && c.is_group,
                );
                if (created) {
                    clearTimeout(timeout);
                    unsub();
                    resolve(new Channel(created));
                }
            });
        });
    }

    // -------------------------
    // History
    // -------------------------

    getCachedHistory(): Message[] {
        return this._history;
    }

    _appendToHistory(message: Message): void {
        this._history.push(message);
    }

    _patchHistory(txId: string): void {
        for (const msg of this._history) {
            if (msg.type === "rugpay" && msg.rugpay?.id === txId) {
                msg.rugpay.status = "completed";
            }
        }
    }

    async getHistory(count: number = 50): Promise<Message[]> {
        return new Promise((resolve) => {
            Chat.send({ action: "get_history", chat_id: this.id, offset: 0 });

            const timeout = setTimeout(() => resolve([]), WS_TIMEOUT);

            const socket = (Chat as any)._socket as WebSocket;
            const onMsg = (event: MessageEvent) => {
                let data: any;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (data.type === "history" && data.chat_id === this.id) {
                    clearTimeout(timeout);
                    socket.removeEventListener("message", onMsg);

                    const messages = (data.messages ?? []).slice(-count).map(
                        (m: any) =>
                            new Message({
                                id: m.id,
                                channel: this,
                                content: m.content,
                                timestamp: m.timestamp,
                                senderUsername: m.sender_username,
                            }),
                    );

                    this._history = messages;
                    resolve(messages);
                }
            };

            socket.addEventListener("message", onMsg);
        });
    }

    // -------------------------
    // Messaging
    // -------------------------

    sendMessage(content: string): boolean {
        return Chat.send({ action: "send_message", chat_id: this.id, content });
    }

    sendRugpay(amount: number): RugpayRequest {
        if (amount < 10)
            throw new Error("RugplaySDK: Minimum rugpay amount is 10.");

        const id = Array.from(
            { length: 10 },
            () =>
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
                    Math.floor(Math.random() * 36)
                ],
        ).join("");

        Chat.send({
            action: "send_message",
            chat_id: this.id,
            content: `RUGPAY REQUEST ${amount}/${id}`,
        });

        return new RugpayRequest({
            id,
            amount,
            creatorUsername: Chat._currentUsername!,
            channel: this,
        });
    }

    // -------------------------
    // Visibility
    // -------------------------

    hide(): void {
        let hidden: string[] = [];
        try {
            hidden = JSON.parse(
                localStorage.getItem("br_hidden_chats") ?? "[]",
            );
        } catch {}
        if (!hidden.includes(this.id)) {
            hidden.push(this.id);
            localStorage.setItem("br_hidden_chats", JSON.stringify(hidden));
        }
    }

    isHidden(): boolean {
        try {
            const hidden: string[] = JSON.parse(
                localStorage.getItem("br_hidden_chats") ?? "[]",
            );
            return hidden.includes(this.id);
        } catch {
            return false;
        }
    }

    // -------------------------
    // Refresh
    // -------------------------

    async refresh(): Promise<Channel | null> {
        const updated = Chat.getChats().find((c) => c.chat_id === this.id);
        if (!updated) return null;
        return new Channel(updated);
    }
}

// Proxy so Channel("global_general") works as a factory call
export default new Proxy(Channel, {
    apply(_Target, _thisArg, [chatId]: [string]) {
        if (chatId === GLOBAL_GENERAL_ID || chatId === "@general")
            return Channel.general();

        const found = Chat.getChats().find((c) => c.chat_id === chatId);
        if (!found)
            throw new Error(
                `RugplaySDK: No channel found with id "${chatId}".`,
            );
        return new Channel(found);
    },
});
