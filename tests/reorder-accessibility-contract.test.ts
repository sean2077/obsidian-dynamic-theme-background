import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("all sortable setting lists expose shared native reorder controls", () => {
    const dragSort = readFileSync("src/utils/drag-sort.ts", "utf8");
    const sections = [
        "src/settings/sections/bg-management.ts",
        "src/settings/sections/mode-settings.ts",
        "src/settings/sections/api-settings.ts",
    ];

    for (const path of sections) {
        assert.match(readFileSync(path, "utf8"), /enableDragForElement\([^,]+,\s*[^,]+,\s*[^)]+\)/u, path);
    }
    assert.match(dragSort, /container\.createEl\("button"/u);
    assert.match(dragSort, /"aria-label": label/u);
    assert.match(dragSort, /button\.disabled = !this\.canMove\(item, direction\)/u);
});

void test("reorder controls retain focus and coarse-pointer target contracts", () => {
    const styles = readFileSync("styles.css", "utf8");
    const en = readFileSync("src/i18n/en.ts", "utf8");
    const zh = readFileSync("src/i18n/zh-cn.ts", "utf8");

    assert.match(styles, /\.dtb-reorder-button \{\s*flex: 0 0 auto;\s*touch-action: manipulation;/u);
    assert.match(styles, /@media \(pointer: coarse\)[\s\S]*\.dtb-button-container \.dtb-reorder-button/u);
    for (const locale of [en, zh]) {
        assert.match(locale, /move_item_up:/u);
        assert.match(locale, /move_item_down:/u);
    }
});
