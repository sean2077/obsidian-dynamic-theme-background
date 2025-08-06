/**
 * API 类注册表和工厂
 * 简化设计：直接使用类类型，无需复杂接口
 */

import type { BaseWallpaperApi } from "./base-api";
import type {
    WallpaperApiConfig,
    WallpaperApiEndpoints,
    WallpaperApiParamDescriptor,
    WallpaperApiParams,
    WallpaperApiType,
} from "./types";

// 简化的API类类型定义 - 包含构造函数和静态方法
interface WallpaperApiClass {
    new (config: WallpaperApiConfig): BaseWallpaperApi;
    getDefaultBaseUrl(): string;
    getDefaultEndpoints(): WallpaperApiEndpoints;
    getDefaultDescription(): string;
    getApiDocUrl(): string;
    getTokenUrl(): string;
    getDefaultParams(): WallpaperApiParams;
    getParamDescriptors(): WallpaperApiParamDescriptor[];
    validateParams(params: WallpaperApiParams): { valid: boolean; errors?: string[] };
}

/**
 * API 类注册表
 */
class ApiRegistry {
    private static instance: ApiRegistry;
    private apiClasses = new Map<WallpaperApiType, WallpaperApiClass>();

    private constructor() {}

    static getInstance(): ApiRegistry {
        if (!ApiRegistry.instance) {
            ApiRegistry.instance = new ApiRegistry();
        }
        return ApiRegistry.instance;
    }

    /**
     * 注册 API 类
     * 简化设计：直接传入类，TypeScript会自动检查继承关系
     */
    register(type: WallpaperApiType, apiClass: WallpaperApiClass): void {
        this.apiClasses.set(type, apiClass);
    }

    /**
     * 获取已注册的 API 类
     */
    getApiClass(type: WallpaperApiType): WallpaperApiClass | undefined {
        return this.apiClasses.get(type);
    }

    /**
     * 获取已注册的 API 类型列表
     */
    getRegisteredTypes(): WallpaperApiType[] {
        return Array.from(this.apiClasses.keys());
    }

    /**
     * 创建 API 实例
     */
    createInstance(type: WallpaperApiType, config: WallpaperApiConfig): BaseWallpaperApi | null {
        const ApiClass = this.apiClasses.get(type);
        if (!ApiClass) {
            console.warn(`API type "${type}" is not registered`);
            return null;
        }
        return new ApiClass(config);
    }

    // ============================================================================
    // api 静态方法
    // ============================================================================

    /**
     * 获取默认基础URL
     */
    getDefaultBaseUrl(type: WallpaperApiType): string | null {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getDefaultBaseUrl() : null;
    }

    /**
     * 获取默认端点配置
     */
    getDefaultEndpoints(type: WallpaperApiType): WallpaperApiEndpoints | null {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getDefaultEndpoints() : null;
    }

    /**
     * 获取指定类型的描述
     */
    getDefaultDescription(type: WallpaperApiType): string | null {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getDefaultDescription() : null;
    }

    /**
     * 获取指定类型的API文档URL
     */
    getApiDocUrl(type: WallpaperApiType): string | null {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getApiDocUrl() : null;
    }

    /**
     * 获取指定类型的Token URL
     */
    getTokenUrl(type: WallpaperApiType): string | null {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getTokenUrl() : null;
    }

    /**
     * 获取默认参数
     */
    getDefaultParams(type: WallpaperApiType): WallpaperApiParams {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getDefaultParams() : {};
    }

    /**
     * 获取参数描述列表
     */
    getParamDescriptors(type: WallpaperApiType): WallpaperApiParamDescriptor[] {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.getParamDescriptors() : [];
    }

    /**
     * 验证参数
     */
    validateParams(type: WallpaperApiType, params: WallpaperApiParams): { valid: boolean; errors?: string[] } {
        const ApiClass = this.apiClasses.get(type);
        return ApiClass ? ApiClass.validateParams(params) : { valid: false, errors: ["API type not registered"] };
    }
}

/**
 * 单例实例
 */
export const apiRegistry = ApiRegistry.getInstance();
