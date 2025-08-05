/**
 * 类型定义文件 - 定义插件中使用的所有TypeScript接口和类型
 * 包含壁纸API配置、插件设置、时间规则和背景项目等类型定义
 */

import type { WallpaperApiConfig } from "./wallpaper-apis";

export interface DTBSettings {
    enabled: boolean;

    // 统一的背景模糊度、亮度和饱和度变量、背景颜色
    blurDepth: number; // 默认模糊度
    brightness4Bg: number; // 默认亮度
    saturate4Bg: number; // 默认饱和度
    bgColor: string; // 默认背景颜色
    bgColorOpacity: number; // 默认背景颜色透明度

    mode: "time-based" | "interval" | "manual";
    timeRules: TimeRule[];
    intervalMinutes: number;
    backgrounds: BackgroundItem[];
    currentIndex: number; // 当前背景索引

    // 随机壁纸设置
    enableRandomWallpaper: boolean; // 是否启用随机壁纸，否则会顺序使用背景列表中的壁纸
    wallpaperApis: WallpaperApiConfig[]; // 壁纸API配置列表
    apiRefreshInterval?: number; // API刷新间隔（分钟）
}

export interface TimeRule {
    id: string;
    name: string;
    startTime: string; // "HH:MM" format
    endTime: string; // "HH:MM" format
    backgroundId: string;
    enabled: boolean;
}

export interface BackgroundItem {
    id: string;
    name: string;
    type: "image" | "color" | "gradient";
    value: string; // image URL, color code, or gradient CSS
    preview?: string;
}
