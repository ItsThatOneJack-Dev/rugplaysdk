import { WSConnection, type BaseWSEvents } from "../helpers/WSConnection";
import { sdkFetch } from "../helpers/sdkFetch";
import { decodeSvelteData } from "../helpers/decodeSvelteData";
import UserFactory from "./User";
import { User, BuyTransaction, SellTransaction } from "./User";
import { info, warn } from "../helpers/log";
import { baseUrl, wsUrl } from "../helpers/baseURL";

const WS_URL = wsUrl("/");
const S3_PROXY = baseUrl("/api/proxy/s3/");
const SESSION_URL = baseUrl("/user/300/__data.json?x-sveltekit-invalidated=11");

export interface ReceiveCashEvent {
    amount: number;
    senderUsername: string;
    sender: User | null;
    timestamp: Date;
}

export interface ReceiveCoinsEvent {
    amount: number;
    coinSymbol: string;
    senderUsername: string;
    sender: User | null;
    timestamp: Date;
}

export interface NotificationEvent {
    notificationType: string;
    title: string;
    message: string;
    link: string | null;
    timestamp: Date;
}

export interface ArcadeActivityEvent {
    username: string;
    userId: string;
    userImage: string | null;
    game: "coinflip" | "dice" | "slots" | "mines";
    amount: number;
    won: boolean;
    timestamp: Date;
    user: User | null;
}

type TradeEvents = BaseWSEvents & {
    buy: [BuyTransaction];
    sell: [SellTransaction];
    receiveCash: [ReceiveCashEvent];
    receiveCoins: [ReceiveCoinsEvent];
    notification: [NotificationEvent];
    arcadeActivity: [ArcadeActivityEvent];
};

class EventsSingleton extends WSConnection<TradeEvents> {
    get wsUrl(): string {
        return WS_URL;
    }

    private _userId: string | null = null;

    protected async _onOpen(): Promise<void> {
        info("Connected.", "Events");
        this.emit("connect");

        try {
            const res = await sdkFetch(SESSION_URL);
            const json = await res.json();
            const decoded = (await decodeSvelteData(json, 0)) as any;
            this._userId = decoded?.userSession?.id
                ? String(decoded.userSession.id)
                : null;
        } catch {
            warn("Could not resolve user ID.", "Events");
        }

        this.send({ type: "subscribe", channel: "trades:all" });
        this.send({ type: "subscribe", channel: "trades:large" });
        this.send({ type: "set_coin", coinSymbol: "@global" });
        if (this._userId) this.send({ type: "set_user", userId: this._userId });

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

        if (data.type === "live-trade" && data.data) {
            const trade = data.data;
            const type =
                trade.type === "BUY"
                    ? "buy"
                    : trade.type === "SELL"
                      ? "sell"
                      : null;

            if (!type) return;

            // Resolve user in background, start with null
            const tx: BuyTransaction | SellTransaction = {
                type: trade.type,
                id: null, // live events don't have a vaaq ID
                symbol: trade.coinSymbol,
                price: trade.price,
                quantity: trade.amount,
                totalValue: trade.totalValue,
                timestamp: new Date(trade.timestamp),
                user: null,
            };

            // Resolve user in background
            (User as any)._fetch(trade.userId).then((user: User | null) => {
                (tx as any).user = user;
            });

            this.emit(type, tx as any);
            return;
        }

        if (data.type === "arcade_activity" && data.arcadeActivity) {
            const a = data.arcadeActivity;

            const event: ArcadeActivityEvent = {
                username: a.username,
                userId: a.userId,
                userImage: a.userImage ? `${S3_PROXY}${a.userImage}` : null,
                game: a.game,
                amount: a.amount,
                won: a.won,
                timestamp: new Date(a.timestamp),
                user: null,
            };

            User._fetch(a.userId).then((user) => {
                (event as any).user = user;
            });

            this.emit("arcadeActivity", event);
            return;
        }

        if (data.type === "notification") {
            const timestamp = new Date(data.timestamp);

            if (data.title === "Money received!") {
                const match = data.message.match(
                    /You received \$([0-9.]+) from @([a-zA-Z0-9_]+)/,
                );
                if (match) {
                    const e: ReceiveCashEvent = {
                        amount: parseFloat(match[1]),
                        senderUsername: match[2],
                        sender: null,
                        timestamp,
                    };
                    (UserFactory as any)(match[2]).then((user: User | null) => {
                        e.sender = user;
                    });
                    this.emit("receiveCash", e);
                    return;
                }
            }

            if (data.title === "Coins received!") {
                const match = data.message.match(
                    /You received ([0-9.]+) \*([A-Z0-9]+) from @([a-zA-Z0-9_]+)/,
                );
                if (match) {
                    const e: ReceiveCoinsEvent = {
                        amount: parseFloat(match[1]),
                        coinSymbol: match[2],
                        senderUsername: match[3],
                        sender: null,
                        timestamp,
                    };
                    (UserFactory as any)(match[3]).then((user: User | null) => {
                        e.sender = user;
                    });
                    this.emit("receiveCoins", e);
                    return;
                }
            }

            // Generic notification fallback
            this.emit("notification", {
                notificationType: data.notificationType,
                title: data.title,
                message: data.message,
                link: data.link ?? null,
                timestamp,
            });
        }
    }
}

export const Events = new EventsSingleton();
