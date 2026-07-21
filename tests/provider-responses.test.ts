import assert from "node:assert/strict";
import test from "node:test";

import {
    parsePexelsResponse,
    parsePixabayResponse,
    parseQihoo360CategoryResponse,
    parseQihoo360HotSearchResponse,
    parseQihoo360WallpaperResponse,
    parseUnsplashPhotoArray,
    parseUnsplashSearchResponse,
    parseWallhavenResponse,
} from "../src/wallpaper-apis/core/provider-responses";

void test("stock-photo provider responses are validated before use", () => {
    assert.deepEqual(parsePexelsResponse({ photos: [{ id: 1 }], total_results: 1 }), {
        photos: [{ id: 1 }],
        total_results: 1,
    });
    assert.deepEqual(parsePixabayResponse({ hits: [{ id: 2 }], total: 1, totalHits: 1 }), {
        hits: [{ id: 2 }],
        total: 1,
        totalHits: 1,
    });
    assert.deepEqual(parseUnsplashSearchResponse({ results: [{ id: "three" }], total: 1, total_pages: 1 }), {
        results: [{ id: "three" }],
        total: 1,
        total_pages: 1,
    });
    assert.deepEqual(parseUnsplashPhotoArray([{ id: "random" }]), [{ id: "random" }]);
    assert.deepEqual(parseWallhavenResponse({ data: [{ id: "four" }], meta: { last_page: 1 } }), {
        data: [{ id: "four" }],
        meta: { last_page: 1, per_page: undefined, total: undefined },
    });
});

void test("stock-photo provider validators reject malformed shapes", () => {
    assert.throws(() => parsePexelsResponse({ photos: ["not-an-object"] }), /array of objects/u);
    assert.throws(() => parsePixabayResponse({ total: "1" }), /finite number/u);
    assert.throws(() => parseUnsplashSearchResponse({ results: {} }), /array of objects/u);
    assert.throws(() => parseUnsplashPhotoArray([null]), /array of objects/u);
    assert.throws(() => parseWallhavenResponse({ meta: { last_page: "1" } }), /finite number/u);
});

void test("Qihoo response validators preserve only checked data", () => {
    assert.deepEqual(
        parseQihoo360CategoryResponse({
            data: [{ create_time: "now", id: "9", name: "Nature", order_num: "1", tag: "nature" }],
            errmsg: "",
            errno: "0",
            total: "1",
        }).data,
        [{ create_time: "now", id: "9", name: "Nature", order_num: "1", tag: "nature" }]
    );
    assert.deepEqual(
        parseQihoo360WallpaperResponse({
            data: [{ cid: "9", resolution: "1920x1080", url: "https://example.test/image.jpg" }],
            errmsg: "",
            errno: "0",
            total: "1",
        }).data,
        [{ cid: "9", resolution: "1920x1080", url: "https://example.test/image.jpg" }]
    );
    assert.deepEqual(parseQihoo360HotSearchResponse({ data: ["nature"], error: 0, total: 1 }), {
        data: ["nature"],
        error: 0,
        total: 1,
    });
});

void test("Qihoo response validators reject malformed nested data", () => {
    assert.throws(
        () =>
            parseQihoo360CategoryResponse({
                data: [{ create_time: "now", id: 9, name: "Nature", order_num: "1", tag: "nature" }],
                errmsg: "",
                errno: "0",
                total: "1",
            }),
        /id must be a string/u
    );
    assert.throws(
        () =>
            parseQihoo360WallpaperResponse({
                data: [{ cid: "9", resolution: 1920, url: "https://example.test/image.jpg" }],
                errmsg: "",
                errno: "0",
                total: "1",
            }),
        /resolution must be a string/u
    );
    assert.throws(
        () => parseQihoo360HotSearchResponse({ data: ["nature", 1], error: 0, total: 2 }),
        /array of strings/u
    );
});
