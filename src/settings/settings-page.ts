import { SettingPage } from "obsidian";

type SettingsPageRenderer = (containerEl: HTMLElement) => () => void;

export function createSettingsPage(
    title: string,
    render: SettingsPageRenderer,
    onDisplay: () => void
): SettingPage {
    return new (class extends SettingPage {
        private pageCleanup?: () => void;

        constructor() {
            super();
            this.title = title;
        }

        display(): void {
            this.pageCleanup?.();
            this.pageCleanup = undefined;
            this.containerEl.empty();
            this.containerEl.addClass("dtb-settings-surface");
            onDisplay();
            this.pageCleanup = render(this.containerEl);
        }

        hide(): void {
            this.pageCleanup?.();
            this.pageCleanup = undefined;
            super.hide();
        }
    })();
}
