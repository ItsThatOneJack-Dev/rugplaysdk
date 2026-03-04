const TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
    value: T;
    cachedAt: number;
}

class Cache {
    private _store: Map<string, CacheEntry<unknown>> = new Map();
    private _enabled: boolean = true;

    get<T>(key: string): T | null {
        if (!this._enabled) return null;
        const entry = this._store.get(key) as CacheEntry<T> | undefined;
        if (!entry) return null;
        if (Date.now() - entry.cachedAt > TTL) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    set<T>(key: string, value: T): void {
        if (!this._enabled) return;
        this._store.set(key, { value, cachedAt: Date.now() });
    }

    expire(): void {
        this._store.clear();
    }

    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        if (!enabled) this.expire();
    }

    getEnabled(): boolean {
        return this._enabled;
    }
}

export const cache = new Cache();
