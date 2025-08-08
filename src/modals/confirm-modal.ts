import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

interface ConfirmModalOptions {
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export class ConfirmModal extends Modal {
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel?: () => void;

    constructor(app: App, options: ConfirmModalOptions) {
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
        contentEl.createDiv({ text: this.message });
        const buttonContainer = contentEl.createDiv({ cls: "dtb-flex-container-end" });

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

export function confirm(app: App, message: string): Promise<boolean> {
    return new Promise((resolve) => {
        new ConfirmModal(app, {
            message,
            onConfirm: async () => resolve(true),
            onCancel: async () => resolve(false),
        }).open();
    });
}
