/**
 * 统一的类型安全事件总线
 * 替代原有的多种通知机制（ApiStateManager 的观察者模式、插件直接方法调用、workspace 事件）
 */

import type { BackgroundItem, DTBSettings } from "../types";
import { logger } from "./logger";

/**
 * API 状态信息
 */
export interface ApiStateInfo {
    configEnabled: boolean;
    instanceEnabled: boolean;
    isLoading: boolean;
    error?: string;
}

/**
 * 事件映射：事件名 → 载荷类型
 */
export interface DTBEventMap {
    "background:changed": { background: BackgroundItem | null };
    "settings:changed": { key: keyof DTBSettings; value: unknown };
    "api:state-changed": { apiId: string; state: ApiStateInfo };
    "time-rules:changed": Record<string, never>;
    "backgrounds:changed": Record<string, never>;
    "apis:changed": Record<string, never>;
    "css:updated": Record<string, never>;
}

export type DTBEventKey = keyof DTBEventMap;

type Listener<T> = (payload: T) => void;

/**
 * 类型安全的事件总线
 */
export class EventBus {
    private listeners = new Map<string, Set<Listener<unknown>>>();

    /**
     * 订阅事件，返回取消订阅函数
     */
    on<K extends DTBEventKey>(event: K, cb: Listener<DTBEventMap[K]>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const set = this.listeners.get(event)!;
        set.add(cb as Listener<unknown>);

        return () => {
            set.delete(cb as Listener<unknown>);
            if (set.size === 0) {
                this.listeners.delete(event);
            }
        };
    }

    /**
     * 发送事件（同步通知所有监听器）
     */
    emit<K extends DTBEventKey>(event: K, payload: DTBEventMap[K]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const cb of [...set]) {
            try {
                cb(payload);
            } catch (error) {
                logger.error(`Event listener failed for "${event}"`, error);
            }
        }
    }

    /**
     * 移除指定事件的指定监听器
     */
    off<K extends DTBEventKey>(event: K, cb: Listener<DTBEventMap[K]>): void {
        const set = this.listeners.get(event);
        if (!set) return;
        set.delete(cb as Listener<unknown>);
        if (set.size === 0) {
            this.listeners.delete(event);
        }
    }

    /**
     * 移除所有监听器
     */
    removeAllListeners(): void {
        this.listeners.clear();
    }
}
