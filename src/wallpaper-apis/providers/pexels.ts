/* Pexels API 实现
 * 文档: https://www.pexels.com/api/documentation/
 */

import { requestUrl } from "obsidian";
import {
    apiRegistry,
    BaseWallpaperApi,
    WallpaperApiEndpoints,
    WallpaperApiParamDescriptor,
    WallpaperApiParams,
    WallpaperApiType,
    WallpaperImage,
} from "../core";

export class PexelsApi extends BaseWallpaperApi {
    type: WallpaperApiType = WallpaperApiType.Pexels;

    perPage = 15; // 默认为15，最大80

    // ============================================================================
    // 静态方法 - 用于UI显示默认值
    // ============================================================================

    static getDefaultBaseUrl(): string {
        return "https://api.pexels.com/v1";
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        return {
            search: "/search",
            detail: "/photos/{id}",
            curated: "/curated",
        };
    }

    static getDefaultDescription(): string {
        return "Pexels API for fetching high-quality stock photos. Requires an API key for authentication.";
    }

    static getApiDocUrl(): string {
        return "https://www.pexels.com/api/documentation/";
    }

    static getTokenUrl(): string {
        return "https://www.pexels.com/api/";
    }

    static getDefaultParams(): WallpaperApiParams {
        return {
            query: "",
            page: 1,
            per_page: 15,
            orientation: "",
            size: "",
            color: "",
            locale: "en-US",
        };
    }

    static getParamDescriptors(): WallpaperApiParamDescriptor[] {
        const defaultParams = PexelsApi.getDefaultParams();

        return [
            {
                key: "api_key",
                label: "API Key",
                type: "password",
                required: true,
                placeholder: "Your Pexels API key",
                description: "Required API key for Pexels API authentication",
            },
            {
                key: "query",
                label: "Search Query",
                type: "string",
                required: false,
                placeholder: "nature, landscape, abstract...",
                description: "Search keywords for photos",
            },
            {
                key: "orientation",
                label: "Orientation",
                type: "select",
                defaultValue: "",
                description: "Filter by photo orientation",
                options: [
                    { value: "", label: "Any" },
                    { value: "landscape", label: "Landscape" },
                    { value: "portrait", label: "Portrait" },
                    { value: "square", label: "Square" },
                ],
            },
            {
                key: "size",
                label: "Size",
                type: "select",
                defaultValue: "",
                description: "Filter by photo size",
                options: [
                    { value: "", label: "Any" },
                    { value: "large", label: "Large (24MP+)" },
                    { value: "medium", label: "Medium (12-24MP)" },
                    { value: "small", label: "Small (4-12MP)" },
                ],
            },
            {
                key: "color",
                label: "Color",
                type: "select",
                defaultValue: "",
                description: "Filter results by color",
                options: [
                    { value: "", label: "Any" },
                    { value: "red", label: "Red" },
                    { value: "orange", label: "Orange" },
                    { value: "yellow", label: "Yellow" },
                    { value: "green", label: "Green" },
                    { value: "turquoise", label: "Turquoise" },
                    { value: "blue", label: "Blue" },
                    { value: "violet", label: "Violet" },
                    { value: "pink", label: "Pink" },
                    { value: "brown", label: "Brown" },
                    { value: "black", label: "Black" },
                    { value: "gray", label: "Gray" },
                    { value: "white", label: "White" },
                ],
            },
            {
                key: "locale",
                label: "Locale",
                type: "select",
                defaultValue: defaultParams.locale,
                description: "The locale for the search query",
                options: [
                    { value: "en-US", label: "English (US)" },
                    { value: "pt-BR", label: "Portuguese (Brazil)" },
                    { value: "es-ES", label: "Spanish (Spain)" },
                    { value: "ca-ES", label: "Catalan (Spain)" },
                    { value: "de-DE", label: "German (Germany)" },
                    { value: "it-IT", label: "Italian (Italy)" },
                    { value: "fr-FR", label: "French (France)" },
                    { value: "sv-SE", label: "Swedish (Sweden)" },
                    { value: "id-ID", label: "Indonesian (Indonesia)" },
                    { value: "pl-PL", label: "Polish (Poland)" },
                    { value: "ja-JP", label: "Japanese (Japan)" },
                    { value: "zh-TW", label: "Chinese (Taiwan)" },
                    { value: "zh-CN", label: "Chinese (China)" },
                    { value: "ko-KR", label: "Korean (Korea)" },
                    { value: "th-TH", label: "Thai (Thailand)" },
                    { value: "nl-NL", label: "Dutch (Netherlands)" },
                    { value: "hu-HU", label: "Hungarian (Hungary)" },
                    { value: "vi-VN", label: "Vietnamese (Vietnam)" },
                    { value: "cs-CZ", label: "Czech (Czech Republic)" },
                    { value: "da-DK", label: "Danish (Denmark)" },
                    { value: "fi-FI", label: "Finnish (Finland)" },
                    { value: "uk-UA", label: "Ukrainian (Ukraine)" },
                    { value: "el-GR", label: "Greek (Greece)" },
                    { value: "ro-RO", label: "Romanian (Romania)" },
                    { value: "nb-NO", label: "Norwegian (Norway)" },
                    { value: "sk-SK", label: "Slovak (Slovakia)" },
                    { value: "tr-TR", label: "Turkish (Turkey)" },
                    { value: "ru-RU", label: "Russian (Russia)" },
                ],
            },
            {
                key: "per_page",
                label: "Photos Per Page",
                type: "number",
                defaultValue: defaultParams.per_page,
                description: "Number of photos per page (max 80)",
            },
            {
                key: "page",
                label: "Page Number",
                type: "number",
                defaultValue: defaultParams.page,
                description: "Page number to fetch",
            },
        ];
    }

