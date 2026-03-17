/**
 * 时段规则调度器
 * 纯逻辑服务：时间规则匹配和下一次切换时间计算
 */

import type { TimeRule } from "../types";

export class TimeRuleScheduler {
    private rules: TimeRule[] = [];

    constructor(rules: TimeRule[]) {
        this.rules = rules;
    }

    updateRules(rules: TimeRule[]): void {
        this.rules = rules;
    }

    /**
     * 获取当前时段规则
     * 按时间顺序排序规则，找到第一个匹配当前时间的规则
     */
    getCurrentRule(now?: Date): TimeRule | null {
        now = now ?? new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // 按 startTime 排序，优先匹配靠前的规则
        const sortedRules = this.rules
            .filter((rule) => rule.enabled)
            .map((rule) => {
                const { startTime, endTime } = this.parseTimeRule(rule);
                return { rule, startTime, endTime };
            })
            .sort((a, b) => a.startTime - b.startTime);

        // 遍历排序后的规则，找到第一个匹配的
        for (const { rule, startTime, endTime } of sortedRules) {
            // 跨天时段处理：如 20:00-06:00
            if (startTime > endTime) {
                if (currentTimeMinutes >= startTime || currentTimeMinutes < endTime) {
                    return rule;
                }
            } else {
                if (currentTimeMinutes >= startTime && currentTimeMinutes < endTime) {
                    return rule;
                }
            }
        }
        return null;
    }

    /**
     * 获取下一个时段规则变化的时间点
     */
    getNextChangeTime(now?: Date): number | null {
        const enabledRules = this.rules.filter((r) => r.enabled);
        if (enabledRules.length === 0) {
            return null;
        }

        now = now ?? new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // 收集所有启用的时段规则的开始和结束时间点
        const timePoints: Array<{ time: number; isStart: boolean; rule: TimeRule }> = [];

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            const { startTime, endTime } = this.parseTimeRule(rule);

            timePoints.push({ time: startTime, isStart: true, rule });
            timePoints.push({ time: endTime, isStart: false, rule });
        }

        // 按时间排序
        timePoints.sort((a, b) => a.time - b.time);

        // 查找下一个时间点
        let nextPoint = null;

        // 首先查找今天剩余时间内的下一个时间点
        for (const point of timePoints) {
            if (point.time > currentTimeMinutes) {
                nextPoint = point;
                break;
            }
        }

        // 如果今天没有找到，取明天的第一个时间点
        if (!nextPoint && timePoints.length > 0) {
            nextPoint = timePoints[0];
        }

        if (!nextPoint) {
            return null;
        }

        // 计算具体的时间戳
        const targetDate = new Date(now);
        const targetHours = Math.floor(nextPoint.time / 60);
        const targetMinutes = nextPoint.time % 60;

        targetDate.setHours(targetHours, targetMinutes, 0, 0);

        // 如果目标时间已经过了，说明是明天的时间点
        if (targetDate.getTime() <= now.getTime()) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        return targetDate.getTime();
    }

    /**
     * 解析时间规则，返回标准化的分钟数
     */
    parseTimeRule(rule: TimeRule): { startTime: number; endTime: number } {
        const [startHour, startMin] = rule.startTime.split(":").map(Number);
        const [endHour, endMin] = rule.endTime.split(":").map(Number);

        // 防御性检查：格式异常时返回 0:00-0:00（等价于禁用）
        if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
            return { startTime: 0, endTime: 0 };
        }

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return { startTime, endTime };
    }
}
