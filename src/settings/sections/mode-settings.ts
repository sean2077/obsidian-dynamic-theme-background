import { Notice, Setting } from "obsidian";
import { MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "../../constants";
import { t } from "../../i18n";
import { ConfirmModal, TimeRuleModal } from "../../modals";
import type DynamicThemeBackgroundPlugin from "../../plugin";
import type { DTBSettings, TimeRule } from "../../types";
import {
    DragSort,
    addDropdownTooltip,
    addEnhancedDropdownTooltip,
    generateId,
} from "../../utils";

export class ModeSettingsSection {
    private plugin: DynamicThemeBackgroundPlugin;
    private defaultSettings: DTBSettings;
    private container!: HTMLElement;
    private timeRulesContainer: HTMLElement | null = null;
    private timeRuleDragSort: DragSort<TimeRule> | null = null;

    constructor(plugin: DynamicThemeBackgroundPlugin, defaultSettings: DTBSettings) {
        this.plugin = plugin;
        this.defaultSettings = defaultSettings;
    }

    display(container: HTMLElement): void {
        this.container = container;
        const containerEl = this.container;
        containerEl.empty();

        // 模式设置标题
        new Setting(containerEl).setName(t("mode_settings_title")).setHeading();

        new Setting(containerEl)
            .setName(t("switch_mode_name"))
            .setDesc(t("switch_mode_desc"))
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("time-based", t("mode_time_based"))
                    .addOption("interval", t("mode_interval"))
                    .addOption("manual", t("mode_manual"))
                    .setValue(this.plugin.settings.mode)
                    .onChange(async (value: string) => {
                        const mode = value as DTBSettings["mode"];
                        this.plugin.settings.mode = mode;
                        await this.plugin.saveSettings();
                        this.plugin.startBackgroundManager();
                        this.display(this.container);
                    });
                // 添加模式切换的 tooltip
                addDropdownTooltip(
                    dropdown,
                    {
                        "time-based": t("mode_time_based_tooltip"),
                        interval: t("mode_interval_tooltip"),
                        manual: t("mode_manual_tooltip"),
                    },
                    t("switch_mode_desc")
                );

                return dropdown;
            });

        // 时间规则（仅在时间模式下显示）
        if (this.plugin.settings.mode === "time-based") {
            new Setting(containerEl).setName(t("time_rules_title")).setHeading();
            const buttonContainer = containerEl.createDiv("dtb-large-button-container");
            new Setting(buttonContainer)
                .setName(t("manage_time_rules_name"))
                .setDesc(t("manage_time_rules_desc"))
                .addButton((button) => {
                    button.setButtonText(t("add_time_rule_button"));
                    button.setTooltip(t("add_time_rule_tooltip"));
                    button.onClick(() => this.showTimeRuleModal());
                })
                .addButton((button) => {
                    button.setButtonText(t("clear_time_rules_button"));
                    button.setTooltip(t("clear_time_rules_tooltip"));
                    button.onClick(() => {
                        new ConfirmModal(this.plugin.app, {
                            message: t("confirm_clear_time_rules"),
                            onConfirm: () => {
                                this.plugin.settings.timeRules = [];
                                this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                                void this.plugin.saveSettings();
                                this.display(this.container);
                            },
                        }).open();
                    });
                })
                .addButton((button) => {
                    button.setButtonText(t("reset_time_rules_button"));
                    button.setTooltip(t("reset_time_rules_tooltip"));
                    button.onClick(() => {
                        this.plugin.settings.timeRules = this.defaultSettings.timeRules.map((rule) => ({ ...rule }));
                        this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                        void this.plugin.saveSettings();
                        this.display(this.container);
                    });
                });

            // 添加时间规则提示
            containerEl.addClass("dtb-hint-section");
            const hint = containerEl.createDiv("dtb-hint");
            hint.textContent = t("time_rule_hint");

            // 显示时间规则列表
            this.timeRulesContainer = containerEl.createDiv("dtb-section-container");
            this.displayTimeRules();
        } else {
            this.timeRulesContainer = null;
        }

        // 时间间隔设置（仅在间隔模式下显示）
        if (this.plugin.settings.mode === "interval") {
            new Setting(containerEl)
                .setName(t("interval_name"))
                .setDesc(t("interval_desc"))
                .addText((text) => {
                    text.inputEl.type = "number";
                    text.inputEl.min = String(MIN_INTERVAL_MINUTES);
                    text.inputEl.max = String(MAX_INTERVAL_MINUTES);
                    text.inputEl.step = "1";
                    return text
                        .setPlaceholder("60")
                        .setValue(this.plugin.settings.intervalMinutes.toString())
                        .onChange(async (value) => {
                            const minutes = Number(value);
                            if (
                                !Number.isInteger(minutes) ||
                                minutes < MIN_INTERVAL_MINUTES ||
                                minutes > MAX_INTERVAL_MINUTES ||
                                minutes === this.plugin.settings.intervalMinutes
                            ) {
                                return;
                            }
                            this.plugin.settings.intervalMinutes = minutes;
                            await this.plugin.saveSettings();
                            this.plugin.startBackgroundManager();
                        });
                });

            // 随机壁纸设置
            new Setting(containerEl)
                .setName(t("enable_random_wallpaper_name"))
                .setDesc(t("enable_random_wallpaper_desc"))
                .addToggle((toggle) =>
                    toggle.setValue(this.plugin.settings.enableRandomWallpaper).onChange(async (value) => {
                        this.plugin.settings.enableRandomWallpaper = value;
                        await this.plugin.saveSettings();
                        this.display(this.container);
                    })
                );
        }
    }

    // 显示时间规则列表，支持编辑、删除和添加新规则
    displayTimeRules(): void {
        const container = this.timeRulesContainer;
        if (!container) return;
        this.timeRuleDragSort?.disableAllDrag();
        container.empty();

        // 初始化时间规则拖拽排序
        const timeRuleDragSort = new DragSort<TimeRule>({
            container,
            items: this.plugin.settings.timeRules,
            getItemId: (rule) => rule.id,
            reorderLabels: { up: t("move_item_up"), down: t("move_item_down") },
            setItems: (rules) => {
                this.plugin.settings.timeRules = rules;
            },
            onReorder: async () => {
                await this.plugin.saveSettings();
                this.plugin.startBackgroundManager();
                this.displayTimeRules();
            },
        });
        this.timeRuleDragSort = timeRuleDragSort;

        // 获取当前激活的时间规则
        const activeRule = this.plugin.getCurrentTimeRule();

        this.plugin.settings.timeRules.forEach((rule: TimeRule) => {
            const setting = new Setting(container);

            setting.setName(rule.name).setDesc(`${rule.startTime} - ${rule.endTime}`);

            // 如果是激活的时间规则，则添加一个提示图标
            if (rule.id === activeRule?.id) {
                const indicator = setting.controlEl.createDiv();
                indicator.setText("🔥");
                indicator.title = t("active_time_rule");
            }

            setting
                .addToggle((toggle) =>
                    toggle.setValue(rule.enabled).onChange(async (value) => {
                        rule.enabled = value;
                        this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                        await this.plugin.saveSettings();
                        this.displayTimeRules();
                    })
                )
                .addDropdown((dropdown) => {
                    dropdown.addOption("", t("select_background_option"));
                    this.plugin.settings.backgrounds.forEach((bg) => {
                        dropdown.addOption(bg.id, bg.name);
                    });
                    // 使用增强版 tooltip 方法为背景选择下拉框添加动态提示
                    addEnhancedDropdownTooltip(dropdown, {
                        defaultTooltip: t("select_background_option"),
                        showSelectedValue: true,
                        customFormatter: (value, text) => {
                            if (!value) return t("select_background_option");
                            const bg = this.plugin.settings.backgrounds.find((b) => b.id === value);
                            if (bg) {
                                return `${text} (${bg.type.toUpperCase()})`;
                            }
                            return text;
                        },
                    });

                    return dropdown.setValue(rule.backgroundId).onChange((value) => {
                        rule.backgroundId = value;
                        void this.plugin.saveSettings();
                        void this.plugin.updateBackground(true);
                    });
                })
                .addButton((button) =>
                    button.setButtonText(t("button_edit")).onClick(() => this.showTimeRuleModal(rule))
                )
                .addButton((button) =>
                    button.setButtonText(t("button_delete")).onClick(() => {
                        this.plugin.settings.timeRules = this.plugin.settings.timeRules.filter((r) => r.id !== rule.id);
                        this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
                        void this.plugin.saveSettings();
                        this.displayTimeRules();
                    })
                );

            // 添加通用条目样式类
            setting.settingEl.addClass("dtb-button-container"); // 按钮样式

            timeRuleDragSort.enableDragForElement(setting.settingEl, rule, setting.controlEl);
        });
    }

    // 显示添加或编辑时间规则的模态窗口
    private showTimeRuleModal(rule?: TimeRule) {
        // 如果没有提供规则，创建一个新的空规则
        const editRule: TimeRule = rule ?? {
            id: "",
            name: "",
            startTime: "09:00",
            endTime: "17:00",
            backgroundId: "",
            enabled: true,
        };

        const modal = new TimeRuleModal(this.plugin.app, editRule, (updatedRule) => {
            if (!updatedRule.name.trim() || !updatedRule.startTime || !updatedRule.endTime) {
                new Notice(t("notice_all_fields_required"));
                return;
            }

            if (rule) {
                // 编辑现有规则
                const index = this.plugin.settings.timeRules.findIndex((r) => r.id === rule.id);
                if (index !== -1) {
                    this.plugin.settings.timeRules[index] = {
                        ...rule,
                        name: updatedRule.name.trim(),
                        startTime: updatedRule.startTime,
                        endTime: updatedRule.endTime,
                    };
                }
            } else {
                // 添加新规则
                const newRule: TimeRule = {
                    id: generateId("rule"),
                    name: updatedRule.name.trim(),
                    startTime: updatedRule.startTime,
                    endTime: updatedRule.endTime,
                    backgroundId: this.plugin.settings.backgrounds[0]?.id ?? "",
                    enabled: true,
                };
                this.plugin.settings.timeRules.push(newRule);
            }

            this.plugin.startBackgroundManager(); // 重新启动背景管理器以应用更改
            void this.plugin.saveSettings();
            this.displayTimeRules();
        });

        modal.open();
    }

    cleanup(): void {
        this.timeRuleDragSort?.disableAllDrag();
    }
}
