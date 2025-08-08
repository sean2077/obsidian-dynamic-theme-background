/**
 * 保存当前背景命令
 */
import { Command } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";

export function createSaveBackgroundCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "save-current-background",
        name: t("command_save_current_background_name"),
        callback: async () => {
            await plugin.saveBackground();
        },
    };
}
