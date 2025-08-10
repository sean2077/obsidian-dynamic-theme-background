/**
 * 设置标签页，用于显示和管理插件的设置
 * 包括基本设置、背景管理和模式设置等功能
 */
import { App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import { getDefaultSettings } from "../default-settings";
import { t } from "../i18n";
import {
    BackgroundModal,
    ConfirmModal,
    ImageFolderSuggestModal,
    TimeRuleModal,
    WallpaperApiEditorModal,
} from "../modals";
import type DynamicThemeBackgroundPlugin from "../plugin";
import type { BackgroundItem, DTBSettings, TimeRule } from "../types";
import { DragSort, addDropdownOptionHoverTooltip, addDropdownTooltip, addEnhancedDropdownTooltip } from "../utils";
import { VERSION } from "../version";
import {
    ApiStateSubscriber,
    BaseWallpaperApi,
    WallpaperApiConfig,
    WallpaperApiType,
    apiManager,
} from "../wallpaper-apis";

export class DTBSettingTab extends PluginSettingTab {
    plugin: DynamicThemeBackgroundPlugin;
    defaultSettings: DTBSettings;

    private componentId: string; // 组件唯一标识符
    private active: boolean; // 是否出于激活状态

    // 记录一些 HTML 元素， 便于分块刷新
    // 注意这些值不应被在事件监听器、闭包、全局变量等持有
    private basicSettingEl: HTMLElement;
    private modeSettingsEl: HTMLElement;
    private timeRulesContainer: HTMLElement | null; // 某些情况下可能不存在
    private bgManagementEl: HTMLElement;
    private bgListContainer: HTMLElement;
    private wallpaperApiSettingsEl: HTMLElement;
    private apiListContainer: HTMLElement;

    // 用于拖拽排序
    private backgroundDragSort?: DragSort<BackgroundItem>;
    private timeRuleDragSort?: DragSort<TimeRule>;
    private apiDragSort?: DragSort<WallpaperApiConfig>;

    constructor(app: App, plugin: DynamicThemeBackgroundPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.defaultSettings = getDefaultSettings();
        // 生成唯一的组件ID
        this.componentId = this.genComponentId();

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
        // 设置面板关闭时应清理所有订阅
        this.cleanup();

        this.active = false;
        // 取消 plugin 注册
        this.plugin.settingTabs.delete(this.componentId);
    }

    display(): void {
        this.active = true;

        // 清理之前的订阅
        this.cleanup();

        const { containerEl } = this;
        containerEl.empty();

        this.displayHeader(containerEl);

        this.basicSettingEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayBasicSettings();

        this.modeSettingsEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayModeSettings();

        this.bgManagementEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayBackgroundManagement();

        this.wallpaperApiSettingsEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayWallpaperApiSettings();
    }

    // 显示设置页头
    private displayHeader(containerEl: HTMLElement) {
        const headerContainer = containerEl.createDiv("dtb-section-header");

        // 创建左侧标题容器
        const titleContainer = headerContainer.createDiv();
        titleContainer.createEl("h2", { text: t("settings_title"), cls: "" });

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
            text: t("tutorial") + "homepage",
            href: "https://obsidian-dynamic-theme-background.pages.dev",
            cls: "dtb-link",
        });
    }

    // ============================================================================
    // 基础设置
    // ============================================================================

    displayBasicSettings() {
        const containerEl = this.basicSettingEl;
        containerEl.empty();
        containerEl.createEl("h3", { text: t("basic_settings_title") });

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
                    .onClick(async () => {
                        // 重新启动背景管理器
                        if (this.plugin.settings.enabled) {
                            this.plugin.startBackgroundManager();
                        }
                        // 强制更新当前背景
                        this.plugin.updateBackground(true);
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
        containerEl.createEl("h4", { text: t("appearance_settings_title") });
        // 背景模糊度设置
        new Setting(containerEl)
            .setName(t("blur_depth_name"))
            .setDesc(t("blur_depth_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 30, 1)
                    .setValue(this.plugin.settings.blurDepth)
                    .setDynamicTooltip()
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
                        this.displayBasicSettings();
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
                    .setDynamicTooltip()
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
                        this.displayBasicSettings();
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
                    .setDynamicTooltip()
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
                        this.displayBasicSettings();
                    })
            );

        // 背景颜色和透明度设置
        new Setting(containerEl)
            .setName(t("bg_mask_color_name"))
            .setDesc(t("bg_mask_color_desc"))
            .addColorPicker((colorPicker) =>
                colorPicker.setValue(this.plugin.settings.bgColor).onChange(async (value: string) => {
                    this.plugin.settings.bgColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                })
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.01)
                    .setValue(this.plugin.settings.bgColorOpacity)
                    .setDynamicTooltip()
                    .onChange(async (value: number) => {
                        this.plugin.settings.bgColorOpacity = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_bg_mask_color_tooltip"))
                    .onClick(async () => {
                        this.plugin.settings.bgColor = this.defaultSettings.bgColor;
                        this.plugin.settings.bgColorOpacity = this.defaultSettings.bgColorOpacity;
                        await this.plugin.saveSettings();
                        this.plugin.updateStyleCss();
                        this.displayBasicSettings();
                    })
            );

        // 背景填充方式设置
        new Setting(containerEl)
            .setName(t("bg_size_name"))
            .setDesc(t("bg_size_desc"))
            .addDropdown((dropdown) => {
                // 添加下拉选项
                dropdown.addOption("intelligent", "intelligent");
                dropdown.addOption("cover", "cover");
                dropdown.addOption("contain", "contain");
                dropdown.addOption("auto", "auto");
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
                    .onChange(async (value: "cover" | "contain" | "auto" | "intelligent") => {
                        this.plugin.settings.bgSize = value;
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
                        this.displayBasicSettings();
                    })
            );
    }

    displayModeSettings() {
        const containerEl = this.modeSettingsEl;
        containerEl.empty();
        containerEl.createEl("h3", { text: t("mode_settings_title") });

        new Setting(containerEl)
            .setName(t("switch_mode_name"))
            .setDesc(t("switch_mode_desc"))
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("time-based", t("mode_time_based"))
                    .addOption("interval", t("mode_interval"))
                    .addOption("manual", t("mode_manual"))
                    .setValue(this.plugin.settings.mode)
                    .onChange(async (value: "time-based" | "interval" | "manual") => {
                        this.plugin.settings.mode = value;
                        await this.plugin.saveSettings();
                        this.plugin.startBackgroundManager();
                        this.displayModeSettings();
                    });
                // 添加模式切换的 tooltip
                addDropdownTooltip(
                    dropdown,
                    {
                        "time-based": t("mode_time_based_tooltip"),
                        interval: t("mode_interval_tooltip"),
                        manual: t("mode_manual_tooltip"),
                    },
                    t("switch_mode_desc")
                );

                return dropdown;
            });

        // 时间规则（仅在时间模式下显示）
        if (this.plugin.settings.mode === "time-based") {
            containerEl.createEl("h4", { text: t("time_rules_title") });
            const buttonContainer = containerEl.createDiv("dtb-large-button-container");
            new Setting(buttonContainer)
                .setName(t("manage_time_rules_name"))
                .setDesc(t("manage_time_rules_desc"))
                .addButton((button) => {
                    button.setButtonText(t("add_time_rule_button"));
                    button.setTooltip(t("add_time_rule_tooltip"));
                    button.onClick(() => this.showTimeRuleModal());
                })
                .addButton((button) => {
                    button.setButtonText(t("clear_time_rules_button"));
                    button.setTooltip(t("clear_time_rules_tooltip"));
                    button.onClick(async () => {
                        new ConfirmModal(this.app, {
                            message: t("confirm_clear_time_rules"),
                            onConfirm: async () => {
                                this.plugin.settings.timeRules = [];
                                this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                                await this.plugin.saveSettings();
                                this.displayModeSettings();
                            },
                        }).open();
                    });
                })
                .addButton((button) => {
                    button.setButtonText(t("reset_time_rules_button"));
                    button.setTooltip(t("reset_time_rules_tooltip"));
                    button.onClick(async () => {
                        this.plugin.settings.timeRules = this.defaultSettings.timeRules;
                        this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                        await this.plugin.saveSettings();
                        this.displayModeSettings();
                    });
                });

            // 添加时间规则提示
            const hint = containerEl.createDiv("dtb-hint");
            hint.textContent = t("time_rule_hint");

            // 显示时间规则列表
            this.timeRulesContainer = containerEl.createDiv("dtb-section-container");
            this.displayTimeRules();
        } else {
            this.timeRulesContainer = null;
        }

        // 时间间隔设置（仅在间隔模式下显示）
        if (this.plugin.settings.mode === "interval") {
            new Setting(containerEl)
                .setName(t("interval_name"))
                .setDesc(t("interval_desc"))
                .addText((text) =>
                    text
                        .setPlaceholder("60")
                        .setValue(this.plugin.settings.intervalMinutes.toString())
                        .onChange(async (value) => {
                            const minutes = parseInt(value) || 60;
                            this.plugin.settings.intervalMinutes = minutes;
                            await this.plugin.saveSettings();
                            this.plugin.startBackgroundManager();
                        })
                );

            // 随机壁纸设置
            new Setting(containerEl)
                .setName(t("enable_random_wallpaper_name"))
                .setDesc(t("enable_random_wallpaper_desc"))
                .addToggle((toggle) =>
                    toggle.setValue(this.plugin.settings.enableRandomWallpaper).onChange(async (value) => {
                        this.plugin.settings.enableRandomWallpaper = value;
                        await this.plugin.saveSettings();
                        this.displayModeSettings();
                    })
                );
        }
    }

    // 显示时间规则列表，支持编辑、删除和添加新规则
    displayTimeRules(): void {
        const container = this.timeRulesContainer;
        if (!container) return;
        container.empty();

        // 初始化时间规则拖拽排序
        this.timeRuleDragSort = new DragSort<TimeRule>({
            container,
            items: this.plugin.settings.timeRules,
            getItemId: (rule) => rule.id,
            itemClass: "dtb-draggable",
            idDataAttribute: "ruleId",
            onReorder: async (reorderedRules) => {
                this.plugin.settings.timeRules = reorderedRules;
                await this.plugin.saveSettings();
                this.displayTimeRules();
            },
        });

        // 获取当前激活的时间规则
        const activeRule = this.plugin.getCurrentTimeRule();

        this.plugin.settings.timeRules.forEach((rule: TimeRule) => {
            const setting = new Setting(container);

            setting.setName(rule.name).setDesc(`${rule.startTime} - ${rule.endTime}`);

            // 如果是激活的时间规则，则添加一个提示图标
            if (rule.id === activeRule?.id) {
                const indicator = setting.controlEl.createDiv();
                indicator.setText("🔥");
                indicator.title = t("active_time_rule");
            }

            setting
                .addToggle((toggle) =>
                    toggle.setValue(rule.enabled).onChange(async (value) => {
                        rule.enabled = value;
                        this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                        await this.plugin.saveSettings();
                        this.displayTimeRules();
                    })
                )
                .addDropdown((dropdown) => {
                    dropdown.addOption("", t("select_background_option"));
                    this.plugin.settings.backgrounds.forEach((bg) => {
                        dropdown.addOption(bg.id, bg.name);
                    });
                    // 使用增强版 tooltip 方法为背景选择下拉框添加动态提示
                    addEnhancedDropdownTooltip(dropdown, {
                        defaultTooltip: t("select_background_option"),
                        showSelectedValue: true,
                        customFormatter: (value, text) => {
                            if (!value) return t("select_background_option");
                            const bg = this.plugin.settings.backgrounds.find((b) => b.id === value);
                            if (bg) {
                                return `${text} (${bg.type.toUpperCase()})`;
                            }
                            return text;
                        },
                    });

                    return dropdown.setValue(rule.backgroundId).onChange(async (value) => {
                        rule.backgroundId = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateBackground(true);
                    });
                })
                .addButton((button) =>
                    button.setButtonText(t("button_edit")).onClick(() => this.showTimeRuleModal(rule))
                )
                .addButton((button) =>
                    button.setButtonText(t("button_delete")).onClick(async () => {
                        this.plugin.settings.timeRules = this.plugin.settings.timeRules.filter((r) => r.id !== rule.id);
                        this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                        await this.plugin.saveSettings();
                        this.displayTimeRules();
                    })
                );

            // 设置拖拽属性
            setting.settingEl.addClass("dtb-draggable");
            setting.settingEl.dataset.ruleId = rule.id;

            // 添加通用条目样式类
            setting.settingEl.addClass("dtb-button-container"); // 按钮样式

            // 启用拖拽功能
            this.timeRuleDragSort?.enableDragForElement(setting.settingEl, rule);
        });
    }

    // 显示添加或编辑时间规则的模态窗口
    private showTimeRuleModal(rule?: TimeRule) {
        // 如果没有提供规则，创建一个新的空规则
        const editRule: TimeRule = rule ?? {
            id: "",
            name: "",
            startTime: "09:00",
            endTime: "17:00",
            backgroundId: "",
            enabled: true,
        };

        const modal = new TimeRuleModal(this.app, editRule, async (updatedRule) => {
            if (!updatedRule.name.trim() || !updatedRule.startTime || !updatedRule.endTime) {
                new Notice(t("notice_all_fields_required"));
                return;
            }

            if (rule) {
                // 编辑现有规则
                const index = this.plugin.settings.timeRules.findIndex((r) => r.name === rule.name);
                if (index !== -1) {
                    this.plugin.settings.timeRules[index] = {
                        ...rule,
                        name: updatedRule.name.trim(),
                        startTime: updatedRule.startTime,
                        endTime: updatedRule.endTime,
                    };
                }
            } else {
                // 添加新规则
                const newRule: TimeRule = {
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                    name: updatedRule.name.trim(),
                    startTime: updatedRule.startTime,
                    endTime: updatedRule.endTime,
                    backgroundId: this.plugin.settings.backgrounds[0]?.id ?? "",
                    enabled: true,
                };
                this.plugin.settings.timeRules.push(newRule);
            }

            this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
            await this.plugin.saveSettings();
            // 这里仅需刷新时间规则列表
            this.plugin.refreshActiveTimeRules();
        });

        modal.open();
    }

    // ============================================================================
    // 背景管理
    // ============================================================================

    displayBackgroundManagement() {
        const containerEl = this.bgManagementEl;
        containerEl.empty();

        // 背景管理
        containerEl.createEl("h3", { text: t("bg_management_title") });

        // 保存远程图片的本地路径
        const imageFolderInputContainer = containerEl.createDiv("setting-item dtb-flex-container-spaced");
        imageFolderInputContainer.createEl("label", { text: t("save_image_path_title") });
        const valueInput = imageFolderInputContainer.createEl("input", {
            type: "text",
            title: t("save_image_path_title"),
            placeholder: t("save_image_path_placeholder"),
            value: this.plugin.settings.localBackgroundFolder ?? "",
            cls: "dtb-flex-1",
        });
        valueInput.oninput = () => {
            this.plugin.settings.localBackgroundFolder = valueInput.value;
            this.plugin.saveSettings();
        };
        const browseButton = imageFolderInputContainer.createEl("button", {
            type: "button",
            text: t("button_browse"),
            cls: "dtb-button",
        });
        browseButton.onclick = () => {
            const modal = new ImageFolderSuggestModal(this.app, (imagePath: string) => {
                valueInput.value = imagePath;
                this.plugin.settings.localBackgroundFolder = imagePath;
                this.plugin.saveSettings();
            });
            modal.open();
        };

        // 添加背景的一组按钮
        const buttonContainer = containerEl.createDiv("dtb-large-button-container");
        new Setting(buttonContainer)
            .setName(t("add_new_bg_name"))
            .setDesc(t("add_new_bg_desc"))
            .addButton((button) =>
                button.setButtonText(t("add_image_bg_button")).onClick(() => this.showAddBackgroundModal("image"))
            )
            .addButton((button) =>
                button.setButtonText(t("add_color_bg_button")).onClick(() => this.showAddBackgroundModal("color"))
            )
            .addButton((button) =>
                button.setButtonText(t("add_gradient_bg_button")).onClick(() => this.showAddBackgroundModal("gradient"))
            )
            .addButton((button) =>
                button.setButtonText(t("add_folder_bg_button")).onClick(() => this.showAddFolderModal())
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("restore_default_bg_tooltip"))
                    .onClick(() => this.restoreDefaultBackgrounds())
            );

        // 添加拖拽提示
        const dragHint = containerEl.createDiv("dtb-hint");
        dragHint.textContent = t("background_management_hint");

        this.bgListContainer = containerEl.createDiv("dtb-section-container");
        this.displayBackgrounds();
    }

    // 显示添加或编辑背景的模态窗口
    private async showAddBackgroundModal(type: "image" | "color" | "gradient") {
        // 创建一个新的背景项，初始值为空
        const bg: BackgroundItem = {
            id: "",
            name: "",
            type,
            value: "",
        };
        const modal = new BackgroundModal(this.app, this.plugin, bg, async (newBg: BackgroundItem) => {
            if (!newBg.name.trim() || !newBg.value.trim()) {
                new Notice(t("notice_name_and_value_required"));
                return;
            }
            newBg.name = newBg.name.trim();
            newBg.value = newBg.value.trim();

            // 生成唯一ID
            newBg.id = Date.now().toString() + Math.random().toString(36).substring(2, 9);

            // 添加到设置中
            this.plugin.settings.backgrounds.push(newBg);
            await this.plugin.saveSettings();

            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.displayTimeRules();
        });

        modal.open();
    }

    // 显示编辑背景的模态窗口
    private async showEditBackgroundModal(bg: BackgroundItem, index: number) {
        const modal = new BackgroundModal(this.app, this.plugin, bg, async (newBg: BackgroundItem) => {
            if (!newBg.name.trim() || !newBg.value.trim()) {
                new Notice(t("notice_name_and_value_required"));
                return;
            }
            newBg.name = newBg.name.trim();
            newBg.value = newBg.value.trim();

            // 更新现有背景项
            this.plugin.settings.backgrounds[index] = newBg;

            await this.plugin.saveSettings();

            // 如果当前正在使用这个背景，则更新显示
            if (this.plugin.background?.id === bg.id) {
                this.plugin.background = this.plugin.settings.backgrounds[index];
                this.plugin.updateStyleCss();
            }

            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.displayTimeRules();
        });

        // 先打开模态窗口，然后预填充现有值
        modal.open();

        // 等待模态窗口完全加载后再设置值
        setTimeout(() => {
            if (modal.nameInput && modal.valueInput) {
                modal.nameInput.value = bg.name;
                modal.valueInput.value = bg.value;
            }
        }, 0);
    }

    private showAddFolderModal() {
        const modal = new ImageFolderSuggestModal(this.app, async (folderPath: string) => {
            if (!folderPath.trim()) {
                new Notice(t("notice_valid_folder_path_required"));
                return;
            }

            // 检查文件夹是否存在
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                new Notice(t("notice_folder_not_found"));
                return;
            }

            try {
                // 处理文件夹中的图片文件
                await this.addImagesFromFolder(folderPath);
                new Notice(t("notice_folder_added_successfully", { folderPath }));
            } catch (error) {
                console.error("Error adding images from folder:", error);
                new Notice(t("notice_error_adding_folder_images"));
            }
        });

        modal.open();
    }

    private async restoreDefaultBackgrounds() {
        // 重新生成默认设置以获取最新的默认背景
        const defaultBackgrounds = this.defaultSettings.backgrounds;

        let addedCount = 0;

        // 遍历默认背景，只添加不存在的
        for (const defaultBg of defaultBackgrounds) {
            const existingBg = this.plugin.settings.backgrounds.find((bg) => bg.id === defaultBg.id);

            if (!existingBg) {
                // 创建新的背景项，确保 ID 唯一
                const newBg: BackgroundItem = {
                    id: defaultBg.id,
                    name: defaultBg.name,
                    type: defaultBg.type,
                    value: defaultBg.value,
                };

                this.plugin.settings.backgrounds.push(newBg);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await this.plugin.saveSettings();
            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.displayTimeRules();
            new Notice(
                t("restore_default_bg_success", {
                    count: addedCount.toString(),
                })
            );
        } else {
            new Notice(t("restore_default_bg_no_new"));
        }
    }

    // 在指定的容器元素中渲染所有背景项
    displayBackgrounds(): void {
        const container = this.bgListContainer;
        container.empty();

        // 初始化背景拖拽排序
        this.backgroundDragSort = new DragSort<BackgroundItem>({
            container,
            items: this.plugin.settings.backgrounds,
            getItemId: (bg) => bg.id,
            itemClass: "dtb-draggable",
            idDataAttribute: "bgId",
            onReorder: async (reorderedBackgrounds) => {
                this.plugin.settings.backgrounds = reorderedBackgrounds;
                await this.plugin.saveSettings();
                // 这里仅需刷新背景列表和时间规则列表
                this.displayBackgrounds();
                this.displayTimeRules();
            },
        });
        this.plugin.settings.backgrounds.forEach((bg: BackgroundItem, index: number) => {
            const bgEl = container.createDiv("dtb-item dtb-draggable");

            // 添加拖拽相关属性
            bgEl.draggable = true;
            bgEl.dataset.bgId = bg.id;
            bgEl.dataset.index = index.toString();

            // 添加拖拽手柄
            const dragHandle = bgEl.createDiv("dtb-drag-handle");
            dragHandle.textContent = "⋮⋮"; // 使用双点符号作为拖拽手柄
            dragHandle.title = t("drag_handle_tooltip");

            // 背景名称
            const contentDiv = bgEl.createDiv("dtb-bg-content");
            contentDiv.createSpan({ text: bg.name, cls: "dtb-bg-name" });

            // 如果是启用背景，添加图标
            if (bg.id === this.plugin.background?.id) {
                const icon = contentDiv.createSpan();
                icon.setText("🔥");
                icon.title = t("current_background");
            }

            // 背景类型
            contentDiv.createSpan({ text: bg.type, cls: "dtb-badge" });

            // 预览图
            const preview = contentDiv.createDiv("dtb-bg-preview");
            this.setPreviewBackground(preview, bg);

            // 操作按钮
            const actions = contentDiv.createDiv("dtb-button-container");

            // 预览按钮
            actions.createEl("button", { text: t("button_preview") }).onclick = () => {
                this.plugin.background = bg;
                this.plugin.settings.currentIndex = index; // 更新当前索引
                this.plugin.saveSettings();
                this.plugin.updateStyleCss();
                this.displayBackgrounds(); // 刷新激活图标
            };

            // 保存按钮
            actions.createEl("button", { text: t("button_save") }).onclick = async () => {
                await this.plugin.saveBackground(bg);
            };

            // 编辑按钮
            actions.createEl("button", { text: t("button_edit") }).onclick = () => {
                this.showEditBackgroundModal(bg, index);
            };

            // 删除按钮
            actions.createEl("button", { text: t("button_delete") }).onclick = async () => {
                // 使用 filter 方法删除
                this.plugin.settings.backgrounds = this.plugin.settings.backgrounds.filter(
                    (b: BackgroundItem) => b.id !== bg.id
                );
                await this.plugin.saveSettings();
                // 这里仅需刷新背景列表和时间规则列表
                this.displayBackgrounds();
                this.displayTimeRules();
            };

            // 启用拖拽功能
            this.backgroundDragSort?.enableDragForElement(bgEl, bg);
        });
    }

    // 设置预览元素的背景样式 * 使用 CSS 自定义属性而不是内联样式，遵循 Obsidian 官方建议
    private setPreviewBackground(preview: HTMLElement, bg: BackgroundItem): void {
        // 移除之前的类型特定类名
        preview.removeClass("dtb-preview-image", "dtb-preview-color", "dtb-preview-gradient");

        // 清除之前设置的 CSS 自定义属性
        preview.setCssProps({
            "--dtb-preview-bg-image": "",
            "--dtb-preview-bg": "",
        });

        switch (bg.type) {
            case "image": {
                preview.addClass("dtb-preview-image");
                const sanitizedImagePath = this.plugin.getBgURL(bg);
                // 只有当图片路径有效时才设置 CSS 变量
                if (sanitizedImagePath && sanitizedImagePath !== "none") {
                    preview.setCssProps({
                        "--dtb-preview-bg-image": sanitizedImagePath,
                    });
                }
                break;
            }
            case "color":
            case "gradient": {
                preview.addClass(`dtb-preview-${bg.type}`);
                // 验证颜色/渐变值的有效性
                if (bg.value && bg.value.trim()) {
                    preview.setCssProps({
                        "--dtb-preview-bg": bg.value,
                    });
                }
                break;
            }
            default:
                console.warn(`DTB: Unknown background type: ${bg.type}`);
                break;
        }
    }

    // 添加文件夹中的图片到背景列表
    private async addImagesFromFolder(folderPath: string) {
        try {
            // 标准化路径：移除开头和结尾的斜杠，只处理 vault 内的相对路径
            folderPath = folderPath.replace(/^\/+|\/+$/g, "");

            let folderFiles: TFile[] = [];

            if (folderPath !== "") {
                // 尝试获取指定文件夹
                const folder = this.app.vault.getFolderByPath(folderPath);
                if (folder) {
                    // 只获取该文件夹下的直接子文件（不递归）
                    folderFiles = this.app.vault.getFiles().filter((file) => {
                        const fileDir = file.path.substring(0, file.path.lastIndexOf("/"));
                        return fileDir === folderPath;
                    });
                } else {
                    new Notice(t("folder_not_found"));
                    return;
                }
            }

            if (folderFiles.length === 0) {
                new Notice(t("folder_not_found"));
                return;
            }

            await this.processImageFiles(folderFiles, folderPath);
        } catch (error) {
            console.error("DTB: Error scanning folder:", error);
            new Notice(t("folder_scan_error", { error: error.message }));
        }
    }

    // 处理文件夹中的图片文件
    private async processImageFiles(files: TFile[], folderPath: string) {
        // 支持的图片格式
        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

        // 过滤出图片文件
        const imageFiles = files.filter((file) => imageExtensions.some((ext) => file.path.toLowerCase().endsWith(ext)));

        if (imageFiles.length === 0) {
            new Notice(t("folder_not_found"));
            return;
        }

        let addedCount = 0;

        for (const file of imageFiles) {
            // 检查是否已存在相同路径的背景
            const existingBg = this.plugin.settings.backgrounds.find(
                (bg) => bg.type === "image" && bg.value === file.path
            );

            if (!existingBg) {
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除扩展名
                // 只保留最后一级文件夹名称，避免长路径影响观感
                const folderName = folderPath === "" ? "root" : (folderPath.split("/").pop() ?? folderPath);
                const newBg: BackgroundItem = {
                    id: Date.now().toString() + "-" + addedCount, // 确保ID唯一
                    name: `${fileName} (${folderName})`,
                    type: "image",
                    value: file.path,
                };

                this.plugin.settings.backgrounds.push(newBg);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await this.plugin.saveSettings();
            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.displayTimeRules();
            new Notice(t("folder_scan_success", { count: addedCount.toString() }));
        } else {
            new Notice(t("folder_no_new_images"));
        }
    }

    // ============================================================================
    // 壁纸 API 管理
    // ============================================================================

    /*
     * 显示壁纸 API 管理设置
     */
    displayWallpaperApiSettings(): void {
        const containerEl = this.wallpaperApiSettingsEl;
        containerEl.empty();

        containerEl.createEl("h3", { text: t("wallpaper_api_management_title") });

        // 添加 API 按钮
        const buttonContainer = containerEl.createDiv("dtb-large-button-container");
        new Setting(buttonContainer)
            .setName(t("add_api_name"))
            .setDesc(t("add_api_desc"))
            .addButton((button) => {
                button.setButtonText(t("add_api_button"));
                button.onClick(() => this.showAddWallpaperApiModal());
            })
            // 添加新增所有默认 API 设置的恢复按钮，如果 API 已经存在则不添加
            .addExtraButton((button) => {
                button.setIcon("refresh-cw");
                button.setTooltip(t("restore_default_apis_tooltip"));
                button.onClick(async () => {
                    // 重新生成默认设置以获取最新的默认 API
                    const defaultApis = this.defaultSettings.wallpaperApis;

                    // 遍历默认 API，检查是否已存在
                    for (const apiConfig of defaultApis) {
                        const existingApi = this.plugin.settings.wallpaperApis.find((api) => api.id === apiConfig.id);
                        if (!existingApi) {
                            // 如果不存在，则添加并创建 API 实例
                            this.plugin.settings.wallpaperApis.push(apiConfig);
                            apiManager.createApi(apiConfig);
                        }
                    }
                    new Notice(t("restore_default_apis_success"));

                    await this.plugin.saveSettings();
                    this.displayWallpaperApiSettings();
                });
            });

        // 添加 API 提示
        const hint = containerEl.createDiv("dtb-hint");
        hint.textContent = t("wallpaper_api_hint");

        // 显示现有API列表
        this.apiListContainer = containerEl.createDiv("dtb-section-container");
        this.displayWallpaperApis();
    }

    /*
     * 显示所有已配置的壁纸 API
     */
    displayWallpaperApis() {
        const container = this.apiListContainer;
        container.empty();

        // 初始化 API 拖拽排序
        this.apiDragSort = new DragSort<WallpaperApiConfig>({
            container,
            items: this.plugin.settings.wallpaperApis,
            getItemId: (api) => api.id,
            itemClass: "dtb-draggable",
            idDataAttribute: "apiId",
            onReorder: async (reorderedApis) => {
                this.plugin.settings.wallpaperApis = reorderedApis;
                await this.plugin.saveSettings();
                this.displayWallpaperApis();
            },
        });

        // API 列表
        this.plugin.settings.wallpaperApis.forEach((apiConfig: WallpaperApiConfig, index: number) => {
            const apiInstance = apiManager.getApiById(apiConfig.id);
            if (!apiInstance) {
                console.warn(`DTB: API instance not found for ${apiConfig.name}`);
                return;
            }

            const setting = new Setting(container).setName(apiConfig.name).setDesc(apiInstance.getDescription());

            // 在设置项的控件区域直接添加类型标签
            setting.controlEl.createSpan({ text: apiConfig.type ?? "Unknown", cls: "dtb-badge" });

            // 注意：状态指示器和启用按钮的状态都以 API 实例的状态为准，配置项的 enabled 字段仅用于初始状态和保存设置时的同步。

            // 添加状态指示器
            const statusIndicator = setting.controlEl.createDiv("dtb-api-status");
            const statusDot = statusIndicator.createDiv("dtb-api-status-dot");
            const statusText = statusIndicator.createSpan();
            // 根据API的启用状态设置初始状态
            if (apiInstance.getEnabled()) {
                statusDot.addClass("enabled");
                statusText.textContent = t("status_enabled");
            } else {
                statusDot.addClass("disabled");
                statusText.textContent = t("status_disabled");
            }

            // 创建 toggle 并保存引用
            let toggleComponent: { setValue: (value: boolean) => void; getValue: () => boolean } | null = null;
            setting.addToggle((toggle) => {
                toggleComponent = toggle; // 保存 toggle 引用
                const toggleEl = toggle.setValue(apiInstance.getEnabled());

                // 使用智能API管理方法
                toggleEl.onChange(async (value) => {
                    // 禁用toggle防止用户重复点击，并添加loading样式
                    toggle.setDisabled(true);
                    toggleEl.toggleEl.addClass("dtb-loading");

                    try {
                        let success: boolean;

                        if (value) {
                            // 使用智能启用方法
                            success = await apiManager.enableApi(apiConfig.id);
                        } else {
                            // 使用智能禁用方法
                            success = await apiManager.disableApi(apiConfig.id);
                        }

                        const action = value ? t("action_enable") : t("action_disable");
                        if (!success) {
                            new Notice(
                                t("notice_api_failed_enable_disable", { action, apiName: apiConfig.name }),
                                3000
                            );
                        } else {
                            new Notice(
                                t("notice_api_success_enable_disable", { action, apiName: apiConfig.name }),
                                3000
                            );
                        }
                    } catch (error) {
                        console.error(`DTB: Error ${value ? "enabling" : "disabling"} API:`, error);
                        const action = value ? t("action_enable") : t("action_disable");
                        new Notice(t("notice_api_error_enable_disable", { action, apiName: apiConfig.name }), 3000);
                    } finally {
                        // 重新启用toggle并移除loading样式
                        toggle.setDisabled(false);
                        toggleEl.toggleEl.removeClass("dtb-loading");
                    }
                });

                return toggleEl;
            });

            // 订阅状态变化，使用 ApiStateSubscriber 对象进行标识
            const subscriber = new ApiStateSubscriber("toggle", this.componentId, apiConfig.id);
            apiManager.stateManager.subscribe(subscriber, async (state) => {
                // 更新状态点的样式
                statusDot.removeClass("enabled", "disabled", "error", "loading");

                if (state.isLoading) {
                    statusDot.addClass("loading");
                    statusText.textContent = t("status_loading");
                } else if (state.error) {
                    statusDot.addClass("error");
                    statusText.textContent = t("status_error");
                    statusText.title = state.error;
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== false) {
                        toggleComponent.setValue(false);
                    }
                    apiConfig.enabled = false;
                    await this.plugin.saveSettings();
                } else if (state.instanceEnabled) {
                    statusDot.addClass("enabled");
                    statusText.textContent = t("status_enabled");
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== true) {
                        toggleComponent.setValue(true);
                    }
                    apiConfig.enabled = true;
                    await this.plugin.saveSettings();
                } else {
                    statusDot.addClass("disabled");
                    statusText.textContent = t("status_disabled");
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== false) {
                        toggleComponent.setValue(false);
                    }
                    apiConfig.enabled = false;
                    await this.plugin.saveSettings();
                }
            });

            setting
                .addButton((button) =>
                    button
                        .setButtonText(t("button_add"))
                        .setTooltip(t("add_api_bg_tooltip"))
                        .onClick(async () => {
                            await this.fetchWallpaperFromApi(apiInstance);
                        })
                )
                .addButton((button) =>
                    button.setButtonText(t("button_edit")).onClick(() => {
                        this.showEditWallpaperApiModal(apiConfig, index);
                    })
                )
                .addButton((button) =>
                    button.setButtonText(t("button_delete")).onClick(async () => {
                        // 删除API实例
                        apiManager.deleteApi(apiConfig.id);
                        // 删除插件设置中的API配置
                        this.plugin.settings.wallpaperApis = this.plugin.settings.wallpaperApis.filter(
                            (api) => api.id !== apiConfig.id
                        );
                        await this.plugin.saveSettings();
                        this.displayWallpaperApis();
                    })
                );

            // 设置拖拽属性
            setting.settingEl.addClass("dtb-draggable");
            setting.settingEl.dataset.apiId = apiConfig.id;

            // 添加通用条目样式类
            setting.settingEl.addClass("dtb-button-container"); // 按钮样式

            // 启用拖拽功能
            this.apiDragSort?.enableDragForElement(setting.settingEl, apiConfig);
        });
    }

    // 显示添加壁纸API的模态窗口
    private showAddWallpaperApiModal() {
        const emptyConfig: WallpaperApiConfig = {
            id: "",
            name: "",
            type: WallpaperApiType.Custom,
            baseUrl: "",
            enabled: false,
            params: {},
        };

        const modal = new WallpaperApiEditorModal(this.app, emptyConfig, async (apiConfig) => {
            // 创建新的API实例
            apiManager.createApi(apiConfig);
            // 添加到插件设置中
            this.plugin.settings.wallpaperApis.push(apiConfig);
            await this.plugin.saveSettings();
            // 这里仅需刷新 api 列表
            this.displayWallpaperApis();
        });

        modal.open();
    }

    // 显示编辑壁纸API的模态窗口
    private showEditWallpaperApiModal(apiConfig: WallpaperApiConfig, index: number) {
        const modal = new WallpaperApiEditorModal(this.app, apiConfig, async (updatedConfig) => {
            // 有可能api类型也修改了，干脆重新创建API实例覆盖原来的
            apiManager.createApi(updatedConfig);

            this.plugin.settings.wallpaperApis[index] = updatedConfig;
            await this.plugin.saveSettings();
            // 这里仅需刷新 api 列表
            this.displayWallpaperApis();
        });

        modal.open();
    }

    // 从API获取壁纸并添加到背景列表
    private async fetchWallpaperFromApi(api: BaseWallpaperApi) {
        if (!api.getEnabled()) {
            new Notice(t("notice_api_disabled", { apiName: api.getName() }));
            return;
        }

        try {
            // 显示加载提示
            const loadingNotice = new Notice(t("notice_api_fetching", { apiName: api.getName() }), 0);

            // 使用API管理器获取随机壁纸
            const wallpaperImages = await apiManager.getRandomWallpapers(api.getId());

            // 关闭加载提示
            loadingNotice.hide();

            if (wallpaperImages) {
                // 创建新的图片背景项
                const newBg: BackgroundItem = {
                    id: api.generateBackgroundId(),
                    name: api.generateBackgroundName(),
                    type: "image",
                    value: wallpaperImages[0].url,
                };

                // 添加到背景列表
                this.plugin.settings.backgrounds.push(newBg);
                await this.plugin.saveSettings();

                // 立即应用这个背景
                this.plugin.background = newBg;
                this.plugin.updateStyleCss();

                // 这里仅需刷新背景列表和时间规则
                this.displayBackgrounds();
                this.displayTimeRules();

                new Notice(t("notice_api_success_applied", { apiName: api.getName() }));
            } else {
                new Notice(t("notice_api_failed_fetch", { apiName: api.getName() }));
            }
        } catch (error) {
            new Notice(t("notice_api_error_fetch", { apiName: api.getName(), error: error.message }));
            console.error("DTB: Error fetching wallpaper:", error);
        }
    }

    /**
     * 清理工作
     */
    cleanup(): void {
        // 使用组件ID清理该组件的所有订阅
        apiManager.stateManager.cleanupByComponent(this.componentId);

        // 清理拖拽排序实例
        this.backgroundDragSort?.disableAllDrag();
        this.timeRuleDragSort?.disableAllDrag();
        this.apiDragSort?.disableAllDrag();
    }

    // ============================================================================
    // Utils
    // ============================================================================

    private genComponentId() {
        return `settings-tab-${crypto.randomUUID()}`;
    }
}
