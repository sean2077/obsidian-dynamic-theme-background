/**
 * 国际化模块 - 处理多语言支持和文本翻译
 * 支持中英文切换，根据Obsidian语言设置自动加载对应翻译
 */

import { moment } from "obsidian";
import en from "./en";
import zhCN from "./zh-cn";

const localeMap: Record<string, typeof en> = {
    en,
    "zh-cn": zhCN,
};

const locale = localeMap[moment.locale()];
export function t(str: keyof typeof en, vars?: Record<string, string>): string {
    let text = (locale && locale[str]) || en[str];
    if (vars) {
        for (const varKey in vars) {
            text = text.replace(`{${varKey}}`, vars[varKey]);
        }
    }
    return text;
}
