/**
 * 动态主题背景插件 - 主插件类
 */
import { Plugin } from "obsidian";

import { registerCommands } from "./commands";
import { getDefaultSettings } from "./default-settings";
import { DTBSettingTab, DTBSettingsView, DTB_SETTINGS_VIEW_TYPE } from "./settings";
import type { BackgroundItem, DTBSettings, TimeRule } from "./types";
import { hexToRgba } from "./utils";
import { apiManager } from "./wallpaper-apis";

export default class DynamicThemeBackgroundPlugin extends Plugin {
    settings: DTBSettings;
    intervalId: number | null = null;
    styleTag: HTMLStyleElement;

    // 当前的背景
    background: BackgroundItem | null = null;

    // ============================================================================
    // 主要接口方法
    // ============================================================================

    async onload() {
        await this.loadSettings();

        // 创建样式元素
        this.styleTag = document.createElement("style");
        this.styleTag.id = "dtb-dynamic-styles";
        document.head.appendChild(this.styleTag);

        // 注册自定义视图类型
        this.registerView(DTB_SETTINGS_VIEW_TYPE, (leaf) => new DTBSettingsView(leaf, this));

        // 添加设置面板
        this.addSettingTab(new DTBSettingTab(this.app, this));

        // 注册命令
        registerCommands(this);

        // 启动背景管理器
        if (this.settings.enabled) {
            // 等待 layout-ready 事件，确保 vault 完全加载
            this.app.workspace.onLayoutReady(() => {
                this.startBackgroundManager();
            });
        }

        // Wallpaper API 管理器
        // 实例化所有已配置的API
        for (const apiConfig of this.settings.wallpaperApis) {
            apiManager.createApi(apiConfig);
        }

        console.log("Dynamic Theme Background plugin loaded");
    }

    onunload() {
        this.stopBackgroundManager();
        this.deactivateView(); // 清理自定义视图
        this.styleTag?.remove();

        // 清理所有注册的API实例（包括状态管理器中的所有订阅）
        apiManager.deleteAllApis();

        console.log("Dynamic Theme Background plugin unloaded");
    }

