/**
 * 动态主题背景插件 - 主插件类
 */
import { Notice, Plugin, requestUrl } from "obsidian";

import { registerCommands } from "./commands";
import { getDefaultSettings } from "./default-settings";
import { t } from "./i18n";
import { confirm } from "./modals";
import { DTBSettingTab, DTBSettingsView, DTB_SETTINGS_VIEW_TYPE } from "./settings";
import type { BackgroundItem, DTBSettings, TimeRule } from "./types";
import { hexToRgba } from "./utils";
import { apiManager } from "./wallpaper-apis";

export default class DynamicThemeBackgroundPlugin extends Plugin {
    settings: DTBSettings;

    // 内部状态
    background: BackgroundItem | null = null; // 当前的背景
    intervalId: number | null = null; // 用于间隔模式的定时器 ID
    timeoutId: number | null = null; // 用于时段规则的定时器 ID

    // 界面元素
    statusBar: HTMLElement | null = null; // 状态栏
    settingTabs: Map<string, DTBSettingTab> = new Map(); // 存储所有设置标签页的引用

    // ============================================================================
    // 主要接口方法
    // ============================================================================

    async onload() {
        await this.loadSettings();

        // 左侧栏图标
        // this.addRibbonIcon("rainbow", "🌈 DTB", async (evt: MouseEvent) => {
        //     await this.applyRandomWallpaper();
        // });

        // 状态栏
        if (this.settings.statusBarEnabled) {
            this.activateStatusBar();
        }

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
            void apiManager.createApi(apiConfig);
        }

