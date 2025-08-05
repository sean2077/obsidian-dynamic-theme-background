/**
 * 切换插件开关命令
 */
import { Command, Notice } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";

export function createToggleCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "toggle-dtb",
        name: t("command_toggle_name"),
        callback: () => {
            plugin.settings.enabled = !plugin.settings.enabled;
            plugin.saveSettings();

            if (plugin.settings.enabled) {
                plugin.startBackgroundManager();
                new Notice(t("command_toggle_enabled_notice"));
            } else {
                plugin.stopBackgroundManager();
                new Notice(t("command_toggle_disabled_notice"));
            }
        },
    };
}
