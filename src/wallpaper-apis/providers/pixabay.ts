/* Pixabay API 实现
 * 文档: https://pixabay.com/api/docs/
 */

import { Notice, requestUrl } from "obsidian";
import { logger } from "../../core/logger";
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

export class PixabayApi extends BaseWallpaperApi {
    type: WallpaperApiType = WallpaperApiType.Pixabay;

    perPage = 20; // 默认为20，最大200

    // ============================================================================
    // 静态方法 - 用于UI显示默认值
    // ============================================================================

    static getDefaultBaseUrl(): string {
        return "https://pixabay.com/api";
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        return {
            search: "/",
            videos: "/videos/",
        };
    }

    static getDefaultDescription(): string {
        return "Pixabay API for fetching royalty-free images and videos. Requires an API key for authentication.";
    }

    static getApiDocUrl(): string {
        return "https://pixabay.com/api/docs/";
    }

    static getTokenUrl(): string {
        return "https://pixabay.com/accounts/register/";
    }

    static getDefaultParams(): WallpaperApiParams {
        return {
            q: "",
            lang: "en",
            image_type: "all",
            orientation: "all",
            category: "",
            min_width: 0,
            min_height: 0,
            colors: "",
            editors_choice: false,
            safesearch: false,
            order: "popular",
            page: 1,
            per_page: 20,
        };
    }

