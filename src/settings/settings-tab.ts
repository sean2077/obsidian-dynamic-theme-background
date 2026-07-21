/**
 * 设置标签页协调器
 * 协调各设置区块的展示和刷新
 */
import { App, PluginSettingTab } from "obsidian";
import type { Setting, SettingDefinitionItem } from "obsidian";

import { displayImperativeSettings, refreshDualSettings } from "../core/obsidian-compat";
import { getDefaultSettings } from "../default-settings";
import { t } from "../i18n";
import type DynamicThemeBackgroundPlugin from "../plugin";
import type { DTBSettings } from "../types";
import { generateId } from "../utils";
import { VERSION } from "../version";
import { ApiSettingsSection, BasicSettingsSection, BgManagementSection, ModeSettingsSection } from "./sections";

export class DTBSettingTab extends PluginSettingTab {
    plugin: DynamicThemeBackgroundPlugin;
    defaultSettings: DTBSettings;

    private componentId: string;
    private active!: boolean;
    private declarativeActive = false;

    // 设置区块
    private basicSection?: BasicSettingsSection;
    private modeSection?: ModeSettingsSection;
    private bgSection?: BgManagementSection;
    private apiSection?: ApiSettingsSection;

    constructor(app: App, plugin: DynamicThemeBackgroundPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.defaultSettings = getDefaultSettings();
        this.componentId = generateId("settings-tab");

        // 注册到 plugin
        this.plugin.settingTabs.set(this.componentId, this);
    }

    isActive(): boolean {
        return this.active;
    }

    // ============================================================================
    // 主要接口方法: hide 和 display
    // ============================================================================

