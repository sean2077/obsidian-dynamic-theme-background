import assert from "node:assert/strict";
import test from "node:test";

import { buildWallpaperApiUrl } from "../src/wallpaper-apis/core/url-params";

void test("custom API parameters extend existing queries and preserve fragments", () => {
    const result = buildWallpaperApiUrl("https://example.com/images?country=cn#results", {
        api_key: "a secret/value",
        page: 2,
    });
    const url = new URL(result);

    assert.equal(url.searchParams.get("country"), "cn");
    assert.equal(url.searchParams.get("api_key"), "a secret/value");
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.hash, "#results");
});

void test("an empty parameter set leaves a custom endpoint byte-for-byte unchanged", () => {
    const endpoint = "https://example.com/images?country=cn";

    assert.equal(buildWallpaperApiUrl(endpoint, {}), endpoint);
});
