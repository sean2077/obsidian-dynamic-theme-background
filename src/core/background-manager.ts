/**
 * 背景生命周期管理器
 * 负责背景切换调度、模式选择和定时器管理
 */

import { Notice, type Plugin } from "obsidian";

import { FALLBACK_CHECK_MS, MIN_DELAY_MS, MS_PER_MINUTE } from "../constants";
import { t } from "../i18n";
import type { BackgroundItem, DTBSettings } from "../types";
import { apiManager } from "../wallpaper-apis";
import type { EventBus } from "./event-bus";
import { logger } from "./logger";
import type { StyleManager } from "./style-manager";
import type { TimeRuleScheduler } from "./time-rule-scheduler";

export class BackgroundManager {
    private scheduler: TimeRuleScheduler;
    private styleManager: StyleManager;
    private events: EventBus;
    private plugin: Plugin;

    // 状态
    background: BackgroundItem | null = null;
    private intervalId: number | null = null;
    private timeoutId: number | null = null;
    private lastActiveRuleId: string | null = null;
    private isUpdating = false;
    private onSettingsMutated: (() => void) | null = null;

    constructor(
        scheduler: TimeRuleScheduler,
        styleManager: StyleManager,
        events: EventBus,
        plugin: Plugin,
        onSettingsMutated?: () => void
    ) {
        this.scheduler = scheduler;
        this.styleManager = styleManager;
        this.events = events;
        this.plugin = plugin;
        this.onSettingsMutated = onSettingsMutated ?? null;
    }

    /**
     * 停止背景管理器
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        document.body.classList.remove("dtb-enabled");
        logger.debug("Background manager stopped");
    }

    /**
     * 启动背景管理器
     */
    start(settings: DTBSettings): void {
        this.stop();

        if (!document.body.classList.contains("dtb-enabled")) {
            document.body.classList.add("dtb-enabled");
        }

        // 立即执行一次更新
        void this.update(settings, true);

        if (settings.mode === "time-based") {
            this.startTimeBasedMode(settings);
        } else if (settings.mode === "interval") {
            const intervalMs = settings.intervalMinutes * MS_PER_MINUTE;
            this.intervalId = this.plugin.registerInterval(
                window.setInterval(() => {
                    void this.update(settings, false);
                }, intervalMs)
            );

            logger.debug("Background manager started (interval mode)", {
                mode: settings.mode,
                interval: intervalMs / 1000 + "s",
            });
        } else {
            logger.debug("Background manager started (manual mode)", {
                mode: settings.mode,
            });
        }
    }

    /**
     * 时段规则模式调度
     */
    private startTimeBasedMode(settings: DTBSettings): void {
        const scheduleNext = () => {
            const nextRuleChange = this.scheduler.getNextChangeTime();
            if (nextRuleChange) {
                const delay = nextRuleChange - Date.now();
                const actualDelay = Math.max(delay, MIN_DELAY_MS);

                this.timeoutId = window.setTimeout(() => {
                    void this.update(settings, false);
                    // 只在活跃规则变化时才刷新 UI
                    const currentRule = this.scheduler.getCurrentRule();
                    const currentRuleId = currentRule?.id ?? null;
                    if (currentRuleId !== this.lastActiveRuleId) {
                        this.lastActiveRuleId = currentRuleId;
                        this.events.emit("time-rules:changed", {});
                    }
                    scheduleNext();
                }, actualDelay);

                logger.debug("Next background change scheduled", {
                    mode: settings.mode,
                    delay: Math.round(actualDelay / 1000) + "s",
                    nextTime: new Date(nextRuleChange).toLocaleTimeString(),
                });
            } else {
                this.timeoutId = window.setTimeout(
                    () => {
                        void this.update(settings, false);
                        scheduleNext();
                    },
                    FALLBACK_CHECK_MS
                );

                logger.debug("No next rule found, checking again in 24 hours");
            }
        };

        scheduleNext();
    }

