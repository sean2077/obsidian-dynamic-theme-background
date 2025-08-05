/*
    添加背景图片、颜色或渐变的模态窗口
*/
import { App, Modal } from "obsidian";
import { t } from "../i18n";
import { ImagePathSuggestModal } from "./image-path-suggest-modal";

export class BackgroundModal extends Modal {
    type: "image" | "color" | "gradient";
    onSubmit: (name: string, value: string) => void;
    nameInput: HTMLInputElement;
    valueInput: HTMLInputElement;

    constructor(app: App, type: "image" | "color" | "gradient", onSubmit: (name: string, value: string) => void) {
        super(app);
        this.type = type;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        let titleKey: "add_modal_title_image" | "add_modal_title_color" | "add_modal_title_gradient";
        switch (this.type) {
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

        switch (this.type) {
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
        if (this.type === "image") {
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
            this.onSubmit(this.nameInput.value, this.valueInput.value || placeholder);
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
