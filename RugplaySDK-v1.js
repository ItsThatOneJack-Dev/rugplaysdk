// ==UserScript==
// @name         RugplaySDK
// @namespace    https://itoj.dev
// @version      1
// @description  The development draft of the RugplaySDK!
// @author       ItsThatOneJack
// @match        *://*.rugplay.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rugplay.com
// @grant        none
// ==/UserScript==

/////////////////////////////////
// Define the RugplaySDK objects.
/////////////////////////////////

/* Main */ window.rugplaySDK = window.rugplaySDK ?? {};
/* Helpers */ window.rugplaySDK.helpers = window.rugplaySDK.helpers ?? {};

///////////////////////////
// Define the core helpers.
///////////////////////////

// To decode Svelte data blobs.
window.rugplaySDK.helpers.decodeSvelteData = async function (
    json,
    nodeIndex = 0,
) {
    const { unflatten } = await import("https://esm.sh/devalue");

    const nodes = json.nodes.filter(
        (n) => n.type === "data" && Array.isArray(n.data),
    );
    const node = nodes[nodeIndex];
    if (!node) return null;

    return unflatten(node.data);
};

window.rugplaySDK.helpers.resolveCoinAmount = async function (
    coinSymbol,
    amount,
) {
    if (typeof amount === "object" && Object.isFrozen(amount)) {
        if (!("__percent" in amount))
            throw new Error(
                "RugplaySDK: Invalid sentinel object passed as amount — missing __percent.",
            );
        if (amount.__percent === 0) return 0;
        const held = await window.rugplaySDK.getHoldingAmount(coinSymbol);
        return held * (amount.__percent / 100);
    }
    return amount;
};

window.rugplaySDK.helpers.resolveCashAmount = async function (amount) {
    if (typeof amount === "object" && Object.isFrozen(amount)) {
        if (!("__percent" in amount))
            throw new Error(
                "RugplaySDK: Invalid sentinel object passed as amount — missing __percent.",
            );
        if (amount.__percent === 0) return 0;
        const balance = await window.rugplaySDK.getBalance();
        return balance * (amount.__percent / 100);
    }
    return amount;
};

//////////////////////////////////////
// Define special types and sentinels.
//////////////////////////////////////

window.rugplaySDK.User = class User {
    constructor({
        id,
        displayName,
        username,
        email,
        avatarUrl,
        bio,
        nameColor,
        baseCurrencyBalance,
        isAdmin,
        prestigeLevel,
        holdings,
    }) {
        this.id = id;
        this.displayName = displayName;
        this.username = username;
        this.email = email ?? null;
        this.avatarUrl = avatarUrl
            ? `https://rugplay.com/api/proxy/s3/${avatarUrl}`
            : null;
        this.bio = bio ?? null;
        this.nameColor = nameColor ?? null;
        this.balance = baseCurrencyBalance ?? 0;
        this.isAdmin = isAdmin ?? false;
        this.prestigeLevel = prestigeLevel ?? 0;
        this.holdings = holdings ?? [];
    }
};

window.rugplaySDK.Coin = class Coin {
    constructor({
        id,
        name,
        symbol,
        icon,
        currentPrice,
        marketCap,
        volume24h,
        change24h,
        circulatingSupply,
        isListed,
        createdAt,
        creator,
    }) {
        this.id = id;
        this.name = name;
        this.symbol = symbol;
        this.iconUrl = icon ? `https://rugplay.com/api/proxy/s3/${icon}` : null;
        this.currentPrice = currentPrice;
        this.marketCap = marketCap;
        this.volume24h = volume24h;
        this.change24h = change24h;
        this.circulatingSupply = circulatingSupply;
        this.isListed = isListed;
        this.createdAt = createdAt ? new Date(createdAt) : null;
        this.creator = creator;
    }
};

// Sentinel for 100%
window.rugplaySDK.MAX = Object.freeze({
    __sentinel: "RugplaySDK Amounts: MAX/PERCENT_100/100%",
    __percent: 100,
});
window.rugplaySDK.PERCENT_100 = window.rugplaySDK.MAX;

// Sentinel for 75%
window.rugplaySDK.PERCENT_75 = Object.freeze({
    __sentinel: "RugplaySDK Amounts: PERCENT_75/75%",
    __percent: 75,
});

// Sentinel for 50%
window.rugplaySDK.HALF = Object.freeze({
    __sentinel: "RugplaySDK Amounts: HALF/PERCENT_50/50%",
    __percent: 50,
});
window.rugplaySDK.PERCENT_50 = window.rugplaySDK.MAX;

// Sentinel for 25%
window.rugplaySDK.PERCENT_25 = Object.freeze({
    __sentinel: "RugplaySDK Amounts: PERCENT_25/25%",
    __percent: 25,
});

