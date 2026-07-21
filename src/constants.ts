/**
 * 全局常量定义
 */

// 定时器间隔
export const MIN_DELAY_MS = 1000;
export const MS_PER_MINUTE = 60_000;
export const MIN_INTERVAL_MINUTES = 1;
// Browser timers clamp through a signed 32-bit delay. Larger values can wrap
// into a near-zero interval and accidentally create a tight request loop.
export const MAX_INTERVAL_MINUTES = Math.floor(2_147_483_647 / MS_PER_MINUTE);
export const FALLBACK_CHECK_MS = 24 * 60 * 60 * 1000; // 24 小时

// 图片比例分析阈值
export const RATIO_CLOSE_THRESHOLD = 0.1; // 比例差异 < 10% 视为相近
export const RATIO_LARGE_DIFF_THRESHOLD = 0.5; // 比例差异 > 50% 视为差异很大

// 壁纸缓存
export const MAX_WALLPAPER_CACHE_SIZE = 100;
