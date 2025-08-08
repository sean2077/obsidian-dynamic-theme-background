/**
 * 默认设置生成器 - 生成插件的默认配置
 * 包含背景设置、API配置、时间规则等默认值的定义和生成
 */

import { t } from "./i18n";
import type { DTBSettings } from "./types";
import { apiRegistry, WallpaperApiType } from "./wallpaper-apis";

let DEFAULT_SETTINGS: DTBSettings;

function genDefaultSettings(): DTBSettings {
    DEFAULT_SETTINGS = {
        enabled: true,
        statusBarEnabled: true, // 是否激活状态栏

        // 全局背景模糊度、亮度和饱和度变量、背景颜色等
        blurDepth: 0,
        brightness4Bg: 0.9,
        saturate4Bg: 1,
        bgColor: "#1f1e1e",
        bgColorOpacity: 0.38,
        bgSize: "intelligent",

        // 背景切换模式和规则
        mode: "time-based",
        timeRules: [
            {
                id: "morning",
                name: t("default_morning_rule"),
                startTime: "06:00",
                endTime: "09:00",
                backgroundId: "blue-purple-gradient",
                enabled: true,
            },
            {
                id: "later-morning",
                name: t("default_later_morning_rule"),
                startTime: "09:00",
                endTime: "11:00",
                backgroundId: "pink-gradient",
                enabled: true,
            },
            {
                id: "noon",
                name: t("default_noon_rule"),
                startTime: "11:00",
                endTime: "13:00",
                backgroundId: "blue-cyan-gradient",
                enabled: true,
            },
            {
                id: "afternoon",
                name: t("default_afternoon_rule"),
                startTime: "13:00",
                endTime: "17:00",
                backgroundId: "green-cyan-gradient",
                enabled: true,
            },
            {
                id: "dusk",
                name: t("default_dusk_rule"),
                startTime: "17:00",
                endTime: "18:00",
                backgroundId: "pink-yellow-gradient",
                enabled: true,
            },
            {
                id: "evening",
                name: t("default_evening_rule"),
                startTime: "18:00",
                endTime: "22:00",
                backgroundId: "cyan-pink-gradient",
                enabled: true,
            },
            {
                id: "night",
                name: t("default_night_rule"),
                startTime: "22:00",
                endTime: "06:00",
                backgroundId: "dark-blue-gray-gradient",
                enabled: true,
            },
        ],
        intervalMinutes: 60,

        // 背景管理
        localBackgroundFolder: "",
        backgrounds: [
            {
                id: "blue-purple-gradient",
                name: t("blue_purple_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            },
            {
                id: "pink-gradient",
                name: t("pink_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            },
            {
                id: "blue-cyan-gradient",
                name: t("blue_cyan_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            },
            {
                id: "green-cyan-gradient",
                name: t("green_cyan_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
            },
            {
                id: "pink-yellow-gradient",
                name: t("pink_yellow_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            },
            {
                id: "cyan-pink-gradient",
                name: t("cyan_pink_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
            },
            {
                id: "dark-blue-gray-gradient",
                name: t("dark_blue_gray_gradient_bg"),
                type: "gradient",
                value: "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
            },
        ],
        currentIndex: 0,

        // 壁纸 API 管理
        enableRandomWallpaper: false, // 默认不启用随机壁纸
        wallpaperApis: [
            {
                id: "api-wallhaven-default",
                name: "Wallhaven API (Default)",
                type: WallpaperApiType.Wallhaven,
                baseUrl: apiRegistry.getDefaultBaseUrl(WallpaperApiType.Wallhaven) || "",
                enabled: false,
                params: apiRegistry.getDefaultParams(WallpaperApiType.Wallhaven),
            },
            {
                id: "api-peapix-bing-cn",
                type: WallpaperApiType.Custom,
                enabled: false,
                name: "Peapix API (Bing CN)",
                description: "For details, see https://peapix.com/api",
                baseUrl: "https://peapix.com/bing/feed?country=cn",
                params: apiRegistry.getDefaultParams(WallpaperApiType.Custom),
                customSettings: {
                    imageUrlJsonPath: "$[*].imageUrl",
                },
            },
        ],
    };
    return DEFAULT_SETTINGS;
}

export function getDefaultSettings(): DTBSettings {
    return DEFAULT_SETTINGS || genDefaultSettings();
}
