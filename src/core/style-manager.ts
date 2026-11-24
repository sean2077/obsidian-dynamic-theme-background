/**
 * Owns DTB styles in every workspace window and asynchronous image analysis.
 */

import type { App } from "obsidian";

import type { BackgroundItem, DTBSettings } from "../types";
import { hexToRgba } from "../utils/utils";
import { assertRemoteUrl, isAllowedImageUrl } from "./network-policy";
import { selectBackgroundSize, toCssUrl } from "./style-policy";
import { logger } from "./logger";

const CSS_PROPERTIES = [
    "--dtb-bg-image",
    "--dtb-blur-depth",
    "--dtb-brightness",
    "--dtb-saturate",
    "--dtb-bg-color-light",
    "--dtb-bg-color-dark",
    "--dtb-bg-size",
];
const IMAGE_LOAD_TIMEOUT_MS = 10_000;

interface ImageDimensions {
    height: number;
    width: number;
}

interface DocumentStyleState {
    backgroundEl: HTMLElement;
    generation: number;
    pendingImageLoads: Set<() => void>;
    removeResizeListener: () => void;
}

interface AppliedBackground {
    background: BackgroundItem | null;
    settings: DTBSettings;
    requestedSize?: string;
}

export class StyleManager {
    private current: AppliedBackground | null = null;
    private documents = new Map<Document, DocumentStyleState>();
    private imageDimensionCache = new Map<string, ImageDimensions>();

    constructor(private app: App) {}

    applyBackground(bg: BackgroundItem | null, settings: DTBSettings, requestedSize?: string): void {
        if (!settings.enabled) {
            this.clear();
            return;
        }
        this.current = { background: bg, settings, requestedSize };

        // The main window and already-open popouts must not depend on keyboard focus.
        this.trackDocument(this.app.workspace.containerEl.ownerDocument);
        this.app.workspace.iterateAllLeaves((leaf) => {
            this.trackDocument(leaf.getContainer().doc);
        });
        for (const [doc, state] of this.documents) {
            this.applyToDocument(doc, state);
        }
        this.notifyCssChange();
    }

    attachDocument(doc: Document): void {
        if (!this.current) return;
        const state = this.trackDocument(doc);
        if (!state) return;
        this.applyToDocument(doc, state);
        this.notifyCssChange();
    }

    detachDocument(doc: Document): void {
        const state = this.documents.get(doc);
        if (!state) return;
        this.documents.delete(doc);
        state.generation += 1;
        this.cancelDocumentImageLoads(state);
        state.removeResizeListener();
        state.backgroundEl.remove();
        doc.body.classList.remove("dtb-enabled");
        for (const property of CSS_PROPERTIES) {
            doc.documentElement.style.removeProperty(property);
        }
    }

    clear(): void {
        this.current = null;
        this.cancelPendingImageLoads();
        for (const doc of this.documents.keys()) {
            this.detachDocument(doc);
        }
        this.imageDimensionCache.clear();
        this.notifyCssChange();
    }

    private trackDocument(doc: Document): DocumentStyleState | null {
        const existing = this.documents.get(doc);
        if (existing) return existing;
        const targetWindow = doc.defaultView;
        if (!targetWindow || targetWindow.closed) return null;
        const backgroundEl = doc.body.createDiv({
            cls: "dtb-background",
            attr: { "aria-hidden": "true" },
            prepend: true,
        });
        const onResize = () => {
            const state = this.documents.get(doc);
            if (!state || !this.current) return;
            this.applyToDocument(doc, state);
            this.notifyCssChange();
        };
        targetWindow.addEventListener("resize", onResize);
        const state: DocumentStyleState = {
            backgroundEl,
            generation: 0,
            pendingImageLoads: new Set(),
            removeResizeListener: () => targetWindow.removeEventListener("resize", onResize),
        };
        this.documents.set(doc, state);
        return state;
    }

    private applyToDocument(doc: Document, state: DocumentStyleState): void {
        if (!this.current) return;
        const { background: bg, settings, requestedSize } = this.current;
        const generation = ++state.generation;
        this.cancelDocumentImageLoads(state);
        const size = requestedSize ?? bg?.bgSize ?? settings.bgSize;
        const backgroundSize =
            size === "intelligent"
                ? bg?.type === "image"
                    ? this.getOptimalBackgroundSize(bg, doc, state, generation)
                    : "auto"
                : size;
        const backgroundImage = !bg
            ? "none"
            : bg.type === "image"
              ? this.getBgURL(bg)
              : bg.type === "color"
                ? `linear-gradient(${bg.value}, ${bg.value})`
                : bg.value;

        // Write the complete state even for an empty selection, so no previous
        // image's per-background filters survive a rule with no background.
        doc.documentElement.setCssProps({
            "--dtb-bg-image": backgroundImage,
            "--dtb-blur-depth": `${bg?.blurDepth ?? settings.blurDepth}px`,
            "--dtb-brightness": `${bg?.brightness4Bg ?? settings.brightness4Bg}`,
            "--dtb-saturate": `${bg?.saturate4Bg ?? settings.saturate4Bg}`,
            "--dtb-bg-color-light": hexToRgba(
                bg?.bgColorLight ?? settings.bgColorLight,
                bg?.bgColorOpacityLight ?? settings.bgColorOpacityLight
            ),
            "--dtb-bg-color-dark": hexToRgba(
                bg?.bgColorDark ?? settings.bgColorDark,
                bg?.bgColorOpacityDark ?? settings.bgColorOpacityDark
            ),
            "--dtb-bg-size": backgroundSize,
        });
        doc.body.classList.add("dtb-enabled");
    }

