import assert from "node:assert/strict";
import test from "node:test";

import {
    MAX_IMAGE_BYTES,
    type BinaryStore,
    buildImagePath,
    inspectImageResponse,
    normalizeVaultFolder,
    sanitizeImageName,
    writeImage,
} from "../src/core/persistence-policy";

void test("vault paths reject traversal and normalize safe separators", () => {
    assert.equal(normalizeVaultFolder("Images\\Wallpapers"), "Images/Wallpapers");
    assert.throws(() => normalizeVaultFolder("../Secrets"), /unsafe/u);
    assert.throws(() => normalizeVaultFolder("C:\\Temp"), /relative/u);
    assert.throws(() => normalizeVaultFolder("/absolute"), /relative/u);
});

void test("file names and MIME types produce bounded image paths", () => {
    assert.equal(sanitizeImageName("  sunset: <golden>?  "), "sunset_ _golden__");
    assert.equal(sanitizeImageName("CON"), "_CON");
    assert.equal(sanitizeImageName("con.preview"), "_con.preview");
    assert.equal(buildImagePath("Images", "Sunset", ".webp"), "Images/Sunset.webp");
    assert.equal(inspectImageResponse("image/png; charset=binary", 128), ".png");
    assert.throws(() => inspectImageResponse("text/html", 128), /supported image/u);
    assert.throws(() => inspectImageResponse("image/jpeg", MAX_IMAGE_BYTES + 1), /invalid size/u);
});

function memoryStore(initial: ArrayBuffer | null, failReplace = false) {
    let value = initial;
    const calls: string[] = [];
    const store: BinaryStore = {
        create: (_path, data) => {
            calls.push("create");
            value = data;
            return Promise.resolve();
        },
        exists: () => value !== null,
        replace: (_path, data) => {
            calls.push("replace");
            if (failReplace) return Promise.reject(new Error("write failed"));
            value = data;
            return Promise.resolve();
        },
    };
    return { calls, getValue: () => value, store };
}

void test("create, cancel, and overwrite use distinct non-destructive paths", async () => {
    const created = memoryStore(null);
    assert.equal(await writeImage(created.store, "Images/a.jpg", new ArrayBuffer(2), () => true), "created");
    assert.deepEqual(created.calls, ["create"]);

    const original = new ArrayBuffer(1);
    const cancelled = memoryStore(original);
    assert.equal(await writeImage(cancelled.store, "Images/a.jpg", new ArrayBuffer(2), () => false), "cancelled");
    assert.equal(cancelled.getValue(), original);
    assert.deepEqual(cancelled.calls, []);
});

void test("failed replacement never deletes the prior value", async () => {
    const original = new ArrayBuffer(1);
    const target = memoryStore(original, true);
    await assert.rejects(
        writeImage(target.store, "Images/a.jpg", new ArrayBuffer(2), () => true),
        /write failed/u
    );
    assert.equal(target.getValue(), original);
    assert.deepEqual(target.calls, ["replace"]);
});
