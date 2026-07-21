import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("runtime startup is layout-ready, ordered, and generation guarded", () => {
    const plugin = readFileSync("src/plugin.ts", "utf8");
    const apiManager = readFileSync("src/wallpaper-apis/core/api-manager.ts", "utf8");

    assert.match(plugin, /onLayoutReady\(\(\) =>/u);
    assert.match(plugin, /await this\.createWallpaperApi\(apiConfig, false\)/u);
    assert.match(plugin, /await apiManager\.createApi\(runtimeConfig, activate\)/u);
    assert.match(plugin, /await apiManager\.activateConfiguredApis\(\)/u);
    assert.match(plugin, /generation !== this\.startGeneration/u);
    assert.match(plugin, /void apiManager\.suspendAllApis\(\)/u);
    assert.match(apiManager, /private lifecycleRevision = 0/u);
    assert.match(apiManager, /this\.lifecycleQueue\.then\(execute, execute\)/u);
});

void test("plugin-owned DOM events and teardown use registered lifecycle paths", () => {
    const plugin = readFileSync("src/plugin.ts", "utf8");
    const eventBus = readFileSync("src/core/event-bus.ts", "utf8");
    const styleManager = readFileSync("src/core/style-manager.ts", "utf8");

    assert.equal((plugin.match(/registerDomEvent\(/gu) ?? []).length, 5);
    assert.doesNotMatch(plugin, /\.addEventListener\(/u);
    assert.match(plugin, /setAttribute\("role", "button"\)/u);
    assert.match(plugin, /evt\.key === "Enter" \|\| evt\.key === " "/u);
    assert.match(plugin, /void apiManager\.deleteAllApis\(\)/u);
    assert.match(plugin, /this\.events\.removeAllListeners\(\)/u);
    assert.doesNotMatch(eventBus, /console\.error/u);
    assert.match(styleManager, /clear\(\): void \{[\s\S]*this\.cancelPendingImageLoads\(\)/u);
    assert.match(styleManager, /image\.onload = null/u);
});

void test("API configuration tests fail closed and always delete their temporary instance", () => {
    const modal = readFileSync("src/modals/wallpaper-api-modal.ts", "utf8");

    assert.match(modal, /const success = apiManager\.getApiById\(testApiId\)/u);
    assert.match(modal, /if \(!success\)/u);
    assert.match(modal, /finally \{[\s\S]*await apiManager\.deleteApi\(testApiId\)/u);
});
