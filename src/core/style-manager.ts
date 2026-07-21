/**
 * Owns DTB CSS variables and asynchronous image-dimension analysis.
 */

import type { App } from "obsidian";

import type { BackgroundItem, DTBSettings } from "../types";
import { hexToRgba } from "../utils";
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

export class StyleManager {
    private analysisGeneration = 0;
    private imageSizeCache = new Map<string, "contain" | "cover">();
    private pendingImageLoads = new Set<() => void>();

    constructor(private app: App) {}

    applyBackground(bg: BackgroundItem | null, settings: DTBSettings, requestedSize?: string): void {
        if (!settings.enabled) return;
        const generation = ++this.analysisGeneration;
        this.cancelPendingImageLoads();

        if (!bg) {
            activeDocument.documentElement.setCssProps({
                "--dtb-bg-image": "none",
                "--dtb-bg-color-light": hexToRgba(settings.bgColorLight, settings.bgColorOpacityLight),
                "--dtb-bg-color-dark": hexToRgba(settings.bgColorDark, settings.bgColorOpacityDark),
            });
        } else {
            const size = requestedSize ?? bg.bgSize ?? settings.bgSize;
            const backgroundSize =
                size === "intelligent"
                    ? bg.type === "image"
                        ? this.getOptimalBackgroundSize(bg.value, generation)
                        : "auto"
                    : size;
            activeDocument.documentElement.setCssProps({
                "--dtb-bg-image": bg.type === "image" ? this.getBgURL(bg) : bg.value,
                "--dtb-blur-depth": `${bg.blurDepth ?? settings.blurDepth}px`,
                "--dtb-brightness": `${bg.brightness4Bg ?? settings.brightness4Bg}`,
                "--dtb-saturate": `${bg.saturate4Bg ?? settings.saturate4Bg}`,
                "--dtb-bg-color-light": hexToRgba(
                    bg.bgColorLight ?? settings.bgColorLight,
                    bg.bgColorOpacityLight ?? settings.bgColorOpacityLight
                ),
                "--dtb-bg-color-dark": hexToRgba(
                    bg.bgColorDark ?? settings.bgColorDark,
                    bg.bgColorOpacityDark ?? settings.bgColorOpacityDark
                ),
                "--dtb-bg-size": backgroundSize,
            });
        }
        this.notifyCssChange();
    }

    clear(): void {
        this.analysisGeneration += 1;
        this.cancelPendingImageLoads();
        this.imageSizeCache.clear();
        for (const property of CSS_PROPERTIES) {
            activeDocument.documentElement.style.removeProperty(property);
        }
        this.notifyCssChange();
    }

    refreshViewport(bg: BackgroundItem | null, settings: DTBSettings): void {
        this.imageSizeCache.clear();
        this.applyBackground(bg, settings);
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

    private getOptimalBackgroundSize(imagePath: string, generation: number): "contain" | "cover" {
        const cached = this.imageSizeCache.get(imagePath);
        if (cached) return cached;
        const resourcePath = this.resolveImagePath(imagePath);
        if (!resourcePath) return "contain";

        const viewportWidth = activeWindow.innerWidth;
        const viewportHeight = activeWindow.innerHeight;
        void this.loadImageDimensions(resourcePath).then((dimensions) => {
            if (!dimensions) return;
            const size = selectBackgroundSize(dimensions.width, dimensions.height, viewportWidth, viewportHeight);
            this.imageSizeCache.set(imagePath, size);
            if (this.imageSizeCache.size > 50) {
                const firstKey = this.imageSizeCache.keys().next().value;
                if (firstKey) this.imageSizeCache.delete(firstKey);
            }
            if (generation === this.analysisGeneration) {
                activeDocument.documentElement.style.setProperty("--dtb-bg-size", size);
                this.notifyCssChange();
            }
        });
        return "contain";
    }

    private resolveImagePath(imagePath: string): string | null {
        if (isAllowedImageUrl(imagePath)) return imagePath;
        const file = this.app.vault.getFileByPath(imagePath);
        return file ? this.app.vault.getResourcePath(file) || null : null;
    }

    private loadImageDimensions(resourcePath: string): Promise<{ height: number; width: number } | null> {
        const image = new Image();
        return new Promise((resolve) => {
            let settled = false;
            let timeout: number | null = null;
            const finish = (dimensions: { height: number; width: number } | null) => {
                if (settled) return;
                settled = true;
                if (timeout !== null) window.clearTimeout(timeout);
                image.onload = null;
                image.onerror = null;
                this.pendingImageLoads.delete(cancel);
                resolve(dimensions);
            };
            const cancel = () => {
                finish(null);
                image.src = "";
            };

            this.pendingImageLoads.add(cancel);
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
        for (const cancel of [...this.pendingImageLoads]) {
            cancel();
        }
    }

    private notifyCssChange(): void {
        this.app.workspace.trigger("css-change", { source: "dtb" });
    }
}
