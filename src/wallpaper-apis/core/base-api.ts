/**
 * 壁纸API基础类
 * 简化设计：移除接口冗余，只保留必要的抽象类
 */

import { logger } from "../../core/logger";
import { generateId } from "../../utils/utils";
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
    // 抽象/模板方法
    // ============================================================================

    abstract init(): Promise<boolean>; // 启用插件时必须调用

    /**
     * 禁用时清理（默认实现，子类可覆写）
     */
    deinit(): Promise<boolean> {
        if (!this.initialized) return Promise.resolve(true);
        this.wallpaperImageCache = [];
        this.curDataIndex = 0;
        this.currentPage = 1;
        this.initialized = false;
        return Promise.resolve(true);
    }

    /**
     * 更新图片缓存（模板方法）
     * 标准分页提供者只需覆写 fetchPage()，无需覆写此方法
     * 非标准分页提供者（如 qihoo360、custom）可直接覆写
     */
    async updateImageCache(): Promise<boolean> {
        if (this.totalPages > 0 && this.currentPage > this.totalPages) {
            this.currentPage = 1;
        }
        const success = await this.fetchPage(this.currentPage);
        if (success) {
            this.currentPage += 1;
        }
        return success;
    }

    /**
     * 获取指定页的数据（子类实现）
     * 默认实现抛出错误，子类必须覆写 fetchPage 或 updateImageCache
     */
    protected fetchPage(_page: number): Promise<boolean> {
        throw new Error("fetchPage must be implemented by subclass or override updateImageCache");
    }

    /**
     * 初始化完成的公共收尾逻辑
     */
    protected finishInit(): void {
        this.wallpaperImageCache = [];
        this.curDataIndex = 0;
        this.currentPage = 1;
        this.initialized = true;
    }

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

    static validateParams(_params: WallpaperApiParams): { valid: boolean; errors?: string[] } {
        return { valid: true };
    }

    static getCustomSettingDescriptors(): WallpaperApiParamDescriptor[] {
        return [];
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
            logger.error(`Failed to enable API "${this.name}":`, error);
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
            logger.error(`Failed to disable API "${this.name}":`, error);
            return false;
        }
    }

    // ============================================================================
    // 工具方法
    // ============================================================================

    generateBackgroundId(): string {
        return generateId(this.getId());
    }

    generateBackgroundName(): string {
        return `${this.getName()} - ${new Date().toLocaleString()}`;
    }

    /**
     * 安全地将未知值转换为字符串
     */
    protected safeString(value: unknown): string {
        if (value === null || value === undefined) {
            return "";
        }
        if (typeof value === "string") {
            return value;
        }
        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        return "";
    }

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

    /**
     * 使用 URLSearchParams 构建查询字符串
     *
     * 设计理念：
     * 1. 使用标准的 URLSearchParams API，符合 Web 标准
     * 2. 数组处理：创建多个同名参数 (tags=nature&tags=landscape)
     * 3. 如果 API 需要特殊格式（如逗号分隔），用户应输入相应格式的字符串
     * 4. 避免在代码中做过多的格式假设，让用户掌控参数格式
     *
     * @param params 查询参数对象，默认使用实例的 params
     * @returns 编码后的查询字符串，不包含前导 '?'
     */
    protected buildUrlParams(params: WallpaperApiParams = this.params): string {
        const queryParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                // 对于字符串，额外检查是否为空
                if (typeof value === "string" && value === "") {
                    return;
                }

                if (Array.isArray(value)) {
                    // 对于数组，使用标准的多参数格式
                    value.forEach((item) => {
                        queryParams.append(key, String(item));
                    });
                } else {
                    queryParams.append(key, String(value));
                }
            }
        });

        return queryParams.toString();
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
                const updated = await this.updateImageCache();
                if (!updated || this.wallpaperImageCache.length === 0) {
                    break; // 获取失败或没有更多图片
                }
                this.curDataIndex = 0;
            }
        }

        return images.length > 0 ? images : null;
    }
}
