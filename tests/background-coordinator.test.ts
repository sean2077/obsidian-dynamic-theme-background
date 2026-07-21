import assert from "node:assert/strict";
import test from "node:test";

import { selectBackgroundPlan } from "../src/core/background-selection";
import { LatestOperation } from "../src/core/latest-operation";
import type { BackgroundItem } from "../src/types";

const backgrounds: BackgroundItem[] = [
    { id: "first", name: "First", type: "color", value: "#111111" },
    { id: "second", name: "Second", type: "color", value: "#222222" },
];

interface Deferred<T> {
    promise: Promise<T>;
    reject: (reason?: unknown) => void;
    resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

void test("only the newest concurrent result can commit", async () => {
    const coordinator = new LatestOperation();
    const first = deferred<string>();
    const second = deferred<string>();
    const committed: string[] = [];

    const firstRun = coordinator.run(
        () => first.promise,
        (value) => {
            committed.push(value);
        }
    );
    const secondRun = coordinator.run(
        () => second.promise,
        (value) => {
            committed.push(value);
        }
    );

    second.resolve("second");
    assert.equal(await secondRun, "applied");
    first.resolve("first");
    assert.equal(await firstRun, "superseded");
    assert.deepEqual(committed, ["second"]);
    assert.equal(coordinator.isRunning, false);
});

void test("invalidation prevents an in-flight result from committing", async () => {
    const coordinator = new LatestOperation();
    const work = deferred<string>();
    let committed = false;
    const run = coordinator.run(
        () => work.promise,
        () => {
            committed = true;
        }
    );

    coordinator.invalidate();
    work.resolve("stale");
    assert.equal(await run, "superseded");
    assert.equal(committed, false);
});

void test("a rejected operation releases state and does not poison retries", async () => {
    const coordinator = new LatestOperation();
    const failure = deferred<string>();
    const failedRun = coordinator.run(
        () => failure.promise,
        () => undefined
    );
    failure.reject(new Error("network failure"));
    await assert.rejects(failedRun, /network failure/u);
    assert.equal(coordinator.isRunning, false);

    let result = "";
    assert.equal(
        await coordinator.run(
            () => Promise.resolve("recovered"),
            (value) => {
                result = value;
            }
        ),
        "applied"
    );
    assert.equal(result, "recovered");
});

void test("manual mode keeps the configured background without scheduling a change", () => {
    assert.deepEqual(
        selectBackgroundPlan({
            backgrounds,
            currentBackground: backgrounds[0],
            currentIndex: 1,
            mode: "manual",
        }),
        { background: backgrounds[1], needsUpdate: false }
    );
});

void test("time-based mode resolves the active rule and reports real changes", () => {
    assert.deepEqual(
        selectBackgroundPlan({
            backgrounds,
            currentBackground: backgrounds[0],
            currentIndex: 0,
            mode: "time-based",
            ruleBackgroundId: "second",
        }),
        { background: backgrounds[1], needsUpdate: true }
    );
    assert.deepEqual(
        selectBackgroundPlan({
            backgrounds,
            currentBackground: backgrounds[1],
            currentIndex: 0,
            mode: "time-based",
            ruleBackgroundId: "missing",
        }),
        { background: null, needsUpdate: true }
    );
});

void test("interval mode prefers fetched images, advances local fallbacks, and survives an empty list", () => {
    const fetched: BackgroundItem = {
        id: "remote",
        name: "Remote",
        type: "image",
        value: "https://example.com/a.jpg",
    };
    assert.deepEqual(
        selectBackgroundPlan({
            backgrounds,
            currentBackground: backgrounds[0],
            currentIndex: 0,
            intervalBackground: fetched,
            mode: "interval",
        }),
        { background: fetched, needsUpdate: true }
    );
    assert.deepEqual(
        selectBackgroundPlan({
            backgrounds,
            currentBackground: backgrounds[1],
            currentIndex: 1,
            mode: "interval",
        }),
        { background: backgrounds[0], needsUpdate: true, nextIndex: 0 }
    );
    assert.deepEqual(
        selectBackgroundPlan({
            backgrounds: [],
            currentBackground: backgrounds[0],
            currentIndex: 0,
            mode: "interval",
        }),
        { background: backgrounds[0], needsUpdate: false }
    );
});
