import type { BackgroundItem, DTBSettings, TimeRule } from "../types";
import { WallpaperApiType } from "../wallpaper-apis/core/types";
import type { ApiValueType, WallpaperApiConfig } from "../wallpaper-apis/core/types";
import { isRecord } from "../utils/type-guards";

const BACKGROUND_TYPES = new Set(["image", "color", "gradient"]);
const BACKGROUND_SIZES = new Set(["cover", "contain", "auto", "intelligent"]);
const MODES = new Set(["time-based", "interval", "manual"]);
const WALLPAPER_API_TYPES = new Set<string>(Object.values(WallpaperApiType));
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function clone<T>(value: T): T {
    if (Array.isArray(value)) {
        const items = value as unknown[];
        return items.map((item) => clone(item)) as T;
    }
    if (!isRecord(value)) {
        return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (!UNSAFE_KEYS.has(key)) {
            result[key] = clone(item);
        }
    }
    return result as T;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): boolean {
    return value === undefined || isFiniteNumber(value);
}

function isOptionalString(value: unknown): boolean {
    return value === undefined || typeof value === "string";
}

function isTimeRule(value: unknown): value is TimeRule {
    return (
        isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.startTime === "string" &&
        typeof value.endTime === "string" &&
        typeof value.backgroundId === "string" &&
        typeof value.enabled === "boolean"
    );
}

function isBackground(value: unknown): value is BackgroundItem {
    return (
        isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        typeof value.type === "string" &&
        BACKGROUND_TYPES.has(value.type) &&
        typeof value.value === "string" &&
        isOptionalString(value.remoteUrl) &&
        isOptionalNumber(value.blurDepth) &&
        isOptionalNumber(value.brightness4Bg) &&
        isOptionalNumber(value.saturate4Bg) &&
        isOptionalString(value.bgColorLight) &&
        isOptionalNumber(value.bgColorOpacityLight) &&
        isOptionalString(value.bgColorDark) &&
        isOptionalNumber(value.bgColorOpacityDark) &&
        (value.bgSize === undefined || (typeof value.bgSize === "string" && BACKGROUND_SIZES.has(value.bgSize)))
    );
}

function isApiValue(value: unknown): value is ApiValueType {
    return typeof value === "string" || typeof value === "boolean" || isFiniteNumber(value);
}

function isValueRecord(value: unknown, predicate: (entry: unknown) => boolean): boolean {
    return isRecord(value) && Object.values(value).every(predicate);
}

function isWallpaperApi(value: unknown): value is WallpaperApiConfig {
    return (
        isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.type === "string" &&
        WALLPAPER_API_TYPES.has(value.type) &&
        typeof value.enabled === "boolean" &&
        typeof value.name === "string" &&
        typeof value.baseUrl === "string" &&
        isOptionalString(value.description) &&
        isValueRecord(value.params, isApiValue) &&
        (value.headers === undefined || isValueRecord(value.headers, (entry) => typeof entry === "string")) &&
        (value.secretRefs === undefined || isSecretRefs(value.secretRefs)) &&
        (value.endpoints === undefined || isValueRecord(value.endpoints, isOptionalString)) &&
        (value.customSettings === undefined || isValueRecord(value.customSettings, isOptionalString))
    );
}

function isSecretRefs(value: unknown): boolean {
    return (
        isRecord(value) &&
        (value.params === undefined || isValueRecord(value.params, (entry) => typeof entry === "string")) &&
        (value.headers === undefined || isValueRecord(value.headers, (entry) => typeof entry === "string"))
    );
}

function arrayOrDefault<T>(value: unknown, fallback: T[], predicate: (entry: unknown) => entry is T): T[] {
    return Array.isArray(value) && value.every(predicate) ? clone(value) : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function numberOrDefault(
    value: unknown,
    fallback: number,
    minimum: number,
    maximum = Number.POSITIVE_INFINITY
): number {
    return isFiniteNumber(value) && value >= minimum && value <= maximum ? value : fallback;
}

function integerOrDefault(value: unknown, fallback: number, minimum: number, maximum: number): number {
    return isFiniteNumber(value) && Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

/**
 * Converts untrusted persisted data into a complete, isolated settings value.
 */
export function normalizeSettings(loaded: unknown, defaults: DTBSettings): DTBSettings {
    const fallback = clone(defaults);
    if (!isRecord(loaded)) {
        return fallback;
    }

    const backgrounds = arrayOrDefault(loaded.backgrounds, fallback.backgrounds, isBackground);
    const currentIndex = integerOrDefault(
        loaded.currentIndex,
        fallback.currentIndex,
        0,
        Math.max(backgrounds.length - 1, 0)
    );

    return {
        credentialStorageVersion: integerOrDefault(
            loaded.credentialStorageVersion,
            0,
            0,
            Number.MAX_SAFE_INTEGER
        ),
        enabled: booleanOrDefault(loaded.enabled, fallback.enabled),
        statusBarEnabled: booleanOrDefault(loaded.statusBarEnabled, fallback.statusBarEnabled),
        blurDepth: numberOrDefault(loaded.blurDepth, fallback.blurDepth, 0, 30),
        brightness4Bg: numberOrDefault(loaded.brightness4Bg, fallback.brightness4Bg, 0, 1.5),
        saturate4Bg: numberOrDefault(loaded.saturate4Bg, fallback.saturate4Bg, 0, 2),
        bgColorLight: stringOrDefault(loaded.bgColorLight, fallback.bgColorLight),
        bgColorOpacityLight: numberOrDefault(loaded.bgColorOpacityLight, fallback.bgColorOpacityLight, 0, 1),
        bgColorDark: stringOrDefault(loaded.bgColorDark, fallback.bgColorDark),
        bgColorOpacityDark: numberOrDefault(loaded.bgColorOpacityDark, fallback.bgColorOpacityDark, 0, 1),
        bgSize:
            typeof loaded.bgSize === "string" && BACKGROUND_SIZES.has(loaded.bgSize)
                ? (loaded.bgSize as DTBSettings["bgSize"])
                : fallback.bgSize,
        mode:
            typeof loaded.mode === "string" && MODES.has(loaded.mode)
                ? (loaded.mode as DTBSettings["mode"])
                : fallback.mode,
        timeRules: arrayOrDefault(loaded.timeRules, fallback.timeRules, isTimeRule),
        intervalMinutes: numberOrDefault(loaded.intervalMinutes, fallback.intervalMinutes, 1),
        localBackgroundFolder: stringOrDefault(loaded.localBackgroundFolder, fallback.localBackgroundFolder),
        backgrounds,
        currentIndex,
        enableRandomWallpaper: booleanOrDefault(loaded.enableRandomWallpaper, fallback.enableRandomWallpaper),
        wallpaperApis: arrayOrDefault(loaded.wallpaperApis, fallback.wallpaperApis, isWallpaperApi),
    };
}
