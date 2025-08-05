/**
 * 命令管理器 - 统一管理所有插件命令
 */
import { Command } from "obsidian";
import DynamicThemeBackgroundPlugin from "../plugin";

// 导入所有命令创建函数
import { createFetchWallpaperCommand } from "./fetch-wallpaper-command";
import { createNextBackgroundCommand } from "./next-background-command";
import { createOpenSettingsCommand } from "./open-settings-command";
import { createTestBackgroundCommand } from "./test-background-command";
import { createToggleCommand } from "./toggle-command";

/**
 * 注册所有命令
 */
export function registerCommands(plugin: DynamicThemeBackgroundPlugin): void {
    const commands: Command[] = [
        createToggleCommand(plugin),
        createNextBackgroundCommand(plugin),
        createTestBackgroundCommand(plugin),
        createFetchWallpaperCommand(plugin),
        createOpenSettingsCommand(plugin),
    ];

    commands.forEach((command) => {
        plugin.addCommand(command);
    });
}