    hide(): void {
        this.cleanup();
        this.active = false;
        this.declarativeActive = false;
        this.plugin.settingTabs.delete(this.componentId);
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: t("settings_title"),
                searchable: false,
                render: (setting) => {
                    this.activateSurface(true);
                    setting.settingEl.empty();
                    this.displayHeader(setting.settingEl);
                },
            },
            {
                type: "page",
                name: t("basic_settings_title"),
                items: [this.basicSettingsDefinition()],
            },
            {
                type: "page",
                name: t("mode_settings_title"),
                items: [this.modeSettingsDefinition()],
            },
            {
                type: "page",
                name: t("bg_management_title"),
                items: [this.backgroundSettingsDefinition()],
            },
            {
                type: "page",
                name: t("wallpaper_api_management_title"),
                items: [this.apiSettingsDefinition()],
            },
        ];
    }

    display(): void {
        this.activateSurface(false);
        this.cleanup();

        const { containerEl } = this;
        containerEl.empty();

        this.displayHeader(containerEl);

        // 基础设置
        const basicEl = containerEl.createDiv();
        this.basicSection = new BasicSettingsSection(this.plugin, this.defaultSettings);
        this.basicSection.display(basicEl);

        // 模式设置
        const modeEl = containerEl.createDiv();
        this.modeSection = new ModeSettingsSection(this.plugin, this.defaultSettings);
        this.modeSection.display(modeEl);

        // 背景管理
        const bgEl = containerEl.createDiv();
        this.bgSection = new BgManagementSection(this.plugin, this.defaultSettings, {
            onChanged: () => {
                // 背景列表变化时也需要刷新时间规则下拉（因为时间规则引用背景 ID）
                this.modeSection?.displayTimeRules();
            },
        });
        this.bgSection.display(bgEl);

        // 壁纸 API 设置
        const apiEl = containerEl.createDiv();
        this.apiSection = new ApiSettingsSection(this.plugin, this.defaultSettings, {
            onBackgroundsChanged: () => this.bgSection?.displayBackgrounds(),
            onTimeRulesChanged: () => this.modeSection?.displayTimeRules(),
        });
        this.apiSection.display(apiEl);
    }

    refresh(): void {
        if (this.declarativeActive) {
            refreshDualSettings(this);
        } else {
            displayImperativeSettings(this);
        }
    }

    // ============================================================================
    // 针对性刷新（plugin.ts 调用）
    // ============================================================================

    displayTimeRules(): void {
        this.modeSection?.displayTimeRules();
    }

    displayBackgrounds(): void {
        this.bgSection?.displayBackgrounds();
    }

    displayWallpaperApis(): void {
        this.apiSection?.displayWallpaperApis();
    }

    // ============================================================================
    // 内部方法
    // ============================================================================

    private activateSurface(declarative: boolean): void {
        this.active = true;
        this.declarativeActive = declarative;
        this.plugin.settingTabs.set(this.componentId, this);
    }

    private basicSettingsDefinition(): SettingDefinitionItem {
        return {
            name: t("basic_settings_title"),
            searchable: false,
            render: (setting: Setting) => {
                setting.settingEl.empty();
                const section = new BasicSettingsSection(this.plugin, this.defaultSettings);
                this.basicSection = section;
                section.display(setting.settingEl);
                return () => {
                    section.cleanup();
                    if (this.basicSection === section) this.basicSection = undefined;
                };
            },
        };
    }

    private modeSettingsDefinition(): SettingDefinitionItem {
        return {
            name: t("mode_settings_title"),
            searchable: false,
            render: (setting: Setting) => {
                setting.settingEl.empty();
                const section = new ModeSettingsSection(this.plugin, this.defaultSettings);
                this.modeSection = section;
                section.display(setting.settingEl);
                return () => {
                    section.cleanup();
                    if (this.modeSection === section) this.modeSection = undefined;
                };
            },
        };
    }

    private backgroundSettingsDefinition(): SettingDefinitionItem {
        return {
            name: t("bg_management_title"),
            searchable: false,
            render: (setting: Setting) => {
                setting.settingEl.empty();
                const section = new BgManagementSection(this.plugin, this.defaultSettings, {
                    onChanged: () => this.modeSection?.displayTimeRules(),
                });
                this.bgSection = section;
                section.display(setting.settingEl);
                return () => {
                    section.cleanup();
                    if (this.bgSection === section) this.bgSection = undefined;
                };
            },
        };
    }

    private apiSettingsDefinition(): SettingDefinitionItem {
        return {
            name: t("wallpaper_api_management_title"),
            searchable: false,
            render: (setting: Setting) => {
                setting.settingEl.empty();
                const section = new ApiSettingsSection(this.plugin, this.defaultSettings, {
                    onBackgroundsChanged: () => this.bgSection?.displayBackgrounds(),
                    onTimeRulesChanged: () => this.modeSection?.displayTimeRules(),
                });
                this.apiSection = section;
                section.display(setting.settingEl);
                return () => {
                    section.cleanup();
                    if (this.apiSection === section) this.apiSection = undefined;
                };
            },
        };
    }

    private displayHeader(containerEl: HTMLElement) {
        const headerContainer = containerEl.createDiv("dtb-section-header");

        // 创建左侧标题容器（预留位置）
        headerContainer.createDiv();

        // 创建右侧信息容器
        const infoContainer = headerContainer.createDiv("dtb-links");

        infoContainer.createEl("a", {
            text: t("version") + VERSION,
            href: `https://github.com/sean2077/obsidian-dynamic-theme-background/releases/tag/${VERSION}`,
            cls: "dtb-link",
        });
        infoContainer.createEl("a", {
            text: t("author") + "Sean2077 ✨",
            href: "https://github.com/sean2077",
            cls: "dtb-link",
        });
        infoContainer.createEl("a", {
            text: t("homepage") + "DTB",
            href: "https://obsidian-dynamic-theme-background.pages.dev",
            cls: "dtb-link",
        });
    }

    cleanup(): void {
        this.basicSection?.cleanup();
        this.modeSection?.cleanup();
        this.bgSection?.cleanup();
        this.apiSection?.cleanup();

        this.basicSection = undefined;
        this.modeSection = undefined;
        this.bgSection = undefined;
        this.apiSection = undefined;
    }
}
