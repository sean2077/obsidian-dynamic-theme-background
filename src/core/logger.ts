/**
 * 统一日志工具
 * 替代分散的 console.debug/warn/error 调用，统一 "DTB" 前缀
 */

import { redactSensitiveText, sanitizeForLog } from "./network-policy";

const PREFIX = "DTB";

function sanitize(args: unknown[]): unknown[] {
    return args.map((value) => sanitizeForLog(value));
}

export const logger = {
    debug: (msg: string, ...args: unknown[]) =>
        console.debug(`${PREFIX}: ${redactSensitiveText(msg)}`, ...sanitize(args)),
    warn: (msg: string, ...args: unknown[]) =>
        console.warn(`${PREFIX}: ${redactSensitiveText(msg)}`, ...sanitize(args)),
    error: (msg: string, ...args: unknown[]) =>
        console.error(`${PREFIX}: ${redactSensitiveText(msg)}`, ...sanitize(args)),
};
