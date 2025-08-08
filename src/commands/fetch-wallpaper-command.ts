/**
 * 获取随机壁纸命令
 */
import { Command } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";

export function createFetchWallpaperCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "fetch-random-wallpaper",
        name: t("command_fetch_random_wallpaper_name"),
        callback: async () => {
            await plugin.applyRandomWallpaper();
        },
    };
}
