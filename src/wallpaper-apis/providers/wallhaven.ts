/* Wallhaven API 实现
 * 文档: https://wallhaven.cc/help/api
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

export class WallhavenApi extends BaseWallpaperApi {
    type: WallpaperApiType = WallpaperApiType.Wallhaven;

    perPage = 24; // 官方设定为24，不可更改

    // ============================================================================
    // 静态方法 - 用于UI显示默认值
    // ============================================================================

    static getDefaultBaseUrl(): string {
        return "https://wallhaven.cc/api/v1";
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        return {
            search: "/search",
            detail: "/w/{id}",
            tag: "/search/tags",
        };
    }

    static getDefaultDescription(): string {
        return "Wallhaven API for fetching wallpapers. Supports SFW, sketchy, and NSFW content. Categories include general, anime, and people.";
    }

    static getApiDocUrl(): string {
        return "https://wallhaven.cc/help/api";
    }

    static getTokenUrl(): string {
        return "https://wallhaven.cc/settings/account";
    }

    static getDefaultParams(): WallpaperApiParams {
        return {
            categories: "111", // general, anime, people
            purity: "100", // SFW only
            sorting: "random",
            order: "desc",
            topRange: "1M", // Last 1 month
            page: 1,
        };
    }

    static getParamDescriptors(): WallpaperApiParamDescriptor[] {
        const defaultParams = WallhavenApi.getDefaultParams();

        return [
            {
                key: "apikey",
                label: "API Key",
                type: "password",
                required: false,
                placeholder: "Your Wallhaven API key (optional)",
                description: "Required for NSFW content and higher rate limits",
            },
            {
                key: "q",
                label: "Search Query",
                type: "string",
                required: false,
                placeholder: "nature, landscape, abstract...",
                description: "Search keywords for wallpapers",
            },
            {
                key: "categories",
                label: "Categories",
                type: "multiselect",
                defaultValue: "111",
                description: "Select which categories to include",
                options: [
                    { value: "general", label: "General" },
                    { value: "anime", label: "Anime" },
                    { value: "people", label: "People" },
                ],
                toApiValue: (uiValue: string | number | boolean | string[]) => {
                    if (!Array.isArray(uiValue)) return defaultParams.categories as string;
                    let result = "";
                    result += uiValue.includes("general") ? "1" : "0";
                    result += uiValue.includes("anime") ? "1" : "0";
                    result += uiValue.includes("people") ? "1" : "0";
                    return result || (defaultParams.categories as string);
                },
                fromApiValue: (apiValue: string | number | boolean | string[]) => {
                    const str = apiValue?.toString() || (defaultParams.categories as string);
                    const result: string[] = [];
                    if (str[0] === "1") result.push("general");
                    if (str[1] === "1") result.push("anime");
                    if (str[2] === "1") result.push("people");
                    return result;
                },
            },
            {
                key: "purity",
                label: "Content Purity",
                type: "multiselect",
                defaultValue: "100",
                description: "Select content purity levels",
                options: [
                    { value: "sfw", label: "SFW (Safe for Work)" },
                    { value: "sketchy", label: "Sketchy" },
                    { value: "nsfw", label: "NSFW (18+)" },
                ],
                toApiValue: (uiValue: string | number | boolean | string[]) => {
                    if (!Array.isArray(uiValue)) return defaultParams.purity as string;
                    let result = "";
                    result += uiValue.includes("sfw") ? "1" : "0";
                    result += uiValue.includes("sketchy") ? "1" : "0";
                    result += uiValue.includes("nsfw") ? "1" : "0";
                    return result || (defaultParams.purity as string);
                },
                fromApiValue: (apiValue: string | number | boolean | string[]) => {
                    const str = apiValue?.toString() || (defaultParams.purity as string);
                    const result: string[] = [];
                    if (str[0] === "1") result.push("sfw");
                    if (str[1] === "1") result.push("sketchy");
                    if (str[2] === "1") result.push("nsfw");
                    return result;
                },
            },
            {
                key: "sorting",
                label: "Sort By",
                type: "select",
                defaultValue: defaultParams.sorting,
                description: "How to sort the results",
                options: [
                    { value: "date_added", label: "Date Added" },
                    { value: "relevance", label: "Relevance" },
                    { value: "random", label: "Random" },
                    { value: "views", label: "Views" },
                    { value: "favorites", label: "Favorites" },
                    { value: "toplist", label: "Top List" },
                ],
            },
            {
                key: "order",
                label: "Order",
                type: "select",
                defaultValue: defaultParams.order,
                description: "Order of the results",
                options: [
                    { value: "desc", label: "Descending" },
                    { value: "asc", label: "Ascending" },
                ],
            },
            {
                key: "topRange",
                label: "Top Range",
                type: "select",
                defaultValue: defaultParams.topRange,
                description: "Time range for top wallpapers",
                options: [
                    { value: "1W", label: "Last Week" },
                    { value: "1M", label: "Last Month" },
                    { value: "3M", label: "Last 3 Months" },
                    { value: "6M", label: "Last 6 Months" },
                    { value: "1Y", label: "Last Year" },
                    { value: "all", label: "All Time" },
                ],
            },
            {
                key: "atleast",
                label: "Minimum Resolution",
                type: "string",
                required: false,
                placeholder: "1920x1080",
                description: "Minimum resolution in WIDTHxHEIGHT format",
            },
            {
                key: "resolutions",
                label: "Resolutions",
                type: "string",
                required: false,
                placeholder: "1920x1080,2560x1440",
                description: "Comma-separated resolutions in WIDTHxHEIGHT format (e.g., 1920x1080,2560x1440)",
            },
            {
                key: "ratios",
                label: "Aspect Ratios",
                type: "string",
                required: false,
                placeholder: "16x9,16x10",
                description: "Comma-separated aspect ratios (e.g., 16x9,16x10,21x9)",
            },
            {
                key: "colors",
                label: "Colors",
                type: "string",
                required: false,
                placeholder: "660000,990000",
                description: "Comma-separated hex colors without # (e.g., 660000,990000)",
            },
            {
                key: "page",
                label: "Page Number",
                type: "number",
                defaultValue: defaultParams.page,
                description: "Page number to fetch",
            },
            {
                key: "seed",
                label: "Seed",
                type: "string",
                required: false,
                placeholder: "[a-zA-Z0-9]{6}",
                description: "Optional seed for random results",
            },
        ];
    }

    static validateParams(params: WallpaperApiParams): { valid: boolean; errors?: string[] } {
        let valid = true;
        const errors: string[] = [];

        // 验证 atleast 是否符合 WIDTHxHEIGHT 格式
        if (params.atleast && !/^\d+x\d+$/.test(String(params.atleast))) {
            valid = false;
            errors.push("Invalid resolution format for 'atleast'. Use WIDTHxHEIGHT.");
        }

        // 验证 resolutions 是否符合逗号分隔的 WIDTHxHEIGHT 格式
        if (params.resolutions) {
            const resolutions = String(params.resolutions).split(",");
            for (const res of resolutions) {
                if (!/^\d+x\d+$/.test(res)) {
                    valid = false;
                    errors.push("Invalid resolution format in 'resolutions'. Use WIDTHxHEIGHT.");
                    break;
                }
            }
        }

        // 验证 ratios 是否符合逗号分隔的 WIDTHxHEIGHT 格式
        if (params.ratios) {
            const ratios = String(params.ratios).split(",");
            for (const ratio of ratios) {
                if (!/^\d+x\d+$/.test(ratio)) {
                    valid = false;
                    errors.push("Invalid aspect ratio format in 'ratios'. Use WIDTHxHEIGHT.");
                    break;
                }
            }
        }

        // 验证 colors 是否符合逗号分隔的十六进制颜色格式
        if (params.colors) {
            const colors = String(params.colors).split(",");
            for (const color of colors) {
                if (!/^[0-9a-fA-F]{6}$/.test(color)) {
                    valid = false;
                    errors.push("Invalid color format in 'colors'. Use 6-digit hex without #.");
                    break;
                }
            }
        }

        // 验证 seed 是否符合 [a-zA-Z0-9]{6} 格式
        if (params.seed && !/^[a-zA-Z0-9]{6}$/.test(String(params.seed))) {
            valid = false;
            errors.push("Invalid seed format. Use exactly 6 alphanumeric characters.");
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

        // 拉取第一页数据用于测试连通性
        const resp = await this.fetchSearchResults(1);
        if (!resp) {
            console.warn("Wallhaven API initialization failed: No response from search endpoint.");
            return false;
        }

        // 填充 totalPages、totalCount 等状态
        const meta = resp.meta;
        if (!meta) {
            console.warn("Wallhaven API response missing meta information.");
            return false;
        }
        this.totalPages = meta.last_page || -1;
        this.totalCount = meta.total || -1;
        this.perPage = meta.per_page || -1;
        if (this.totalPages <= 0 || this.totalCount < 0 || this.perPage <= 0) {
            console.warn("Wallhaven API response has invalid pagination data.");
            return false;
        }

        // 初始化数据缓存
        this.wallpaperImageCache = [];
        this.curDataIndex = 0;
        this.currentPage = 1;

        this.initialized = true;
        return true;
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
        const success = await this.fetchAndCachePageImages(this.currentPage);
        if (success) {
            this.currentPage += 1;
        }
        return success;
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    // 拉取指定页码的壁纸数据并缓存到 wallpaperImageCache
    private async fetchAndCachePageImages(page = this.currentPage): Promise<boolean> {
        try {
            const data = await this.fetchSearchResults(page);

            if (!data.data || !Array.isArray(data.data)) {
                console.warn("Invalid API response format from Wallhaven");
                return false;
            }
            // 为避免爆内存，这里应仅缓存当前页的数据
            this.wallpaperImageCache = data.data.map((img: Record<string, unknown>) => this.transformImage(img));
            return true;
        } catch (error) {
            console.warn(`Error fetching images from Wallhaven API:`, error);
            return false;
        }
    }

    // 搜索请求, 返回 response.json
    private async fetchSearchResults(page = this.currentPage) {
        const url = `${this.buildEndpointUrl("search")}?${this.buildQuery({ ...this.params, page })}`;
        const response = await requestUrl({ url });
        return response.json;
    }

    // 辅助方法：转换 API 返回的图片数据为 WallpaperImage
    private transformImage(apiImage: Record<string, unknown>): WallpaperImage {
        return {
            id: String(apiImage.id || ""),
            url: String(apiImage.path || ""),
            width: Number(apiImage.dimension_x) || undefined,
            height: Number(apiImage.dimension_y) || undefined,
        };
    }
}

// 注册 Wallhaven API
apiRegistry.register(WallpaperApiType.Wallhaven, WallhavenApi);
