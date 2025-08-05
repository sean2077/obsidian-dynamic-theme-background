/**
 * 壁纸API核心类型定义
 */

/**
 * API 类型枚举
 */
export enum WallpaperApiType {
    Unsplash = "Unsplash",
    Pexels = "Pexels",
    Pixabay = "Pixabay",
    Wallhaven = "Wallhaven",
    Custom = "Custom",
}

/**
 * API 参数描述
 */
export interface WallpaperApiParamDescriptor {
    key: string; // 参数key
    label: string; // 显示标签
    type: "string" | "number" | "boolean" | "select" | "multiselect" | "password"; // 参数类型
    required?: boolean; // 是否必填
    defaultValue?: string | number | boolean | string[]; // 默认值（注: 提供的值应为 api 参数值
    placeholder?: string; // 占位符
    description?: string; // 参数描述
    options?: { value: string | number; label: string }[]; // 选择项（用于select和multiselect）

    // 注：界面值为便于用户理解的值，API参数值为实际传递给API的值

    // 转换函数：将界面值转换为API参数值
    toApiValue?: (uiValue: string | number | boolean | string[]) => string | number | boolean | string[];
    // 转换函数：将API参数值转换为界面值
    fromApiValue?: (apiValue: string | number | boolean | string[]) => string | number | boolean | string[];
}

/**
 * API 端点配置
 */
export interface WallpaperApiEndpoints {
    search?: string; // 搜索端点
    detail?: string; // 获取详细信息端点
    download?: string; // 下载端点
    [key: string]: string | undefined; // 允许自定义端点
}

/**
 * API 参数
 * 通用参数接口，允许各个API实现类定义自己需要的参数
 */
export interface WallpaperApiParams {
    [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * 壁纸图片接口
 */
export interface WallpaperImage {
    url: string;
    id: string;
    author?: string;
    description?: string;
    tags?: string[];
    width?: number;
    height?: number;
    downloadUrl?: string;
}

/**
 * 壁纸API实例配置接口
 */
export interface WallpaperApiConfig {
    id: string; // API实例唯一标识符, 由插件自动生成，用户不应修改
    type: WallpaperApiType;
    enabled: boolean; // 记录该API是否启用
    name: string;
    description?: string; // API实例描述
    baseUrl: string; // API基础域名或服务地址 (如: https://wallhaven.cc/api/v1)
    endpoints?: WallpaperApiEndpoints; // 具体的端点配置，如果不提供则使用默认端点
    headers?: Record<string, string>; // 请求头
    params: WallpaperApiParams;

    // 自定义设置
    customSettings?: {
        imageUrlJsonPath?: string; // 从响应中提取图片URL的JSON路径
        [key: string]: string | undefined; // 允许其他自定义设置
    };
}
