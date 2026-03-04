export interface TokenStore {
    get(): string | null;
    set(token: string): void;
    remove(): void;
}

export const memoryTokenStore = (): TokenStore => {
    let _token: string | null = null;
    return {
        get: () => _token,
        set: (t) => {
            _token = t;
        },
        remove: () => {
            _token = null;
        },
    };
};

export const localStorageTokenStore = (
    key: string = "br_auth_token",
): TokenStore => ({
    get: () => localStorage.getItem(key),
    set: (t) => localStorage.setItem(key, t),
    remove: () => localStorage.removeItem(key),
});
