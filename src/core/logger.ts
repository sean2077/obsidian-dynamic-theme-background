/**
 * 统一日志工具
 * 替代分散的 console.debug/warn/error 调用，统一 "DTB" 前缀
 */

const PREFIX = "DTB";

export const logger = {
    debug: (msg: string, ...args: unknown[]) => console.debug(`${PREFIX}: ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`${PREFIX}: ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`${PREFIX}: ${msg}`, ...args),
};
