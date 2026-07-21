import assert from "node:assert/strict";
import test from "node:test";

import { selectBackgroundSize, toCssUrl } from "../src/core/style-policy";

void test("CSS URL values escape quotes, slashes, and line breaks", () => {
    const css = toCssUrl('https://example.test/a"b\\c\n.png');
    assert.equal(css, 'url("https://example.test/a\\"b\\\\c\\A .png")');
    assert.doesNotMatch(css, /\n/u);
});

void test("intelligent sizing is deterministic for representative ratios", () => {
    assert.equal(selectBackgroundSize(1920, 1080, 1920, 1080), "cover");
    assert.equal(selectBackgroundSize(3440, 1440, 1920, 1080), "contain");
    assert.equal(selectBackgroundSize(1600, 1200, 1920, 1080), "cover");
    assert.equal(selectBackgroundSize(800, 1600, 1920, 1080), "contain");
    assert.equal(selectBackgroundSize(0, 0, 1920, 1080), "contain");
});