    async loadSettings() {
        const defaultSettings = getDefaultSettings();
        this.settings = Object.assign({}, defaultSettings, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 停止并清理设置标签页视图
     */
    deactivateView() {
        this.app.workspace.detachLeavesOfType(DTB_SETTINGS_VIEW_TYPE);
    }

    /**
     * 激活设置标签页视图
     */
    async activateView() {
        this.deactivateView();
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({
            type: DTB_SETTINGS_VIEW_TYPE,
            active: true,
        });

        // 确保标签页获得焦点
        this.app.workspace.revealLeaf(leaf);
    }

    /**
     * 停止背景管理器
     */
    stopBackgroundManager() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        document.body.classList.remove("dtb-enabled");
        console.log("DTB: Background manager stopped");
    }

    /**
     * 启动背景管理器
     */
    startBackgroundManager() {
        this.stopBackgroundManager();

        // 如果没有 'dtb-enabled' 类，则添加
        if (!document.body.classList.contains("dtb-enabled")) {
            document.body.classList.add("dtb-enabled");
        }

        // 立即执行一次更新
        this.updateBackground();

        // 设置定时器
        const intervalMs =
            this.settings.mode === "time-based"
                ? 60000 // 每分钟检查一次
                : this.settings.intervalMinutes * 60000;

        this.intervalId = this.registerInterval(
            window.setInterval(async () => {
                await this.updateBackground(false);
            }, intervalMs)
        );

        console.log("DTB: Background manager started", {
            mode: this.settings.mode,
            interval: intervalMs / 1000 + "s",
        });
    }

    /**
     * 按设定规则更新背景
     * @param forceUpdate 是否强制更新背景
     */
    async updateBackground(forceUpdate = true) {
        if (!this.settings.enabled) return;

        let needsUpdate = false;
        switch (this.settings.mode) {
            // 基于时段切换
            case "time-based": {
                const rule = this.getCurrentTimeRule();
                if (rule) {
                    this.background = this.settings.backgrounds.find((bg) => bg.id === rule.backgroundId) || null;

                    // 判断是否与当前背景不同
                    needsUpdate = this.background?.id !== rule.backgroundId;

                    // 调试信息, 降低等级，避免刷屏
                    console.debug("DTB: TimeRule mode - current time rule", rule);
                }
                break;
            }
            // 基于时间间隔切换
            case "interval": {
                // 检查是否启用随机壁纸
                if (this.settings.enableRandomWallpaper) {
                    const randomWallpaperUrl = await this.fetchRandomWallpaper();

                    if (randomWallpaperUrl) {
                        // 创建一个临时的背景项用于随机壁纸
                        this.background = {
                            id: `random-wallpaper-${Date.now()}`,
                            name: `Random Wallpaper`,
                            type: "image",
                            value: randomWallpaperUrl,
                        };
                        needsUpdate = true;

                        console.debug("DTB: Interval mode - using random wallpaper", randomWallpaperUrl);
                    } else if (this.settings.backgrounds.length > 0) {
                        // API失败时回退到本地背景
                        this.settings.currentIndex =
                            (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                        this.background = this.settings.backgrounds[this.settings.currentIndex];
                        this.saveSettings();
                        needsUpdate = true;

                        console.debug("DTB: Interval mode - fallback to local background", this.background);
                    }
                } else if (this.settings.backgrounds.length > 0) {
                    // 使用本地背景
                    this.background = this.settings.backgrounds[this.settings.currentIndex];
                    this.settings.currentIndex = (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                    this.saveSettings();
                    needsUpdate = true; // 每次间隔切换都需要更新背景

                    console.debug(
                        "DTB: Interval mode - current index and background",
                        this.settings.currentIndex,
                        this.background
                    );
                }
                break;
            }
            default: {
                // 手动模式
                this.background = this.settings.backgrounds[this.settings.currentIndex];
            }
        }

        if (forceUpdate || (needsUpdate && this.background)) {
            this.updateStyleCss();
        }
    }

    /**
     * 获取当前时段规则
     */
    getCurrentTimeRule(): TimeRule | null {
        if (this.settings.mode !== "time-based") return null;

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        for (const rule of this.settings.timeRules) {
            if (!rule.enabled) continue;

            const [startHour, startMin] = rule.startTime.split(":").map(Number);
            const [endHour, endMin] = rule.endTime.split(":").map(Number);

            const startTime = startHour * 60 + startMin;
            const endTime = endHour * 60 + endMin;

            // 处理跨天的情况（如22:00-06:00）
            if (startTime > endTime) {
                if (currentTime >= startTime || currentTime < endTime) {
                    return rule;
                }
            } else {
                if (currentTime >= startTime && currentTime < endTime) {
                    return rule;
                }
            }
        }

        return null;
    }

    /**
     * 更新样式 CSS（真正更新背景的地方）, 调用前请确保已设置 this.background
     * @param customBackgroundSize 可选的自定义背景尺寸，如果不提供则自动计算
     */
    updateStyleCss(customBackgroundSize?: string) {
        if (!this.settings.enabled || !this.background) {
            console.warn("DTB: Background update is disabled or no background is set");
            return;
        }

        let cssValue = "";
        let backgroundProperty = "";

        switch (this.background.type) {
            case "image":
                cssValue = this.sanitizeImagePath(this.background.value);
                backgroundProperty = "background-image";
                break;
            case "color":
                cssValue = this.background.value;
                backgroundProperty = "background";
                break;
            case "gradient":
                cssValue = this.background.value;
                backgroundProperty = "background";
                break;
        }

        const bgColorWithOpacity = hexToRgba(this.settings.bgColor, this.settings.bgColorOpacity);

        // 确定背景尺寸：优先使用传入的自定义尺寸，否则自动计算
        let backgroundSize = customBackgroundSize;
        if (!backgroundSize) {
            if (this.background.type === "image") {
                backgroundSize = this.getOptimalBackgroundSize(this.background.value);
            } else {
                backgroundSize = "auto";
            }
        }

        // TODO 样式还需要优化
        this.styleTag.innerText = `
			.dtb-enabled :not(.modal):not(.modal *) {
                --background-primary: ${bgColorWithOpacity} !important;
                --background-primary-alt: ${bgColorWithOpacity} !important;
                --background-secondary: ${bgColorWithOpacity} !important;
                --background-secondary-alt: ${bgColorWithOpacity} !important;
            }
            .dtb-enabled .workspace::before {
				${backgroundProperty}: ${cssValue} !important;
				background-size: ${backgroundSize};
				background-repeat: no-repeat;
				background-position: center;
				filter: blur(${this.settings.blurDepth}px) brightness(${this.settings.brightness4Bg}) saturate(${this.settings.saturate4Bg});
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: -1;
			}
			`
            .trim()
            .replace(/[\r\n\s]+/g, " ");

        // 通知 css-change
        this.app.workspace.trigger("css-change", {
            source: "dtb",
        });
    }

    /**
     * 根据图片和屏幕比例动态选择最佳的background-size
     * @param imagePath 图片路径
     * @returns 最佳的background-size值
     */
    private getOptimalBackgroundSize(imagePath: string): string {
        // 对于远程图片，由于无法同步获取尺寸，使用contain作为默认值
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
            return "contain";
        }

        try {
            // 获取屏幕比例
            const screenRatio = window.innerWidth / window.innerHeight;

            // 对于本地图片，尝试获取图片尺寸
            const file = this.app.vault.getFileByPath(imagePath);
            if (!file) {
                return "contain";
            }

            // 获取资源路径
            const resourcePath = this.app.vault.getResourcePath(file);

            if (!resourcePath) {
                return "contain";
            }

            // 异步加载图片并更新尺寸
            this.loadImageAndUpdateSize(resourcePath, screenRatio);

            return "contain"; // 默认返回contain，异步更新后会重新渲染
        } catch (error) {
            console.warn("DTB: Error determining optimal background size:", error);
            return "contain";
        }
    }

    /**
     * 异步加载图片并根据比例更新background-size
     * @param resourcePath 图片资源路径
     * @param screenRatio 屏幕比例
     */
    private async loadImageAndUpdateSize(resourcePath: string, screenRatio: number) {
        try {
            const img = new Image();

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Failed to load image"));
                img.src = resourcePath;
            });

            const imageRatio = img.naturalWidth / img.naturalHeight;

            // 计算比例差异
            const ratioDifference = Math.abs(imageRatio - screenRatio) / screenRatio;

            let optimalSize: string;

            if (ratioDifference < 0.1) {
                // 比例相近（差异小于10%），使用cover以获得最佳填充效果
                optimalSize = "cover";
            } else if (imageRatio > screenRatio) {
                // 图片更宽，使用contain以显示完整宽度
                optimalSize = "contain";
            } else {
                // 图片更高，根据差异程度选择
                if (ratioDifference > 0.5) {
                    // 差异很大，使用contain以确保完整显示
                    optimalSize = "contain";
                } else {
                    // 差异适中，使用cover以获得更好的视觉效果
                    optimalSize = "cover";
                }
            }

            console.debug(
                `DTB: Image analysis - Screen ratio: ${screenRatio.toFixed(2)}, Image ratio: ${imageRatio.toFixed(
                    2
                )}, Optimal size: ${optimalSize}`
            );

            // 使用优化后的方法更新样式（如果背景仍然是当前图片）
            if (this.background && this.background.type === "image") {
                this.updateStyleCss(optimalSize);
            }
        } catch (error) {
            console.warn("DTB: Error loading image for size calculation:", error);
        }
    }

