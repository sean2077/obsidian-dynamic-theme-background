/**
 * 测试当前时间规则背景命令
 */
import { Command, Notice } from "obsidian";
import { t } from "../i18n";
import DynamicThemeBackgroundPlugin from "../plugin";

export function createTestBackgroundCommand(plugin: DynamicThemeBackgroundPlugin): Command {
    return {
        id: "test-current-background",
        name: t("command_test_bg_name"),
        callback: () => {
            switch (plugin.settings.mode) {
                case "time-based": {
                    const rule = plugin.getCurrentTimeRule();
                    if (rule) {
                        const bg = plugin.settings.backgrounds.find((b) => b.id === rule.backgroundId);
                        if (bg) {
                            plugin.background = bg;
                            plugin.updateStyleCss();
                            new Notice(
                                t("command_test_bg_success_notice", {
                                    ruleName: rule.name,
                                    bgName: bg.name,
                                })
                            );
                        } else {
                            new Notice(
                                t("command_test_bg_no_bg_notice", {
                                    ruleName: rule.name,
                                })
                            );
                        }
                    } else {
                        new Notice(t("command_test_bg_no_rule_notice"));
                    }
                    break;
                }
                default: {
                    new Notice(t("command_test_bg_not_supported_notice"));
                    break;
                }
            }
        },
    };
}
