/**
 * 设置标签页，用于显示和管理插件的设置
 * 包括基本设置、背景管理和模式设置等功能
 */
import { App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import { getDefaultSettings } from "../default-settings";
import { t } from "../i18n";
import { BackgroundModal, ImageFolderSuggestModal, TimeRuleModal, WallpaperApiEditorModal } from "../modals";
import type DynamicThemeBackgroundPlugin from "../plugin";
import type { BackgroundItem, DTBSettings, TimeRule } from "../types";
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
    private componentId: string;

    constructor(app: App, plugin: DynamicThemeBackgroundPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.defaultSettings = getDefaultSettings();
        // 生成唯一的组件ID
        this.componentId = this.genComponentId();
    }

    display(): void {
        // 清理之前的订阅
        this.cleanup();

        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: t("settings_title") });

        // 创建基本设置容器，便于分组更新
        const basicSettingEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayBasicSettings(basicSettingEl);

        const bgManagementEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayBackgroundManagement(bgManagementEl);

        const wallpaperApiSettingsEl = containerEl.createDiv(); // 这里适合使用默认的 div 容器，因为 displayXXX 内部会清理该容器
        this.displayWallpaperApiSettings(wallpaperApiSettingsEl);
    }

    // ============================================================================
    // 基础设置
    // ============================================================================

    private displayBasicSettings(containerEl: HTMLElement) {
        containerEl.empty();
        containerEl.createEl("h3", { text: t("basic_settings_title") });

        // 基础设置
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
                        this.displayBasicSettings(containerEl);
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
                        this.displayBasicSettings(containerEl);
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
                        this.displayBasicSettings(containerEl);
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
                        this.displayBasicSettings(containerEl);
                    })
            );

        // 模式设置
        containerEl.createEl("h4", { text: t("mode_settings_title") });
        new Setting(containerEl)
            .setName(t("switch_mode_name"))
            .setDesc(t("switch_mode_desc"))
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("time-based", t("mode_time_based"))
                    .addOption("interval", t("mode_interval"))
                    .addOption("manual", t("mode_manual"))
                    .setValue(this.plugin.settings.mode)
                    .onChange(async (value: "time-based" | "interval" | "manual") => {
                        this.plugin.settings.mode = value;
                        await this.plugin.saveSettings();
                        this.plugin.startBackgroundManager();
                        this.displayBasicSettings(containerEl);
                    })
            );

        // 时间规则（仅在时间模式下显示）
        if (this.plugin.settings.mode === "time-based") {
            containerEl.createEl("h4", { text: t("time_rules_title") });
            new Setting(containerEl)
                .setName(t("manage_time_rules_name"))
                .setDesc(t("manage_time_rules_desc"))
                .addButton((button) => {
                    button.setButtonText(t("add_time_rule_button"));
                    button.setTooltip(t("add_time_rule_tooltip"));
                    button.buttonEl.addClass("dtb-action-button");
                    button.onClick(() => this.showTimeRuleModal());
                })
                .addButton((button) => {
                    button.setButtonText(t("clear_time_rules_button"));
                    button.setTooltip(t("clear_time_rules_tooltip"));
                    button.buttonEl.addClass("dtb-action-button");
                    button.onClick(async () => {
                        this.plugin.settings.timeRules = [];
                        await this.plugin.saveSettings();
                        this.displayBasicSettings(containerEl);
                    });
                })
                .addButton((button) => {
                    button.setButtonText(t("reset_time_rules_button"));
                    button.setTooltip(t("reset_time_rules_tooltip"));
                    button.buttonEl.addClass("dtb-action-button");
                    button.onClick(async () => {
                        this.plugin.settings.timeRules = this.defaultSettings.timeRules;
                        await this.plugin.saveSettings();
                        this.displayBasicSettings(containerEl);
                    });
                });

            // 添加时间规则提示
            const hint = containerEl.createDiv("dtb-hint");
            hint.textContent = t("time_rule_hint");

            // 显示时间规则列表
            const timeRulesContainer = containerEl.createDiv("dtb-item-list-container dtb-section-container");
            this.displayTimeRules(timeRulesContainer);
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
                        this.displayBasicSettings(containerEl);
                    })
                );
        }
    }

    // 显示时间规则列表，支持编辑、删除和添加新规则
    private displayTimeRules(container: HTMLElement): void {
        container.empty();

        this.plugin.settings.timeRules.forEach((rule: TimeRule) => {
            new Setting(container)
                .setName(rule.name)
                .setDesc(`${rule.startTime} - ${rule.endTime}`)
                .addToggle((toggle) =>
                    toggle.setValue(rule.enabled).onChange(async (value) => {
                        rule.enabled = value;
                        await this.plugin.saveSettings();
                    })
                )
                .addDropdown((dropdown) => {
                    dropdown.addOption("", t("select_background_option"));
                    this.plugin.settings.backgrounds.forEach((bg) => {
                        dropdown.addOption(bg.id, bg.name);
                    });
                    return dropdown.setValue(rule.backgroundId).onChange(async (value) => {
                        rule.backgroundId = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateBackground();
                    });
                })
                .addButton((button) =>
                    button.setButtonText(t("button_edit")).onClick(() => this.showTimeRuleModal(rule))
                )
                .addButton((button) =>
                    button.setButtonText(t("button_delete")).onClick(async () => {
                        // 使用 filter 方法删除
                        this.plugin.settings.timeRules = this.plugin.settings.timeRules.filter((r) => r.id !== rule.id);
                        await this.plugin.saveSettings();
                        this.displayTimeRules(container);
                    })
                );
        });
    }

    // 显示添加或编辑时间规则的模态窗口
    private showTimeRuleModal(rule?: TimeRule) {
        // 如果没有提供规则，创建一个新的空规则
        const editRule: TimeRule = rule || {
            id: "",
            name: "",
            startTime: "09:00",
            endTime: "17:00",
            backgroundId: "",
            enabled: true,
        };

        const modal = new TimeRuleModal(this.app, editRule, async (updatedRule) => {
            if (!updatedRule.name.trim() || !updatedRule.startTime || !updatedRule.endTime) {
                new Notice("Please provide all required fields");
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
                    backgroundId: this.plugin.settings.backgrounds[0]?.id || "",
                    enabled: true,
                };
                this.plugin.settings.timeRules.push(newRule);
            }

            await this.plugin.saveSettings();
            this.display();
        });

        modal.open();
    }

    // ============================================================================
    // 背景管理
    // ============================================================================

    private displayBackgroundManagement(containerEl: HTMLElement) {
        containerEl.empty();

        // 背景管理
        containerEl.createEl("h3", { text: t("bg_management_title") });

        const addBgContainer = containerEl.createDiv("dtb-add-bg-container");

        // 添加拖拽提示
        const dragHint = containerEl.createDiv("dtb-hint");
        dragHint.textContent = t("drag_hint_text");

        new Setting(addBgContainer)
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

        const backgroundContainer = containerEl.createDiv("dtb-item-list-container  dtb-section-container");
        this.displayBackgrounds(backgroundContainer);
    }

    // 显示添加或编辑背景的模态窗口
    private async showAddBackgroundModal(type: "image" | "color" | "gradient") {
        const modal = new BackgroundModal(this.app, type, async (name: string, value: string) => {
            if (!name.trim() || !value.trim()) {
                new Notice("Please provide both name and value");
                return;
            }

            // 生成唯一ID
            const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);

            // 创建新的背景项
            const newBackground: BackgroundItem = {
                id,
                name: name.trim(),
                type,
                value: value.trim(),
            };

            // 添加到设置中
            this.plugin.settings.backgrounds.push(newBackground);
            await this.plugin.saveSettings();

            // 直接全刷新
            this.display();
        });

        modal.open();
    }

    // 显示编辑背景的模态窗口
    private async showEditBackgroundModal(bg: BackgroundItem, index: number) {
        const modal = new BackgroundModal(this.app, bg.type, async (name: string, value: string) => {
            if (!name.trim() || !value.trim()) {
                new Notice("Please provide both name and value");
                return;
            }

            // 更新现有背景项
            this.plugin.settings.backgrounds[index] = {
                ...bg,
                name: name.trim(),
                value: value.trim(),
            };

            await this.plugin.saveSettings();

            // 如果当前正在使用这个背景，则更新显示
            if (this.plugin.background?.id === bg.id) {
                this.plugin.background = this.plugin.settings.backgrounds[index];
                this.plugin.updateStyleCss();
            }

            // 刷新显示
            this.display();
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
                new Notice("Please provide a valid folder path");
                return;
            }

            // 检查文件夹是否存在
            const folder = this.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                new Notice("Folder not found");
                return;
            }

            try {
                // 处理文件夹中的图片文件
                if (typeof this.addImagesFromFolder === "function") {
                    await this.addImagesFromFolder(folderPath);
                    new Notice(`Images from folder "${folderPath}" added successfully`);
                } else {
                    new Notice("Folder processing method not available");
                }
            } catch (error) {
                console.error("Error adding images from folder:", error);
                new Notice("Error adding images from folder");
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
            this.display();
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
    private displayBackgrounds(container: HTMLElement): void {
        container.empty();

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

            const contentDiv = bgEl.createDiv("dtb-bg-content");
            contentDiv.createSpan({ text: bg.name, cls: "dtb-bg-name" });
            contentDiv.createSpan({ text: bg.type, cls: "dtb-type-badge" });

            // 预览
            const preview = contentDiv.createDiv("dtb-bg-preview");
            this.setPreviewBackground(preview, bg);

            // 操作按钮
            const actions = contentDiv.createDiv("dtb-actions");

            actions.createEl("button", { text: t("button_preview") }).onclick = () => {
                this.plugin.background = bg;
                this.plugin.settings.currentIndex = index; // 更新当前索引
                this.plugin.saveSettings();
                this.plugin.updateStyleCss();
            };

            actions.createEl("button", { text: t("button_edit") }).onclick = () => {
                this.showEditBackgroundModal(bg, index);
            };

            actions.createEl("button", { text: t("button_delete") }).onclick = async () => {
                // 使用 filter 方法删除
                this.plugin.settings.backgrounds = this.plugin.settings.backgrounds.filter(
                    (b: BackgroundItem) => b.id !== bg.id
                );
                await this.plugin.saveSettings();
                this.displayBackgrounds(container);
            };

            // 添加拖拽事件监听器
            this.addDragListeners(bgEl);
        });
    }

    // 添加拖拽事件监听器的辅助方法
    private addDragListeners(element: HTMLElement) {
        element.addEventListener("dragstart", (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", element.dataset.bgId || "");
                element.classList.add("dtb-dragging");
            }
        });

        element.addEventListener("dragend", () => {
            element.classList.remove("dtb-dragging");
            // 移除所有拖拽相关的样式
            const allItems = element.parentElement?.querySelectorAll(".dtb-item");
            allItems?.forEach((item) => {
                item.classList.remove("dtb-drag-over", "dtb-drag-over-top", "dtb-drag-over-bottom");
            });
        });

        element.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = "move";
            }

            // 确定拖拽位置（上半部分还是下半部分）
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isTopHalf = e.clientY < midpoint;

            // 移除之前的样式
            element.classList.remove("dtb-drag-over-top", "dtb-drag-over-bottom");

            // 添加适当的样式
            if (isTopHalf) {
                element.classList.add("dtb-drag-over-top");
            } else {
                element.classList.add("dtb-drag-over-bottom");
            }
        });

        element.addEventListener("dragleave", (e) => {
            // 只有当鼠标真正离开元素时才移除样式
            if (!element.contains(e.relatedTarget as Node)) {
                element.classList.remove("dtb-drag-over-top", "dtb-drag-over-bottom");
            }
        });

        element.addEventListener("drop", async (e) => {
            e.preventDefault();

            const draggedId = e.dataTransfer?.getData("text/plain");
            const targetId = element.dataset.bgId;

            if (!draggedId || !targetId || draggedId === targetId) {
                return;
            }

            // 确定插入位置
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const insertAfter = e.clientY >= midpoint;

            await this.reorderBackgrounds(draggedId, targetId, insertAfter);

            // 清理样式
            element.classList.remove("dtb-drag-over-top", "dtb-drag-over-bottom");
        });
    }

    // 重新排序背景的方法
    private async reorderBackgrounds(draggedId: string, targetId: string, insertAfter: boolean) {
        const backgrounds = this.plugin.settings.backgrounds;
        const draggedIndex = backgrounds.findIndex((bg: BackgroundItem) => bg.id === draggedId);
        const targetIndex = backgrounds.findIndex((bg: BackgroundItem) => bg.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            console.warn("DTB: Invalid drag operation - background not found");
            return;
        }

        // 如果拖拽到相同位置，则不做任何操作
        if (
            draggedIndex === targetIndex ||
            (insertAfter && draggedIndex === targetIndex + 1) ||
            (!insertAfter && draggedIndex === targetIndex - 1)
        ) {
            return;
        }

        // 移除被拖拽的元素
        const draggedItem = backgrounds.splice(draggedIndex, 1)[0];

        // 计算新的插入位置
        let newTargetIndex = backgrounds.findIndex((bg: BackgroundItem) => bg.id === targetId);
        if (insertAfter) {
            newTargetIndex++;
        }

        // 插入到新位置
        backgrounds.splice(newTargetIndex, 0, draggedItem);

        // 保存设置并重新显示
        await this.plugin.saveSettings();
        this.display();
    }

    // 设置预览元素的背景样式 * 使用 CSS 自定义属性而不是内联样式，遵循 Obsidian 官方建议
    private setPreviewBackground(preview: HTMLElement, bg: BackgroundItem): void {
        // 移除之前的类型特定类名
        preview.removeClass("dtb-preview-image", "dtb-preview-color", "dtb-preview-gradient");

        // 清除之前设置的 CSS 自定义属性
        preview.style.removeProperty("--dtb-preview-bg-image");
        preview.style.removeProperty("--dtb-preview-bg");

        switch (bg.type) {
            case "image": {
                preview.addClass("dtb-preview-image");
                const sanitizedImagePath = this.plugin.sanitizeImagePath(bg.value);
                // 只有当图片路径有效时才设置 CSS 变量
                if (sanitizedImagePath && sanitizedImagePath !== "none") {
                    preview.style.setProperty("--dtb-preview-bg-image", sanitizedImagePath);
                }
                break;
            }
            case "color":
            case "gradient": {
                preview.addClass(`dtb-preview-${bg.type}`);
                // 验证颜色/渐变值的有效性
                if (bg.value && bg.value.trim()) {
                    preview.style.setProperty("--dtb-preview-bg", bg.value);
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
                const folderName = folderPath === "" ? "root" : folderPath.split("/").pop() || folderPath;
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
            this.display();
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
    private displayWallpaperApiSettings(containerEl: HTMLElement): void {
        containerEl.empty();

        containerEl.createEl("h3", { text: t("wallpaper_api_management_title") });

        // 添加 API 按钮
        new Setting(containerEl)
            .setName(t("add_api_name"))
            .setDesc(t("add_api_desc"))
            .addButton((button) => {
                button.setButtonText(t("add_api_button"));
                button.buttonEl.addClass("dtb-action-button");
                button.onClick(() => this.showAddWallpaperApiModal());
            });

        // 添加 API 提示
        const hint = containerEl.createDiv("dtb-hint");
        hint.textContent = t("wallpaper_api_hint");

        // 显示现有API列表
        const apiContainer = containerEl.createDiv("dtb-item-list-container");
        this.displayWallpaperApis(apiContainer);
    }

    /*
     * 显示所有已配置的壁纸 API
     */
    private displayWallpaperApis(container: HTMLElement) {
        container.empty();

        // API 列表
        this.plugin.settings.wallpaperApis.forEach((apiConfig: WallpaperApiConfig, index: number) => {
            const apiInstance = apiManager.getApiById(apiConfig.id);
            if (!apiInstance) {
                console.warn(`DTB: API instance not found for ${apiConfig.name}`);
                return;
            }

            // 描述
            const desc = apiInstance.getDescription();

            const setting = new Setting(container).setName(apiConfig.name).setDesc(desc);

            // 在设置项的控件区域直接添加类型标签
            setting.controlEl.createSpan({ text: apiConfig.type || "Unknown", cls: "dtb-type-badge" });

            // 注意：状态指示器和启用按钮的状态都以 API 实例的状态为准，配置项的 enabled 字段仅用于初始状态和保存设置时的同步。

            // 添加状态指示器
            const statusIndicator = setting.controlEl.createDiv("dtb-api-status");
            const statusDot = statusIndicator.createDiv("dtb-api-status-dot");
            const statusText = statusIndicator.createSpan();
            // 根据API的启用状态设置初始状态
            if (apiInstance.getEnabled()) {
                statusDot.addClass("enabled");
                statusText.textContent = "Enabled";
            } else {
                statusDot.addClass("disabled");
                statusText.textContent = "Disabled";
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

                        if (!success) {
                            new Notice(`❌ Failed to ${value ? "enable" : "disable"} ${apiConfig.name}`, 3000);
                        } else {
                            new Notice(`✅ Successfully ${value ? "enabled" : "disabled"} ${apiConfig.name}`, 3000);
                        }
                    } catch (error) {
                        console.error(`DTB: Error ${value ? "enabling" : "disabling"} API:`, error);
                        new Notice(`❌ Error ${value ? "enabling" : "disabling"} ${apiConfig.name}`, 3000);
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
                    statusText.textContent = "Loading...";
                } else if (state.error) {
                    statusDot.addClass("error");
                    statusText.textContent = "Error";
                    statusText.title = state.error;
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== false) {
                        toggleComponent.setValue(false);
                    }
                    apiConfig.enabled = false;
                    await this.plugin.saveSettings();
                } else if (state.instanceEnabled) {
                    statusDot.addClass("enabled");
                    statusText.textContent = "Enabled";
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== true) {
                        toggleComponent.setValue(true);
                    }
                    apiConfig.enabled = true;
                    await this.plugin.saveSettings();
                } else {
                    statusDot.addClass("disabled");
                    statusText.textContent = "Disabled";
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
                        this.displayWallpaperApis(container);
                    })
                );
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
            this.display();
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
            this.display();
        });

        modal.open();
    }

    // 从API获取壁纸并添加到背景列表
    private async fetchWallpaperFromApi(api: BaseWallpaperApi) {
        if (!api.getEnabled()) {
            new Notice(`❌ ${api.getName()}: API is disabled`);
            return;
        }

        try {
            // 显示加载提示
            const loadingNotice = new Notice(`🔄 Fetching wallpaper from ${api.getName()}...`, 0);

            // 使用API管理器获取随机壁纸
            const wallpaperImages = await apiManager.getRandomWallpapers(api.getId());

            // 关闭加载提示
            loadingNotice.hide();

            if (wallpaperImages) {
                // 创建新的图片背景项
                const newBg: BackgroundItem = {
                    id: `${api.getId()}-${Date.now()}`,
                    name: `${api.getName()} - ${new Date().toLocaleString()}`,
                    type: "image",
                    value: wallpaperImages[0].url,
                };

                // 添加到背景列表
                this.plugin.settings.backgrounds.push(newBg);
                await this.plugin.saveSettings();

                // 立即应用这个背景
                this.plugin.background = newBg;
                this.plugin.updateStyleCss();

                // 刷新显示
                this.display();

                new Notice(`✅ Successfully applied wallpaper from ${api.getName()}`);
            } else {
                new Notice(`❌ Failed to fetch wallpaper from ${api.getName()}`);
            }
        } catch (error) {
            new Notice(`❌ Error fetching wallpaper from ${api.getName()}: ${error.message}`);
            console.error("DTB: Error fetching wallpaper:", error);
        }
    }

    /**
     * 清理所有订阅
     */
    cleanup(): void {
        // 使用组件ID清理该组件的所有订阅
        apiManager.stateManager.cleanupByComponent(this.componentId);
    }

    // ============================================================================
    // Utils
    // ============================================================================

    private genComponentId() {
        return `settings-tab-${crypto.randomUUID()}`;
    }
}