    /**
     * 按设定规则更新背景
     */
    async update(settings: DTBSettings, forceUpdate = true): Promise<void> {
        if (!settings.enabled) return;

        // 防止并发更新
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            let needsUpdate = false;
            switch (settings.mode) {
                case "time-based": {
                    const rule = this.scheduler.getCurrentRule();
                    if (rule) {
                        needsUpdate = this.background?.id !== rule.backgroundId;
                        if (needsUpdate) {
                            this.background =
                                settings.backgrounds.find((bg) => bg.id === rule.backgroundId) ?? null;
                        }
                    } else {
                        this.background = null;
                        needsUpdate = true;
                    }
                    logger.debug("TimeRule mode - current time rule", rule, needsUpdate);
                    break;
                }
                case "interval": {
                    const randomBg = await this.fetchRandomWallpaper(settings);
                    if (randomBg) {
                        this.background = randomBg;
                        needsUpdate = true;
                    } else if (settings.backgrounds.length > 0) {
                        settings.currentIndex =
                            (settings.currentIndex + 1) % settings.backgrounds.length;
                        this.background = settings.backgrounds[settings.currentIndex];
                        this.onSettingsMutated?.();
                        needsUpdate = true;
                    }
                    break;
                }
                default: {
                    this.background = settings.backgrounds[settings.currentIndex] ?? null;
                }
            }

            if (forceUpdate || needsUpdate) {
                this.styleManager.applyBackground(this.background, settings);
                this.events.emit("backgrounds:changed", {});
            }
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * 应用随机壁纸
     */
    async applyRandom(settings: DTBSettings): Promise<void> {
        const bg = await this.fetchRandomWallpaper(settings);

        if (bg) {
            this.background = bg;
        } else if (settings.backgrounds.length > 0) {
            settings.currentIndex = (settings.currentIndex + 1) % settings.backgrounds.length;
            this.background = settings.backgrounds[settings.currentIndex];
            this.onSettingsMutated?.();
        }

        this.styleManager.applyBackground(this.background, settings);
        this.events.emit("backgrounds:changed", {});
    }

    /**
     * 从壁纸 API 获取随机图片
     */
    private async fetchRandomWallpaper(settings: DTBSettings): Promise<BackgroundItem | null> {
        if (!settings.enableRandomWallpaper) {
            return null;
        }

        const enabledApis = apiManager.getEnabledApis();
        if (enabledApis.length === 0) {
            logger.warn("No enabled APIs found");
            return null;
        }

        const selectedApi = enabledApis[Math.floor(Math.random() * enabledApis.length)];

        try {
            const loadingNotice = new Notice(
                t("notice_api_fetching", { apiName: selectedApi.getName() }),
                0
            );

            const wallpaperImages = await apiManager.getRandomWallpapers(selectedApi.getId());
            loadingNotice.hide();

            if (!wallpaperImages || wallpaperImages.length === 0) {
                logger.warn(`No images returned from API: ${selectedApi.getName()}`);
                return null;
            }
            const randomImage = wallpaperImages[Math.floor(Math.random() * wallpaperImages.length)];
            if (randomImage?.url) {
                new Notice(t("notice_api_success_applied", { apiName: selectedApi.getName() }));
                return {
                    id: selectedApi.generateBackgroundId(),
                    name: selectedApi.generateBackgroundName(),
                    type: "image",
                    value: randomImage.url,
                };
            } else {
                new Notice(t("notice_api_failed_fetch", { apiName: selectedApi.getName() }));
                logger.warn(`No wallpaper image returned from API: ${selectedApi.getName()}`);
                return null;
            }
        } catch (error) {
            new Notice(
                t("notice_api_error_fetch", {
                    apiName: selectedApi.getName(),
                    error: (error as Error).message,
                })
            );
            logger.error("Error fetching random wallpaper:", error);
            return null;
        }
    }
}
