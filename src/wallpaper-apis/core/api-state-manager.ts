/**
 * API状态管理器
 * 专门用于管理API的配置状态、实例状态和UI状态之间的同步
 */

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
        setTimeout(async () => {
            const callbackPromises: Promise<void>[] = [];

            for (const { subscriber, callback } of this.listeners.values()) {
                if (subscriber.apiId === apiId) {
                    // 创建一个 Promise 来处理每个回调（无论同步还是异步）
                    const callbackPromise = Promise.resolve().then(async () => {
                        try {
                            const result = callback(state);
                            // 如果是 Promise，等待完成
                            if (result && typeof result.then === "function") {
                                await result;
                            }
                        } catch (error) {
                            console.warn(`DTB: Error in state change callback for ${subscriber.name}:`, error);
                        }
                    });

                    callbackPromises.push(callbackPromise);
                }
            }

            // 并发执行所有回调，但不等待结果（火后即忘模式）
            if (callbackPromises.length > 0) {
                Promise.all(callbackPromises).catch((error) => {
                    console.warn("DTB: Unexpected error in state notification batch:", error);
                });
            }
        }, 0);
    }

    /**
     * 按订阅者清理订阅
     * @param subscriber 订阅者对象
     */
    cleanupBySubscriber(subscriber: ApiStateSubscriber): void {
        const key = subscriber.key();
        this.listeners.delete(key);
    }

    /**
     * 按组件ID清理订阅
     * @param componentId 组件ID
     */
    cleanupByComponent(componentId: string): void {
        const keysToDelete: string[] = [];
        for (const [key, { subscriber }] of this.listeners.entries()) {
            if (subscriber.componentId === componentId) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => this.listeners.delete(key));
    }

    /**
     * 清理指定API的所有订阅
     * @param apiId API ID
     */
    cleanupByApiId(apiId: string): void {
        const keysToDelete: string[] = [];
        for (const [key, { subscriber }] of this.listeners.entries()) {
            if (subscriber.apiId === apiId) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => this.listeners.delete(key));
    }

    /**
     * 检查是否已订阅
     * @param subscriber 订阅者对象
     */
    hasSubscription(subscriber: ApiStateSubscriber): boolean {
        const key = subscriber.key();
        return this.listeners.has(key);
    }

    /**
     * 获取订阅统计信息
     */
    getStats(): { totalSubscriptions: number; apiCount: number; subscriberCount: number; componentCount: number } {
        const apis = new Set<string>();
        const components = new Set<string>();

        for (const { subscriber } of this.listeners.values()) {
            apis.add(subscriber.apiId);
            components.add(subscriber.componentId);
        }

        return {
            totalSubscriptions: this.listeners.size,
            apiCount: apis.size,
            subscriberCount: this.listeners.size, // 每个订阅对应一个订阅者
            componentCount: components.size,
        };
    }

    /**
     * 获取指定API的所有订阅者
     * @param apiId API ID
     */
    getSubscribers(apiId: string): ApiStateSubscriber[] {
        const result: ApiStateSubscriber[] = [];
        for (const { subscriber } of this.listeners.values()) {
            if (subscriber.apiId === apiId) {
                result.push(subscriber);
            }
        }
        return result;
    }

    /**
     * 按组件ID获取订阅者
     * @param componentId 组件ID
     */
    getSubscribersByComponent(componentId: string): ApiStateSubscriber[] {
        const result: ApiStateSubscriber[] = [];
        for (const { subscriber } of this.listeners.values()) {
            if (subscriber.componentId === componentId) {
                result.push(subscriber);
            }
        }
        return result;
    }

    /**
     * 按名称查找订阅者
     * @param name 订阅者名称
     */
    getSubscribersByName(name: string): ApiStateSubscriber[] {
        const result: ApiStateSubscriber[] = [];
        for (const { subscriber } of this.listeners.values()) {
            if (subscriber.name === name) {
                result.push(subscriber);
            }
        }
        return result;
    }

    /**
     * 获取所有API ID
     */
    getApiIds(): string[] {
        const apis = new Set<string>();
        for (const { subscriber } of this.listeners.values()) {
            apis.add(subscriber.apiId);
        }
        return Array.from(apis);
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
