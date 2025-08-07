/**
 * 类型定义文件 - 定义插件中使用的所有TypeScript接口和类型
 * 包含壁纸API配置、插件设置、时间规则和背景项目等类型定义
 */

import type { WallpaperApiConfig } from "./wallpaper-apis";

export interface DTBSettings {
    enabled: boolean;

    // 全局背景模糊度、亮度和饱和度变量、背景颜色
    blurDepth: number; // 背景模糊度
    brightness4Bg: number; // 背景亮度
    saturate4Bg: number; // 背景饱和度
    bgColor: string; // 背景遮罩颜色
    bgColorOpacity: number; // 背景颜色透明度
    bgSize: "cover" | "contain" | "auto" | "intelligent"; // 背景图片填充方式, intelligent 表示智能选择填充方式

    // 背景切换模式和规则
    mode: "time-based" | "interval" | "manual";
    timeRules: TimeRule[];
    intervalMinutes: number;

    // 背景管理
    backgrounds: BackgroundItem[];
    currentIndex: number; // 当前背景索引

    // 壁纸 API 管理
    enableRandomWallpaper: boolean; // 是否启用随机壁纸，否则会顺序使用背景列表中的壁纸
    wallpaperApis: WallpaperApiConfig[]; // 壁纸API配置列表
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

    // 每个背景单独的模糊度、亮度和饱和度变量、遮罩颜色和透明度、填充方式，可覆盖全局设置
    blurDepth?: number;
    brightness4Bg?: number;
    saturate4Bg?: number;
    bgColor?: string;
    bgColorOpacity?: number;
    bgSize?: "cover" | "contain" | "auto" | "intelligent";
}
