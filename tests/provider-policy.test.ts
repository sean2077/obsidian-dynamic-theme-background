import assert from "node:assert/strict";
import test from "node:test";

import {
    MAX_RESPONSE_BYTES,
    assertRemoteUrl,
    assertResponseSize,
    isAllowedImageUrl,
    redactSensitiveText,
    sanitizeForLog,
    withTimeout,
} from "../src/core/network-policy";
import { queryJsonPath } from "../src/core/safe-json-path";

void test("remote URL policy defaults to HTTPS and rejects embedded credentials", () => {
    assert.equal(assertRemoteUrl("https://images.example.test/a.jpg"), "https://images.example.test/a.jpg");
    assert.throws(() => assertRemoteUrl("http://example.test/a"), /protocol/u);
    assert.throws(() => assertRemoteUrl("file:///vault/data.json"), /protocol/u);
    assert.throws(() => assertRemoteUrl("https://user:pass@example.test/a"), /credentials/u);
    assert.match(
        assertRemoteUrl("http://legacy.example.test/api", {
            allowInsecureHttp: true,
        }),
        /^http:/u
    );
});

void test("image and response bounds fail closed", () => {
    assert.equal(isAllowedImageUrl("https://example.test/image.jpg"), true);
    assert.equal(isAllowedImageUrl("javascript:alert(1)"), false);
    assert.doesNotThrow(() => assertResponseSize(MAX_RESPONSE_BYTES));
    assert.throws(() => assertResponseSize(MAX_RESPONSE_BYTES + 1), /size limit/u);
});

void test("log sanitization removes query and header credentials", () => {
    const text = redactSensitiveText("https://api.example.test?q=sky&client_id=secret-token&key=second");
    assert.doesNotMatch(text, /secret-token|second/u);
    assert.deepEqual(
        sanitizeForLog({
            Authorization: "Bearer secret",
            nested: { api_key: "hidden", query: "safe" },
        }),
        {
            Authorization: "[REDACTED]",
            nested: { api_key: "[REDACTED]", query: "safe" },
        }
    );
});

void test("logical timeout rejects stalled adapters", async () => {
    const immediateTimer = {
        clearTimeout: () => undefined,
        setTimeout: (callback: () => void) => {
            callback();
            return null;
        },
    };
    await assert.rejects(withTimeout(new Promise<never>(() => undefined), 5, immediateTimer), /timed out/u);
});

void test("safe JSONPath covers configured selectors without evaluation", () => {
    const data = {
        data: {
            images: [{ url: "one" }, { url: "two" }, { url: "three" }],
        },
        "strange-key": "quoted",
    };

    assert.deepEqual(queryJsonPath(data, "$.data.images[*].url"), ["one", "two", "three"]);
    assert.deepEqual(queryJsonPath(data, "$.data.images[0,2].url"), ["one", "three"]);
    assert.deepEqual(queryJsonPath(data, "$.data.images[1:3].url"), ["two", "three"]);
    assert.deepEqual(queryJsonPath(data, "$['strange-key']"), ["quoted"]);
    assert.deepEqual(queryJsonPath(data, "$..url"), ["one", "two", "three"]);
    assert.throws(() => queryJsonPath(data, "$[?(@.url)]"), /unsupported/u);
    assert.throws(() => queryJsonPath(data, "$.__proto__"), /unsafe/u);
});
