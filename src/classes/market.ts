import { Coin, CoinData } from "./Coin";
import { baseUrl } from "../helpers/baseURL";

export enum SortBy {
    MarketCap = "marketCap",
    CurrentPrice = "currentPrice",
    Change = "change",
    Volume = "volume",
}

export enum SortOrder {
    Desc = "desc",
    Asc = "asc",
}

export enum PriceFilter {
    All = "all",
    Under1 = "under1",
    From1To10 = "1to10",
    From10To100 = "10to100",
    Over100 = "over100",
}

export enum ChangeFilter {
    All = "all",
    Gainers = "gainers",
    Losers = "losers",
    Hot = "hot",
    Wild = "wild",
}

export type MarketQueryOptions = {
    sortBy?: SortBy;
    sortOrder?: SortOrder;
    priceFilter?: PriceFilter;
    changeFilter?: ChangeFilter;
    search?: string;
};

type MarketResponse = {
    coins: CoinData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const PAGE_SIZE = 12;

function buildUrl(
    page: number,
    limit: number,
    opts: MarketQueryOptions,
): string {
    const params = new URLSearchParams({
        search: opts.search ?? "",
        sortBy: opts.sortBy ?? SortBy.MarketCap,
        sortOrder: opts.sortOrder ?? SortOrder.Desc,
        priceFilter: opts.priceFilter ?? PriceFilter.All,
        changeFilter: opts.changeFilter ?? ChangeFilter.All,
        page: String(page),
        limit: String(limit),
    });
    return baseUrl(`/api/market?${params}`);
}

async function fetchPage(
    page: number,
    limit: number,
    opts: MarketQueryOptions,
): Promise<MarketResponse> {
    const res = await fetch(buildUrl(page, limit, opts));
    if (!res.ok) throw new Error(`Market fetch failed: ${res.status}`);
    return res.json();
}

export async function getTopCoins(
    count: number,
    from: number = 0,
    opts: MarketQueryOptions = {},
): Promise<Coin[]> {
    const coins: Coin[] = [];

    const startPage = Math.floor(from / PAGE_SIZE) + 1;
    const endPage = Math.ceil((from + count) / PAGE_SIZE);

    for (let page = startPage; page <= endPage; page++) {
        const data = await fetchPage(page, PAGE_SIZE, opts);

        for (const entry of data.coins) {
            const absoluteIndex =
                (page - 1) * PAGE_SIZE + data.coins.indexOf(entry);
            if (absoluteIndex < from) continue;
            if (coins.length >= count) break;

            coins.push(new Coin(entry));
        }

        if (coins.length >= count) break;
    }

    return coins;
}