    static getParamDescriptors(): WallpaperApiParamDescriptor[] {
        const defaultParams = PixabayApi.getDefaultParams();

        return [
            {
                key: "key",
                label: "API key",
                type: "password",
                required: true,
                placeholder: "Your Pixabay API key",
                description: "Required API key for Pixabay API authentication",
            },
            {
                key: "q",
                label: "Search query",
                type: "string",
                required: false,
                placeholder: "yellow flowers, nature, abstract...",
                description: "URL encoded search term. Max 100 characters.",
            },
            {
                key: "lang",
                label: "Language",
                type: "select",
                defaultValue: defaultParams.lang,
                description: "Language code for the search",
                options: [
                    { value: "cs", label: "Czech" },
                    { value: "da", label: "Danish" },
                    { value: "de", label: "German" },
                    { value: "en", label: "English" },
                    { value: "es", label: "Spanish" },
                    { value: "fr", label: "French" },
                    { value: "id", label: "Indonesian" },
                    { value: "it", label: "Italian" },
                    { value: "hu", label: "Hungarian" },
                    { value: "nl", label: "Dutch" },
                    { value: "no", label: "Norwegian" },
                    { value: "pl", label: "Polish" },
                    { value: "pt", label: "Portuguese" },
                    { value: "ro", label: "Romanian" },
                    { value: "sk", label: "Slovak" },
                    { value: "fi", label: "Finnish" },
                    { value: "sv", label: "Swedish" },
                    { value: "tr", label: "Turkish" },
                    { value: "vi", label: "Vietnamese" },
                    { value: "th", label: "Thai" },
                    { value: "bg", label: "Bulgarian" },
                    { value: "ru", label: "Russian" },
                    { value: "el", label: "Greek" },
                    { value: "ja", label: "Japanese" },
                    { value: "ko", label: "Korean" },
                    { value: "zh", label: "Chinese" },
                ],
            },
            {
                key: "image_type",
                label: "Image type",
                type: "select",
                defaultValue: defaultParams.image_type,
                description: "Filter results by image type",
                options: [
                    { value: "all", label: "All" },
                    { value: "photo", label: "Photo" },
                    { value: "illustration", label: "Illustration" },
                    { value: "vector", label: "Vector" },
                ],
            },
            {
                key: "orientation",
                label: "Orientation",
                type: "select",
                defaultValue: defaultParams.orientation,
                description: "Filter by image orientation",
                options: [
                    { value: "all", label: "All" },
                    { value: "horizontal", label: "Horizontal" },
                    { value: "vertical", label: "Vertical" },
                ],
            },
            {
                key: "category",
                label: "Category",
                type: "select",
                defaultValue: "",
                description: "Filter results by category",
                options: [
                    { value: "", label: "All categories" },
                    { value: "backgrounds", label: "Backgrounds" },
                    { value: "fashion", label: "Fashion" },
                    { value: "nature", label: "Nature" },
                    { value: "science", label: "Science" },
                    { value: "education", label: "Education" },
                    { value: "feelings", label: "Feelings" },
                    { value: "health", label: "Health" },
                    { value: "people", label: "People" },
                    { value: "religion", label: "Religion" },
                    { value: "places", label: "Places" },
                    { value: "animals", label: "Animals" },
                    { value: "industry", label: "Industry" },
                    { value: "computer", label: "Computer" },
                    { value: "food", label: "Food" },
                    { value: "sports", label: "Sports" },
                    { value: "transportation", label: "Transportation" },
                    { value: "travel", label: "Travel" },
                    { value: "buildings", label: "Buildings" },
                    { value: "business", label: "Business" },
                    { value: "music", label: "Music" },
                ],
            },
            {
                key: "colors",
                label: "Colors",
                type: "multiselect",
                defaultValue: "",
                description: "Filter images by color properties (comma-separated)",
                options: [
                    { value: "grayscale", label: "Grayscale" },
                    { value: "transparent", label: "Transparent" },
                    { value: "red", label: "Red" },
                    { value: "orange", label: "Orange" },
                    { value: "yellow", label: "Yellow" },
                    { value: "green", label: "Green" },
                    { value: "turquoise", label: "Turquoise" },
                    { value: "blue", label: "Blue" },
                    { value: "lilac", label: "Lilac" },
                    { value: "pink", label: "Pink" },
                    { value: "white", label: "White" },
                    { value: "gray", label: "Gray" },
                    { value: "black", label: "Black" },
                    { value: "brown", label: "Brown" },
                ],
            },
            {
                key: "min_width",
                label: "Minimum width",
                type: "number",
                defaultValue: defaultParams.min_width,
                description: "Minimum image width in pixels",
            },
            {
                key: "min_height",
                label: "Minimum height",
                type: "number",
                defaultValue: defaultParams.min_height,
                description: "Minimum image height in pixels",
            },
            {
                key: "editors_choice",
                label: "Editor's choice",
                type: "boolean",
                defaultValue: defaultParams.editors_choice,
                description: "Select images that have received an Editor's Choice award",
            },
            {
                key: "safesearch",
                label: "Safe search",
                type: "boolean",
                defaultValue: defaultParams.safesearch,
                description: "Only images suitable for all ages",
            },
            {
                key: "order",
                label: "Order by",
                type: "select",
                defaultValue: defaultParams.order,
                description: "How the results should be ordered",
                options: [
                    { value: "popular", label: "Popular" },
                    { value: "latest", label: "Latest" },
                ],
            },
            {
                key: "per_page",
                label: "Photos per page",
                type: "number",
                defaultValue: defaultParams.per_page,
                description: "Number of images per page (3-200)",
            },
            {
                key: "page",
                label: "Page number",
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
        if (!params.key) {
            valid = false;
            errors.push("API key is required for Pixabay API.");
        }

        // 验证 per_page 范围
        if (params.per_page && (Number(params.per_page) < 3 || Number(params.per_page) > 200)) {
            valid = false;
            errors.push("per_page must be between 3 and 200.");
        }

        // 验证搜索查询长度
        if (params.q && String(params.q).length > 100) {
            valid = false;
            errors.push("Search query cannot exceed 100 characters.");
        }

        // 验证最小尺寸
        if (params.min_width && Number(params.min_width) < 0) {
            valid = false;
            errors.push("min_width must be 0 or greater.");
        }

        if (params.min_height && Number(params.min_height) < 0) {
            valid = false;
            errors.push("min_height must be 0 or greater.");
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
            // 测试API连通性 - 获取第一页数据
            const response = await this.fetchSearchResults(1);

            if (!response || !response.hits || !Array.isArray(response.hits)) {
                logger.warn("Pixabay API initialization failed: Invalid response format.");
                return false;
            }

            // 更新分页信息（先更新 perPage，再计算 totalPages）
            this.perPage = Number(this.params.per_page) || 20;
            this.totalPages = response.totalHits ? Math.ceil(response.totalHits / this.perPage) : -1;
            this.totalCount = response.total ?? -1;

            new Notice(
                t("api_initialized_notice", {
                    apiName: this.name,
                    count: String(this.totalCount),
                    pages: String(this.totalPages),
                })
            );

            this.finishInit();
            return true;
        } catch (error) {
            logger.warn("Pixabay API initialization failed:", error);
            return false;
        }
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    protected async fetchPage(page: number): Promise<boolean> {
        try {
            const data = await this.fetchSearchResults(page);

            if (!data || !data.hits || !Array.isArray(data.hits)) {
                logger.warn("Invalid search response format from Pixabay API");
                return false;
            }

            // 更新分页信息
            this.totalPages = data.totalHits ? Math.ceil(data.totalHits / this.perPage) : -1;
            this.totalCount = data.total ?? -1;

            // 缓存当前页的数据
            this.wallpaperImageCache = data.hits.map((image: Record<string, unknown>) => this.transformImage(image));
            this.curDataIndex = 0;

            return true;
        } catch (error) {
            logger.warn("Error fetching search results from Pixabay API:", error);
            return false;
        }
    }

    // 搜索请求
    private async fetchSearchResults(page = this.currentPage) {
        const queryParams = new URLSearchParams();

        // 必需参数
        queryParams.append("key", String(this.params.key ?? ""));
        queryParams.append("page", String(page));
        queryParams.append("per_page", String(this.params.per_page ?? this.perPage));

        // 可选参数
        if (this.params.q) {
            queryParams.append("q", String(this.params.q));
        }
        if (this.params.lang) {
            queryParams.append("lang", String(this.params.lang));
        }
        if (this.params.image_type) {
            queryParams.append("image_type", String(this.params.image_type));
        }
        if (this.params.orientation) {
            queryParams.append("orientation", String(this.params.orientation));
        }
        if (this.params.category) {
            queryParams.append("category", String(this.params.category));
        }
        if (this.params.min_width && Number(this.params.min_width) > 0) {
            queryParams.append("min_width", String(this.params.min_width));
        }
        if (this.params.min_height && Number(this.params.min_height) > 0) {
            queryParams.append("min_height", String(this.params.min_height));
        }
        if (this.params.colors) {
            queryParams.append("colors", String(this.params.colors));
        }
        if (this.params.editors_choice) {
            queryParams.append("editors_choice", "true");
        }
        if (this.params.safesearch) {
            queryParams.append("safesearch", "true");
        }
        if (this.params.order) {
            queryParams.append("order", String(this.params.order));
        }

        const url = `${this.buildEndpointUrl("search")}?${queryParams.toString()}`;
        logger.debug(`Fetching Pixabay search results from: ${url}`);
        const response = await requestUrl({ url });
        return response.json;
    }

    // 辅助方法：转换 API 返回的图片数据为 WallpaperImage
    private transformImage(image: Record<string, unknown>): WallpaperImage {
        const tagsStr = this.safeString(image.tags);
        return {
            id: this.safeString(image.id),
            url:
                this.safeString(image.largeImageURL) ||
                this.safeString(image.fullHDURL) ||
                this.safeString(image.webformatURL),
            width: Number(image.imageWidth) || Number(image.webformatWidth) || undefined,
            height: Number(image.imageHeight) || Number(image.webformatHeight) || undefined,
            author: this.safeString(image.user),
            description: tagsStr,
            tags: tagsStr.split(", ").filter((tag) => tag.trim()),
            downloadUrl:
                this.safeString(image.imageURL) ||
                this.safeString(image.largeImageURL) ||
                this.safeString(image.fullHDURL),
        };
    }
}

// 注册 Pixabay API
apiRegistry.register(WallpaperApiType.Pixabay, PixabayApi);
