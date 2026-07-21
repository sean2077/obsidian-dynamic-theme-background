import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("the settings seam stays pure and plugin remains the composition root", () => {
    const settingsModule = readFileSync("src/core/settings.ts", "utf8");
    const pluginModule = readFileSync("src/plugin.ts", "utf8");

    assert.doesNotMatch(settingsModule, /from ["']obsidian["']/u);
    assert.match(settingsModule, /export function normalizeSettings/u);
    assert.match(pluginModule, /normalizeSettings\(loaded, defaultSettings\)/u);
});
