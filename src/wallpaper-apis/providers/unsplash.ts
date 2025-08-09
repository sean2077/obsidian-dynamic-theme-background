/* Unsplash API 实现
 * 文档: https://unsplash.com/documentation
 */

import { Notice, requestUrl } from "obsidian";
import { t } from "../../i18n";
import {
    apiRegistry,
    BaseWallpaperApi,
    WallpaperApiEndpoints,
    WallpaperApiParamDescriptor,
    WallpaperApiParams,
    WallpaperApiType,
    WallpaperImage,
} from "../core";

export class UnsplashApi extends BaseWallpaperApi {
    type: WallpaperApiType = WallpaperApiType.Unsplash;

    perPage = 10; // 默认为10，最大30

    // ============================================================================
    // 静态方法 - 用于UI显示默认值
    // ============================================================================

    static getDefaultBaseUrl(): string {
        return "https://api.unsplash.com";
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        return {
            search: "/search/photos",
            detail: "/photos/{id}",
            random: "/photos/random",
        };
    }

    static getDefaultDescription(): string {
        return "Unsplash API for fetching high-quality photos. Requires an access key for authentication.";
    }

    static getApiDocUrl(): string {
        return "https://unsplash.com/documentation";
    }

    static getTokenUrl(): string {
        return "https://unsplash.com/oauth/applications";
    }

    static getDefaultParams(): WallpaperApiParams {
        return {
            query: "",
            page: 1,
            per_page: 10,
            order_by: "relevant",
            orientation: "",
            color: "",
            content_filter: "low",
        };
    }