        console.debug("Dynamic Theme Background plugin loaded");
    }

    onunload() {
        this.stopBackgroundManager();

        // 清理所有注册的API实例（包括状态管理器中的所有订阅）
        apiManager.deleteAllApis();

        console.debug("Dynamic Theme Background plugin unloaded");
    }

    async loadSettings() {
        const defaultSettings = getDefaultSettings();
        const saved = (await this.loadData()) ?? {};
        this.settings = Object.assign({}, defaultSettings, saved);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 激活设置标签页视图
     */
    activateView(): void {
        // 检查是否已经存在该类型的 leaf
        const existingLeaf = this.app.workspace.getLeavesOfType(DTB_SETTINGS_VIEW_TYPE)[0];

        if (existingLeaf) {
            // 如果已存在，则聚焦它
            void this.app.workspace.revealLeaf(existingLeaf);
        } else {
            // 如果不存在，则创建新的 leaf
            const leaf = this.app.workspace.getLeaf("tab");
            void leaf.setViewState({
                type: DTB_SETTINGS_VIEW_TYPE,
                active: true,
            });

            // 确保标签页获得焦点
            void this.app.workspace.revealLeaf(leaf);
        }
    }

    /**
     * 停止状态栏
     */
    deactivateStatusBar() {
        this.statusBar?.empty();
    }

    /**
     * 激活状态栏，左键点击切换随机壁纸，右键点击保存当前背景，中键打开设置标签页
     */
    activateStatusBar() {
        this.deactivateStatusBar();
        this.statusBar = this.addStatusBarItem();
        this.statusBar.setText("🌈 DTB"); // eslint-disable-line obsidianmd/ui/sentence-case -- acronym
        this.statusBar.addClass("dtb-status-bar");
        this.statusBar.setAttribute("title", t("status_bar_title"));
        this.statusBar.addEventListener("click", (evt) => {
            if (evt.button === 0) {
                void this.applyRandomWallpaper();
            }
        });
        this.statusBar.addEventListener("auxclick", (evt) => {
            if (evt.button === 1) {
                void this.activateView();
            }
        });
        this.statusBar.addEventListener("contextmenu", (evt) => {
            evt.preventDefault();
            void this.saveBackground();
        });
    }

    /**
     * 停止背景管理器
     */
    stopBackgroundManager() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        document.body.classList.remove("dtb-enabled");
        console.debug("DTB: Background manager stopped");
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
        void this.updateBackground(true);

        if (this.settings.mode === "time-based") {
            // 时段模式：使用 setTimeout，计算到下一个时段的时间
            this.startTimeBasedManager();
        } else if (this.settings.mode === "interval") {
            // 间隔模式：使用 setInterval
            const intervalMs = this.settings.intervalMinutes * 60000;
            this.intervalId = this.registerInterval(
                window.setInterval(() => {
                    void this.updateBackground(false);
                }, intervalMs)
            );

            console.debug("DTB: Background manager started (interval mode)", {
                mode: this.settings.mode,
                interval: intervalMs / 1000 + "s",
            });
        } else {
            console.debug("DTB: Background manager started (manual mode)", {
                mode: this.settings.mode,
            });
        }
    }

    // 时段规则下的背景更新循环，通过 setTimeout 实现
    startTimeBasedManager(): void {
        const scheduleNext = () => {
            const nextRuleChange = this.getNextRuleChangeTime();
            if (nextRuleChange) {
                const delay = nextRuleChange - Date.now();

                // 确保延迟时间为正数，最少1秒
                const actualDelay = Math.max(delay, 1000);

                this.timeoutId = window.setTimeout(() => {
                    void this.updateBackground(false);
                    // 此处应该刷新设置页中的时间规则列表
                    this.refreshActiveTimeRules();
                    scheduleNext(); // 递归调度下一个时段
                }, actualDelay);

                console.debug("DTB: Next background change scheduled", {
                    mode: this.settings.mode,
                    delay: Math.round(actualDelay / 1000) + "s",
                    nextTime: new Date(nextRuleChange).toLocaleTimeString(),
                });
            } else {
                // 如果没有下一个时段，24小时后重新检查
                this.timeoutId = window.setTimeout(
                    () => {
                        void this.updateBackground(false);
                        scheduleNext();
                    },
                    24 * 60 * 60 * 1000
                );

                console.debug("DTB: No next rule found, checking again in 24 hours");
            }
        };

        scheduleNext();
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
                    // 判断是否与当前背景不同
                    needsUpdate = this.background?.id !== rule.backgroundId;
                    if (needsUpdate) {
                        this.background = this.settings.backgrounds.find((bg) => bg.id === rule.backgroundId) ?? null;
                    }
                } else {
                    // 当前没有匹配的时段规则，取消背景
                    this.background = null;
                    needsUpdate = true; // 强制更新样式以清除背景
                }
                // 调试信息, 降低等级，避免刷屏
                console.debug("DTB: TimeRule mode - current time rule", rule, needsUpdate);
                break;
            }
            // 基于时间间隔切换
            case "interval": {
                const randomBg = await this.fetchRandomWallpaperFromAPI();
                if (randomBg) {
                    this.background = randomBg;
                    needsUpdate = true;
                } else if (this.settings.backgrounds.length > 0) {
                    // API失败时回退到本地背景
                    this.settings.currentIndex = (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                    this.background = this.settings.backgrounds[this.settings.currentIndex];
                    void this.saveSettings();
                    needsUpdate = true;
                }
                break;
            }
            default: {
                // 手动模式
                this.background = this.settings.backgrounds[this.settings.currentIndex];
            }
        }

        if (forceUpdate || needsUpdate) {
            this.updateStyleCss();
            // 这里需要刷新设置页面，以正确显示激活图标
            this.refreshActiveBackgrounds();
        }
    }

    /**
     * 更新样式 CSS（真正更新背景的地方）, 调用前请确保已设置 this.background
     * @param bgSize 可选的自定义背景尺寸，如果不提供则自动计算
     */
    updateStyleCss(bgSize?: string) {
        if (!this.settings.enabled) {
            return;
        }

        if (!this.background) {
            // 没有激活背景时，仍然更新遮罩变量，保证设置页调整立即生效
            const bgColorLight = hexToRgba(this.settings.bgColorLight, this.settings.bgColorOpacityLight);
            const bgColorDark = hexToRgba(this.settings.bgColorDark, this.settings.bgColorOpacityDark);
            document.documentElement.setCssProps({
                "--dtb-bg-image": "none",
                "--dtb-bg-color-light": bgColorLight,
                "--dtb-bg-color-dark": bgColorDark,
            });
        } else {
            const bgCssValue =
                this.background.type === "image" ? this.getBgURL(this.background) : this.background.value;
            // 模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式的优先级统一为:
            // 传入的自定义值 > 背景单独的设置 > 全局默认设置
            const blurDepth = this.background.blurDepth ?? this.settings.blurDepth;
            const brightness4Bg = this.background.brightness4Bg ?? this.settings.brightness4Bg;
            const saturate4Bg = this.background.saturate4Bg ?? this.settings.saturate4Bg;
            // 计算遮罩颜色与透明度（优先级：每背景按主题覆盖 > 全局 light/dark）
            const perBgLightColor = this.background.bgColorLight;
            const perBgLightOpacity = this.background.bgColorOpacityLight;
            const perBgDarkColor = this.background.bgColorDark;
            const perBgDarkOpacity = this.background.bgColorOpacityDark;

            const lightColor = perBgLightColor ?? this.settings.bgColorLight;
            const lightOpacity = perBgLightOpacity ?? this.settings.bgColorOpacityLight;
            const darkColor = perBgDarkColor ?? this.settings.bgColorDark;
            const darkOpacity = perBgDarkOpacity ?? this.settings.bgColorOpacityDark;
            const bgColorLight = hexToRgba(lightColor, lightOpacity);
            const bgColorDark = hexToRgba(darkColor, darkOpacity);
            bgSize = bgSize ?? this.background.bgSize ?? this.settings.bgSize ?? "intelligent";
            // 如果是 "intelligent"，则根据图片和屏幕比例动态选择
            if (bgSize === "intelligent") {
                if (this.background.type === "image") {
                    bgSize = this.getOptimalBackgroundSize(this.background.value);
                } else {
                    bgSize = "auto"; // 对于非图片背景，使用 auto
                }
            }
            // 通过修改根元素的 CSS 属性来更新背景样式
            document.documentElement.setCssProps({
                "--dtb-bg-image": bgCssValue,
                "--dtb-blur-depth": `${blurDepth}px`,
                "--dtb-brightness": `${brightness4Bg}`,
                "--dtb-saturate": `${saturate4Bg}`,
                // 仅设置明/暗两套变量；统一变量 --dtb-bg-color 交由 CSS 中的 .theme-light/.theme-dark 进行映射
                "--dtb-bg-color-light": bgColorLight,
                "--dtb-bg-color-dark": bgColorDark,
                "--dtb-bg-size": bgSize,
            });
        }

        // 通知 css-change
        this.app.workspace.trigger("css-change", { source: "dtb" });
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

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
            void this.loadImageAndUpdateSize(resourcePath, screenRatio);

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

    /**
     * 异步应用随机壁纸作为背景。
     *
     * 此方法会尝试从 API 获取一个随机壁纸 URL，并将其设置为当前背景。
     * 如果 API 获取失败，则会回退到本地背景列表，按顺序切换到下一个背景，并保存设置。
     * 最后会更新样式的 CSS 以应用新的背景。
     *
     */
    async applyRandomWallpaper(): Promise<void> {
        const bg = await this.fetchRandomWallpaperFromAPI();

        if (bg) {
            this.background = bg;
        } else if (this.settings.backgrounds.length > 0) {
            // API失败时回退到本地背景
            this.settings.currentIndex = (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
            this.background = this.settings.backgrounds[this.settings.currentIndex];
            await this.saveSettings();
        }

        this.updateStyleCss();
        // 这里需要刷新设置页面
        this.refreshActiveBackgrounds();
    }

    /**
     * 保存当前背景设置, 如果已经是本地图片则不操作
     */
    async saveBackground(bg: BackgroundItem | null = this.background) {
        if (!bg) return;
        // 判断是否设置了 localBackgroundFolder
        if (!this.settings.localBackgroundFolder) {
            new Notice(t("notice_save_background_valid_folder_path_required"));
            return;
        }
        // 判断是否是图片，非图片则不保存
        if (bg.type !== "image") {
            new Notice(t("notice_save_background_only_image_supported"));
            return;
        }
        // 如果是本地图片，则不保存
        if (!this.isRemoteImage(bg.value)) {
            new Notice(t("notice_save_background_no_need_save_local"));
            return;
        }

        // 保存远程图片
        const success = await this.saveRemoteImage(bg, this.settings.localBackgroundFolder);
        if (!success) {
            new Notice(t("notice_save_background_failed"));
            return;
        }

        // 如果本 bg 还未在列表中，则添加
        if (!this.settings.backgrounds.find((item) => item.id === bg.id)) {
            this.settings.backgrounds.push(bg);
            // 这里需要刷新设置页面中的背景列表和时间规则
            this.refreshActiveBackgrounds();
            this.refreshActiveTimeRules();
        }

        // 由于保存远程图片时会将本地图片路径替换为远程路径，因此需要更新设置
        await this.saveSettings();

        new Notice(t("notice_save_background_success", { folderPath: this.settings.localBackgroundFolder }));
    }

    async saveRemoteImage(bg: BackgroundItem, folderPath: string): Promise<boolean> {
        if (!folderPath) {
            new Notice(t("notice_save_background_valid_folder_path_required"));
            return false;
        }

        // 默认图片名为 bg.name + .jpg , 并规范化路径 移除禁止的字符： \ / : * ? " < > |
        const imageName = bg.name.replace(/[\\/:*?"<>|]/g, "_") + ".jpg";
        const localPath = `${folderPath}/${imageName}`;

        // 判断路径是否存在，如果存在，由用户确定是否覆盖
        const file = this.app.vault.getFileByPath(localPath);
        if (file) {
            const overwrite = await confirm(
                this.app,
                t("notice_save_background_overwrite_existing_file", { filePath: localPath })
            );
            if (!overwrite) return true; // 用户取消覆盖
        }

        // 这里添加保存远程图片的逻辑
        const response = await requestUrl({ url: bg.value });
        if (response.status < 200 || response.status >= 300) {
            new Notice(t("notice_save_background_failed"), response.status);
            return false;
        }
        const arrayBuffer = response.arrayBuffer;

        // 如果需要覆盖，则先删除旧文件
        if (file) {
            await this.app.fileManager.trashFile(file);
        }
        await this.app.vault.createBinary(localPath, arrayBuffer);

        // 默认将bg中的url替换为本地路径，并将remoteUrl设置为原始url以作备份
        bg.remoteUrl = bg.value;
        bg.value = localPath;
        // 这里提示用户转换了 value, 时间长点
        new Notice(t("notice_save_background_converted", { oldPath: bg.remoteUrl, newPath: bg.value }), 5000);

        return true;
    }

    // 从壁纸API获取随机图片URL
    async fetchRandomWallpaperFromAPI(): Promise<BackgroundItem | null> {
        if (!this.settings.enableRandomWallpaper) {
            return null;
        }

        // 获取所有启用的API实例
        const enabledApis = apiManager.getEnabledApis();
        // 如果没有启用的API，返回null
        if (enabledApis.length === 0) {
            console.warn("DTB: No enabled APIs found");
            return null;
        }
        // 从启用的API中随机选择一个
        const randomIndex = Math.floor(Math.random() * enabledApis.length);
        const selectedApi = enabledApis[randomIndex];

        try {
            // 显示加载提示
            const loadingNotice = new Notice(t("notice_api_fetching", { apiName: selectedApi.getName() }), 0);

            // 使用选中的API获取壁纸
            const wallpaperImages = await apiManager.getRandomWallpapers(selectedApi.getId());

            // 关闭加载提示
            loadingNotice.hide();

            if (!wallpaperImages || wallpaperImages.length === 0) {
                console.warn(`DTB: No images returned from API: ${selectedApi.getName()}`);
                return null;
            }
            const randomImage = wallpaperImages[Math.floor(Math.random() * wallpaperImages.length)];
            if (randomImage && randomImage.url) {
                new Notice(t("notice_api_success_applied", { apiName: selectedApi.getName() }));
                return {
                    id: selectedApi.generateBackgroundId(),
                    name: selectedApi.generateBackgroundName(),
                    type: "image",
                    value: randomImage.url,
                };
            } else {
                new Notice(t("notice_api_failed_fetch", { apiName: selectedApi.getName() }));
                console.warn(`DTB: No wallpaper image returned from API: ${selectedApi.getName()}`);
                return null;
            }
        } catch (error) {
            new Notice(t("notice_api_error_fetch", { apiName: selectedApi.getName(), error: error.message }));
            console.error("DTB: Error fetching random wallpaper:", error);
            return null;
        }
    }

    // 将图片路径转换为可用的 CSS URL
    getBgURL(bg: BackgroundItem): string {
        const imagePath = bg.value;
        // 判断是否是远程图片
        if (this.isRemoteImage(imagePath)) {
            return `url("${imagePath}")`;
        }
        // 本地图片路径（只接受 Vault 内的图片）
        const file = this.app.vault.getFileByPath(imagePath);
        if (file) {
            const p = this.app.vault.getResourcePath(file);
            if (p) {
                return `url("${p}")`;
            } else {
                console.warn(`DTB: Resource path for ${imagePath} is empty`);
            }
        } else {
            console.warn(`DTB: Image ${imagePath} not found or inaccessible`);
        }

        // 如果 value 表示的本地路径无效，则查看 bg 有没有 remoteUrl 备份链接
        if (bg.remoteUrl) {
            // 这里恢复备份, 按理在这做不太合适
            bg.value = bg.remoteUrl;
            void this.saveSettings(); // 保存设置
            return `url("${bg.remoteUrl}")`;
        }

        // 否则
        return "none";
    }

    isRemoteImage(imagePath: string): boolean {
        return imagePath.startsWith("http://") || imagePath.startsWith("https://");
    }

    /**
     * 获取当前时段规则
     * 按时间顺序排序规则，找到第一个匹配当前时间的规则
     */
    getCurrentTimeRule(): TimeRule | null {
        if (this.settings.mode !== "time-based") return null;

        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // 按 startTime 排序，优先匹配靠前的规则
        const sortedRules = this.settings.timeRules
            .filter((rule) => rule.enabled)
            .map((rule) => {
                const { startTime, endTime } = this.parseTimeRule(rule);
                return { rule, startTime, endTime };
            })
            .sort((a, b) => a.startTime - b.startTime);

        // 遍历排序后的规则，找到第一个匹配的
        for (const { rule, startTime, endTime } of sortedRules) {
            // 跨天时段处理：如 20:00-06:00
            if (startTime > endTime) {
                if (currentTimeMinutes >= startTime || currentTimeMinutes < endTime) {
                    return rule;
                }
            } else {
                if (currentTimeMinutes >= startTime && currentTimeMinutes < endTime) {
                    return rule;
                }
            }
        }
        return null;
    }

    /**
     * 获取下一个时段规则变化的时间点
     */
    getNextRuleChangeTime(): number | null {
        if (this.settings.mode !== "time-based" || this.settings.timeRules.length === 0) {
            return null;
        }

        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // 收集所有启用的时段规则的开始和结束时间点
        const timePoints: Array<{ time: number; isStart: boolean; rule: TimeRule }> = [];

        for (const rule of this.settings.timeRules) {
            if (!rule.enabled) continue;

            const { startTime, endTime } = this.parseTimeRule(rule);

            timePoints.push({ time: startTime, isStart: true, rule });
            timePoints.push({ time: endTime, isStart: false, rule });
        }

        // 按时间排序
        timePoints.sort((a, b) => a.time - b.time);

        // 查找下一个时间点
        let nextPoint = null;

        // 首先查找今天剩余时间内的下一个时间点
        for (const point of timePoints) {
            if (point.time > currentTimeMinutes) {
                nextPoint = point;
                break;
            }
        }

        // 如果今天没有找到，取明天的第一个时间点
        if (!nextPoint && timePoints.length > 0) {
            nextPoint = timePoints[0];
        }

        if (!nextPoint) {
            return null;
        }

        // 计算具体的时间戳
        const targetDate = new Date(now);
        const targetHours = Math.floor(nextPoint.time / 60);
        const targetMinutes = nextPoint.time % 60;

        targetDate.setHours(targetHours, targetMinutes, 0, 0);

        // 如果目标时间已经过了，说明是明天的时间点
        if (targetDate.getTime() <= now.getTime()) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        return targetDate.getTime();
    }

    /**
     * 解析时间规则，返回标准化的时间信息
     */
    private parseTimeRule(rule: TimeRule) {
        const [startHour, startMin] = rule.startTime.split(":").map(Number);
        const [endHour, endMin] = rule.endTime.split(":").map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return { startTime, endTime };
    }

    /**
     * 刷新当前激活的设置页
     */
    refreshActiveSettings() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.display();
            }
        });
    }

    /**
     * 刷新当前激活的设置页中的时间规则列表
     */
    refreshActiveTimeRules() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.displayTimeRules();
            }
        });
    }

    /**
     * 刷新当前激活的设置页中的背景列表
     */
    refreshActiveBackgrounds() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.displayBackgrounds();
            }
        });
    }

    /**
     * 刷新当前激活的设置页中的api列表
     */
    refreshActiveApiList() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.displayWallpaperApis();
            }
        });
    }
}
