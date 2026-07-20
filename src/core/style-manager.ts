/**
 * 样式管理器
 * 负责 CSS 变量注入、背景 URL 解析和图片尺寸分析
 */

import type { App } from "obsidian";

import { RATIO_CLOSE_THRESHOLD, RATIO_LARGE_DIFF_THRESHOLD } from "../constants";
import type { BackgroundItem, DTBSettings } from "../types";
import { hexToRgba } from "../utils";
import { logger } from "./logger";

export class StyleManager {
    private app: App;
    private imageSizeCache = new Map<string, string>();

    constructor(app: App) {
        this.app = app;
    }

    /**
     * 应用背景样式（CSS 变量注入）
     */
    applyBackground(bg: BackgroundItem | null, settings: DTBSettings, bgSize?: string): void {
        if (!settings.enabled) {
            return;
        }

        if (!bg) {
            // 没有激活背景时，仍然更新遮罩变量
            const bgColorLight = hexToRgba(settings.bgColorLight, settings.bgColorOpacityLight);
            const bgColorDark = hexToRgba(settings.bgColorDark, settings.bgColorOpacityDark);
            activeDocument.documentElement.setCssProps({
                "--dtb-bg-image": "none",
                "--dtb-bg-color-light": bgColorLight,
                "--dtb-bg-color-dark": bgColorDark,
            });
        } else {
            const bgCssValue = bg.type === "image" ? this.getBgURL(bg) : bg.value;
            // 优先级: 传入的自定义值 > 背景单独的设置 > 全局默认设置
            const blurDepth = bg.blurDepth ?? settings.blurDepth;
            const brightness4Bg = bg.brightness4Bg ?? settings.brightness4Bg;
            const saturate4Bg = bg.saturate4Bg ?? settings.saturate4Bg;
            // 遮罩颜色与透明度
            const lightColor = bg.bgColorLight ?? settings.bgColorLight;
            const lightOpacity = bg.bgColorOpacityLight ?? settings.bgColorOpacityLight;
            const darkColor = bg.bgColorDark ?? settings.bgColorDark;
            const darkOpacity = bg.bgColorOpacityDark ?? settings.bgColorOpacityDark;
            const bgColorLight = hexToRgba(lightColor, lightOpacity);
            const bgColorDark = hexToRgba(darkColor, darkOpacity);
            bgSize = bgSize ?? bg.bgSize ?? settings.bgSize ?? "intelligent";
            // intelligent 模式下动态选择
            if (bgSize === "intelligent") {
                if (bg.type === "image") {
                    bgSize = this.getOptimalBackgroundSize(bg.value);
                } else {
                    bgSize = "auto";
                }
            }
            activeDocument.documentElement.setCssProps({
                "--dtb-bg-image": bgCssValue,
                "--dtb-blur-depth": `${blurDepth}px`,
                "--dtb-brightness": `${brightness4Bg}`,
                "--dtb-saturate": `${saturate4Bg}`,
                "--dtb-bg-color-light": bgColorLight,
                "--dtb-bg-color-dark": bgColorDark,
                "--dtb-bg-size": bgSize,
            });
        }

        // 通知 css-change
        this.app.workspace.trigger("css-change", { source: "dtb" });
    }

    /**
     * 将图片路径转换为可用的 CSS URL
     * 注意：如果本地路径无效且有 remoteUrl 备份，返回远端 URL 并标记需要恢复
     */
    getBgURL(bg: BackgroundItem): string {
        const imagePath = bg.value;
        if (this.isRemoteImage(imagePath)) {
            return `url("${imagePath}")`;
        }
        // 本地图片路径
        const file = this.app.vault.getFileByPath(imagePath);
        if (file) {
            const p = this.app.vault.getResourcePath(file);
            if (p) {
                return `url("${p}")`;
            } else {
                logger.warn(`Resource path for ${imagePath} is empty`);
            }
        } else {
            logger.warn(`Image ${imagePath} not found or inaccessible`);
        }

        // 回退到 remoteUrl 备份（不修改 bg 对象，仅使用远端 URL 渲染）
        if (bg.remoteUrl) {
            logger.warn(`Local path invalid, falling back to remote URL for "${bg.name}"`);
            return `url("${bg.remoteUrl}")`;
        }

        return "none";
    }

    isRemoteImage(imagePath: string): boolean {
        return imagePath.startsWith("http://") || imagePath.startsWith("https://");
    }

    /**
     * 根据图片和屏幕比例动态选择最佳 background-size
     */
    private getOptimalBackgroundSize(imagePath: string): string {
        if (this.isRemoteImage(imagePath)) {
            return "contain";
        }

        // 检查缓存
        const cached = this.imageSizeCache.get(imagePath);
        if (cached) {
            return cached;
        }

        try {
            const screenRatio = window.innerWidth / window.innerHeight;
            const file = this.app.vault.getFileByPath(imagePath);
            if (!file) return "contain";

            const resourcePath = this.app.vault.getResourcePath(file);
            if (!resourcePath) return "contain";

            // 异步分析图片尺寸
            void this.loadImageAndAnalyze(resourcePath, screenRatio, imagePath);

            return "contain"; // 默认返回 contain，异步更新后会重新渲染
        } catch (error) {
            logger.warn("Error determining optimal background size:", error);
            return "contain";
        }
    }

    /**
     * 异步加载图片并分析尺寸，结果缓存
     * 返回计算出的最佳尺寸（通过回调通知）
     */
    private async loadImageAndAnalyze(
        resourcePath: string,
        screenRatio: number,
        imagePath: string
    ): Promise<string> {
        try {
            const img = new Image();

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Failed to load image"));
                img.src = resourcePath;
            });

            const imageRatio = img.naturalWidth / img.naturalHeight;
            const ratioDifference = Math.abs(imageRatio - screenRatio) / screenRatio;

            let optimalSize: string;

            if (ratioDifference < RATIO_CLOSE_THRESHOLD) {
                optimalSize = "cover";
            } else if (imageRatio > screenRatio) {
                optimalSize = "contain";
            } else {
                optimalSize =
                    ratioDifference > RATIO_LARGE_DIFF_THRESHOLD ? "contain" : "cover";
            }

            logger.debug(
                `Image analysis - Screen: ${screenRatio.toFixed(2)}, Image: ${imageRatio.toFixed(2)}, Size: ${optimalSize}`
            );

            // 缓存结果
            this.imageSizeCache.set(imagePath, optimalSize);

            // 限制缓存大小
            if (this.imageSizeCache.size > 50) {
                const firstKey = this.imageSizeCache.keys().next().value;
                if (firstKey) this.imageSizeCache.delete(firstKey);
            }

            return optimalSize;
        } catch (error) {
            logger.warn("Error loading image for size calculation:", error);
            return "contain";
        }
    }

    /**
     * 清除图片尺寸缓存（窗口 resize 时调用）
     */
    clearImageSizeCache(): void {
        this.imageSizeCache.clear();
    }
}
