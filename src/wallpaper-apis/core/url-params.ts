import type { WallpaperApiParams } from "./types";

/** Adds persisted or runtime-hydrated API parameters without discarding an endpoint's existing query. */
export function buildWallpaperApiUrl(baseUrl: string, params: WallpaperApiParams): string {
    if (Object.keys(params).length === 0) return baseUrl;

    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
        if (value === "") continue;
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}
