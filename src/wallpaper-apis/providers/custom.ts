/* Custom API 实现
 * 支持自定义的图片 API，可以通过 JSON Path 配置图片 URL 的提取方式
 */

import { JSONPath } from "jsonpath-plus";
import { requestUrl } from "obsidian";
import { logger } from "../../core/logger";
import { generateId } from "../../utils/utils";
import {
    apiRegistry,
    BaseWallpaperApi,
    WallpaperApiEndpoints,
    WallpaperApiParamDescriptor,
    WallpaperApiParams,
    WallpaperApiType,
    WallpaperImage,
} from "../core";

export class CustomApi extends BaseWallpaperApi {
    type: WallpaperApiType = WallpaperApiType.Custom;

    perPage = 1; // 默认每次获取1张图片

    // ============================================================================
    // 静态方法 - 用于UI显示默认值
    // ============================================================================

    static getDefaultBaseUrl(): string {
        return "";
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        return {};
    }

    static getDefaultDescription(): string {
        return "Custom API for fetching images from JSON responses. Configure JSON path to extract image URLs from API responses.";
    }

    static getApiDocUrl(): string {
        return "";
    }

    static getTokenUrl(): string {
        return "";
    }

    static getDefaultParams(): WallpaperApiParams {
        return {};
    }

    static getParamDescriptors(): WallpaperApiParamDescriptor[] {
        return [];
    }

    static getCustomSettingDescriptors(): WallpaperApiParamDescriptor[] {
        return [
            {
                key: "imageUrlJsonPath",
                label: "Image URL JSON path",
                type: "string",
                required: true,
                placeholder: "$.data.images[*].url or $.url or $[*].imageUrl",
                description:
                    "JSONPath expression to extract image URL(s) from API response. Supports standard JSONPath syntax.",
            },
        ];
    }

    // ============================================================================
    // 参数验证
    // ============================================================================

    validateParams(_params: WallpaperApiParams): boolean {
        if (!this.baseUrl) {
            logger.warn("Custom API: baseUrl is required");
            return false;
        }

        const urlJsonPath = this.config.customSettings?.imageUrlJsonPath;
        if (!urlJsonPath) {
            logger.warn("Custom API: imageUrlJsonPath is required");
            return false;
        }

        return true;
    }

    // ============================================================================
    // 必须实现的抽象方法
    // ============================================================================

    async init(): Promise<boolean> {
        if (this.initialized) {
            return true;
        }

        try {
            // 测试连通性
            const images = await this.fetchImages();
            if (!images || images.length === 0) {
                logger.warn("Custom API initialization failed: No images returned.");
                return false;
            }

            // 初始化数据缓存
            this.finishInit();
            this.totalPages = 1; // Custom API 通常只有一页
            this.totalCount = images.length;

            return true;
        } catch (error) {
            logger.error("Custom API initialization failed:", error);
            return false;
        }
    }

    deinit(): Promise<boolean> {
        return super.deinit(); // 重置 cache, curDataIndex, currentPage, initialized
    }

    async updateImageCache(): Promise<boolean> {
        try {
            const images = await this.fetchImages();
            if (images && images.length > 0) {
                this.wallpaperImageCache = images;
                this.curDataIndex = 0;
                this.totalCount = images.length;
                return true;
            }
            return false;
        } catch (error) {
            logger.error("Custom API cache update failed:", error);
            return false;
        }
    }

    // ============================================================================
    // API 调用实现
    // ============================================================================

    async fetchImages(): Promise<WallpaperImage[]> {
        try {
            if (!this.validateParams(this.params)) {
                throw new Error("Invalid parameters");
            }

            // 构建请求 URL
            const url = `${this.baseUrl}`;

            // 发起 GET 请求
            const response = await requestUrl({
                url,
                method: "GET",
            });

            // 解析 JSON 响应
            const data = response.json;
            return this.transformCustomResponse(data);
        } catch (error) {
            logger.error("Custom API fetch error:", error);
            throw error;
        }
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    // 转换自定义响应为图片数组
    private transformCustomResponse(data: unknown): WallpaperImage[] {
        try {
            const urlJsonPath = this.config.customSettings?.imageUrlJsonPath;

            if (!urlJsonPath) {
                logger.warn("Custom API: imageUrlJsonPath is required for JSON response");
                return [];
            }

            // 使用 jsonpath-plus 提取图片URL
            const urls = JSONPath({
                path: urlJsonPath,
                json: data as object,
                wrap: false,
            });

            if (!urls || (Array.isArray(urls) && urls.length === 0)) {
                logger.warn("Custom API: No URLs found at path:", urlJsonPath);
                return [];
            }

            // 确保结果是数组
            const urlArray = Array.isArray(urls) ? urls : [urls];

            // 过滤并转换为图片对象数组
            return urlArray
                .filter((url: unknown) => url && typeof url === "string")
                .map((url: unknown, index: number) => {
                    return {
                        id: this.generateImageId(index),
                        url: String(url),
                    };
                });
        } catch (error) {
            logger.warn("Error parsing custom API response:", error);
            return [];
        }
    }

    // 生成图片ID
    private generateImageId(_index?: number): string {
        return generateId("custom");
    }
}

// 注册 Custom API
apiRegistry.register(WallpaperApiType.Custom, CustomApi);