    getBgURL(bg: BackgroundItem): string {
        if (/^https?:/iu.test(bg.value)) {
            try {
                return toCssUrl(assertRemoteUrl(bg.value, { allowInsecureHttp: true }));
            } catch {
                logger.warn("Rejected unsafe remote background URL");
                return "none";
            }
        }

        const file = this.app.vault.getFileByPath(bg.value);
        if (file) {
            const resourcePath = this.app.vault.getResourcePath(file);
            if (resourcePath) return toCssUrl(resourcePath);
            logger.warn("Local background resource path is empty");
        } else {
            logger.warn("Local background file is unavailable");
        }

        if (bg.remoteUrl && isAllowedImageUrl(bg.remoteUrl)) {
            logger.warn("Using the remote fallback for a missing local background");
            return toCssUrl(bg.remoteUrl);
        }
        return "none";
    }

    isRemoteImage(imagePath: string): boolean {
        return isAllowedImageUrl(imagePath);
    }

    private getOptimalBackgroundSize(
        bg: BackgroundItem,
        doc: Document,
        state: DocumentStyleState,
        generation: number
    ): "contain" | "cover" {
        const resourcePath = this.resolveImagePath(bg);
        if (!resourcePath) return "contain";
        const selectSize = (dimensions: ImageDimensions) =>
            selectBackgroundSize(
                dimensions.width,
                dimensions.height,
                doc.defaultView?.innerWidth ?? 0,
                doc.defaultView?.innerHeight ?? 0
            );
        const cached = this.imageDimensionCache.get(resourcePath);
        if (cached) return selectSize(cached);

        void this.loadImageDimensions(resourcePath, state).then((dimensions) => {
            if (!dimensions || !this.current || this.documents.get(doc) !== state || generation !== state.generation) {
                return;
            }
            this.imageDimensionCache.set(resourcePath, dimensions);
            if (this.imageDimensionCache.size > 50) {
                const firstKey = this.imageDimensionCache.keys().next().value;
                if (firstKey) this.imageDimensionCache.delete(firstKey);
            }
            doc.documentElement.style.setProperty("--dtb-bg-size", selectSize(dimensions));
            this.notifyCssChange();
        });
        return "contain";
    }

    private resolveImagePath(bg: BackgroundItem): string | null {
        if (isAllowedImageUrl(bg.value)) return bg.value;
        const file = this.app.vault.getFileByPath(bg.value);
        const resourcePath = file ? this.app.vault.getResourcePath(file) : null;
        if (resourcePath) return resourcePath;
        return bg.remoteUrl && isAllowedImageUrl(bg.remoteUrl) ? bg.remoteUrl : null;
    }

    private loadImageDimensions(resourcePath: string, state: DocumentStyleState): Promise<ImageDimensions | null> {
        // Keep detached loaders and their timers in the main window. The promise
        // continuation above retains the target document even when focus changes.
        const image = createEl("img");
        return new Promise((resolve) => {
            let settled = false;
            let timeout: number | null = null;
            const finish = (dimensions: ImageDimensions | null) => {
                if (settled) return;
                settled = true;
                if (timeout !== null) window.clearTimeout(timeout);
                image.onload = null;
                image.onerror = null;
                state.pendingImageLoads.delete(cancel);
                resolve(dimensions);
            };
            const cancel = () => {
                finish(null);
                image.src = "";
            };

            state.pendingImageLoads.add(cancel);
            timeout = window.setTimeout(() => {
                logger.warn("Background dimension analysis timed out");
                cancel();
            }, IMAGE_LOAD_TIMEOUT_MS);
            image.onload = () => {
                finish({
                    height: image.naturalHeight,
                    width: image.naturalWidth,
                });
            };
            image.onerror = () => {
                logger.warn("Unable to analyze background dimensions");
                finish(null);
            };
            image.src = resourcePath;
        });
    }

    private cancelPendingImageLoads(): void {
        for (const state of this.documents.values()) {
            this.cancelDocumentImageLoads(state);
        }
    }

    private cancelDocumentImageLoads(state: DocumentStyleState): void {
        for (const cancel of [...state.pendingImageLoads]) {
            cancel();
        }
    }

    private notifyCssChange(): void {
        this.app.workspace.trigger("css-change", { source: "dtb" });
    }
}
