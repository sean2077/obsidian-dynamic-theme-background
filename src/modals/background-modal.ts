import { App, Modal, Setting } from "obsidian";
import { preserveSliderValueVisibility } from "../core/obsidian-compat";
import { t } from "../i18n";
import type DynamicThemeBackgroundPlugin from "../plugin";
import type { BackgroundItem, DTBSettings } from "../types";
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

    nameInput!: HTMLInputElement;
    valueInput!: HTMLInputElement;
    // 背景单独的模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式设置
    blurDepth?: number;
    brightness4Bg?: number;
    saturate4Bg?: number;
    // 按主题覆盖（新）
    bgColorLight?: string;
    bgColorOpacityLight?: number;
    bgColorDark?: string;
    bgColorOpacityDark?: number;
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
        this.nameInput.value = this.bgItem.name;

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
            this.valueInput.value = this.bgItem.value;
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
            this.valueInput.value = this.bgItem.value;
        }

        // 背景单独的模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式设置
        contentEl.createEl("h4", { text: t("appearance_settings_title") });
        // 提示：重置仅清空当前背景的覆盖值，继承全局设置
        const hint = contentEl.createDiv({ cls: "dtb-hint" });
        hint.setText(t("per_bg_reset_hint"));
        const appearanceContainer = contentEl.createDiv();
        this.displayAppearanceSettings(appearanceContainer);

        // Buttons
        const buttonContainer = contentEl.createDiv("dtb-flex-container-end");

        const cancelButton = buttonContainer.createEl("button", {
            text: t("button_cancel"),
            cls: "dtb-button",
        });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl("button", {
            text: t("button_confirm"),
            cls: ["dtb-button", "mod-cta"],
        });
        submitButton.onclick = () => {
            // update bgItem with input values
            this.bgItem.name = this.nameInput.value;
            this.bgItem.value = this.valueInput.value;
            // 如果设置了模糊度、亮度、饱和度、遮罩颜色和透明度、填充方式, 则更新这些属性
            this.bgItem.blurDepth = this.blurDepth ?? this.bgItem.blurDepth;
            this.bgItem.brightness4Bg = this.brightness4Bg ?? this.bgItem.brightness4Bg;
            this.bgItem.saturate4Bg = this.saturate4Bg ?? this.bgItem.saturate4Bg;
            // 保存按主题覆盖（优先级更高）
            this.bgItem.bgColorDark = this.bgColorDark ?? this.bgItem.bgColorDark;
            this.bgItem.bgColorOpacityDark = this.bgColorOpacityDark ?? this.bgItem.bgColorOpacityDark;
            this.bgItem.bgColorLight = this.bgColorLight ?? this.bgItem.bgColorLight;
            this.bgItem.bgColorOpacityLight = this.bgColorOpacityLight ?? this.bgItem.bgColorOpacityLight;
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
                preserveSliderValueVisibility(slider.setLimits(0, 30, 1))
                    .setValue(this.blurDepth ?? this.bgItem.blurDepth ?? this.plugin.settings.blurDepth)
                    .onChange((value: number) => {
                        this.blurDepth = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_blur_tooltip"))
                    .onClick(() => {
                        // 清空每背景覆盖，让其回退到全局
                        this.blurDepth = undefined;
                        this.bgItem.blurDepth = undefined;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
        // 背景亮度设置
        new Setting(containerEl)
            .setName(t("brightness_name"))
            .setDesc(t("brightness_desc"))
            .addSlider((slider) =>
                preserveSliderValueVisibility(slider.setLimits(0, 1.5, 0.01))
                    .setValue(this.brightness4Bg ?? this.bgItem.brightness4Bg ?? this.plugin.settings.brightness4Bg)
                    .onChange((value: number) => {
                        this.brightness4Bg = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_brightness_tooltip"))
                    .onClick(() => {
                        // 清空每背景覆盖，让其回退到全局
                        this.brightness4Bg = undefined;
                        this.bgItem.brightness4Bg = undefined;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
        // 背景饱和度设置
        new Setting(containerEl)
            .setName(t("saturate_name"))
            .setDesc(t("saturate_desc"))
            .addSlider((slider) =>
                preserveSliderValueVisibility(slider.setLimits(0, 2, 0.01))
                    .setValue(this.saturate4Bg ?? this.bgItem.saturate4Bg ?? this.plugin.settings.saturate4Bg)
                    .onChange((value: number) => {
                        this.saturate4Bg = value;
                    })
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_saturate_tooltip"))
                    .onClick(() => {
                        // 清空每背景覆盖，让其回退到全局
                        this.saturate4Bg = undefined;
                        this.bgItem.saturate4Bg = undefined;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
        // 背景遮罩（每背景的暗/亮两套覆盖）
        const overlayRow = new Setting(containerEl).setName(t("bg_mask_color_name")).setDesc(t("bg_mask_color_desc"));
        // 暗主题（左）
        overlayRow.addExtraButton((btn) => btn.setTooltip(t("overlay_dark_tooltip")).setIcon("moon"));
        overlayRow.addColorPicker((picker) =>
            picker
                .setValue(this.bgColorDark ?? this.bgItem.bgColorDark ?? this.plugin.settings.bgColorDark)
                .onChange((value: string) => {
                    this.bgColorDark = value;
                })
        );
        overlayRow.addSlider((slider) =>
            preserveSliderValueVisibility(slider.setLimits(0, 1, 0.01))
                .setValue(
                    this.bgColorOpacityDark ?? this.bgItem.bgColorOpacityDark ?? this.plugin.settings.bgColorOpacityDark
                )
                .onChange((value: number) => {
                    this.bgColorOpacityDark = value;
                })
        );
        // 亮主题（右）
        overlayRow.addExtraButton((btn) => btn.setTooltip(t("overlay_light_tooltip")).setIcon("sun"));
        overlayRow.addColorPicker((picker) =>
            picker
                .setValue(this.bgColorLight ?? this.bgItem.bgColorLight ?? this.plugin.settings.bgColorLight)
                .onChange((value: string) => {
                    this.bgColorLight = value;
                })
        );
        overlayRow.addSlider((slider) =>
            preserveSliderValueVisibility(slider.setLimits(0, 1, 0.01))
                .setValue(
                    this.bgColorOpacityLight ??
                        this.bgItem.bgColorOpacityLight ??
                        this.plugin.settings.bgColorOpacityLight
                )
                .onChange((value: number) => {
                    this.bgColorOpacityLight = value;
                })
        );
        overlayRow.addExtraButton((button) =>
            button
                .setIcon("reset")
                .setTooltip(t("reset_bg_mask_color_tooltip"))
                .onClick(() => {
                    // 清空每背景遮罩覆盖，让其回退到全局
                    this.bgColorDark = undefined;
                    this.bgColorOpacityDark = undefined;
                    this.bgColorLight = undefined;
                    this.bgColorOpacityLight = undefined;
                    this.bgItem.bgColorDark = undefined;
                    this.bgItem.bgColorOpacityDark = undefined;
                    this.bgItem.bgColorLight = undefined;
                    this.bgItem.bgColorOpacityLight = undefined;
                    this.displayAppearanceSettings(containerEl);
                })
        );

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
                    .setValue(this.bgSize ?? this.bgItem.bgSize ?? this.plugin.settings.bgSize)
                    .onChange((value: string) => {
                        this.bgSize = value as DTBSettings["bgSize"];
                    });

                return dropdown;
            })
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("reset_bg_size_tooltip"))
                    .onClick(() => {
                        // 清空每背景覆盖，让其回退到全局
                        this.bgSize = undefined;
                        this.bgItem.bgSize = undefined;
                        this.displayAppearanceSettings(containerEl); // 重新渲染设置
                    })
            );
    }
}
