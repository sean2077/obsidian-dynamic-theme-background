/**
 * 背景持久化服务
 * 负责远程图片下载保存到 vault
 */

import { type App, Notice, requestUrl } from "obsidian";

import { t } from "../i18n";
import { confirm } from "../modals";
import type { BackgroundItem } from "../types";
import { logger } from "./logger";

export interface SaveResult {
    success: true;
    /** 更新后的 BackgroundItem（value 替换为本地路径, remoteUrl 为备份） */
    updatedBg: BackgroundItem;
}

export interface SaveError {
    success: false;
    error: string;
}

export class BackgroundPersistence {
    constructor(private app: App) {}

    /**
     * 保存远程图片到本地 vault
     * 返回新的 BackgroundItem（不修改输入对象）
     */
    async saveRemoteImage(bg: BackgroundItem, folderPath: string): Promise<SaveResult | SaveError> {
        if (!folderPath) {
            return { success: false, error: "no_folder_path" };
        }

        // 规范化文件名
        const imageName = bg.name.replace(/[\\/:*?"<>|]/g, "_") + ".jpg";
        const localPath = `${folderPath}/${imageName}`;

        // 判断路径是否存在
        const file = this.app.vault.getFileByPath(localPath);
        if (file) {
            const overwrite = await confirm(
                this.app,
                t("notice_save_background_overwrite_existing_file", { filePath: localPath })
            );
            if (!overwrite) {
                return { success: false, error: "cancelled" };
            }
        }

        // 下载远程图片
        try {
            const response = await requestUrl({ url: bg.value });
            if (response.status < 200 || response.status >= 300) {
                new Notice(t("notice_save_background_failed"), response.status);
                return { success: false, error: `HTTP ${response.status}` };
            }
            const arrayBuffer = response.arrayBuffer;

            // 覆盖旧文件
            if (file) {
                await this.app.fileManager.trashFile(file);
            }
            await this.app.vault.createBinary(localPath, arrayBuffer);

            // 创建新的 BackgroundItem（不修改原对象）
            const updatedBg: BackgroundItem = {
                ...bg,
                remoteUrl: bg.value,
                value: localPath,
            };

            new Notice(
                t("notice_save_background_converted", {
                    oldPath: bg.value,
                    newPath: localPath,
                }),
                5000
            );

            return { success: true, updatedBg };
        } catch (error) {
            logger.error("Error saving remote image:", error);
            return { success: false, error: String(error) };
        }
    }
}
