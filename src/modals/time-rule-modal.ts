import { App, Modal } from "obsidian";
import { t } from "../i18n";
import type { TimeRule } from "../types";

export class TimeRuleModal extends Modal {
    rule: TimeRule;
    onSubmit: (rule: { name: string; startTime: string; endTime: string }) => void;
    nameInput: HTMLInputElement;
    startTimeInput: HTMLInputElement;
    endTimeInput: HTMLInputElement;

    constructor(
        app: App,
        rule: TimeRule,
        onSubmit: (rule: { name: string; startTime: string; endTime: string }) => void
    ) {
        super(app);
        this.rule = rule;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl("h2", { text: t("edit_time_rule_title") });

        // Name input
        contentEl.createEl("label", { text: t("rule_name_label") });
        this.nameInput = contentEl.createEl("input", {
            type: "text",
            value: this.rule.name,
            cls: "dtb-input",
        });

        // Start time input
        contentEl.createEl("label", { text: t("start_time_label") });
        this.startTimeInput = contentEl.createEl("input", {
            type: "time",
            value: this.rule.startTime,
            cls: "dtb-input",
        });

        // End time input
        contentEl.createEl("label", { text: t("end_time_label") });
        this.endTimeInput = contentEl.createEl("input", {
            type: "time",
            value: this.rule.endTime,
            cls: "dtb-input",
        });

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
            this.onSubmit({
                name: this.nameInput.value,
                startTime: this.startTimeInput.value,
                endTime: this.endTimeInput.value,
            });
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
