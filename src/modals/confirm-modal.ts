import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

export class ConfirmModal extends Modal {
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel?: () => void;

    constructor(
        app: App,
        options: {
            message: string;
            confirmText?: string;
            cancelText?: string;
            onConfirm: () => void;
            onCancel?: () => void;
        }
    ) {
        super(app);
        this.message = options.message;
        this.confirmText = options.confirmText ?? t("button_confirm");
        this.cancelText = options.cancelText ?? t("button_cancel");
        this.onConfirm = options.onConfirm;
        this.onCancel = options.onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createDiv({ text: this.message, cls: "dtb-confirm-modal-message" });
        const buttonContainer = contentEl.createDiv({ cls: "dtb-confirm-modal-buttons" });

        new Setting(buttonContainer)
            .addButton((btn) => {
                btn.setButtonText(this.confirmText)
                    .setCta()
                    .onClick(() => {
                        this.close();
                        this.onConfirm();
                    });
            })
            .addButton((btn) => {
                btn.setButtonText(this.cancelText).onClick(() => {
                    this.close();
                    this.onCancel?.();
                });
            });
    }

    onClose() {
        this.contentEl.empty();
    }
}
