import { ApiError, ApiErrorType } from "./api-error";
import { apiRegistry } from "./api-registry";
import { ApiStateManager } from "./api-state-manager";
import { BaseWallpaperApi } from "./base-api";
import type { WallpaperApiConfig, WallpaperImage } from "./types";

/**
 * 壁纸API管理器
 *
 * 负责管理所有注册的API实例，并提供统一的接口
 */
class WallpaperApiManager {
    // 单例模式
    private static instance: WallpaperApiManager;

    // API状态管理器
    stateManager = new ApiStateManager();
    // 存储所有API实例
    private apis = new Map<string, BaseWallpaperApi>();

    private constructor() {}

    static getInstance(): WallpaperApiManager {
        if (!WallpaperApiManager.instance) {
            WallpaperApiManager.instance = new WallpaperApiManager();
        }
        return WallpaperApiManager.instance;
    }

    // ============================================================================
    // 主要接口
    // ============================================================================

    /**
     * 创建API实例，注：如果设置API启用，则会异步启用实例
     * @param config API配置
     */
    async createApi(config: WallpaperApiConfig): Promise<void> {
        // 验证参数
        const validation = apiRegistry.validateParams(config.type, config.params);
        if (!validation.valid) {
            const error = new ApiError(
                ApiErrorType.PARAMETER_ERROR,
                `Invalid parameters for API "${config.name}": ${validation.errors?.join(", ") || "Unknown error"}`,
                config.id
            );
            console.warn(`WallpaperApiManager: ${error.message}`);
            return;
        }

        // 使用注册表动态创建API实例
        const ApiClass = apiRegistry.getApiClass(config.type);

        if (!ApiClass) {
            console.warn(`WallpaperApiManager: Unsupported API type "${config.type}". No registered API class found.`);
            return;
        }

        // 如果没有提供ID，则生成一个新的唯一标识符
        config.id ||= this.genApiId();

        const api = new ApiClass(config);

        this.apis.set(api.getId(), api);

        // 如果配置中启用了API，则异步启用实例
        if (config.enabled) {
            await this.enableApi(api.getId());
        }
    }

    /**
     * 删除API实例
     * @param apiId API实例唯一标识符
     */
    deleteApi(apiId: string): void {
        this.apis.delete(apiId);
        // 清理状态管理器中的订阅
        this.stateManager.cleanupByApiId(apiId);
    }

    /**
     * 删除所有API实例
     */
    deleteAllApis(): void {
        this.apis.clear();
        // 清理状态管理器中的所有订阅
        this.stateManager.cleanup();
    }

    /**
     * 根据ID获取API实例
     * @param apiId API实例唯一标识符
     */
    getApiById(apiId: string): BaseWallpaperApi | null {
        return this.apis.get(apiId) || null;
    }

    /**
     * 获取所有注册的API
     */
    getAllApis(): BaseWallpaperApi[] {
        return Array.from(this.apis.values());
    }

    /**
     * 获取所有API名称
     */
    getApiNames(): string[] {
        return Array.from(this.apis.values()).map((api) => api.getName());
    }

