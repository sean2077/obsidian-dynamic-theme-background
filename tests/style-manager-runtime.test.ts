import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { App, WorkspaceLeaf } from "obsidian";

import { StyleManager } from "../src/core/style-manager";
import type { BackgroundItem, DTBSettings } from "../src/types";

class ImageFixture {
    naturalHeight = 0;
    naturalWidth = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = "";

    complete(width: number, height: number): void {
        this.naturalWidth = width;
        this.naturalHeight = height;
        this.onload?.();
    }
}

class BackgroundLayerFixture {
    className = "";
    attributes = new Map<string, string>();

    constructor(private onRemove: () => void) {}

    setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
    }

    remove(): void {
        this.onRemove();
    }
}

function documentFixture(width = 1920, height = 1080) {
    const properties = new Map<string, string>();
    const classes = new Set<string>();
    const resizeListeners = new Set<() => void>();
    const layers = new Set<BackgroundLayerFixture>();
    const targetWindow = {
        innerWidth: width,
        innerHeight: height,
        closed: false,
        addEventListener: (type: string, listener: () => void) => {
            assert.equal(type, "resize");
            resizeListeners.add(listener);
        },
        removeEventListener: (type: string, listener: () => void) => {
            assert.equal(type, "resize");
            resizeListeners.delete(listener);
        },
    };
    const doc = {
        body: {
            createDiv: (options: { cls: string; attr: Record<string, string>; prepend: boolean }) => {
                const layer = new BackgroundLayerFixture(() => layers.delete(layer));
                layer.className = options.cls;
                for (const [name, value] of Object.entries(options.attr)) layer.setAttribute(name, value);
                assert.equal(options.prepend, true);
                layers.add(layer);
                return layer;
            },
            classList: {
                add: (value: string) => classes.add(value),
                remove: (value: string) => classes.delete(value),
            },
        },
        defaultView: targetWindow,
        documentElement: {
            setCssProps: (values: Record<string, string>) => {
                for (const [property, value] of Object.entries(values)) properties.set(property, value);
            },
            style: {
                removeProperty: (property: string) => properties.delete(property),
                setProperty: (property: string, value: string) => properties.set(property, value),
            },
        },
    } as unknown as Document;
    return { doc, properties, classes, resizeListeners, targetWindow, layers };
}

function appFixture(mainDocument: Document, documents: Document[] = []) {
    let cssChanges = 0;
    const app = {
        workspace: {
            containerEl: { ownerDocument: mainDocument },
            iterateAllLeaves: (callback: (leaf: WorkspaceLeaf) => void) => {
                for (const doc of documents) {
                    callback({ getContainer: () => ({ doc }) } as unknown as WorkspaceLeaf);
                }
            },
            trigger: (event: string) => {
                assert.equal(event, "css-change");
                cssChanges += 1;
            },
        },
        vault: {
            getFileByPath: () => null,
        },
    } as unknown as App;
    return { app, cssChanges: () => cssChanges };
}

function installMainWindowTimers(context: TestContext) {
    const timers = new Map<number, () => void>();
    const images: ImageFixture[] = [];
    let nextTimer = 0;
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalCreateEl = Object.getOwnPropertyDescriptor(globalThis, "createEl");
    Object.defineProperty(globalThis, "createEl", {
        configurable: true,
        value: (tag: string) => {
            assert.equal(tag, "img");
            const image = new ImageFixture();
            images.push(image);
            return image;
        },
    });
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            setTimeout: (callback: () => void) => {
                const id = ++nextTimer;
                timers.set(id, callback);
                return id;
            },
            clearTimeout: (id: number) => timers.delete(id),
        },
    });
    context.after(() => {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
        if (originalCreateEl) Object.defineProperty(globalThis, "createEl", originalCreateEl);
        else Reflect.deleteProperty(globalThis, "createEl");
    });
    return { timers, images };
}

function settingsFixture(): DTBSettings {
    return {
        credentialStorageVersion: 1,
        enabled: true,
        statusBarEnabled: true,
        blurDepth: 0,
        brightness4Bg: 0.9,
        saturate4Bg: 1,
        bgColorLight: "#ffffff",
        bgColorOpacityLight: 0.3,
        bgColorDark: "#000000",
        bgColorOpacityDark: 0.4,
        bgSize: "intelligent",
        mode: "manual",
        timeRules: [],
        intervalMinutes: 60,
        localBackgroundFolder: "",
        backgrounds: [],
        currentIndex: 0,
        enableRandomWallpaper: false,
        wallpaperApis: [],
    };
}

const imageBackground: BackgroundItem = {
    id: "image",
    name: "Image",
    type: "image",
    value: "https://example.com/wallpaper.jpg",
};

void test("existing and newly opened windows share complete styles and clean up together", () => {
    const main = documentFixture();
    const existing = documentFixture();
    const opened = documentFixture();
    const { app } = appFixture(main.doc, [main.doc, existing.doc]);
    const manager = new StyleManager(app);
    const settings = settingsFixture();
    const background: BackgroundItem = { id: "color", name: "Color", type: "color", value: "#123456" };

    manager.applyBackground(background, settings);
    manager.attachDocument(opened.doc);
    manager.attachDocument(opened.doc);
    for (const target of [main, existing, opened]) {
        assert.equal(target.properties.get("--dtb-bg-image"), "linear-gradient(#123456, #123456)");
        assert.equal(target.classes.has("dtb-enabled"), true);
        assert.equal(target.resizeListeners.size, 1);
        assert.equal(target.layers.size, 1);
        const layer = [...target.layers][0];
        assert.equal(layer.className, "dtb-background");
        assert.equal(layer.attributes.get("aria-hidden"), "true");
    }

    manager.applyBackground({ ...background, value: "#654321" }, settings);
    assert.equal(opened.properties.get("--dtb-bg-image"), "linear-gradient(#654321, #654321)");
    manager.clear();
    for (const target of [main, existing, opened]) {
        assert.equal(target.properties.size, 0);
        assert.equal(target.classes.has("dtb-enabled"), false);
        assert.equal(target.resizeListeners.size, 0);
        assert.equal(target.layers.size, 0);
    }

    manager.attachDocument(opened.doc);
    assert.equal(opened.properties.size, 0);
    assert.equal(opened.layers.size, 0);
});

