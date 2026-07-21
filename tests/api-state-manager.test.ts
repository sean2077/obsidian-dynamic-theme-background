import assert from "node:assert/strict";
import test from "node:test";

import { ApiStateManager, ApiStateSubscriber } from "../src/wallpaper-apis/core/api-state-manager";

void test("API state notifications filter and clean subscriptions", async (context) => {
    const host = globalThis as unknown as { window?: Window };
    const originalWindow = host.window;
    host.window = {
        setTimeout: (callback: () => void) => {
            callback();
            return 1;
        },
    } as unknown as Window;
    context.after(() => {
        if (originalWindow === undefined) delete host.window;
        else host.window = originalWindow;
    });

    const manager = new ApiStateManager();
    const received: string[] = [];
    const first = new ApiStateSubscriber("toggle", "settings-a", "api-a");
    const second = new ApiStateSubscriber("toggle", "settings-b", "api-b");
    const unsubscribe = manager.subscribe(first, () => {
        received.push("a");
    });
    manager.subscribe(second, () => {
        received.push("b");
    });

    manager.notify("api-a", {
        configEnabled: true,
        instanceEnabled: true,
        isLoading: false,
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(received, ["a"]);

    unsubscribe();
    manager.cleanupByComponent("settings-b");
    manager.notify("api-a", {
        configEnabled: false,
        instanceEnabled: false,
        isLoading: false,
    });
    manager.notify("api-b", {
        configEnabled: false,
        instanceEnabled: false,
        isLoading: false,
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(received, ["a"]);
});
