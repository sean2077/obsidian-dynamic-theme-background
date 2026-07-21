/**
 * Pure local-time rule matching and next-boundary scheduling.
 */

import type { TimeRule } from "../types";

interface CompiledRule {
    endTime: number;
    order: number;
    rule: TimeRule;
    startTime: number;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export class TimeRuleScheduler {
    private rules: CompiledRule[] = [];

    constructor(rules: TimeRule[]) {
        this.updateRules(rules);
    }

    updateRules(rules: TimeRule[]): void {
        this.rules = rules
            .map((rule, order) => {
                if (!rule.enabled) return null;
                const parsed = this.parseTimeRule(rule);
                return parsed && parsed.startTime !== parsed.endTime
                    ? { ...parsed, order, rule }
                    : null;
            })
            .filter((rule): rule is CompiledRule => rule !== null)
            .sort((left, right) => left.startTime - right.startTime || left.order - right.order);
    }

    /**
     * Returns the first matching rule. Starts are inclusive and ends exclusive.
     * Equal start/end values represent an empty interval.
     */
    getCurrentRule(now = new Date()): TimeRule | null {
        const currentTime = now.getHours() * 60 + now.getMinutes();

        for (const { endTime, rule, startTime } of this.rules) {
            const matches =
                startTime > endTime
                    ? currentTime >= startTime || currentTime < endTime
                    : currentTime >= startTime && currentTime < endTime;
            if (matches) return rule;
        }
        return null;
    }

    /**
     * Returns the next configured local-time boundary as an epoch timestamp.
     * Date#setHours intentionally delegates daylight-saving normalization to
     * the host calendar (for example, 02:30 becomes 03:30 across a spring gap).
     */
    getNextChangeTime(now = new Date()): number | null {
        if (this.rules.length === 0) return null;

        const currentTime = now.getHours() * 60 + now.getMinutes();
        const timePoints = Array.from(
            new Set(this.rules.flatMap(({ endTime, startTime }) => [startTime, endTime]))
        ).sort((left, right) => left - right);
        const nextPoint = timePoints.find((point) => point > currentTime) ?? timePoints[0];

        const target = new Date(now);
        target.setHours(Math.floor(nextPoint / 60), nextPoint % 60, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }
        return target.getTime();
    }

    parseTimeRule(rule: TimeRule): { endTime: number; startTime: number } | null {
        if (!TIME_PATTERN.test(rule.startTime) || !TIME_PATTERN.test(rule.endTime)) {
            return null;
        }
        const [startHour, startMinute] = rule.startTime.split(":").map(Number);
        const [endHour, endMinute] = rule.endTime.split(":").map(Number);
        return {
            startTime: startHour * 60 + startMinute,
            endTime: endHour * 60 + endMinute,
        };
    }
}
