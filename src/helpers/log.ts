const PREFIX = "RugplaySDK";

function formatPrefix(domain?: string): string {
    return domain ? `${PREFIX} [${domain}]:` : `${PREFIX}:`;
}

export function log(message: string, domain?: string): void {
    console.log(formatPrefix(domain), message);
}

export function info(message: string, domain?: string): void {
    console.info(formatPrefix(domain), message);
}

export function warn(message: string, domain?: string): void {
    console.warn(formatPrefix(domain), message);
}

export function error(message: string, domain?: string): void {
    console.error(formatPrefix(domain), message);
}
