import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeSettings } from "../src/core/settings";
import type { DTBSettings } from "../src/types";

function settingsFixture(): DTBSettings {
    return {
        credentialStorageVersion: 1,
        enabled: true,
        statusBarEnabled: true,
        blurDepth: 0,
        brightness4Bg: 0.9,
        saturate4Bg: 1,
        bgColorLight: "#fff",
        bgColorOpacityLight: 0.3,
        bgColorDark: "#000",
        bgColorOpacityDark: 0.4,
        bgSize: "intelligent",
        mode: "time-based",
        timeRules: [
            {
                id: "day",
                name: "Day",
                startTime: "06:00",
                endTime: "18:00",
                backgroundId: "gradient",
                enabled: true,
            },
        ],
        intervalMinutes: 60,
        localBackgroundFolder: "",
        backgrounds: [
            {
                id: "gradient",
                name: "Gradient",
                type: "gradient",
                value: "linear-gradient(red, blue)",
            },
        ],
        currentIndex: 0,
        enableRandomWallpaper: true,
        wallpaperApis: [],
    };
}

void test("invalid persisted data returns an isolated default value", () => {
    const defaults = settingsFixture();
    const normalized = normalizeSettings(null, defaults);

    normalized.backgrounds[0].name = "Changed";
    assert.equal(defaults.backgrounds[0].name, "Gradient");
});

void test("partial settings migrate while valid empty collections are preserved", () => {
    const normalized = normalizeSettings(
        {
            enabled: false,
            backgrounds: [],
            timeRules: [],
            wallpaperApis: [],
        },
        settingsFixture()
    );

    assert.equal(normalized.enabled, false);
    assert.equal(normalized.brightness4Bg, 0.9);
    assert.deepEqual(normalized.backgrounds, []);
    assert.deepEqual(normalized.timeRules, []);
});

void test("invalid scalar and nested values fall back without partial arrays", () => {
    const defaults = settingsFixture();
    const normalized = normalizeSettings(
        {
            blurDepth: Number.NaN,
            brightness4Bg: 99,
            backgrounds: [{ id: "broken" }],
            currentIndex: 0.5,
        },
        defaults
    );

    assert.equal(normalized.blurDepth, defaults.blurDepth);
    assert.equal(normalized.brightness4Bg, defaults.brightness4Bg);
    assert.deepEqual(normalized.backgrounds, defaults.backgrounds);
    assert.equal(normalized.currentIndex, 0);
});

void test("unknown and prototype-sensitive top-level fields are not retained", () => {
    const loaded = JSON.parse('{"enabled":false,"futureField":"ignored","__proto__":{"polluted":true}}') as unknown;
    const normalized = normalizeSettings(loaded, settingsFixture());

    assert.equal(normalized.enabled, false);
    assert.equal("futureField" in normalized, false);
    assert.equal("polluted" in normalized, false);
    assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

void test("interval settings cannot overflow the host timer delay", () => {
    const defaults = settingsFixture();

    assert.equal(normalizeSettings({ intervalMinutes: -1 }, defaults).intervalMinutes, 60);
    assert.equal(normalizeSettings({ intervalMinutes: 35_791 }, defaults).intervalMinutes, 35_791);
    assert.equal(normalizeSettings({ intervalMinutes: 35_792 }, defaults).intervalMinutes, 60);
});

void test("default settings are produced as isolated values", () => {
    const source = readFileSync("src/default-settings.ts", "utf8");

    assert.doesNotMatch(source, /let DEFAULT_SETTINGS/u);
    assert.match(source, /export function getDefaultSettings\(\): DTBSettings \{\s*return genDefaultSettings\(\);/u);
});
