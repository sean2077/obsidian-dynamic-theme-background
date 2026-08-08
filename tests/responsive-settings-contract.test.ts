import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("styles.css", "utf8");

void test("settings pages respond to their content container instead of only the app window", () => {
    assert.match(
        styles,
        /\.dtb-settings-surface \{[\s\S]*?container-name: dtb-settings;[\s\S]*?container-type: inline-size;[\s\S]*?\}/u
    );
    assert.match(
        styles,
        /@container dtb-settings \(max-width: 840px\) \{[\s\S]*?\.dtb-settings-surface \.dtb-item,[\s\S]*?flex-direction: column;[\s\S]*?align-items: stretch;/u
    );
    assert.match(
        styles,
        /@container dtb-settings \(max-width: 600px\) \{[\s\S]*?\.dtb-settings-surface \.dtb-section-header[\s\S]*?flex-wrap: wrap;/u
    );
});

void test("constrained settings override the desktop card direction", () => {
    assert.match(
        styles,
        /@media \(max-width: 1100px\) \{\s*\.dtb-hint-section > \.setting-item,\s*\.dtb-large-button-container \.setting-item,\s*body \.dtb-item,\s*body \.dtb-section-container \.setting-item \{\s*flex-direction: column;\s*align-items: stretch;/u
    );
    assert.match(styles, /\.dtb-hint-section > \.setting-item,/u);
    assert.match(styles, /\.dtb-large-button-container \.setting-item,/u);
    assert.doesNotMatch(styles, /:has\(/u);
    assert.doesNotMatch(styles, /!important/u);
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