    static validateParams(params: WallpaperApiParams): { valid: boolean; errors?: string[] } {
        let valid = true;
        const errors: string[] = [];

        // 验证 API key 是否存在
        if (!params.api_key) {
            valid = false;
            errors.push("API key is required for Pexels API.");
        }

        // 验证 per_page 范围
        if (params.per_page && (Number(params.per_page) < 1 || Number(params.per_page) > 80)) {
            valid = false;
            errors.push("per_page must be between 1 and 80.");
        }

        return { valid: valid, errors: errors.length > 0 ? errors : undefined };
    }

    // ============================================================================
    // 接口方法
    // ============================================================================

    async init(): Promise<boolean> {
        if (this.initialized) {
            return true;
        }

        try {
            // 测试API连通性
            let response;
            if (this.params.query) {
                // 如果有搜索查询，测试搜索接口
                response = await this.fetchSearchResults(1);
            } else {
                // 没有搜索查询，测试精选接口
                response = await this.fetchCuratedPhotos(1);
            }

            if (!response || !response.photos || !Array.isArray(response.photos)) {
                console.warn("Pexels API initialization failed: Invalid response format.");
                return false;
            }

            // 更新分页信息
            this.totalPages = response.total_results ? Math.ceil(response.total_results / this.perPage) : -1;
            this.totalCount = response.total_results || -1;
            this.perPage = Number(this.params.per_page) || 15;

            // 初始化数据缓存
            this.wallpaperImageCache = [];
            this.curDataIndex = 0;
            this.currentPage = 1;

            this.initialized = true;
            return true;
        } catch (error) {
            console.warn("Pexels API initialization failed:", error);
            return false;
        }
    }

    async deinit(): Promise<boolean> {
        if (!this.initialized) {
            return true;
        }

        // 清理缓存数据
        this.wallpaperImageCache = [];
        this.curDataIndex = 0;
        this.currentPage = 1;

        this.initialized = false;
        return true;
    }

