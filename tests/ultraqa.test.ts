import assert from "node:assert/strict";
import test from "node:test";

import {
    MAX_REMOTE_URL_LENGTH,
    MAX_RESPONSE_BYTES,
    assertRemoteUrl,
    assertResponseSize,
    sanitizeForLog,
    withTimeout,
} from "../src/core/network-policy";
import {
    MAX_IMAGE_BYTES,
    inspectImageResponse,
    sanitizeImageName,
    writeImage,
} from "../src/core/persistence-policy";
import { queryJsonPath } from "../src/core/safe-json-path";
import { ApiStateManager, ApiStateSubscriber } from "../src/wallpaper-apis/core/api-state-manager";

void test("UltraQA bounds hostile paths, cycles, and result fan-out", () => {
    const cyclic: { self?: unknown; target: string } = { target: "safe" };
    cyclic.self = cyclic;

    assert.deepEqual(queryJsonPath(cyclic, "$..target"), ["safe"]);
    assert.throws(() => queryJsonPath(cyclic, `$.${"a".repeat(512)}`), /length limit/u);
    assert.throws(() => queryJsonPath(cyclic, "$..constructor"), /unsafe/u);
    assert.throws(() => queryJsonPath(cyclic, "$[?(@.target)]"), /unsupported/u);
    assert.equal(queryJsonPath({ items: Array.from({ length: 1_500 }, (_, index) => index) }, "$.items[*]", 5_000).length, 1_000);
    assert.deepEqual(queryJsonPath({ items: [1] }, "$.items[*]", -1), []);
});

void test("UltraQA rejects URL and response limits at max plus one", () => {
    assert.throws(() => assertRemoteUrl(""), /length/u);
    assert.throws(() => assertRemoteUrl(`https://example.test/${"a".repeat(MAX_REMOTE_URL_LENGTH)}`), /length/u);
    assert.throws(() => assertRemoteUrl("data:text/plain,secret"), /protocol/u);
    assert.doesNotThrow(() => assertResponseSize(MAX_RESPONSE_BYTES));
    assert.throws(() => assertResponseSize(MAX_RESPONSE_BYTES + 1), /size/u);
    assert.throws(() => assertResponseSize(-1), /size/u);
    assert.throws(() => assertResponseSize(Number.NaN), /size/u);
});

void test("UltraQA truncates deep log data without exposing secrets", () => {
    const sanitized = sanitizeForLog({
        array: Array.from({ length: 30 }, (_, index) => `item-${index}`),
        error: new Error("request failed: https://example.test/?token=hidden"),
        nested: { one: { two: { Authorization: "Bearer deeply-hidden" } } },
    });
    const serialized = JSON.stringify(sanitized);

    assert.doesNotMatch(serialized, /hidden|deeply-hidden/u);
    assert.equal((sanitized as { array: unknown[] }).array.length, 20);
});

void test("UltraQA timeout adapter clears settled timers and normalizes failures", async () => {
    let clears = 0;
    const timers = {
        clearTimeout: () => {
            clears += 1;
        },
        setTimeout: () => 1,
    };

    assert.equal(await withTimeout(Promise.resolve("ok"), 10, timers), "ok");
    // Deliberately model a hostile adapter that violates the Promise rejection convention.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- exercise a non-Error adapter rejection
    await assert.rejects(withTimeout(Promise.reject("unsafe detail"), 10, timers), /Remote request failed/u);
    assert.equal(clears, 2);
});

void test("UltraQA enforces portable image names, MIME, and exact size bounds", () => {
    assert.equal(sanitizeImageName("ＣＯＮ"), "_CON");
    assert.equal(sanitizeImageName("\u0000\u0001"), "__");
    assert.equal(inspectImageResponse("IMAGE/AVIF; charset=binary", MAX_IMAGE_BYTES), ".avif");
    assert.throws(() => inspectImageResponse("image/png", 0), /invalid size/u);
    assert.throws(() => inspectImageResponse("image/svg+xml", 10), /supported image/u);
    assert.throws(() => inspectImageResponse("image/png", MAX_IMAGE_BYTES + 1), /invalid size/u);
});

void test("UltraQA never reports a failed create as a successful write", async () => {
    await assert.rejects(
        writeImage(
            {
                create: () => Promise.reject(new Error("permission denied")),
                exists: () => false,
                replace: () => Promise.resolve(),
            },
            "Images/a.png",
            new ArrayBuffer(1),
            () => true
        ),
        /permission denied/u
    );
});

void test("UltraQA isolates rejected listeners and removes API subscriptions", async (context) => {
    const host = globalThis as unknown as { window?: Window };
    const originalWindow = host.window;
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    host.window = {
        setTimeout: (callback: () => void) => {
            callback();
            return 1;
        },
    } as unknown as Window;
    context.after(() => {
        console.warn = originalWarn;
        if (originalWindow === undefined) delete host.window;
        else host.window = originalWindow;
    });

    const manager = new ApiStateManager();
    const received: string[] = [];
    manager.subscribe(new ApiStateSubscriber("rejecting", "settings", "api"), () =>
        Promise.reject(new Error("listener failure"))
    );
    manager.subscribe(new ApiStateSubscriber("healthy", "settings", "api"), () => {
        received.push("healthy");
    });

    manager.notify("api", { configEnabled: true, instanceEnabled: true, isLoading: false });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(received, ["healthy"]);
    assert.equal(warnings.length, 1);

    manager.cleanupByApiId("api");
    manager.notify("api", { configEnabled: false, instanceEnabled: false, isLoading: false });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(received, ["healthy"]);
});
