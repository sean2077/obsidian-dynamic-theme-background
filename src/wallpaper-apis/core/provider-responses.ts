import { isRecord } from "../../utils/type-guards";

export type JsonRecord = Record<string, unknown>;

export interface PexelsResponse {
    photos?: JsonRecord[];
    total_results?: number;
}

export interface PixabayResponse {
    hits?: JsonRecord[];
    total?: number;
    totalHits?: number;
}

export interface UnsplashSearchResponse {
    results?: JsonRecord[];
    total?: number;
    total_pages?: number;
}

export interface WallhavenResponse {
    data?: JsonRecord[];
    meta?: {
        last_page?: number;
        per_page?: number;
        total?: number;
    };
}

export interface Qihoo360Category {
    create_time: string;
    id: string;
    name: string;
    order_num: string;
    tag: string;
}

export interface Qihoo360CategoryResponse {
    data: Qihoo360Category[];
    errmsg: string;
    errno: string;
    total: string;
}

export interface Qihoo360Wallpaper {
    cid: string;
    url: string;
    [key: string]: string | undefined;
}

export interface Qihoo360WallpaperResponse {
    data: Qihoo360Wallpaper[];
    errmsg: string;
    errno: string;
    total: string;
}

export interface Qihoo360HotSearchResponse {
    data: string[];
    error: number;
    total: number;
}

function responseRecord(value: unknown, label: string): JsonRecord {
    if (!isRecord(value)) throw new Error(`${label} response must be an object`);
    return value;
}

function recordArray(value: unknown, label: string): JsonRecord[] {
    if (!Array.isArray(value) || !value.every(isRecord)) {
        throw new Error(`${label} must be an array of objects`);
    }
    return value;
}

function optionalRecordArray(value: unknown, label: string): JsonRecord[] | undefined {
    return value === undefined ? undefined : recordArray(value, label);
}

function finiteNumber(value: unknown, label: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number`);
    }
    return value;
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
    return value === undefined ? undefined : finiteNumber(value, label);
}

function stringValue(value: unknown, label: string): string {
    if (typeof value !== "string") throw new Error(`${label} must be a string`);
    return value;
}

function stringArray(value: unknown, label: string): string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
        throw new Error(`${label} must be an array of strings`);
    }
    return value;
}

export function parsePexelsResponse(value: unknown): PexelsResponse {
    const response = responseRecord(value, "Pexels");
    return {
        photos: optionalRecordArray(response.photos, "Pexels photos"),
        total_results: optionalFiniteNumber(response.total_results, "Pexels total_results"),
    };
}

export function parsePixabayResponse(value: unknown): PixabayResponse {
    const response = responseRecord(value, "Pixabay");
    return {
        hits: optionalRecordArray(response.hits, "Pixabay hits"),
        total: optionalFiniteNumber(response.total, "Pixabay total"),
        totalHits: optionalFiniteNumber(response.totalHits, "Pixabay totalHits"),
    };
}

export function parseUnsplashSearchResponse(value: unknown): UnsplashSearchResponse {
    const response = responseRecord(value, "Unsplash search");
    return {
        results: optionalRecordArray(response.results, "Unsplash results"),
        total: optionalFiniteNumber(response.total, "Unsplash total"),
        total_pages: optionalFiniteNumber(response.total_pages, "Unsplash total_pages"),
    };
}

export function parseUnsplashPhotoArray(value: unknown): JsonRecord[] {
    return recordArray(value, "Unsplash photos");
}

export function parseWallhavenResponse(value: unknown): WallhavenResponse {
    const response = responseRecord(value, "Wallhaven");
    const metaValue = response.meta;
    let meta: WallhavenResponse["meta"];
    if (metaValue !== undefined) {
        const metaRecord = responseRecord(metaValue, "Wallhaven meta");
        meta = {
            last_page: optionalFiniteNumber(metaRecord.last_page, "Wallhaven last_page"),
            per_page: optionalFiniteNumber(metaRecord.per_page, "Wallhaven per_page"),
            total: optionalFiniteNumber(metaRecord.total, "Wallhaven total"),
        };
    }
    return {
        data: optionalRecordArray(response.data, "Wallhaven data"),
        meta,
    };
}

export function parseQihoo360CategoryResponse(value: unknown): Qihoo360CategoryResponse {
    const response = responseRecord(value, "Qihoo category");
    const data = recordArray(response.data, "Qihoo category data").map((item, index) => ({
        create_time: stringValue(item.create_time, `Qihoo category ${index} create_time`),
        id: stringValue(item.id, `Qihoo category ${index} id`),
        name: stringValue(item.name, `Qihoo category ${index} name`),
        order_num: stringValue(item.order_num, `Qihoo category ${index} order_num`),
        tag: stringValue(item.tag, `Qihoo category ${index} tag`),
    }));
    return {
        data,
        errmsg: stringValue(response.errmsg, "Qihoo category errmsg"),
        errno: stringValue(response.errno, "Qihoo category errno"),
        total: stringValue(response.total, "Qihoo category total"),
    };
}

export function parseQihoo360WallpaperResponse(value: unknown): Qihoo360WallpaperResponse {
    const response = responseRecord(value, "Qihoo wallpaper");
    const data = recordArray(response.data, "Qihoo wallpaper data").map((item, index) => {
        const normalized: Record<string, string | undefined> = {};
        for (const [key, entry] of Object.entries(item)) {
            if (entry !== undefined && typeof entry !== "string") {
                throw new Error(`Qihoo wallpaper ${index} ${key} must be a string`);
            }
            normalized[key] = entry;
        }
        return {
            ...normalized,
            cid: stringValue(item.cid, `Qihoo wallpaper ${index} cid`),
            url: stringValue(item.url, `Qihoo wallpaper ${index} url`),
        };
    });
    return {
        data,
        errmsg: stringValue(response.errmsg, "Qihoo wallpaper errmsg"),
        errno: stringValue(response.errno, "Qihoo wallpaper errno"),
        total: stringValue(response.total, "Qihoo wallpaper total"),
    };
}

export function parseQihoo360HotSearchResponse(value: unknown): Qihoo360HotSearchResponse {
    const response = responseRecord(value, "Qihoo hot search");
    return {
        data: stringArray(response.data, "Qihoo hot search data"),
        error: finiteNumber(response.error, "Qihoo hot search error"),
        total: finiteNumber(response.total, "Qihoo hot search total"),
    };
}
