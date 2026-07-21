import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("plugin migration and runtime creation cross the SecretStorage boundary", () => {
    const plugin = readFileSync("src/plugin.ts", "utf8");

    assert.match(plugin, /this\.app\.secretStorage/u);
    assert.match(plugin, /migrateSettingsCredentials/u);
    assert.match(plugin, /hydrateWallpaperApiConfig/u);
    assert.match(plugin, /assertSettingsCredentialsAreReferences/u);
    assert.match(plugin, /createWallpaperApi/u);
});

void test("settings use declarative definitions with an imperative compatibility fallback", () => {
    const settingsTab = readFileSync("src/settings/settings-tab.ts", "utf8");
    const settingsView = readFileSync("src/settings/settings-view.ts", "utf8");

    assert.match(settingsTab, /getSettingDefinitions\(\)/u);
    assert.match(settingsTab, /type:\s*"page"/u);
    assert.match(settingsTab, /display\(\): void/u);
    assert.match(settingsTab, /activateSurface\(declarative: boolean\)/u);
    assert.match(settingsTab, /this\.plugin\.settingTabs\.set\(this\.componentId, this\)/u);
    assert.match(settingsView, /displayImperativeSettings/u);
});

void test("credential controls store SecretStorage references instead of plaintext values", () => {
    const modal = readFileSync("src/modals/wallpaper-api-modal.ts", "utf8");

    assert.match(modal, /SecretComponent/u);
    assert.match(modal, /secretRefs/u);
    assert.doesNotMatch(modal, /\(input as HTMLInputElement\)\.type = "password"/u);
});
