import { Setting } from "obsidian";
import { t } from "../../i18n";
import type DynamicThemeBackgroundPlugin from "../../plugin";
import type { DTBSettings } from "../../types";
import { addDropdownOptionHoverTooltip } from "../../utils";

export class BasicSettingsSection {
    private plugin: DynamicThemeBackgroundPlugin;
    private defaultSettings: DTBSettings;
    private container!: HTMLElement;

    constructor(plugin: DynamicThemeBackgroundPlugin, defaultSettings: DTBSettings) {
        this.plugin = plugin;
        this.defaultSettings = defaultSettings;
    }

    display(container: HTMLElement): void {
        this.container = container;
        const containerEl = this.container;
        containerEl.empty();

        // 基础设置标题
        new Setting(containerEl).setName(t("basic_settings_title")).setHeading();

        // 是否启用插件
        new Setting(containerEl)
            .setName(t("enable_plugin_name"))
            .setDesc(t("enable_plugin_desc"))
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        this.plugin.startBackgroundManager();
                    } else {
                        this.plugin.stopBackgroundManager();
                    }
                })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("refresh-cw")
                    .setTooltip(t("reload_plugin_tooltip"))
                    .onClick(() => {
                        // 重新启动背景管理器
                        if (this.plugin.settings.enabled) {
                            this.plugin.startBackgroundManager();
                        }
                        // 强制更新当前背景
                        void this.plugin.updateBackground(true);
                    })
            );

        // 是否开启状态栏
        new Setting(containerEl)
            .setName(t("enable_status_bar_name"))
            .setDesc(t("enable_status_bar_desc") + t("status_bar_title").replace(/\n/g, "  "))
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.statusBarEnabled).onChange(async (value) => {
                    this.plugin.settings.statusBarEnabled = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        this.plugin.activateStatusBar();
                    } else {
                        this.plugin.deactivateStatusBar();
                    }
                })
            );

        // 外观设置
        new Setting(containerEl).setName(t("appearance_settings_title")).setHeading();
        // 外观设置提示（全局外观优先级说明）
        containerEl.addClass("dtb-hint-section");
        const appearanceHint = containerEl.createDiv("dtb-hint");
        appearanceHint.textContent = t("appearance_settings_hint");
        // 背景模糊度设置
        new Setting(containerEl)
            .setName(t("blur_depth_name"))
            .setDesc(t("blur_depth_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 30, 1)
                    .setValue(this.plugin.settings.blurDepth)
                    .onChange(async (value: number) => {
                        this.plugin.settings.blurDepth = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_blur_tooltip"))
                    .onClick(async () => {
                        this.plugin.settings.blurDepth = this.defaultSettings.blurDepth;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                        this.display(this.container);
                    })
            );

        // 背景亮度设置
        new Setting(containerEl)
            .setName(t("brightness_name"))
            .setDesc(t("brightness_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1.5, 0.01)
                    .setValue(this.plugin.settings.brightness4Bg)
                    .onChange(async (value: number) => {
                        this.plugin.settings.brightness4Bg = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_brightness_tooltip"))
                    .onClick(async () => {
                        this.plugin.settings.brightness4Bg = this.defaultSettings.brightness4Bg;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                        this.display(this.container);
                    })
            );

        // 背景饱和度设置
        new Setting(containerEl)
            .setName(t("saturate_name"))
            .setDesc(t("saturate_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 2, 0.01)
                    .setValue(this.plugin.settings.saturate4Bg)
                    .onChange(async (value: number) => {
                        this.plugin.settings.saturate4Bg = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_saturate_tooltip"))
                    .onClick(async () => {
                        this.plugin.settings.saturate4Bg = this.defaultSettings.saturate4Bg;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                        this.display(this.container);
                    })
            );

        // 背景颜色和透明度设置（暗/亮两套，同一行：暗在前，亮在后）
        {
            const setting = new Setting(containerEl).setName(t("bg_mask_color_name")).setDesc(t("bg_mask_color_desc"));

            // 暗主题标签
            const darkLabel = setting.controlEl.createSpan({ text: "🌙" });
            darkLabel.setAttribute("title", t("overlay_dark_tooltip"));

            // 暗主题：颜色
            setting.addColorPicker((colorPicker) =>
                colorPicker
                    .setValue(this.plugin.settings.bgColorDark ?? this.defaultSettings.bgColorDark)
                    .onChange(async (value: string) => {
                        this.plugin.settings.bgColorDark = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            );
            // 暗主题：透明度
            setting.addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.01)
                    .setValue(this.plugin.settings.bgColorOpacityDark ?? this.defaultSettings.bgColorOpacityDark)
                    .onChange(async (value: number) => {
                        this.plugin.settings.bgColorOpacityDark = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            );

            // 亮主题标签
            const lightLabel = setting.controlEl.createSpan({ text: "☀️" });
            lightLabel.setAttribute("title", t("overlay_light_tooltip"));

            // 亮主题：颜色
            setting.addColorPicker((colorPicker) =>
                colorPicker
                    .setValue(this.plugin.settings.bgColorLight ?? this.defaultSettings.bgColorLight)
                    .onChange(async (value: string) => {
                        this.plugin.settings.bgColorLight = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            );
            // 亮主题：透明度
            setting.addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.01)
                    .setValue(this.plugin.settings.bgColorOpacityLight ?? this.defaultSettings.bgColorOpacityLight)
                    .onChange(async (value: number) => {
                        this.plugin.settings.bgColorOpacityLight = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            );

            // 重置（两套新字段）
            setting.addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_bg_mask_color_tooltip"))
                    .onClick(async () => {
                        this.plugin.settings.bgColorDark = this.defaultSettings.bgColorDark;
                        this.plugin.settings.bgColorOpacityDark = this.defaultSettings.bgColorOpacityDark;
                        this.plugin.settings.bgColorLight = this.defaultSettings.bgColorLight;
                        this.plugin.settings.bgColorOpacityLight = this.defaultSettings.bgColorOpacityLight;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                        this.display(this.container);
                    })
            );
        }

        // 背景填充方式设置
        new Setting(containerEl)
            .setName(t("bg_size_name"))
            .setDesc(t("bg_size_desc"))
            .addDropdown((dropdown) => {
                // 添加下拉选项
                dropdown.addOption("intelligent", "Intelligent");
                dropdown.addOption("cover", "Cover");
                dropdown.addOption("contain", "Contain");
                dropdown.addOption("auto", "Auto");
                // 使用专门的悬停选项方法添加 tooltip（推荐用法）
                addDropdownOptionHoverTooltip(
                    dropdown,
                    {
                        cover: t("bg_size_option_cover"),
                        contain: t("bg_size_option_contain"),
                        auto: t("bg_size_option_auto"),
                        intelligent: t("bg_size_option_intelligent"),
                    },
                    {
                        defaultTooltip: t("bg_size_desc"),
                        updateOnChange: true, // 选择后也更新整个下拉框的 tooltip
                    }
                );

                dropdown
                    .setValue(this.plugin.settings.bgSize)
                    .onChange(async (value: string) => {
                        const bgSize = value as DTBSettings["bgSize"];
                        this.plugin.settings.bgSize = bgSize;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    });

                return dropdown;
            })
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_bg_size_tooltip"))
                    .onClick(async () => {
                        this.plugin.settings.bgSize = this.defaultSettings.bgSize;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                        this.display(this.container);
                    })
            );
    }

    cleanup(): void {
        // Basic settings has no subscriptions to clean up
    }
}
