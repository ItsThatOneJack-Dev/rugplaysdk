declare const BASE_DOMAIN: string;
declare const BASE_WS_DOMAIN: string;

export function baseUrl(path: string): string {
    return `https://${BASE_DOMAIN}${path}`;
}

export function wsUrl(path: string): string {
    return `wss://${BASE_WS_DOMAIN}${path}`;
}
