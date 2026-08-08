import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

void test("plugin migration and runtime creation cross the SecretStorage boundary", () => {
    const plugin = readFileSync("src/plugin.ts", "utf8");

    assert.match(plugin, /this\.app\.secretStorage/u);
    assert.match(plugin, /migrateSettingsCredentials/u);
    assert.match(plugin, /hydrateWallpaperApiConfig/u);
    assert.match(plugin, /assertSettingsCredentialsAreReferences/u);
    assert.match(plugin, /createWallpaperApi/u);
});

void test("settings use native Obsidian 1.13 pages without a legacy compatibility layer", () => {
    const settingsTab = readFileSync("src/settings/settings-tab.ts", "utf8");
    const settingsPage = readFileSync("src/settings/settings-page.ts", "utf8");
    const settingsView = readFileSync("src/settings/settings-view.ts", "utf8");

    assert.match(settingsTab, /getSettingDefinitions\(\)/u);
    assert.match(settingsTab, /type:\s*"page"/u);
    assert.match(settingsTab, /page:\s*\(\)\s*=>\s*this\.create/u);
    assert.match(settingsTab, /createSettingsPage/u);
    assert.match(settingsPage, /class extends SettingPage/u);
    assert.doesNotMatch(settingsTab, /items:\s*\[this\.(?:basic|mode|background|api)SettingsDefinition\(\)\]/u);
    assert.doesNotMatch(settingsTab, /\n\s+display\(\): void/u);
    assert.match(settingsTab, /displayWorkspaceView\(containerEl: HTMLElement\): void/u);
    assert.match(settingsTab, /activateSurface\(declarative: boolean\)/u);
    assert.match(settingsTab, /setting\.settingEl\.addClass\("dtb-settings-surface"\)/u);
    assert.match(settingsTab, /containerEl\.addClass\("dtb-settings-surface"\)/u);
    assert.match(settingsTab, /this\.plugin\.settingTabs\.set\(this\.componentId, this\)/u);
    assert.match(settingsView, /displayWorkspaceView/u);
    assert.equal(existsSync("src/core/obsidian-compat.ts"), false);
});

void test("credential controls store SecretStorage references instead of plaintext values", () => {
    const modal = readFileSync("src/modals/wallpaper-api-modal.ts", "utf8");

    assert.match(modal, /SecretComponent/u);
    assert.match(modal, /secretRefs/u);
    assert.doesNotMatch(modal, /\(input as HTMLInputElement\)\.type = "password"/u);
});
