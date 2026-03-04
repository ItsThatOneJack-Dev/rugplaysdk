type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

let _fetchImpl: FetchImpl = (url, init) => fetch(url, init);

export function setSdkFetch(impl: FetchImpl): void {
    _fetchImpl = impl;
}

export function sdkFetch(url: string, init?: RequestInit): Promise<Response> {
    return _fetchImpl(url, init);
}