    async updateImageCache(): Promise<boolean> {
        // 如果已经到最后一页了，跳到第一页
        if (this.totalPages > 0 && this.currentPage > this.totalPages) {
            this.currentPage = 1;
        }

        let success = false;
        if (this.params.query) {
            // 有搜索查询，使用搜索接口
            success = await this.fetchAndCacheSearchResults(this.currentPage);
        } else {
            // 没有搜索查询，使用精选接口
            success = await this.fetchAndCacheCuratedPhotos(this.currentPage);
        }

        if (success) {
            this.currentPage += 1;
        }
        return success;
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    // 拉取搜索结果并缓存
    private async fetchAndCacheSearchResults(page = this.currentPage): Promise<boolean> {
        try {
            const data = await this.fetchSearchResults(page);

            if (!data || !data.photos || !Array.isArray(data.photos)) {
                console.warn("Invalid search response format from Pexels API");
                return false;
            }

            // 更新分页信息
            this.totalPages = data.total_results ? Math.ceil(data.total_results / this.perPage) : -1;
            this.totalCount = data.total_results || -1;

            // 缓存当前页的数据
            this.wallpaperImageCache = data.photos.map((photo: Record<string, unknown>) => this.transformPhoto(photo));
            this.curDataIndex = 0;

            return true;
        } catch (error) {
            console.warn(`Error fetching search results from Pexels API:`, error);
            return false;
        }
    }

    // 拉取精选图片并缓存
    private async fetchAndCacheCuratedPhotos(page = this.currentPage): Promise<boolean> {
        try {
            const data = await this.fetchCuratedPhotos(page);

            if (!data || !data.photos || !Array.isArray(data.photos)) {
                console.warn("Invalid curated photos response format from Pexels API");
                return false;
            }

            // 缓存当前页的数据
            this.wallpaperImageCache = data.photos.map((photo: Record<string, unknown>) => this.transformPhoto(photo));
            this.curDataIndex = 0;

            return true;
        } catch (error) {
            console.warn(`Error fetching curated photos from Pexels API:`, error);
            return false;
        }
    }

    // 搜索请求
    private async fetchSearchResults(page = this.currentPage) {
        const queryParams = new URLSearchParams();

        // 必需参数
        queryParams.append("query", String(this.params.query || ""));
        queryParams.append("page", String(page));
        queryParams.append("per_page", String(this.params.per_page || this.perPage));

        // 可选参数
        if (this.params.orientation) {
            queryParams.append("orientation", String(this.params.orientation));
        }
        if (this.params.size) {
            queryParams.append("size", String(this.params.size));
        }
        if (this.params.color) {
            queryParams.append("color", String(this.params.color));
        }
        if (this.params.locale) {
            queryParams.append("locale", String(this.params.locale));
        }

        const url = `${this.buildEndpointUrl("search")}?${queryParams.toString()}`;
        const response = await requestUrl({
            url,
            headers: {
                Authorization: String(this.params.api_key || ""),
            },
        });
        return response.json;
    }

    // 精选图片请求
    private async fetchCuratedPhotos(page = this.currentPage) {
        const queryParams = new URLSearchParams();

        queryParams.append("page", String(page));
        queryParams.append("per_page", String(this.params.per_page || this.perPage));

        const url = `${this.buildEndpointUrl("curated")}?${queryParams.toString()}`;
        const response = await requestUrl({
            url,
            headers: {
                Authorization: String(this.params.api_key || ""),
            },
        });
        return response.json;
    }

    // 辅助方法：转换 API 返回的图片数据为 WallpaperImage
    private transformPhoto(photo: Record<string, unknown>): WallpaperImage {
        const src = (photo.src as Record<string, unknown>) || {};

        return {
            id: String(photo.id || ""),
            url: String(src.large || src.original || src.large2x || ""),
            width: Number(photo.width) || undefined,
            height: Number(photo.height) || undefined,
            author: String(photo.photographer || ""),
            description: String(photo.alt || ""),
            downloadUrl: String(src.original || src.large2x || src.large || ""),
        };
    }
}

// 注册 Pexels API
apiRegistry.register(WallpaperApiType.Pexels, PexelsApi);
