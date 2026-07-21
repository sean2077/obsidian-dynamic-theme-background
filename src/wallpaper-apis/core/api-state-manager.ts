/**
 * API状态管理器
 * 专门用于管理API的配置状态、实例状态和UI状态之间的同步
 */

import { logger } from "../../core/logger";

/**
 * API状态订阅者
 */
export class ApiStateSubscriber {
    name: string;
    componentId: string;
    apiId: string;

    constructor(name: string, componentId: string, apiId: string) {
        this.name = name;
        this.componentId = componentId;
        this.apiId = apiId;
    }

    /**
     * 生成订阅者的唯一标识
     */
    key(): string {
        return `${this.apiId}::${this.componentId}::${this.name}`;
    }
}

export class ApiStateManager {
    private listeners: Map<
        string,
        { subscriber: ApiStateSubscriber; callback: (state: ApiState) => void | Promise<void> }
    > = new Map();

    /**
     * 订阅API状态变化
     * @param subscriber 订阅者对象
     * @param callback 状态变化回调（支持同步和异步）
     */
    subscribe(subscriber: ApiStateSubscriber, callback: (state: ApiState) => void | Promise<void>): () => void {
        const key = subscriber.key();
        this.listeners.set(key, { subscriber, callback });

        return () => {
            this.listeners.delete(key);
        };
    }

    /**
     * 通知状态变化
     * @param apiId API ID
     * @param state 新状态
     */
    notify(apiId: string, state: ApiState): void {
        // 立即返回，异步执行所有回调以避免阻塞调用者
        window.setTimeout(() => {
            for (const { subscriber, callback } of this.listeners.values()) {
                if (subscriber.apiId !== apiId) continue;

                void Promise.resolve()
                    .then(() => callback(state))
                    .catch((error: unknown) => {
                        logger.warn(`Error in state change callback for ${subscriber.name}:`, error);
                    });
            }
        }, 0);
    }

    /**
     * 按组件ID清理订阅
     * @param componentId 组件ID
     */
    cleanupByComponent(componentId: string): void {
        for (const [key, { subscriber }] of this.listeners.entries()) {
            if (subscriber.componentId === componentId) {
                this.listeners.delete(key);
            }
        }
    }

    /**
     * 清理指定API的所有订阅
     * @param apiId API ID
     */
    cleanupByApiId(apiId: string): void {
        for (const [key, { subscriber }] of this.listeners.entries()) {
            if (subscriber.apiId === apiId) {
                this.listeners.delete(key);
            }
        }
    }

    /**
     * 清理所有监听器
     */
    cleanup(): void {
        this.listeners.clear();
    }
}

export interface ApiState {
    configEnabled: boolean;
    instanceEnabled: boolean;
    isLoading: boolean;
    error?: string;
}