    static getParamDescriptors(): WallpaperApiParamDescriptor[] {
        const defaultParams = UnsplashApi.getDefaultParams();

        return [
            {
                key: "client_id",
                label: "Access Key",
                type: "password",
                required: true,
                placeholder: "Your Unsplash access key",
                description: "Required access key for Unsplash API authentication",
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
                key: "order_by",
                label: "Order By",
                type: "select",
                defaultValue: defaultParams.order_by,
                description: "How to sort the search results",
                options: [
                    { value: "relevant", label: "Relevance" },
                    { value: "latest", label: "Latest" },
                ],
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
                    { value: "squarish", label: "Squarish" },
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
                    { value: "black_and_white", label: "Black and White" },
                    { value: "black", label: "Black" },
                    { value: "white", label: "White" },
                    { value: "yellow", label: "Yellow" },
                    { value: "orange", label: "Orange" },
                    { value: "red", label: "Red" },
                    { value: "purple", label: "Purple" },
                    { value: "magenta", label: "Magenta" },
                    { value: "green", label: "Green" },
                    { value: "teal", label: "Teal" },
                    { value: "blue", label: "Blue" },
                ],
            },
            {
                key: "content_filter",
                label: "Content Filter",
                type: "select",
                defaultValue: defaultParams.content_filter,
                description: "Limit results by content safety",
                options: [
                    { value: "low", label: "Low (Default)" },
                    { value: "high", label: "High (More restrictive)" },
                ],
            },
            {
                key: "collections",
                label: "Collections",
                type: "string",
                required: false,
                placeholder: "123,456,789",
                description: "Comma-separated collection IDs to narrow search",
            },
            {
                key: "per_page",
                label: "Photos Per Page",
                type: "number",
                defaultValue: defaultParams.per_page,
                description: "Number of photos per page (max 30)",
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

        // 验证 access key 是否存在
        if (!params.client_id) {
            valid = false;
            errors.push("Access key (client_id) is required for Unsplash API.");
        }

        // 验证 per_page 范围
        if (params.per_page && (Number(params.per_page) < 1 || Number(params.per_page) > 30)) {
            valid = false;
            errors.push("per_page must be between 1 and 30.");
        }

        // 验证 collections 格式（逗号分隔的数字）
        if (params.collections) {
            const collections = String(params.collections).split(",");
            for (const collection of collections) {
                if (!/^\d+$/.test(collection.trim())) {
                    valid = false;
                    errors.push("Collections must be comma-separated numeric IDs.");
                    break;
                }
            }
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
            // 测试API连通性 - 获取随机图片
            const response = await this.fetchRandomPhotos(1);
            if (!response || !Array.isArray(response) || response.length === 0) {
                console.warn("Unsplash API initialization failed: No response from random endpoint.");
                return false;
            }

            // 如果有搜索查询，则获取搜索结果的分页信息
            if (this.params.query) {
                const searchResp = await this.fetchSearchResults(1);
                if (!searchResp) {
                    console.warn("Unsplash API initialization failed: No response from search endpoint.");
                    return false;
                }
                this.totalPages = searchResp.total_pages ?? -1;
                this.totalCount = searchResp.total ?? -1;
            } else {
                // 对于随机图片，我们无法预知总数，设置为无限模式
                this.totalPages = -1;
                this.totalCount = -1;
            }

            new Notice(
                t("api_initialized_notice", {
                    apiName: this.name,
                    count: String(this.totalCount),
                    pages: String(this.totalPages),
                })
            );

            this.perPage = Number(this.params.per_page) ?? 10;

            // 初始化数据缓存
            this.wallpaperImageCache = [];
            this.curDataIndex = 0;
            this.currentPage = 1;

            this.initialized = true;
            return true;
        } catch (error) {
            console.warn("Unsplash API initialization failed:", error);
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
        // 如果有搜索查询，使用搜索接口
        if (this.params.query) {
            // 如果已经到最后一页了，跳到第一页
            if (this.totalPages > 0 && this.currentPage > this.totalPages) {
                this.currentPage = 1;
            }
            const success = await this.fetchAndCacheSearchResults(this.currentPage);
            if (success) {
                this.currentPage += 1;
            }
            return success;
        } else {
            // 没有搜索查询，使用随机图片接口
            return await this.fetchAndCacheRandomPhotos();
        }
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    // 拉取搜索结果并缓存
    private async fetchAndCacheSearchResults(page = this.currentPage): Promise<boolean> {
        try {
            const data = await this.fetchSearchResults(page);

            if (!data || !data.results || !Array.isArray(data.results)) {
                console.warn("Invalid search response format from Unsplash API");
                return false;
            }

            // 更新分页信息
            this.totalPages = data.total_pages ?? -1;
            this.totalCount = data.total ?? -1;

            // 缓存当前页的数据
            this.wallpaperImageCache = data.results.map((photo: Record<string, unknown>) => this.transformPhoto(photo));
            this.curDataIndex = 0;

            return true;
        } catch (error) {
            console.warn(`Error fetching search results from Unsplash API:`, error);
            return false;
        }
    }

    // 拉取随机图片并缓存
    private async fetchAndCacheRandomPhotos(): Promise<boolean> {
        try {
            const photos = await this.fetchRandomPhotos(this.perPage);

            if (!photos || !Array.isArray(photos)) {
                console.warn("Invalid random photos response format from Unsplash API");
                return false;
            }

            // 缓存随机图片数据
            this.wallpaperImageCache = photos.map((photo: Record<string, unknown>) => this.transformPhoto(photo));
            this.curDataIndex = 0;

            return true;
        } catch (error) {
            console.warn(`Error fetching random photos from Unsplash API:`, error);
            return false;
        }
    }

    // 搜索请求
    private async fetchSearchResults(page = this.currentPage) {
        const queryParams = new URLSearchParams();

        // 必需参数
        queryParams.append("client_id", String(this.params.client_id ?? ""));
        queryParams.append("query", String(this.params.query ?? ""));
        queryParams.append("page", String(page));
        queryParams.append("per_page", String(this.params.per_page ?? this.perPage));

        // 可选参数
        if (this.params.order_by) {
            queryParams.append("order_by", String(this.params.order_by));
        }
        if (this.params.orientation) {
            queryParams.append("orientation", String(this.params.orientation));
        }
        if (this.params.color) {
            queryParams.append("color", String(this.params.color));
        }
        if (this.params.content_filter) {
            queryParams.append("content_filter", String(this.params.content_filter));
        }
        if (this.params.collections) {
            queryParams.append("collections", String(this.params.collections));
        }

        const url = `${this.buildEndpointUrl("search")}?${queryParams.toString()}`;
        console.debug(`Fetching Unsplash search results from: ${url}`);
        const response = await requestUrl({ url });
        return response.json;
    }

    // 随机图片请求
    private async fetchRandomPhotos(count = 1) {
        const queryParams = new URLSearchParams();

        // 必需参数
        queryParams.append("client_id", String(this.params.client_id ?? ""));
        queryParams.append("count", String(count));

        // 可选参数
        if (this.params.query) {
            queryParams.append("query", String(this.params.query));
        }
        if (this.params.orientation) {
            queryParams.append("orientation", String(this.params.orientation));
        }
        if (this.params.content_filter) {
            queryParams.append("content_filter", String(this.params.content_filter));
        }
        if (this.params.collections) {
            queryParams.append("collections", String(this.params.collections));
        }

        const url = `${this.buildEndpointUrl("random")}?${queryParams.toString()}`;
        console.debug(`Fetching Unsplash random photos from: ${url}`);
        const response = await requestUrl({ url });
        return response.json;
    }

    // 辅助方法：转换 API 返回的图片数据为 WallpaperImage
    private transformPhoto(photo: Record<string, unknown>): WallpaperImage {
        const user = (photo.user as Record<string, unknown>) ?? {};
        const urls = (photo.urls as Record<string, unknown>) ?? {};

        return {
            id: String(photo.id ?? ""),
            url: String(urls.regular || urls.full || urls.raw || ""),
            width: Number(photo.width) || undefined,
            height: Number(photo.height) || undefined,
            author: String(user.name || user.username || ""),
            description: String(photo.description || photo.alt_description || ""),
            downloadUrl: String(urls.full || urls.raw || ""),
        };
    }
}

// 注册 Unsplash API
apiRegistry.register(WallpaperApiType.Unsplash, UnsplashApi);