// Sentinel for 0%
window.rugplaySDK.NONE = Object.freeze({
    __sentinel: "RugplaySDK Amounts: NONE/PERCENT_0/0%",
    __percent: 0,
});
window.rugplaySDK.PERCENT_0 = window.rugplaySDK.NONE;

////////////////////////////////
// Define the creator functions.
////////////////////////////////

window.rugplaySDK.getUser = async function (usernameOrId) {
    const res = await fetch(
        `https://rugplay.com/user/${usernameOrId}/__data.json?x-sveltekit-invalidated=11`,
    );
    if (!res.ok) return null;

    const json = await res.json();
    const decoded = await window.rugplaySDK.helpers.decodeSvelteData(json, 1);
    if (!decoded?.profileData?.profile) return null;

    const u = decoded.profileData.profile;

    return new window.rugplaySDK.User({
        id: u.id,
        displayName: u.name,
        username: u.username,
        avatarUrl: u.image,
        bio: u.bio,
        nameColor: u.nameColor,
        baseCurrencyBalance: u.baseCurrencyBalance,
        isAdmin: u.isAdmin,
        prestigeLevel: u.prestigeLevel,
    });
};

window.rugplaySDK.getCoin = async function (coinSymbol) {
    const symbol = coinSymbol.toUpperCase();
    const res = await fetch(
        `https://rugplay.com/coin/${symbol}/__data.json?x-sveltekit-invalidated=11`,
    );
    if (!res.ok) return null;

    const json = await res.json();
    const decoded = await window.rugplaySDK.helpers.decodeSvelteData(json, 1);
    if (!decoded?.coin) return null;

    const c = decoded.coin;

    const creator = await window.rugplaySDK.getUser(c.creatorId);

    return new window.rugplaySDK.Coin({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        icon: c.icon,
        currentPrice: c.currentPrice,
        marketCap: c.marketCap,
        volume24h: c.volume24h,
        change24h: c.change24h,
        circulatingSupply: c.circulatingSupply,
        isListed: c.isListed,
        createdAt: c.createdAt,
        creator,
    });
};

////////////////////////////////////////////////////////
// Define the transfer, trading and ownership functions.
////////////////////////////////////////////////////////

window.rugplaySDK.percent = function (pct) {
    if (pct < 0 || pct > 100)
        throw new Error("RugplaySDK: percent() must be between 0 and 100.");
    return Object.freeze({ __percent: pct });
};

window.rugplaySDK.getOwnedNameColours = async function () {
    const res = await fetch("https://rugplay.com/api/shop/inventory");

    if (!res.ok) return {};

    const data = await res.json();
    return data?.nameColors ?? [];
};

window.rugplaySDK.getBalance = async function () {
    const res = await fetch("https://rugplay.com/api/portfolio/total");
    if (!res.ok) return 0;
    const data = await res.json();
    return data.baseCurrencyBalance ?? 0;
};

window.rugplaySDK.getGemsBalance = async function () {
    const res = await fetch("https://rugplay.com/api/shop/inventory");
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.gems ?? 0;
};

window.rugplaySDK.getNetWorth = async function () {
    const res = await fetch("https://rugplay.com/api/portfolio/total");
    if (!res.ok) return 0;
    const data = await res.json();
    return data.totalValue ?? 0;
};

window.rugplaySDK.getHoldings = async function () {
    const res = await fetch("https://rugplay.com/api/portfolio/total");
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.coinHoldings) return null;

    const holdings = {};
    for (const holding of data.coinHoldings) {
        holdings[holding.symbol] = {
            symbol: holding.symbol,
            iconUrl: holding.icon
                ? `https://rugplay.com/api/proxy/s3/${holding.icon}`
                : null,
            quantity: holding.quantity,
            currentPrice: holding.currentPrice,
            value: holding.value,
            change24h: holding.change24h,
            avgPurchasePrice: holding.avgPurchasePrice,
            percentageChange: holding.percentageChange,
            costBasis: holding.costBasis,
        };
    }
    return holdings;
};

window.rugplaySDK.getHoldingAmount = async function (coinSymbol) {
    const holdings = await window.rugplaySDK.getHoldings();
    if (!holdings) return 0;
    return holdings[coinSymbol.toUpperCase()]?.quantity ?? 0;
};

window.rugplaySDK.sendCash = async function (recipientUsername, amount) {
    const resolved = await rugplaySDK.helpers.resolveCashAmount(amount);
    if (resolved === 0) return true;

    const res = await fetch("https://rugplay.com/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            recipientUsername,
            type: "CASH",
            amount: resolved,
        }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.success ?? false;
};

window.rugplaySDK.sendCoin = async function (
    recipientUsername,
    amount,
    coinSymbol,
) {
    const resolved = await rugplaySDK.helpers.resolveCoinAmount(
        coinSymbol,
        amount,
    );
    if (resolved === 0) return true;

    const res = await fetch("https://rugplay.com/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            recipientUsername,
            type: "COIN",
            amount: resolved,
            coinSymbol,
        }),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return data.success ?? false;
};