    /**
     * 智能启用API - 先更新配置，再尝试启用实例，失败时回退配置
     * @param apiId API实例唯一标识符
     * @returns Promise<boolean> 成功返回true，失败返回false
     */
    async enableApi(apiId: string): Promise<boolean> {
        // 1. 先找API实例
        const api = this.getApiById(apiId);
        if (!api) {
            const error = new ApiError(
                ApiErrorType.CONFIGURATION_ERROR,
                `API instance with ID "${apiId}" not found`,
                apiId
            );
            console.warn(`WallpaperApiManager: ${error.message}`);
            this.stateManager.notify(apiId, {
                configEnabled: false,
                instanceEnabled: false,
                isLoading: false,
                error: error.getUserMessage(),
            });
            return false;
        }
        const apiConfig = api.getConfig();

        // 2. 状态管理器通知订阅者 api 处于加载状态
        this.stateManager.notify(apiId, {
            configEnabled: true,
            instanceEnabled: false,
            isLoading: true,
        });

        // 3. 异步尝试启用API实例
        try {
            const success = await api.tryEnable();

            if (!success) {
                // 4. 更新状态管理器
                this.stateManager.notify(apiId, {
                    configEnabled: false,
                    instanceEnabled: false,
                    isLoading: false,
                    error: `Failed to enable API "${apiConfig.name}"`,
                });
                apiConfig.enabled = false;

                console.warn(`WallpaperApiManager: Failed to enable API "${apiId}", config reverted.`);
                return false;
            }

            // 5. 成功时更新状态
            this.stateManager.notify(apiId, {
                configEnabled: true,
                instanceEnabled: true,
                isLoading: false,
            });
            apiConfig.enabled = true;

            return true;
        } catch (error) {
            // 处理不同类型的错误
            let apiError: ApiError;
            if (error instanceof ApiError) {
                apiError = error;
            } else {
                apiError = new ApiError(
                    ApiErrorType.UNKNOWN_ERROR,
                    error instanceof Error ? error.message : String(error),
                    apiId
                );
            }

            // 6. 更新状态管理器
            this.stateManager.notify(apiId, {
                configEnabled: false,
                instanceEnabled: false,
                isLoading: false,
                error: apiError.getUserMessage(),
            });
            apiConfig.enabled = false;

            console.error(`WallpaperApiManager: Error enabling API "${apiId}":`, error);
            return false;
        }
    }

    /**
     * 禁用API
     * @param apiId API实例唯一标识符
     * @returns Promise<boolean> 成功返回true，失败返回false
     */
    async disableApi(apiId: string): Promise<boolean> {
        // 1. 先找到配置和API实例
        const api = this.getApiById(apiId);
        if (!api) {
            console.warn(`WallpaperApiManager: API config or instance with ID "${apiId}" not found.`);
            return false;
        }

        // 不考虑禁用失败回退那一套，因为还可能涉及恢复启用状态之类的逻辑，不搞这么复杂。。。
        await api.tryDisable();
        this.stateManager.notify(apiId, {
            configEnabled: false,
            instanceEnabled: false,
            isLoading: false,
        });

        return true;
    }

    /**
     * 从指定的壁纸 API 或随机启用的 API 获取随机壁纸图片列表。
     *
     * @param apiId 可选，指定要使用的 API ID。如果未指定，则从已启用的 API 中随机选择一个。
     * @param count 要获取的壁纸数量，默认为 1。
     * @returns 返回壁纸图片列表（WallpaperImage[]），如果未找到图片或 API 不存在则返回 null。
     */
    async getRandomWallpapers(apiId?: string, count = 1): Promise<WallpaperImage[] | null> {
        let randomApi: BaseWallpaperApi;
        // 如果指定了API ID，则使用该API获取壁纸
        if (apiId) {
            const foundApi = this.getApiById(apiId);
            if (!foundApi) {
                console.warn(`WallpaperApiManager: API with ID "${apiId}" not found.`);
                return null;
            }
            randomApi = foundApi;
        } else {
            // 随机从已启用的API中选择一个
            const enabledApis = Array.from(this.apis.values()).filter((api) => api.getEnabled());
            if (enabledApis.length === 0) {
                console.warn("No enabled wallpaper APIs available.");
                return null;
            }
            randomApi = enabledApis[Math.floor(Math.random() * enabledApis.length)];
        }

        // 获取壁纸
        const imageList = await randomApi.getImages(count);
        if (!imageList || imageList.length === 0) {
            console.warn(`No images found for API: ${randomApi.getName()}`);
            return null;
        }
        return imageList;
    }

    // ============================================================================
    // 辅助方法
    // ============================================================================

    private genApiId(): string {
        return `api-${crypto.randomUUID()}`;
    }
}

// 单例模式
export const apiManager = WallpaperApiManager.getInstance();
