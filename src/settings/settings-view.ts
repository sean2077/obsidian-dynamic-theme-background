/*
 * 设置视图，用于在标签页中显示插件的设置
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { t } from "../i18n";
import type DynamicThemeBackgroundPlugin from "../plugin";
import { DTBSettingTab } from "./settings-tab";

export const DTB_SETTINGS_VIEW_TYPE = "dtb-settings";

export class DTBSettingsView extends ItemView {
    plugin: DynamicThemeBackgroundPlugin;
    settingTab: DTBSettingTab | null;

    constructor(leaf: WorkspaceLeaf, plugin: DynamicThemeBackgroundPlugin) {
        super(leaf);
        this.plugin = plugin;
        // 创建一个设置标签页实例，但不是真正的设置标签页
        this.settingTab = new DTBSettingTab(this.app, plugin);
    }

    getViewType(): string {
        return DTB_SETTINGS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return t("settings_title");
    }

    getIcon(): string {
        return "settings";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // 添加标题
        container.createEl("h1", { text: t("settings_title") });

        // 使用设置标签页的显示逻辑，但在我们自己的容器中
        if (this.settingTab) {
            this.settingTab.containerEl = container as HTMLElement;
            this.settingTab.display();
        }
        return Promise.resolve();
    }

    async onClose(): Promise<void> {
        if (this.settingTab) {
            // hide() 调用 cleanup() + 设置 active=false + 从 settingTabs Map 中移除
            this.settingTab.hide();

            // 清理 DOM
            if (this.settingTab.containerEl) {
                this.settingTab.containerEl.empty();
            }
        }
        this.settingTab = null;
        return Promise.resolve();
    }
}
