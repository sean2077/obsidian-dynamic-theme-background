/**
 * 壁纸API核心类型定义
 */

/**
 * API 类型枚举
 */
export enum WallpaperApiType {
    Custom = "Custom",
    Wallhaven = "Wallhaven",
    Unsplash = "Unsplash",
    Pexels = "Pexels",
    Pixabay = "Pixabay",
    Qihoo360 = "Qihoo360",
}

/**
 * API 参数值类型
 * 直接拼接到 URL 上的值类型
 */
export type ApiValueType = string | number | boolean;

/**
 * UI 显示值类型
 * 用于在界面上显示的值，可能与实际API参数值不同
 * 注：数组类型只有 string[] 是有意义的，因为 HTML 表单元素只能返回字符串值
 */
export type UiValueType = string | number | boolean | string[];

/**
 * 可选的UI值类型 - 常用于输入处理
 */
export type OptionalUiValueType = UiValueType | undefined;

/**
 * 可选的API值类型 - 常用于配置获取
 */
export type OptionalApiValueType = ApiValueType | undefined;

/**
 * API 参数描述
 */
export interface WallpaperApiParamDescriptor {
    key: string; // 参数key
    label: string; // 显示标签
    type: "string" | "number" | "boolean" | "select" | "multiselect" | "password"; // 参数类型
    required?: boolean; // 是否必填
    defaultValue?: ApiValueType; // 默认值（注: 提供的值应为 api 参数值
    placeholder?: string; // 占位符
    description?: string; // 参数描述
    options?: { value: string | number; label: string }[]; // 选择项（用于select和multiselect）

    // 注：界面值为便于用户理解的值，API参数值为实际传递给API的值

    // 转换函数：将界面值转换为API参数值
    toApiValue?: (uiValue: UiValueType) => ApiValueType;
    // 转换函数：将API参数值转换为界面值
    fromApiValue?: (apiValue: ApiValueType) => UiValueType;
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
    [key: string]: ApiValueType;
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
        [key: string]: string | undefined; // 允许其他自定义设置
    };
}
