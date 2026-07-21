/**
 * Validates and stores remote backgrounds in the vault without delete-first
 * overwrite behavior.
 */

import { type App, Notice, TFolder, requestUrl } from "obsidian";

import { t } from "../i18n";
import { confirm } from "../modals";
import type { BackgroundItem } from "../types";
import { logger } from "./logger";
import { REQUEST_TIMEOUT_MS, assertRemoteUrl, withTimeout } from "./network-policy";
import {
    type BinaryStore,
    buildImagePath,
    inspectImageResponse,
    normalizeVaultFolder,
    writeImage,
} from "./persistence-policy";

export interface SaveResult {
    success: true;
    updatedBg: BackgroundItem;
}

export interface SaveError {
    error: string;
    success: false;
}

function responseContentType(headers: Record<string, string>): string | undefined {
    return Object.entries(headers).find(([name]) => name.toLowerCase() === "content-type")?.[1];
}

export class BackgroundPersistence {
    constructor(private app: App) {}

    async saveRemoteImage(bg: BackgroundItem, folderPath: string): Promise<SaveResult | SaveError> {
        let folder: string;
        let remoteUrl: string;
        try {
            folder = normalizeVaultFolder(folderPath);
            remoteUrl = assertRemoteUrl(bg.value, { allowInsecureHttp: true });
        } catch {
            return { error: "invalid_path_or_url", success: false };
        }
        if (!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder)) {
            return { error: "invalid_folder", success: false };
        }

        try {
            const response = await withTimeout(requestUrl({ method: "GET", url: remoteUrl }), REQUEST_TIMEOUT_MS, {
                clearTimeout: (handle) => window.clearTimeout(handle as number),
                setTimeout: (callback, delay) => window.setTimeout(callback, delay),
            });
            const extension = inspectImageResponse(
                responseContentType(response.headers),
                response.arrayBuffer.byteLength
            );
            const localPath = buildImagePath(folder, bg.name, extension);
            const result = await writeImage(this.createStore(), localPath, response.arrayBuffer, (path) =>
                confirm(
                    this.app,
                    t("notice_save_background_overwrite_existing_file", {
                        filePath: path,
                    })
                )
            );
            if (result === "cancelled") {
                return { error: "cancelled", success: false };
            }

            const updatedBg: BackgroundItem = {
                ...bg,
                remoteUrl: bg.value,
                value: localPath,
            };
            new Notice(t("notice_save_background_converted", { newPath: localPath }), 5000);
            return { success: true, updatedBg };
        } catch (error) {
            logger.error("Error saving remote image", error);
            return { error: "download_or_write_failed", success: false };
        }
    }

    private createStore(): BinaryStore {
        return {
            create: async (path, data) => {
                await this.app.vault.createBinary(path, data);
            },
            exists: (path) => this.app.vault.getFileByPath(path) !== null,
            replace: async (path, data) => {
                const file = this.app.vault.getFileByPath(path);
                if (!file) throw new Error("Existing image disappeared before replace");
                await this.app.vault.modifyBinary(file, data);
            },
        };
    }
}
