/* 360壁纸API实现
 * 基于360壁纸API文档实现
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

// 360壁纸API响应接口
interface Qihoo360CategoryResponse {
    errno: string;
    errmsg: string;
    total: string;
    data: Array<{
        id: string;
        name: string;
        order_num: string;
        tag: string;
        create_time: string;
    }>;
}

interface Qihoo360WallpaperResponse {
    errno: string;
    errmsg: string;
    total: string;
    data: Array<{
        pid?: string;
        id?: string;
        cid: string;
        url: string;
        fav_total?: string;
        utag?: string;
        resolution?: string;
        url_mobile?: string;
        url_thumb?: string;
        url_mid?: string;
        img_1920_1080?: string;
        img_1600_900?: string;
        img_1440_900?: string;
        img_1366_768?: string;
        img_1280_800?: string;
        img_1280_1024?: string;
        img_1024_768?: string;
        img_800_600?: string;
        img_640_480?: string;
        // 支持更多分辨率字段
        [key: string]: any;
    }>;
}

interface Qihoo360HotSearchResponse {
    error: number;
    total: number;
    data: string[];
}

export class Qihoo360Api extends BaseWallpaperApi {
    type: WallpaperApiType = WallpaperApiType.Qihoo360;

    perPage = 24; // 更改为24，符合360官方推荐

    // 缓存类别数据
    private categoriesCache: Array<{ id: string; name: string; order_num: string; tag: string; create_time: string }> =
        [];
    private hotSearchCache: string[] = [];

    // ============================================================================
    // 静态方法 - 用于UI显示默认值
    // ============================================================================

    static getDefaultBaseUrl(): string {
        return "http://wallpaper.apc.360.cn";
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        return {
            categories: "/index.php?c=WallPaperAndroid&a=getAllCategories",
            categoriesV2: "/index.php?c=WallPaper&a=getAllCategoriesV2&from=360chrome",
            search: "/index.php?c=WallPaper&a=search",
            category: "/index.php?c=WallPaperAndroid&a=getAppsByCategory",
            newest: "/index.php?c=WallPaper&a=getAppsByOrder&order=create_time&from=360chrome",
            hotSearch: "http://openbox.mobilem.360.cn/html/api/wallpaperhot.html",
        };
    }

    static getDefaultDescription(): string {
        return "360壁纸API，提供丰富的高质量壁纸资源，包括风景、美女、动漫、游戏等多个分类。";
    }

    static getApiDocUrl(): string {
        return "";
    }

    static getTokenUrl(): string {
        return "";
    }

    static getDefaultParams(): WallpaperApiParams {
        return {
            cid: "9", // 默认风景类别
            start: 0,
            count: 24, // 更改为24，符合360官方推荐
            kw: "", // 搜索关键词
            from: "360chrome", // 添加来源参数
            order: "create_time", // 排序方式
        };
    }

    static getParamDescriptors(): WallpaperApiParamDescriptor[] {
        const defaultParams = Qihoo360Api.getDefaultParams();

        return [
            {
                key: "searchMode",
                label: "搜索模式",
                type: "select",
                defaultValue: "category",
                description: "选择获取壁纸的方式",
                options: [
                    { value: "category", label: "按分类浏览" },
                    { value: "search", label: "关键词搜索" },
                    { value: "newest", label: "最新壁纸" },
                ],
            },
            {
                key: "cid",
                label: "壁纸分类",
                type: "select",
                defaultValue: defaultParams.cid,
                description: "选择壁纸分类",
                options: [
                    { value: "36", label: "4K专区" },
                    { value: "6", label: "美女模特" },
                    { value: "30", label: "爱情美图" },
                    { value: "9", label: "风景大片" },
                    { value: "15", label: "小清新" },
                    { value: "26", label: "动漫卡通" },
                    { value: "11", label: "明星风尚" },
                    { value: "14", label: "萌宠动物" },
                    { value: "5", label: "游戏壁纸" },
                    { value: "12", label: "汽车天下" },
                    { value: "10", label: "炫酷时尚" },
                    { value: "29", label: "月历壁纸" },
                    { value: "7", label: "影视剧照" },
                    { value: "13", label: "节日美图" },
                    { value: "22", label: "军事天地" },
                    { value: "16", label: "劲爆体育" },
                    { value: "18", label: "BABY秀" },
                    { value: "35", label: "文字控" },
                ],
            },
            {
                key: "kw",
                label: "搜索关键词",
                type: "string",
                required: false,
                placeholder: "风景, 动漫, 美女...",
                description: "搜索关键词，仅在搜索模式下使用",
            },
            {
                key: "count",
                label: "每页数量",
                type: "number",
                defaultValue: defaultParams.count,
                description: "每次获取的壁纸数量 (建议: 12-48，360官方推荐24)",
            },
            {
                key: "preferredResolution",
                label: "首选分辨率",
                type: "select",
                defaultValue: "auto",
                description: "优先选择的图片分辨率",
                options: [
                    { value: "auto", label: "自动选择最佳" },
                    { value: "1920x1080", label: "1920x1080" },
                    { value: "1600x900", label: "1600x900" },
                    { value: "1440x900", label: "1440x900" },
                    { value: "1366x768", label: "1366x768" },
                    { value: "1280x800", label: "1280x800" },
                    { value: "1280x1024", label: "1280x1024" },
                    { value: "1024x768", label: "1024x768" },
                ],
            },
        ];
    }

    static validateParams(params: WallpaperApiParams): { valid: boolean; errors?: string[] } {
        let valid = true;
        const errors: string[] = [];

        // 验证 count 范围
        if (params.count && (Number(params.count) < 1 || Number(params.count) > 100)) {
            valid = false;
            errors.push("每页数量必须在1到100之间。");
        }

        // 验证搜索模式
        const searchMode = params.searchMode;
        if (searchMode === "search" && !params.kw) {
            valid = false;
            errors.push("搜索模式下必须提供搜索关键词。");
        }

        // 验证分类ID（仅在分类模式下）
        if (searchMode === "category" && params.cid) {
            const validCids = [
                "5",
                "6",
                "7",
                "9",
                "10",
                "11",
                "12",
                "13",
                "14",
                "15",
                "16",
                "18",
                "22",
                "26",
                "29",
                "30",
                "35",
                "36",
            ];
            if (!validCids.includes(String(params.cid))) {
                valid = false;
                errors.push("无效的分类ID。");
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
            // 初始化时加载分类数据
            await this.loadCategories();
            await this.loadHotSearch();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error("360壁纸API初始化失败:", error);
            new Notice(t("notice_api_failed_enable_disable", { action: "启用", apiName: this.name }));
            return false;
        }
    }

    async deinit(): Promise<boolean> {
        this.initialized = false;
        this.categoriesCache = [];
        this.hotSearchCache = [];
        return true;
    }

    async updateImageCache(): Promise<boolean> {
        try {
            const searchMode = this.params.searchMode || "category";
            let wallpapers: WallpaperImage[] = [];

            if (searchMode === "search") {
                wallpapers = await this.searchWallpapers();
            } else if (searchMode === "newest") {
                wallpapers = await this.getNewestWallpapers();
            } else {
                wallpapers = await this.getCategoryWallpapers();
            }

            if (wallpapers.length > 0) {
                // 清空当前缓存，添加新数据
                this.wallpaperImageCache = wallpapers;
                this.curDataIndex = 0;
                return true;
            } else {
                console.warn("360壁纸API: 未获取到壁纸数据");
                return false;
            }
        } catch (error) {
            console.error("360壁纸API更新缓存失败:", error);
            new Notice(t("notice_api_failed_fetch", { apiName: this.name }));
            return false;
        }
    }

    // ============================================================================
    // 私有方法
    // ============================================================================

    /**
     * 加载壁纸分类
     */
    private async loadCategories(): Promise<void> {
        try {
            const url = this.buildEndpointUrl("categories");
            console.debug("360壁纸API: 获取分类列表", url);

            const response = await requestUrl({
                url: url,
                method: "GET",
            });

            const data: Qihoo360CategoryResponse = response.json;

            if (data.errno === "0" && data.data) {
                this.categoriesCache = data.data;
                console.debug(`360壁纸API: 成功加载${data.data.length}个分类`);
            } else {
                throw new Error(`API返回错误: ${data.errmsg}`);
            }
        } catch (error) {
            console.error("360壁纸API: 加载分类失败", error);
            throw error;
        }
    }

    /**
     * 加载热门搜索
     */
    private async loadHotSearch(): Promise<void> {
        try {
            // 热门搜索API使用不同的域名，直接使用完整URL
            const url = this.endpoints.hotSearch;
            if (!url) {
                throw new Error("hotSearch endpoint not configured");
            }
            console.debug("360壁纸API: 获取热门搜索", url);

            const response = await requestUrl({
                url: url,
                method: "GET",
            });

            const data: Qihoo360HotSearchResponse = response.json;

            if (data.error === 0 && data.data) {
                this.hotSearchCache = data.data;
                console.debug(`360壁纸API: 成功加载${data.data.length}个热门搜索词`);
            }
        } catch (error) {
            console.error("360壁纸API: 加载热门搜索失败", error);
            // 热门搜索加载失败不影响主要功能
        }
    }

    /**
     * 获取最新壁纸
     */
    private async getNewestWallpapers(): Promise<WallpaperImage[]> {
        const params = new URLSearchParams({
            c: "WallPaper",
            a: "getAppsByOrder",
            order: "create_time",
            start: String(this.params.start || 0),
            count: String(this.params.count || 24),
            from: "360chrome",
        });

        const url = `${this.baseUrl}/index.php?${params.toString()}`;
        console.debug("360壁纸API: 获取最新壁纸", url);

        const response = await requestUrl({
            url: url,
            method: "GET",
        });

        const data: Qihoo360WallpaperResponse = response.json;

        if (data.errno === "0" && data.data) {
            return data.data.map((item, index) => this.convertToWallpaperImage(item, index));
        } else {
            throw new Error(`API返回错误: ${data.errmsg}`);
        }
    }

    /**
     * 按分类获取壁纸
     */
    private async getCategoryWallpapers(): Promise<WallpaperImage[]> {
        const params = new URLSearchParams({
            c: "WallPaperAndroid",
            a: "getAppsByCategory",
            cid: String(this.params.cid || "9"),
            start: String(this.params.start || 0),
            count: String(this.params.count || 24),
            from: "360chrome",
        });

        const url = `${this.baseUrl}/index.php?${params.toString()}`;
        console.debug("360壁纸API: 获取分类壁纸", url);

        const response = await requestUrl({
            url: url,
            method: "GET",
        });

        const data: Qihoo360WallpaperResponse = response.json;

        if (data.errno === "0" && data.data) {
            return data.data.map((item, index) => this.convertToWallpaperImage(item, index));
        } else {
            throw new Error(`API返回错误: ${data.errmsg}`);
        }
    }

    /**
     * 搜索壁纸
     */
    private async searchWallpapers(): Promise<WallpaperImage[]> {
        const keyword = this.params.kw;
        if (!keyword) {
            throw new Error("搜索关键词不能为空");
        }

        const params = new URLSearchParams({
            c: "WallPaper",
            a: "search",
            kw: String(keyword),
            start: String(this.params.start || 0),
            count: String(this.params.count || 24),
            from: "360chrome",
        });

        const url = `${this.baseUrl}/index.php?${params.toString()}`;
        console.debug("360壁纸API: 搜索壁纸", url);

        const response = await requestUrl({
            url: url,
            method: "GET",
        });

        const data: Qihoo360WallpaperResponse = response.json;

        if (data.errno === "0" && data.data) {
            return data.data.map((item, index) => this.convertToWallpaperImage(item, index));
        } else {
            throw new Error(`API返回错误: ${data.errmsg}`);
        }
    }

    /**
     * 转换API响应为WallpaperImage格式
     */
    private convertToWallpaperImage(item: any, index: number): WallpaperImage {
        // 获取首选分辨率设置
        const preferredResolution = this.params.preferredResolution || "auto";
        let imageUrl = item.url;

        // 根据首选分辨率或自动选择最佳图片
        if (preferredResolution !== "auto") {
            const resField = `img_${String(preferredResolution).replace("x", "_")}`;
            if (item[resField]) {
                imageUrl = item[resField];
            }
        } else {
            // 自动选择最佳分辨率（从高到低）
            const resolutionFields = [
                "img_1920_1080",
                "img_1600_900",
                "img_1440_900",
                "img_1366_768",
                "img_1280_1024",
                "img_1280_800",
                "img_1024_768",
                "img_800_600",
                "url_mobile",
            ];

            for (const field of resolutionFields) {
                if (item[field] && item[field] !== "no_data") {
                    imageUrl = item[field];
                    break;
                }
            }
        }

        // 应用URL解码（参考第一个仓库的实现）
        imageUrl = this.decode360Url(imageUrl);

        // 解析分辨率
        let width: number | undefined;
        let height: number | undefined;
        if (item.resolution) {
            const [w, h] = item.resolution.split("x").map(Number);
            width = w;
            height = h;
        }

        // 解析标签（参考第一个仓库的实现）
        let tags: string[] = [];
        if (item.utag) {
            tags = item.utag.split(" ").filter((tag: string) => tag.trim().length > 0);
        } else if (item.tag) {
            // 处理来自旧API的tag格式
            tags = this.decode360Tag(item.tag);
        }

        // 找到分类名称
        const category = this.categoriesCache.find((cat) => cat.id === item.cid);
        const categoryName = category ? category.name : `分类${item.cid}`;

        return {
            id: item.pid || item.id || `360-${Date.now()}-${index}`,
            url: imageUrl,
            author: "360壁纸",
            description: tags.length > 0 ? tags.join(", ") : categoryName,
            tags: tags.length > 0 ? tags : [categoryName],
            width: width,
            height: height,
            downloadUrl: imageUrl,
        };
    }

    /**
     * 获取分类列表（供外部调用）
     */
    getCategories(): Array<{ id: string; name: string; order_num: string; tag: string; create_time: string }> {
        return this.categoriesCache;
    }

    /**
     * 获取热门搜索词（供外部调用）
     */
    getHotSearchTerms(): string[] {
        return this.hotSearchCache;
    }

    /**
     * 解码360图片的链接，获得指定尺寸图片
     * 参考: https://github.com/mengkunsoft/wallpaper
     */
    private decode360Url(oldUrl: string, width = 0, height = 0, quality = 100): string {
        let newUrl = oldUrl;

        // 如果指定了宽高，则替换为相应的缩略图URL
        if (width > 0 && height > 0) {
            newUrl = oldUrl.replace("r/__85", `m/${width}_${height}_${quality}`);
        }

        // 强制使用HTTPS
        newUrl = newUrl.replace(/http:\/\//g, "https://");

        return newUrl;
    }

    /**
     * 解码360API获取的tag标签
     * 参考: https://github.com/mengkunsoft/wallpaper
     */
    private decode360Tag(oldTag: string): string[] {
        if (!oldTag) return [];

        // 匹配 _category_xxx_ 格式的标签
        const matches = oldTag.match(/_category_[^_]+_/g);
        if (matches) {
            return matches.map((match) => match.replace(/_category_([^_]+)_/g, "$1"));
        }

        // 如果没有匹配到，尝试简单的空格分隔
        return oldTag.split(" ").filter((tag) => tag.trim().length > 0);
    }
}

// 注册到API注册表
apiRegistry.register(WallpaperApiType.Qihoo360, Qihoo360Api);
