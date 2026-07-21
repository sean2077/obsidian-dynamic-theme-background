/**
 * Background lifecycle, selection, and scheduling coordinator.
 */

import { Notice, type Plugin } from "obsidian";

import {
    FALLBACK_CHECK_MS,
    MAX_INTERVAL_MINUTES,
    MIN_DELAY_MS,
    MIN_INTERVAL_MINUTES,
    MS_PER_MINUTE,
} from "../constants";
import { t } from "../i18n";
import type { BackgroundItem, DTBSettings } from "../types";
import { apiManager } from "../wallpaper-apis";
import { selectBackgroundPlan, type BackgroundSelectionPlan } from "./background-selection";
import type { EventBus } from "./event-bus";
import { LatestOperation } from "./latest-operation";
import { logger } from "./logger";
import type { StyleManager } from "./style-manager";
import type { TimeRuleScheduler } from "./time-rule-scheduler";

interface RandomWallpaperResult {
    apiName: string | null;
    background: BackgroundItem | null;
    status: "disabled" | "failed" | "success" | "unavailable";
}

interface BackgroundSelection extends BackgroundSelectionPlan {
    fetch?: RandomWallpaperResult;
}

export class BackgroundManager {
    background: BackgroundItem | null = null;

    private events: EventBus;
    private intervalId: number | null = null;
    private lastActiveRuleId: string | null = null;
    private onSettingsMutated: (() => void) | null;
    private plugin: Plugin;
    private running = false;
    private scheduleGeneration = 0;
    private scheduler: TimeRuleScheduler;
    private styleManager: StyleManager;
    private timeoutId: number | null = null;
    private updates = new LatestOperation();

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

    stop(): void {
        this.running = false;
        this.scheduleGeneration += 1;
        this.updates.invalidate();
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.timeoutId !== null) {
            window.clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        activeDocument.body.classList.remove("dtb-enabled");
        this.styleManager.clear();
        logger.debug("Background manager stopped");
    }

