/**
 * 切换到下一个背景命令
 */
import { Command, Notice } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";

export function createNextBackgroundCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "next-background",
        name: t("command_next_bg_name"),
        callback: () => {
            if (plugin.settings.backgrounds.length > 0) {
                plugin.settings.currentIndex = (plugin.settings.currentIndex + 1) % plugin.settings.backgrounds.length;
                plugin.background = plugin.settings.backgrounds[plugin.settings.currentIndex];
                plugin.updateStyleCss();
                plugin.saveSettings();
                new Notice(
                    t("command_next_bg_notice", {
                        bgName: plugin.background.name,
                    })
                );
            }
        },
    };
}
