import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";
import type DynamicThemeBackgroundPlugin from "../plugin";
import { BackgroundItem } from "../types";
import { addDropdownOptionHoverTooltip } from "../utils";
import { ImagePathSuggestModal } from "./image-path-suggest-modal";

/**
 * 用于添加或编辑背景（图片、颜色或渐变）的模态框。
 *
 * 该模态框根据类型（image、color、gradient）动态渲染输入区域，
 * 并在图片类型下提供浏览按钮以选择图片路径。
 *
 */
export class BackgroundModal extends Modal {
    plugin: DynamicThemeBackgroundPlugin;
    bgItem: BackgroundItem;
    onSubmit: (bg: BackgroundItem) => void;

    nameInput: HTMLInputElement;
    valueInput: HTMLInputElement;
    // 背景单独的模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式设置
    blurDepth?: number;
    brightness4Bg?: number;
    saturate4Bg?: number;
    bgColor?: string;
    bgColorOpacity?: number;
    bgSize?: "cover" | "contain" | "auto" | "intelligent";

    constructor(
        app: App,
        plugin: DynamicThemeBackgroundPlugin,
        bgItem: BackgroundItem,
        onSubmit: (bg: BackgroundItem) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.bgItem = bgItem;
        this.onSubmit = onSubmit;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    onOpen() {
        const { contentEl } = this;

        let titleKey: "add_modal_title_image" | "add_modal_title_color" | "add_modal_title_gradient";
        switch (this.bgItem.type) {
            case "image":
                titleKey = "add_modal_title_image";
                break;
            case "color":
                titleKey = "add_modal_title_color";
                break;
            case "gradient":
                titleKey = "add_modal_title_gradient";
                break;
        }
        contentEl.createEl("h2", { text: t(titleKey) });

        // Name input
        contentEl.createEl("label", { text: t("bg_name_label") });
        this.nameInput = contentEl.createEl("input", { type: "text", cls: "dtb-input" });

        // Value input
        let valueLabel = "";
        let placeholder = "";
        switch (this.bgItem.type) {
            case "image":
                valueLabel = t("image_url_label");
                placeholder = "https://example.com/image.jpg OR path/to/image.jpg";
                break;
            case "color":
                valueLabel = t("color_value_label");
                placeholder = "#ffffff";
                break;
            case "gradient":
                valueLabel = t("gradient_css_label");
                placeholder = "linear-gradient(45deg, #ff0000, #0000ff)";
                break;
        }

        contentEl.createEl("label", { text: valueLabel });

        // 为图片类型创建带有浏览按钮的输入区域
        if (this.bgItem.type === "image") {
            const inputContainer = contentEl.createDiv("dtb-flex-container-spaced");
            this.valueInput = inputContainer.createEl("input", {
                type: "text",
                placeholder,
                cls: "dtb-flex-1",
            });
            const browseButton = inputContainer.createEl("button", {
                type: "button",
                text: t("button_browse"),
            });
            browseButton.onclick = () => {
                const modal = new ImagePathSuggestModal(this.app, (imagePath: string) => {
                    this.valueInput.value = imagePath;
                });
                modal.open();
            };
        } else {
            this.valueInput = contentEl.createEl("input", {
                type: "text",
                placeholder,
                cls: "dtb-input",
            });
        }

        // 背景单独的模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式设置
        contentEl.createEl("h4", { text: t("appearance_settings_title") });
        const appearanceContainer = contentEl.createDiv();
        this.displayAppearanceSettings(appearanceContainer);

        // Buttons
        const buttonContainer = contentEl.createDiv("dtb-flex-container-end");

        const cancelButton = buttonContainer.createEl("button", {
            text: t("button_cancel"),
            cls: "dtb-action-button",
        });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl("button", {
            text: t("button_confirm"),
            cls: ["dtb-action-button", "mod-cta"],
        });
        submitButton.onclick = () => {
            // update bgItem with input values
            this.bgItem.name = this.nameInput.value;
            this.bgItem.value = this.valueInput.value;
            // 如果设置了模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式, 则更新这些属性
            this.bgItem.blurDepth = this.blurDepth ?? this.bgItem.blurDepth;
            this.bgItem.brightness4Bg = this.brightness4Bg ?? this.bgItem.brightness4Bg;
            this.bgItem.saturate4Bg = this.saturate4Bg ?? this.bgItem.saturate4Bg;
            this.bgItem.bgColor = this.bgColor ?? this.bgItem.bgColor;
            this.bgItem.bgColorOpacity = this.bgColorOpacity ?? this.bgItem.bgColorOpacity;
            this.bgItem.bgSize = this.bgSize ?? this.bgItem.bgSize;
            // call onSubmit callback with updated bgItem
            this.onSubmit(this.bgItem);
            this.close();
        };
    }

    displayAppearanceSettings(containerEl: HTMLElement) {
        containerEl.empty();

        // 背景模糊度设置
        new Setting(containerEl)
            .setName(t("blur_depth_name"))
            .setDesc(t("blur_depth_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 30, 1)
                    .setDynamicTooltip()
                    .setValue(this.blurDepth ?? this.bgItem.blurDepth ?? this.plugin.settings.blurDepth)
                    .onChange(async (value: number) => {
                        this.blurDepth = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_blur_tooltip"))
                    .onClick(async () => {
                        this.blurDepth = this.plugin.settings.blurDepth;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
        // 背景亮度设置
        new Setting(containerEl)
            .setName(t("brightness_name"))
            .setDesc(t("brightness_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1.5, 0.01)
                    .setDynamicTooltip()
                    .setValue(this.brightness4Bg ?? this.bgItem.brightness4Bg ?? this.plugin.settings.brightness4Bg)
                    .onChange(async (value: number) => {
                        this.brightness4Bg = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_brightness_tooltip"))
                    .onClick(async () => {
                        this.brightness4Bg = this.plugin.settings.brightness4Bg;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
        // 背景饱和度设置
        new Setting(containerEl)
            .setName(t("saturate_name"))
            .setDesc(t("saturate_desc"))
            .addSlider((slider) =>
                slider
                    .setLimits(0, 2, 0.01)
                    .setDynamicTooltip()
                    .setValue(this.saturate4Bg ?? this.bgItem.saturate4Bg ?? this.plugin.settings.saturate4Bg)
                    .onChange(async (value: number) => {
                        this.saturate4Bg = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_saturate_tooltip"))
                    .onClick(async () => {
                        this.saturate4Bg = this.plugin.settings.saturate4Bg;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
        // 背景遮罩颜色和透明度设置
        new Setting(containerEl)
            .setName(t("bg_mask_color_name"))
            .setDesc(t("bg_mask_color_desc"))
            .addColorPicker((picker) =>
                picker
                    .setValue(this.bgColor ?? this.bgItem.bgColor ?? this.plugin.settings.bgColor)
                    .onChange(async (value: string) => {
                        this.bgColor = value;
                    })
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.01)
                    .setDynamicTooltip()
                    .setValue(this.bgColorOpacity ?? this.bgItem.bgColorOpacity ?? this.plugin.settings.bgColorOpacity)
                    .onChange(async (value: number) => {
                        this.bgColorOpacity = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_bg_mask_color_tooltip"))
                    .onClick(async () => {
                        this.bgColor = this.plugin.settings.bgColor;
                        this.bgColorOpacity = this.plugin.settings.bgColorOpacity;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
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
                    .setValue(this.bgSize ?? this.bgItem.bgSize ?? this.plugin.settings.bgSize)
                    .onChange(async (value: "cover" | "contain" | "auto" | "intelligent") => {
                        this.bgSize = value;
                    });

                return dropdown;
            })
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_bg_size_tooltip"))
                    .onClick(async () => {
                        this.bgSize = this.plugin.settings.bgSize;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
    }
}
