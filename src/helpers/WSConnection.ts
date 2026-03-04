import { EventEmitter } from "./EventEmitter";
import { error } from "./log";

const MAX_RECONNECT_DELAY = 30_000;

export type BaseWSEvents = {
    ready: [];
    connect: [];
    disconnect: [];
    retry: [number];
    error: [Event];
};

export abstract class WSConnection<
    Events extends BaseWSEvents,
> extends EventEmitter<Events> {
    protected _socket: WebSocket | null = null;
    protected _shouldReconnect: boolean = false;
    protected _reconnectDelay: number = 1000;

    abstract get wsUrl(): string;
    protected abstract _onOpen(): Promise<void>;
    protected abstract _onMessage(event: MessageEvent): void;

    async connect(): Promise<void> {
        this._shouldReconnect = true;
        return new Promise(async (resolve, reject) => {
            const unsub = this.once("ready", () => resolve());
            this.once("error", (err) => {
                unsub();
                reject(err);
            });
            try {
                await this._createSocket();
            } catch (e) {
                unsub();
                reject(e);
            }
        });
    }

    disconnect(): void {
        this._shouldReconnect = false;
        this._cleanup();
    }

    get connected(): boolean {
        return this._socket?.readyState === WebSocket.OPEN;
    }

    send(data: object): boolean {
        if (this._socket?.readyState !== WebSocket.OPEN) return false;
        this._socket.send(JSON.stringify(data));
        return true;
    }

    private _pongCallbacks: Array<() => void> = [];

    protected _handlePong(): void {
        const cb = this._pongCallbacks.shift();
        if (cb) cb();
    }

    async measureLatency(): Promise<number | null> {
        if (!this.connected) return null;
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this._pongCallbacks = this._pongCallbacks.filter(
                    (cb) => cb !== onPong,
                );
                resolve(null);
            }, 5000);

            const start = performance.now();
            const onPong = () => {
                clearTimeout(timeout);
                resolve(performance.now() - start);
            };

            this._pongCallbacks.push(onPong);
            this.send({ type: "ping" });
        });
    }

    protected _cleanup(): void {
        if (this._socket) this._socket.close();
        this._socket = null;
    }

    protected async _createSocket(): Promise<void> {
        this._socket = new WebSocket(this.wsUrl);

        this._socket.addEventListener("open", async () => {
            this._reconnectDelay = 1000;
            try {
                await this._onOpen();
            } catch (e: any) {
                error(
                    "_onOpen failed, closing socket.",
                    "Websocket Connection Manager",
                );
                this._socket?.close();
            }
        });

        this._socket.addEventListener("message", (event) =>
            this._onMessage(event),
        );

        this._socket.addEventListener("close", () => {
            this._cleanup();
            this.emit("disconnect");

            if (this._shouldReconnect) {
                this.emit("retry", this._reconnectDelay);
                setTimeout(() => this._createSocket(), this._reconnectDelay);
                this._reconnectDelay = Math.min(
                    this._reconnectDelay * 2,
                    MAX_RECONNECT_DELAY,
                );
            }
        });

        this._socket.addEventListener("error", (err) => {
            this.emit("error", err);
        });
    }
}
