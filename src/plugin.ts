/**
 * 动态主题背景插件 - 主插件类
 * 作为编排器协调各服务模块
 */
import { Notice, Plugin } from "obsidian";

import { registerCommands } from "./commands";
import { BackgroundManager, BackgroundPersistence, EventBus, StyleManager, TimeRuleScheduler, logger } from "./core";
import { getDefaultSettings } from "./default-settings";
import { t } from "./i18n";
import { DTBSettingTab, DTBSettingsView, DTB_SETTINGS_VIEW_TYPE } from "./settings";
import type { BackgroundItem, DTBSettings } from "./types";
import { isRecord } from "./utils";
import { apiManager } from "./wallpaper-apis";

export default class DynamicThemeBackgroundPlugin extends Plugin {
    settings!: DTBSettings;
    events: EventBus = new EventBus();

    // 核心服务
    private scheduler!: TimeRuleScheduler;
    styleManager!: StyleManager;
    private persistence!: BackgroundPersistence;
    bgManager!: BackgroundManager;

    // 界面元素
    statusBar: HTMLElement | null = null;
    settingTabs: Map<string, DTBSettingTab> = new Map();

    // ============================================================================
    // 主要接口方法
    // ============================================================================

    async onload() {
        await this.loadSettings();

        // 初始化核心服务
        this.scheduler = new TimeRuleScheduler(this.settings.timeRules);
        this.styleManager = new StyleManager(this.app);
        this.persistence = new BackgroundPersistence(this.app);
        this.bgManager = new BackgroundManager(this.scheduler, this.styleManager, this.events, this, () => {
            void this.saveSettings();
        });

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
            this.app.workspace.onLayoutReady(() => {
                this.startBackgroundManager();
            });
        }

        // Wallpaper API 管理器
        for (const apiConfig of this.settings.wallpaperApis) {
            void apiManager.createApi(apiConfig);
        }

        logger.debug("Plugin loaded");
    }

    onunload() {
        this.stopBackgroundManager();
        apiManager.deleteAllApis();
        this.events.removeAllListeners();
        logger.debug("Plugin unloaded");
    }

    async loadSettings() {
        const defaultSettings = getDefaultSettings();
        const loaded: unknown = await this.loadData();
        const saved = isRecord(loaded) ? loaded : {};
        this.settings = Object.assign({}, defaultSettings, saved);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // ============================================================================
    // 背景管理器代理
    // ============================================================================

    get background(): BackgroundItem | null {
        return this.bgManager?.background ?? null;
    }

    set background(bg: BackgroundItem | null) {
        if (this.bgManager) {
            this.bgManager.background = bg;
        }
    }

    startBackgroundManager() {
        this.scheduler.updateRules(this.settings.timeRules);
        this.bgManager.start(this.settings);
    }

    stopBackgroundManager() {
        this.bgManager?.stop();
    }

    /**
     * 按设定规则更新背景
     */
    async updateBackground(forceUpdate = true) {
        await this.bgManager.update(this.settings, forceUpdate);
    }

    /**
     * 更新样式 CSS（代理到 StyleManager）
     */
    updateStyleCss(bgSize?: string) {
        this.styleManager.applyBackground(this.background, this.settings, bgSize);
    }

    /**
     * 异步应用随机壁纸
     */
    async applyRandomWallpaper(): Promise<void> {
        await this.bgManager.applyRandom(this.settings);
        this.refreshActiveBackgrounds();
    }

    // ============================================================================
    // 背景保存
    // ============================================================================

    /**
     * 保存当前背景设置
     */
    async saveBackground(bg: BackgroundItem | null = this.background) {
        if (!bg) return;
        if (!this.settings.localBackgroundFolder) {
            new Notice(t("notice_save_background_valid_folder_path_required"));
            return;
        }
        if (bg.type !== "image") {
            new Notice(t("notice_save_background_only_image_supported"));
            return;
        }
        if (!this.styleManager.isRemoteImage(bg.value)) {
            new Notice(t("notice_save_background_no_need_save_local"));
            return;
        }

        const result = await this.persistence.saveRemoteImage(bg, this.settings.localBackgroundFolder);
        if (!result.success) {
            if (result.error !== "cancelled") {
                new Notice(t("notice_save_background_failed"));
            }
            return;
        }

        // 更新 settings 中的 bg 引用（不可变更新）
        const updatedBg = result.updatedBg;
        const bgIndex = this.settings.backgrounds.findIndex((item) => item.id === updatedBg.id);
        if (bgIndex >= 0) {
            this.settings.backgrounds[bgIndex] = updatedBg;
        } else {
            this.settings.backgrounds.push(updatedBg);
            this.refreshActiveBackgrounds();
            this.refreshActiveTimeRules();
        }

        // 更新当前显示的背景
        if (this.background?.id === updatedBg.id) {
            this.bgManager.background = updatedBg;
        }

        await this.saveSettings();
        new Notice(t("notice_save_background_success", { folderPath: this.settings.localBackgroundFolder }));
    }

    // ============================================================================
    // 工具方法（代理）
    // ============================================================================

    getBgURL(bg: BackgroundItem): string {
        return this.styleManager.getBgURL(bg);
    }

    isRemoteImage(imagePath: string): boolean {
        return this.styleManager.isRemoteImage(imagePath);
    }

    getCurrentTimeRule() {
        return this.scheduler.getCurrentRule();
    }

    getNextRuleChangeTime() {
        return this.scheduler.getNextChangeTime();
    }

    // ============================================================================
    // 界面方法
    // ============================================================================

    activateView(): void {
        const existingLeaf = this.app.workspace.getLeavesOfType(DTB_SETTINGS_VIEW_TYPE)[0];
        if (existingLeaf) {
            void this.app.workspace.revealLeaf(existingLeaf);
        } else {
            const leaf = this.app.workspace.getLeaf("tab");
            void leaf.setViewState({
                type: DTB_SETTINGS_VIEW_TYPE,
                active: true,
            });
            void this.app.workspace.revealLeaf(leaf);
        }
    }

    deactivateStatusBar() {
        this.statusBar?.remove();
        this.statusBar = null;
    }

    activateStatusBar() {
        this.deactivateStatusBar();
        this.statusBar = this.addStatusBarItem();
        this.statusBar.setText("DTB");
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

    // ============================================================================
    // 设置页刷新（保持兼容，后续 R3 将替换为纯事件驱动）
    // ============================================================================

    refreshActiveSettings() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.display();
            }
        });
        this.events.emit("settings:changed", { key: "enabled", value: this.settings.enabled });
    }

    refreshActiveTimeRules() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.displayTimeRules();
            }
        });
        this.events.emit("time-rules:changed", {});
    }

    refreshActiveBackgrounds() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.displayBackgrounds();
            }
        });
        this.events.emit("backgrounds:changed", {});
    }

    refreshActiveApiList() {
        this.settingTabs.forEach((tab) => {
            if (tab.isActive()) {
                tab.displayWallpaperApis();
            }
        });
        this.events.emit("apis:changed", {});
    }
}
