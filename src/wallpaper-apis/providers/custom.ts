/* Custom API 实现
 * 支持自定义的图片 API，可以通过 JSON Path 配置图片 URL 的提取方式
 */

import { logger } from "../../core/logger";
import { queryJsonPath } from "../../core/safe-json-path";
import { generateId } from "../../utils/utils";
import {
    apiRegistry,
    BaseWallpaperApi,
    buildWallpaperApiUrl,
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
                    "Safe JSONPath subset: properties, quoted keys, indexes, slices, unions, wildcards, and recursive descent. Filters and scripts are rejected.",
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

            return this.transformCustomResponse(
                await this.requestJson(buildWallpaperApiUrl(this.baseUrl, this.params), {
                    allowInsecureHttp: true,
                    headers: this.config.headers,
                })
            );
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

            // 使用受限、无求值的路径查询提取图片 URL
            const urls = queryJsonPath(data, urlJsonPath, 100);

            if (!urls || (Array.isArray(urls) && urls.length === 0)) {
                logger.warn("Custom API: No URLs found at path:", urlJsonPath);
                return [];
            }

            // 确保结果是数组
            // 过滤并转换为图片对象数组
            return this.limitItems(urls)
                .filter((url): url is string => typeof url === "string" && url.length > 0)
                .map((url, index) => {
                    return {
                        id: this.generateImageId(index),
                        url,
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
