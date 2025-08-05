/**
 * 壁纸API基础类
 * 简化设计：移除接口冗余，只保留必要的抽象类
 */

import type {
    WallpaperApiConfig,
    WallpaperApiEndpoints,
    WallpaperApiParamDescriptor,
    WallpaperApiParams,
    WallpaperApiType,
    WallpaperImage,
} from "./types";

/**
 * 壁纸API实例的基础类
 * 通过抽象类提供所有必要的约束，无需额外接口
 */
export abstract class BaseWallpaperApi {
    // ============================================================================
    // 基础属性
    // ============================================================================

    // 实例标识和配置
    protected readonly id: string;
    protected readonly name: string;
    protected readonly description: string;
    protected readonly type: WallpaperApiType;
    protected readonly config: WallpaperApiConfig; // API实例配置的引用

    // API连接配置
    protected readonly baseUrl: string;
    protected readonly endpoints: WallpaperApiEndpoints;
    protected readonly params: WallpaperApiParams;

    // 状态管理
    protected enabled = false;
    protected initialized = false;

    // ============================================================================
    // 数据缓存相关
    // ============================================================================

    protected wallpaperImageCache: WallpaperImage[] = []; // 为避免爆内存，这里应仅缓存当前页的数据
    protected curDataIndex = 0;
    protected currentPage = 1;
    protected totalPages = -1;
    protected totalCount = -1;

    constructor(config: WallpaperApiConfig) {
        this.config = config;
        this.id = config.id;
        this.name = config.name;
        this.type = config.type;
        this.description = config.description || (this.constructor as typeof BaseWallpaperApi).getDefaultDescription();
        this.baseUrl = config.baseUrl || (this.constructor as typeof BaseWallpaperApi).getDefaultBaseUrl();
        this.endpoints = {
            ...(this.constructor as typeof BaseWallpaperApi).getDefaultEndpoints(),
            ...config.endpoints,
        };
        this.params = {
            ...(this.constructor as typeof BaseWallpaperApi).getDefaultParams(),
            ...config.params,
        };
        this.saveConfig();
    }

    // ============================================================================
    // 抽象方法 - 子类必须实现
    // ============================================================================

    abstract init(): Promise<boolean>; // 启用插件时必须调用
    abstract deinit(): Promise<boolean>; // 禁用插件时必须调用
    abstract updateImageCache(): Promise<boolean>; // 更新图片缓存数据 wallpaperImageCache

    // ============================================================================
    // 静态方法 - 基类中抛出错误的方法，子类必须实现
    // ============================================================================

    static getDefaultBaseUrl(): string {
        throw new Error("getDefaultBaseUrl must be implemented by subclass");
    }

    static getDefaultEndpoints(): WallpaperApiEndpoints {
        throw new Error("getDefaultEndpoints must be implemented by subclass");
    }

    static getDefaultDescription(): string {
        return "No description provided.";
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

    static validateParams(params: WallpaperApiParams): { valid: boolean; errors?: string[] } {
        return { valid: true };
    }

    // ============================================================================
    // 基础信息获取方法
    // ============================================================================

    getId(): string {
        return this.id;
    }

    getName(): string {
        return this.name;
    }

    getDescription(): string {
        return this.description;
    }

    getType(): WallpaperApiType {
        return this.type;
    }

    getConfig(): WallpaperApiConfig {
        return this.config;
    }

    getParams(): WallpaperApiParams {
        return { ...this.params };
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getEndpoints(): WallpaperApiEndpoints {
        return { ...this.endpoints };
    }

    // ============================================================================
    // 状态管理方法
    // ============================================================================

    getEnabled(): boolean {
        return this.enabled;
    }

    async tryEnable(): Promise<boolean> {
        if (this.enabled) {
            return true;
        }

        try {
            const success = await this.init();
            if (success) {
                this.enabled = true;
            }
            return success;
        } catch (error) {
            console.error(`Failed to enable API "${this.name}":`, error);
            return false;
        }
    }

    async tryDisable(): Promise<boolean> {
        if (!this.enabled) {
            return true;
        }

        try {
            const success = await this.deinit();
            if (success) {
                this.enabled = false;
            }
            return success;
        } catch (error) {
            console.error(`Failed to disable API "${this.name}":`, error);
            return false;
        }
    }

    // ============================================================================
    // 工具方法
    // ============================================================================

    protected saveConfig(): void {
        // 将 api 的配置同步过到 config 中
        this.config.baseUrl = this.baseUrl;
        this.config.endpoints = this.endpoints;
        this.config.params = this.params;
    }

    protected buildEndpointUrl(endpointKey: string, pathParams?: Record<string, string>): string {
        const endpoint = this.endpoints[endpointKey];
        if (!endpoint) {
            throw new Error(`Endpoint '${endpointKey}' not found`);
        }

        let url = `${this.baseUrl}${endpoint}`;

        // 替换路径参数 (如: /w/{id} -> /w/123)
        if (pathParams) {
            Object.entries(pathParams).forEach(([key, value]) => {
                url = url.replace(`{${key}}`, encodeURIComponent(value));
            });
        }

        return url;
    }

    // 辅助方法：构建查询字符串
    protected buildQuery(params: WallpaperApiParams = this.params): string {
        return Object.entries(params)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => {
                const encodedKey = encodeURIComponent(key);
                const encodedValue = Array.isArray(value)
                    ? encodeURIComponent(value.join(","))
                    : encodeURIComponent(String(value));
                return `${encodedKey}=${encodedValue}`;
            })
            .join("&");
    }

    // ============================================================================
    // 核心业务方法
    // ============================================================================

    async getImages(imageNum = 1): Promise<WallpaperImage[] | null> {
        const images: WallpaperImage[] = [];

        while (images.length < imageNum) {
            const remaining = imageNum - images.length;
            const available = this.wallpaperImageCache.length - this.curDataIndex;

            if (available > 0) {
                const slice = this.wallpaperImageCache.slice(this.curDataIndex, this.curDataIndex + remaining);
                images.push(...slice);
                this.curDataIndex += slice.length;
            }

            if (images.length < imageNum) {
                await this.updateImageCache();
                if (this.wallpaperImageCache.length === 0) {
                    break; // 没有更多图片了
                }
                this.curDataIndex = 0;
            }
        }

        return images.length > 0 ? images : null;
    }
}
