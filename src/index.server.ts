import { rugplaySDK } from "./index";

export * from "./index";
export { rugplaySDK } from "./index";
export { ServerAuth } from "./server/ServerAuth";
export type { ServerAuthConfig } from "./server/ServerAuth";

export function shutdown(): void {
    rugplaySDK.Chat.disconnect();
    rugplaySDK.Events.disconnect();
}