window.rugplaySDK.buyCoin = async function (coinSymbol, amount) {
    const resolved = await rugplaySDK.helpers.resolveCashAmount(amount);
    if (resolved === 0) return true;

    const res = await fetch(
        `https://rugplay.com/api/coin/${coinSymbol.toUpperCase()}/trade`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "BUY", amount: resolved }),
        },
    );

    if (!res.ok) return false;
    const data = await res.json();
    return data.success ?? false;
};

window.rugplaySDK.sellCoin = async function (coinSymbol, amount) {
    const resolved = await rugplaySDK.helpers.resolveCoinAmount(
        coinSymbol,
        amount,
    );
    if (resolved === 0) return true;

    const res = await fetch(
        `https://rugplay.com/api/coin/${coinSymbol.toUpperCase()}/trade`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "SELL", amount: resolved }),
        },
    );

    if (!res.ok) return false;
    const data = await res.json();
    return data.success ?? false;
};

//////////////////////////////////////////
// Event handling, dispatch and listening.
//////////////////////////////////////////

window.rugplaySDK.events = {
    _listeners: {},
    _socket: null,
    _reconnectDelay: 1000,
    _maxReconnectDelay: 30000,
    _shouldReconnect: true,

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return () => this.off(event, callback);
    },

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(
            (cb) => cb !== callback,
        );
    },

    emit(event, ...args) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach((cb) => cb(...args));
    },

    once(event, callback) {
        const unsub = this.on(event, (...args) => {
            callback(...args);
            unsub();
        });
    },

    send(data) {
        if (this._socket?.readyState === WebSocket.OPEN) {
            this._socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    },

    async connect() {
        this._shouldReconnect = true;

        // Get current user ID from node 0 of any __data.json endpoint
        let userId = null;
        try {
            const res = await fetch(
                "https://rugplay.com/user/300/__data.json?x-sveltekit-invalidated=11",
            );
            const json = await res.json();
            const decoded = await window.rugplaySDK.helpers.decodeSvelteData(
                json,
                0,
            );
            userId = decoded?.userSession?.id ?? null;
        } catch (e) {
            console.warn("RugplaySDK WS: could not resolve user ID", e);
        }

        this._createSocket(userId);
    },

    disconnect() {
        this._shouldReconnect = false;
        if (this._socket) this._socket.close();
        this._socket = null;
    },

    _createSocket(userId) {
        this._socket = new WebSocket("wss://ws.rugplay.com/");

        this._socket.addEventListener("open", () => {
            console.log("RugplaySDK WS: connected");
            this._reconnectDelay = 1000;
            this.emit("connect");

            this.send({ type: "subscribe", channel: "trades:all" });
            this.send({ type: "subscribe", channel: "trades:large" });
            this.send({ type: "set_coin", coinSymbol: "@global" });

            if (userId) this.send({ type: "set_user", userId: String(userId) });

            this.emit("ready");
        });

        this._socket.addEventListener("message", (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            // Handle ping automatically
            if (data.type === "ping") {
                this.send({ type: "pong" });
                return;
            }

            // Handle trade events
            if (data.type === "all-trades" && data.data) {
                const trade = data.data;
                const eventType =
                    trade.type === "BUY"
                        ? "buy"
                        : trade.type === "SELL"
                          ? "sell"
                          : null;
                if (eventType) {
                    this.emit(eventType, {
                        username: trade.username,
                        userId: trade.userId,
                        userImage: trade.userImage
                            ? `https://rugplay.com/api/proxy/s3/${trade.userImage}`
                            : null,
                        coinSymbol: trade.coinSymbol,
                        coinName: trade.coinName,
                        coinIcon: trade.coinIcon
                            ? `https://rugplay.com/api/proxy/s3/${trade.coinIcon}`
                            : null,
                        amount: trade.amount,
                        totalValue: trade.totalValue,
                        price: trade.price,
                        timestamp: new Date(trade.timestamp),
                    });
                }
                return;
            }
        });

        this._socket.addEventListener("close", () => {
            this.emit("disconnect");
            if (this._shouldReconnect) {
                console.log(
                    `RugplaySDK WS: disconnected, retrying in ${this._reconnectDelay}ms`,
                );
                this.emit("retry", this._reconnectDelay);
                setTimeout(
                    () => this._createSocket(userId),
                    this._reconnectDelay,
                );
                this._reconnectDelay = Math.min(
                    this._reconnectDelay * 2,
                    this._maxReconnectDelay,
                );
            }
        });

        this._socket.addEventListener("error", (err) => {
            console.error("RugplaySDK WS: error", err);
            this.emit("error", err);
        });
    },
};