    // 从壁纸API获取随机图片URL
    async fetchRandomWallpaper(): Promise<string | null> {
        if (!this.settings.enableRandomWallpaper) {
            return null;
        }

        try {
            // 获取所有启用的API配置
            const enabledApis = this.settings.wallpaperApis.filter((api) => api.enabled);

            // 如果没有启用的API，返回null
            if (enabledApis.length === 0) {
                console.warn("DTB: No enabled APIs found");
                return null;
            }

            // 从启用的API中随机选择一个
            const randomIndex = Math.floor(Math.random() * enabledApis.length);
            const selectedApi = enabledApis[randomIndex];

            // 使用选中的API获取壁纸
            const wallpaperImages = await apiManager.getRandomWallpapers();
            if (!wallpaperImages || wallpaperImages.length === 0) {
                console.warn(`DTB: No images returned from API: ${selectedApi.name}`);
                return null;
            }
            const randomImage = wallpaperImages[Math.floor(Math.random() * wallpaperImages.length)];
            if (randomImage && randomImage.url) {
                return randomImage.url;
            } else {
                console.warn(`DTB: No wallpaper image returned from API: ${selectedApi.name}`);
                return null;
            }
        } catch (error) {
            console.error("DTB: Error fetching random wallpaper:", error);
            return null;
        }
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    // 将图片路径转换为可用的 CSS URL
    sanitizeImagePath(imagePath: string): string {
        // 判断是否是远程图片
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
            return `url(${imagePath})`;
        }
        // 本地图片路径（只接受 Vault 内的图片）
        const file = this.app.vault.getFileByPath(imagePath);
        if (!file) {
            console.warn(`DTB: Image ${imagePath} not found`);
            return "none";
        }
        const p = this.app.vault.getResourcePath(file);
        if (!p) {
            console.warn(`DTB: Cannot get resource path for image ${imagePath}`);
            return "none";
        }
        return `url(${p})`; // 形如 app://local/path/to/image.jpg
    }
}
