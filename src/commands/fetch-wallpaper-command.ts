/**
 * 获取随机壁纸命令
 */
import { Command, Notice } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";
import { apiManager } from "../wallpaper-apis";

export function createFetchWallpaperCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "fetch-random-wallpaper",
        name: t("command_fetch_random_wallpaper_name"),
        callback: async () => {
            if (!plugin.settings.enableRandomWallpaper) {
                new Notice(t("command_fetch_random_wallpaper_notice_disabled"));
                return;
            }

            // 显示加载提示
            const loadingNotice = new Notice("🔄 Fetching wallpaper from API...", 0);

            try {
                // 使用API管理器获取随机壁纸，这样可以受益于状态管理
                const wallpaperImages = await apiManager.getRandomWallpapers();

                // 关闭加载提示
                loadingNotice.hide();

                if (wallpaperImages && wallpaperImages.length > 0) {
                    // 创建一个临时的背景项用于随机壁纸
                    plugin.background = {
                        id: `random-wallpaper-${Date.now()}`,
                        name: `Random Wallpaper`,
                        type: "image",
                        value: wallpaperImages[0].url,
                    };
                    plugin.updateStyleCss();
                    new Notice("✅ Successfully applied random wallpaper!");
                } else {
                    new Notice("❌ No wallpaper APIs available or all APIs failed");
                }
            } catch (error) {
                // 关闭加载提示
                loadingNotice.hide();

                console.error("DTB: Error fetching random wallpaper:", error);
                new Notice("❌ Error fetching wallpaper from API");
            }
        },
    };
}
