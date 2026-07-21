import assert from "node:assert/strict";
import test from "node:test";

import { TimeRuleScheduler } from "../src/core/time-rule-scheduler";
import type { TimeRule } from "../src/types";

function rule(id: string, startTime: string, endTime: string, enabled = true): TimeRule {
    return {
        backgroundId: id,
        enabled,
        endTime,
        id,
        name: id,
        startTime,
    };
}

function localDate(hour: number, minute: number): Date {
    return new Date(2026, 0, 15, hour, minute, 0, 0);
}

void test("matches normal and cross-midnight intervals at exact boundaries", () => {
    const scheduler = new TimeRuleScheduler([rule("day", "06:00", "18:00"), rule("night", "18:00", "06:00")]);

    assert.equal(scheduler.getCurrentRule(localDate(6, 0))?.id, "day");
    assert.equal(scheduler.getCurrentRule(localDate(17, 59))?.id, "day");
    assert.equal(scheduler.getCurrentRule(localDate(18, 0))?.id, "night");
    assert.equal(scheduler.getCurrentRule(localDate(5, 59))?.id, "night");
});

void test("ignores disabled, malformed, out-of-range, and zero-length rules", () => {
    const scheduler = new TimeRuleScheduler([
        rule("disabled", "00:00", "23:59", false),
        rule("malformed", "oops", "12:00"),
        rule("range", "25:99", "12:00"),
        rule("empty", "10:00", "10:00"),
    ]);

    assert.equal(scheduler.getCurrentRule(localDate(10, 0)), null);
    assert.equal(scheduler.getNextChangeTime(localDate(10, 0)), null);
    assert.equal(scheduler.parseTimeRule(rule("bad", "1:00", "02:00")), null);
});

void test("resolves overlaps deterministically by start then configuration order", () => {
    const first = rule("first", "00:00", "04:00");
    const second = rule("second", "00:00", "03:00");
    const night = rule("night", "22:00", "06:00");
    const scheduler = new TimeRuleScheduler([first, second, night]);

    assert.equal(scheduler.getCurrentRule(localDate(1, 0))?.id, "first");
    assert.equal(scheduler.getCurrentRule(localDate(4, 0))?.id, "night");
});

void test("returns the next distinct boundary today or tomorrow", () => {
    const scheduler = new TimeRuleScheduler([rule("day", "06:00", "18:00"), rule("night", "18:00", "06:00")]);

    assert.equal(scheduler.getNextChangeTime(localDate(17, 59)), localDate(18, 0).getTime());
    const tomorrow = localDate(6, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.equal(scheduler.getNextChangeTime(localDate(18, 0)), tomorrow.getTime());
});

void test("uses host calendar normalization across daylight-saving changes", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
        const springScheduler = new TimeRuleScheduler([rule("gap", "02:30", "04:00")]);
        const springNow = new Date(2026, 2, 8, 1, 55, 0, 0);
        const springTarget = new Date(springScheduler.getNextChangeTime(springNow) ?? 0);
        assert.equal(springTarget.getHours(), 3);
        assert.equal(springTarget.getMinutes(), 30);
        assert.ok(springTarget.getTime() > springNow.getTime());

        const fallScheduler = new TimeRuleScheduler([rule("repeat", "01:30", "02:30")]);
        const fallNow = new Date(2026, 10, 1, 0, 55, 0, 0);
        const fallTarget = fallScheduler.getNextChangeTime(fallNow) ?? 0;
        assert.ok(fallTarget > fallNow.getTime());
    } finally {
        if (originalTimeZone === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = originalTimeZone;
        }
    }
});
