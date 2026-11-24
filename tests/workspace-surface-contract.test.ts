import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("styles.css", "utf8");

// Plugin styles load before theme styles. A theme rule with equal specificity
// therefore wins and repaints an opaque workspace layer over the wallpaper, so
// the structural selectors must stay on the full ancestor chain.
void test("workspace surfaces outrank themes that load after plugin styles", () => {
    assert.match(
        styles,
        /body\.dtb-enabled \.app-container \.horizontal-main-container \.workspace :is\(\.workspace-split, \.workspace-window\) \.workspace-leaf \{\s*background-color: var\(--dtb-surface-content\);/u
    );
    assert.match(
        styles,
        /body\.dtb-enabled \.app-container \.horizontal-main-container \.workspace \.workspace-split,[\s\S]*?background-color: transparent;/u
    );
    assert.match(
        styles,
        /body\.dtb-enabled \.app-container \.horizontal-main-container \.workspace \.workspace-leaf > \.workspace-leaf-content \{\s*--file-header-background: transparent;\s*--file-header-background-focused: transparent;\s*background-color: transparent;/u
    );
    assert.match(
        styles,
        /body\.dtb-enabled \.app-container \.horizontal-main-container \.workspace \.workspace-tab-header-container \{\s*--tab-inner-background-active:[^;]*;\s*background-color: var\(--dtb-surface-chrome\);/u
    );
    assert.match(
        styles,
        /body\.dtb-enabled \.app-container \.horizontal-main-container \.workspace \.workspace-tabs\.mod-stacked \.workspace-leaf \{\s*background-color: var\(--background-primary\);/u
    );
});

void test("community content canvases reuse the wallpaper surfaces", () => {
    assert.match(styles, /body\.dtb-enabled \.kanban-plugin \{\s*background-color: transparent;/u);
    assert.match(styles, /body\.dtb-enabled \.bp-pagination-bar \{\s*background-color: var\(--dtb-surface-chrome\);/u);
    assert.match(
        styles,
        /body\.dtb-enabled \.bp-table-header,\s*body\.dtb-enabled \.bp-group-cell \{\s*background-color: var\(--dtb-surface-control\);/u
    );
    assert.match(
        styles,
        /body\.dtb-enabled \.bp-table-row:nth-child\(even\) \{\s*background-color: var\(--dtb-surface-content\);/u
    );
    assert.match(styles, /--bases-table-header-background: var\(--dtb-surface-control\);/u);
});