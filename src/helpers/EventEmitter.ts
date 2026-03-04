type EventMap = Record<string, unknown[]>;
type Listener<T extends unknown[]> = (...args: T) => void;

export class EventEmitter<Events extends EventMap> {
    private _listeners: {
        [K in keyof Events]?: Listener<Events[K]>[];
    } = {};

    on<K extends keyof Events>(
        event: K,
        callback: Listener<Events[K]>,
    ): () => void {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event]!.push(callback);
        return () => this.off(event, callback);
    }

    off<K extends keyof Events>(event: K, callback: Listener<Events[K]>): void {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event]!.filter(
            (cb) => cb !== callback,
        );
    }

    once<K extends keyof Events>(
        event: K,
        callback: Listener<Events[K]>,
    ): () => void {
        const unsub = this.on(event, ((...args: Events[K]) => {
            callback(...args);
            unsub();
        }) as Listener<Events[K]>);
        return unsub;
    }

    emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
        this._listeners[event]?.forEach((cb) => cb(...args));
    }
}
