import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("styles.css", "utf8");

void test("constrained settings override the desktop card direction", () => {
    assert.match(
        styles,
        /@media \(max-width: 1100px\) \{\s*:has\(> \.dtb-hint\) > \.setting-item,\s*\.dtb-large-button-container \.setting-item,\s*\.dtb-item,\s*\.dtb-section-container \.setting-item \{\s*flex-direction: column;\s*align-items: stretch;/u
    );
    assert.match(styles, /:has\(> \.dtb-hint\) > \.setting-item,/u);
    assert.match(styles, /\.dtb-large-button-container \.setting-item,/u);
    assert.match(styles, /\.dtb-bg-name \{\s*min-width: 0;\s*overflow-wrap: anywhere;/u);
    assert.match(
        styles,
        /\.dtb-bg-content > \.dtb-button-container \{\s*flex: 1 0 100%;\s*justify-content: flex-end;/u
    );
});

void test("narrow settings wrap headers and stack background content", () => {
    assert.match(
        styles,
        /\.dtb-section-header \{\s*flex-wrap: wrap;\s*justify-content: flex-start;\s*gap: 8px;/u
    );
    assert.match(styles, /\.dtb-links \{\s*flex-wrap: wrap;\s*width: 100%;\s*min-width: 0;/u);
    assert.match(
        styles,
        /\.dtb-bg-content \{\s*flex-direction: column;\s*align-items: stretch;\s*width: 100%;\s*min-width: 0;/u
    );
});