    start(settings: DTBSettings): void {
        this.stop();
        const scheduleGeneration = this.scheduleGeneration;
        this.running = true;
        activeDocument.body.classList.add("dtb-enabled");

        void this.update(settings, true);

        if (settings.mode === "time-based") {
            this.startTimeBasedMode(settings, scheduleGeneration);
        } else if (settings.mode === "interval") {
            const intervalMinutes =
                Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, settings.intervalMinutes)) ||
                MIN_INTERVAL_MINUTES;
            const intervalMs = intervalMinutes * MS_PER_MINUTE;
            this.intervalId = this.plugin.registerInterval(
                window.setInterval(() => {
                    if (!this.isCurrentSchedule(scheduleGeneration)) return;
                    void this.update(settings, false);
                }, intervalMs)
            );
            logger.debug("Background manager started (interval mode)", {
                interval: `${intervalMs / 1000}s`,
                mode: settings.mode,
            });
        } else {
            logger.debug("Background manager started (manual mode)", {
                mode: settings.mode,
            });
        }
    }

    private startTimeBasedMode(settings: DTBSettings, generation: number): void {
        const scheduleNext = () => {
            if (!this.isCurrentSchedule(generation)) return;
            const nextRuleChange = this.scheduler.getNextChangeTime();
            if (nextRuleChange !== null) {
                const delay = Math.max(nextRuleChange - Date.now(), MIN_DELAY_MS);
                this.timeoutId = window.setTimeout(() => {
                    if (!this.isCurrentSchedule(generation)) return;
                    void this.update(settings, false);
                    const currentRuleId = this.scheduler.getCurrentRule()?.id ?? null;
                    if (currentRuleId !== this.lastActiveRuleId) {
                        this.lastActiveRuleId = currentRuleId;
                        this.events.emit("time-rules:changed", {});
                    }
                    scheduleNext();
                }, delay);
                logger.debug("Next background change scheduled", {
                    delay: `${Math.round(delay / 1000)}s`,
                    mode: settings.mode,
                    nextTime: new Date(nextRuleChange).toLocaleTimeString(),
                });
            } else {
                this.timeoutId = window.setTimeout(() => {
                    if (!this.isCurrentSchedule(generation)) return;
                    void this.update(settings, false);
                    scheduleNext();
                }, FALLBACK_CHECK_MS);
                logger.debug("No next rule found, checking again in 24 hours");
            }
        };

        scheduleNext();
    }

    private isCurrentSchedule(generation: number): boolean {
        return generation === this.scheduleGeneration;
    }

    async update(settings: DTBSettings, forceUpdate = true): Promise<void> {
        if (!settings.enabled || !this.running) return;
        if (!forceUpdate && this.updates.isRunning) return;

        await this.updates.run(
            () => this.selectBackground(settings),
            (selection) => {
                this.commitSelection(selection, settings, forceUpdate);
            }
        );
    }

    async applyRandom(settings: DTBSettings): Promise<void> {
        if (!settings.enabled || !this.running) return;
        await this.updates.run(
            () => this.selectIntervalBackground(settings),
            (selection) => {
                this.commitSelection(selection, settings, true);
            }
        );
    }

    private async selectBackground(settings: DTBSettings): Promise<BackgroundSelection> {
        if (settings.mode === "interval") {
            return this.selectIntervalBackground(settings);
        }
        if (settings.mode === "time-based") {
            const rule = this.scheduler.getCurrentRule();
            logger.debug("Time-rule mode selected current rule", rule);
            return selectBackgroundPlan({
                backgrounds: settings.backgrounds,
                currentBackground: this.background,
                currentIndex: settings.currentIndex,
                mode: settings.mode,
                ruleBackgroundId: rule?.backgroundId,
            });
        }
        return selectBackgroundPlan({
            backgrounds: settings.backgrounds,
            currentBackground: this.background,
            currentIndex: settings.currentIndex,
            mode: settings.mode,
        });
    }

    private async selectIntervalBackground(settings: DTBSettings): Promise<BackgroundSelection> {
        const fetch = await this.fetchRandomWallpaper(settings);
        return {
            ...selectBackgroundPlan({
                backgrounds: settings.backgrounds,
                currentBackground: this.background,
                currentIndex: settings.currentIndex,
                intervalBackground: fetch.background,
                mode: "interval",
            }),
            fetch,
        };
    }

    private commitSelection(selection: BackgroundSelection, settings: DTBSettings, forceUpdate: boolean): void {
        if (selection.nextIndex !== undefined) {
            settings.currentIndex = selection.nextIndex;
            this.onSettingsMutated?.();
        }
        this.background = selection.background;

        if (selection.fetch?.status === "success" && selection.fetch.apiName) {
            new Notice(
                t("notice_api_success_applied", {
                    apiName: selection.fetch.apiName,
                })
            );
        } else if (selection.fetch?.status === "failed" && selection.fetch.apiName) {
            new Notice(
                t("notice_api_failed_fetch", {
                    apiName: selection.fetch.apiName,
                })
            );
        }

        if (forceUpdate || selection.needsUpdate) {
            this.styleManager.applyBackground(this.background, settings);
            this.events.emit("backgrounds:changed", {});
        }
    }

    private async fetchRandomWallpaper(settings: DTBSettings): Promise<RandomWallpaperResult> {
        if (!settings.enableRandomWallpaper) {
            return {
                apiName: null,
                background: null,
                status: "disabled",
            };
        }

        const enabledApis = apiManager.getEnabledApis();
        if (enabledApis.length === 0) {
            logger.warn("No enabled APIs found");
            return {
                apiName: null,
                background: null,
                status: "unavailable",
            };
        }

        const selectedApi = enabledApis[Math.floor(Math.random() * enabledApis.length)];
        const apiName = selectedApi.getName();
        const loadingNotice = new Notice(t("notice_api_fetching", { apiName }), 0);

        try {
            const images = await apiManager.getRandomWallpapers(selectedApi.getId());
            const image = images?.[Math.floor(Math.random() * images.length)] ?? null;
            if (!image?.url) {
                logger.warn(`No wallpaper image returned from API: ${apiName}`);
                return { apiName, background: null, status: "failed" };
            }
            return {
                apiName,
                background: {
                    id: selectedApi.generateBackgroundId(),
                    name: selectedApi.generateBackgroundName(),
                    type: "image",
                    value: image.url,
                },
                status: "success",
            };
        } catch (error) {
            logger.error("Error fetching random wallpaper", error instanceof Error ? error.name : "Unknown error");
            return { apiName, background: null, status: "failed" };
        } finally {
            loadingNotice.hide();
        }
    }
}
