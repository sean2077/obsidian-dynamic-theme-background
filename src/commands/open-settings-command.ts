/**
 * 打开设置标签页命令
 */
import { Command } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";

export function createOpenSettingsCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "open-dtb-settings-tab",
        name: t("command_open_settings_tab_name"),
        callback: () => {
            plugin.activateView();
        },
    };
}
