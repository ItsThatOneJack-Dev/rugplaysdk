import User from "./classes/User";
import Coin from "./classes/Coin";
import Channel from "./classes/Channel";
import { decodeSvelteData } from "./helpers/decodeSvelteData";
import { composeGeckoForm } from "./helpers/composeGeckoForm";
import { nameStyles } from "./classes/nameStyles";
import {
    isPercentAmount,
    percent,
    resolveAmount,
} from "./helpers/resolveAmount";
import { Chat } from "./classes/Chat";
import { Message } from "./classes/Message";
import { RugpayRequest } from "./classes/RugpayRequest";
import { results } from "./classes/results";
import { EventEmitter } from "./helpers/EventEmitter";
import { cache } from "./helpers/cache";
import { Events } from "./classes/Events";
import { crateTiers } from "./classes/crateTiers";
import { redeemPromoCode } from "./helpers/redeemPromoCode";
import { Arcade } from "./classes/Arcade";
import { achievements } from "./classes/achievements";
import { computeLevenshteinDistance } from "./helpers/computeLevenshteinDistance";
import { warn } from "./helpers/log";
import {
    linearBackoff,
    exponentialBackoff,
    logarithmicBackoff,
    steppedBackoff,
    customBackoff,
} from "./helpers/backoff";
import { isLoggedIn } from "./helpers/isLoggedIn";
import { Leaderboard } from "./classes/Leaderboard";
import { Hopium } from "./classes/Hopium";
import { escapeHTML, sanitiseHTML } from "./helpers/sanitise";
import { Info } from "./classes/Info";
import { towerDifficulty } from "./classes/towerDifficulty";

declare global {
    interface Window {
        rugplaySDK: typeof rugplaySDK;
        RPSDK$: typeof rugplaySDK;
    }
}

export const rugplaySDK = {
    helpers: {
        decodeSvelteData,
        composeGeckoForm,
        resolveAmount,
        isPercentAmount,
        computeLevenshteinDistance,
        linearBackoff,
        exponentialBackoff,
        logarithmicBackoff,
        steppedBackoff,
        customBackoff,
        escapeHTML,
        sanitiseHTML,
    },
    isLoggedIn,
    percent,
    nameStyles,
    results,
    User,
    Coin,
    Chat,
    Channel,
    Message,
    RugpayRequest,
    EventEmitter,
    cache,
    Events,
    crateTiers,
    redeemPromoCode,
    arcade: Arcade,
    achievements,
    leaderboard: Leaderboard,
    hopium: Hopium,
    info: Info,
    towerDifficulty,
};

export type RugplaySDK = typeof rugplaySDK;

if (typeof window !== "undefined") {
    window.rugplaySDK = rugplaySDK;
    window.RPSDK$ = rugplaySDK;

    User.me().then((me) => {
        if (!me) {
            warn(
                "No active session detected. Please log in!",
                "Automatic Connector",
            );
            return;
        }

        Chat.connect().catch((err) => {
            warn(`Chat auto-connect failed: ${err}`, "Automatic Connector");
        });
        Events.connect().catch((err) => {
            warn(`Events auto-connect failed: ${err}`, "Automatic Connector");
        });
    });
}