void test("intelligent sizing uses each window's viewport and reuses image dimensions on resize", async (context) => {
    const { timers, images } = installMainWindowTimers(context);
    const main = documentFixture();
    const popout = documentFixture(800, 1200);
    const { app } = appFixture(main.doc, [popout.doc]);
    const manager = new StyleManager(app);
    manager.applyBackground(imageBackground, settingsFixture());
    assert.equal(timers.size, 2);

    // Each completion stays bound to the document that initiated it, without
    // reading Obsidian's focus-dependent activeDocument/activeWindow globals.
    images[1].complete(1920, 1080);
    await Promise.resolve();
    assert.equal(popout.properties.get("--dtb-bg-size"), "contain");
    assert.equal(main.properties.get("--dtb-bg-size"), "contain");
    images[0].complete(1920, 1080);
    await Promise.resolve();
    assert.equal(main.properties.get("--dtb-bg-size"), "cover");
    assert.equal(timers.size, 0);

    popout.targetWindow.innerWidth = 1920;
    popout.targetWindow.innerHeight = 1080;
    for (const listener of popout.resizeListeners) listener();
    assert.equal(popout.properties.get("--dtb-bg-size"), "cover");
    assert.equal(images.length, 2);

    const later = documentFixture(800, 1200);
    manager.attachDocument(later.doc);
    assert.equal(later.properties.get("--dtb-bg-size"), "contain");
    assert.equal(images.length, 2);
    manager.clear();
});

void test("superseded image completions cannot overwrite a newer background", async (context) => {
    const { timers, images } = installMainWindowTimers(context);
    const main = documentFixture();
    const { app } = appFixture(main.doc);
    const manager = new StyleManager(app);
    const settings = settingsFixture();
    manager.applyBackground(imageBackground, settings);
    const oldImage = images[0];
    const staleCompletion = oldImage.onload;
    manager.applyBackground({ ...imageBackground, value: "https://example.com/new.jpg" }, settings);
    assert.equal(oldImage.src, "");
    assert.equal(oldImage.onload, null);
    assert.equal(timers.size, 1);
    staleCompletion?.();
    await Promise.resolve();
    assert.equal(main.properties.get("--dtb-bg-size"), "contain");
    assert.equal(main.properties.get("--dtb-bg-image"), 'url("https://example.com/new.jpg")');

    images[1].complete(1920, 1080);
    await Promise.resolve();
    assert.equal(main.properties.get("--dtb-bg-size"), "cover");
    assert.equal(timers.size, 0);
    manager.clear();
});

void test("closing or disabling windows prevents in-flight analysis from restoring cleared styles", async (context) => {
    const { timers, images } = installMainWindowTimers(context);
    const main = documentFixture();
    const popout = documentFixture();
    const fixture = appFixture(main.doc, [popout.doc]);
    const manager = new StyleManager(fixture.app);
    manager.applyBackground(imageBackground, settingsFixture());
    images[1].complete(1920, 1080);
    // Close before the completed image's promise continuation runs.
    manager.detachDocument(popout.doc);
    const changesBeforeCompletion = fixture.cssChanges();
    await Promise.resolve();
    assert.equal(popout.properties.size, 0);
    assert.equal(popout.resizeListeners.size, 0);
    assert.equal(popout.layers.size, 0);
    assert.equal(fixture.cssChanges(), changesBeforeCompletion);
    assert.equal(timers.size, 1);

    const staleCompletion = images[0].onload;
    manager.applyBackground(imageBackground, { ...settingsFixture(), enabled: false });
    staleCompletion?.();
    await Promise.resolve();
    assert.equal(main.properties.size, 0);
    assert.equal(main.classes.size, 0);
    assert.equal(main.resizeListeners.size, 0);
    assert.equal(main.layers.size, 0);
    assert.equal(timers.size, 0);
});

void test("empty selections reset per-background filters and image analysis times out cleanly", async (context) => {
    const { timers, images } = installMainWindowTimers(context);
    const main = documentFixture();
    const { app } = appFixture(main.doc);
    const manager = new StyleManager(app);
    const settings = settingsFixture();
    manager.applyBackground({ ...imageBackground, blurDepth: 18, brightness4Bg: 0.5 }, settings);
    const timeout = [...timers.values()][0];
    timeout();
    await Promise.resolve();
    assert.equal(images[0].src, "");
    assert.equal(images[0].onload, null);
    assert.equal(images[0].onerror, null);
    assert.equal(timers.size, 0);

    manager.applyBackground(null, settings);
    assert.equal(main.properties.get("--dtb-bg-image"), "none");
    assert.equal(main.properties.get("--dtb-blur-depth"), "0px");
    assert.equal(main.properties.get("--dtb-brightness"), "0.9");
    manager.clear();
});
