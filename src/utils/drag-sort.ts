/**
 * 通用拖拽排序工具类
 * 支持对任意列表进行拖拽排序操作
 */

import { logger } from "../core/logger";

const DRAGGABLE_CLASS = "dtb-draggable";

/**
 * 拖拽排序配置接口
 */
export interface DragSortConfig<T> {
    /** 容器元素 */
    container: HTMLElement;
    /** 拖拽项目列表 */
    items: T[];
    /** 获取项目唯一ID的函数 */
    getItemId: (item: T) => string;
    /** Accessible labels for optional keyboard/touch reorder buttons. */
    reorderLabels?: { up: string; down: string };
    /** 排序完成后的回调函数 */
    onReorder: (items: T[]) => Promise<void> | void;
    /** Publish replacement arrays owned outside this module; also used for rollback. */
    setItems?: (items: T[]) => void;
}

export type ReorderDirection = -1 | 1;

/**
 * 通用拖拽排序工具类
 */
export class DragSort<T> {
    private config: DragSortConfig<T>;
    private dragHandles: WeakMap<HTMLElement, () => void> = new WeakMap();
    private reorderPending = false;

    constructor(config: DragSortConfig<T>) {
        this.config = config;
    }

    /**
     * 为指定元素添加拖拽功能
     */
    public enableDragForElement(element: HTMLElement, item: T, reorderControls?: HTMLElement): void {
        const itemId = this.config.getItemId(item);

        // 设置拖拽属性
        element.draggable = true;
        element.classList.add(DRAGGABLE_CLASS);
        element.dataset.itemId = itemId;

        // 添加拖拽事件监听器
        this.addDragListeners(element, item);
        if (reorderControls) this.addReorderControls(reorderControls, item);
    }

    /**
     * 禁用指定元素的拖拽功能
     */
    public disableDragForElement(element: HTMLElement): void {
        element.draggable = false;
        element.classList.remove(DRAGGABLE_CLASS);

        // 移除事件监听器（WeakMap 自动清理引用，无需手动 delete）
        const cleanup = this.dragHandles.get(element);
        if (cleanup) {
            cleanup();
        }
    }

    /**
     * 禁用所有拖拽功能
     */
    public disableAllDrag(): void {
        const elements = this.config.container.querySelectorAll(`.${DRAGGABLE_CLASS}`);
        elements.forEach((element) => {
            this.disableDragForElement(element as HTMLElement);
        });
    }

    /** Return whether an item can move one position in the requested direction. */
    public canMove(item: T, direction: ReorderDirection): boolean {
        if (this.reorderPending) return false;
        const index = this.findItemIndex(item);
        const targetIndex = index + direction;
        return index >= 0 && targetIndex >= 0 && targetIndex < this.config.items.length;
    }

    /** Move an item one position without requiring pointer drag support. */
    public async moveItem(item: T, direction: ReorderDirection): Promise<boolean> {
        if (!this.canMove(item, direction)) return false;

        const items = [...this.config.items];
        const currentIndex = this.findItemIndex(item);
        const [movedItem] = items.splice(currentIndex, 1);
        items.splice(currentIndex + direction, 0, movedItem);
        return this.commitReorder(items);
    }

    /**
     * 添加拖拽事件监听器
     */
    private addDragListeners(element: HTMLElement, item: T): void {
        const dragStartHandler = (e: DragEvent) => {
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", this.config.getItemId(item));
                element.classList.add("dtb-dragging");
            }
        };

        const dragEndHandler = () => {
            element.classList.remove("dtb-dragging");
            // 移除所有拖拽相关的样式
            const allItems = this.config.container.querySelectorAll(`.${DRAGGABLE_CLASS}`);
            allItems?.forEach((item) => {
                item.classList.remove("dtb-drag-over", "dtb-drag-over-top", "dtb-drag-over-bottom");
            });
        };

        const dragOverHandler = (e: DragEvent) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = "move";
            }

            // 确定拖拽位置（上半部分还是下半部分）
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const isTopHalf = e.clientY < midpoint;

            // 移除之前的样式
            element.classList.remove("dtb-drag-over-top", "dtb-drag-over-bottom");

            // 添加适当的样式
            if (isTopHalf) {
                element.classList.add("dtb-drag-over-top");
            } else {
                element.classList.add("dtb-drag-over-bottom");
            }
        };

        const dragLeaveHandler = (e: DragEvent) => {
            // 只有当鼠标真正离开元素时才移除样式
            if (!element.contains(e.relatedTarget as Node)) {
                element.classList.remove("dtb-drag-over-top", "dtb-drag-over-bottom");
            }
        };

        const dropHandler = (e: DragEvent) => {
            e.preventDefault();

            const draggedId = e.dataTransfer?.getData("text/plain");
            const targetId = element.dataset.itemId;

            if (!draggedId || !targetId || draggedId === targetId) {
                return;
            }

            // 确定插入位置
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const insertAfter = e.clientY >= midpoint;

            void this.reorderItems(draggedId, targetId, insertAfter).catch((error) =>
                logger.error("Reorder", error)
            );

            // 清理样式
            element.classList.remove("dtb-drag-over-top", "dtb-drag-over-bottom");
        };

        // 添加事件监听器
        element.addEventListener("dragstart", dragStartHandler);
        element.addEventListener("dragend", dragEndHandler);
        element.addEventListener("dragover", dragOverHandler);
        element.addEventListener("dragleave", dragLeaveHandler);
        element.addEventListener("drop", dropHandler);

        // 保存清理函数
        const cleanup = () => {
            element.removeEventListener("dragstart", dragStartHandler);
            element.removeEventListener("dragend", dragEndHandler);
            element.removeEventListener("dragover", dragOverHandler);
            element.removeEventListener("dragleave", dragLeaveHandler);
            element.removeEventListener("drop", dropHandler);
        };
        this.dragHandles.set(element, cleanup);
    }

    /**
     * 重新排序项目
     */
    private async reorderItems(draggedId: string, targetId: string, insertAfter: boolean): Promise<void> {
        const items = [...this.config.items];
        const draggedIndex = items.findIndex((item) => this.config.getItemId(item) === draggedId);
        const targetIndex = items.findIndex((item) => this.config.getItemId(item) === targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            logger.warn("Invalid drag operation - item not found");
            return;
        }

        // 如果拖拽到相同位置，则不做任何操作
        if (
            draggedIndex === targetIndex ||
            (insertAfter && draggedIndex === targetIndex + 1) ||
            (!insertAfter && draggedIndex === targetIndex - 1)
        ) {
            return;
        }

        // 移除被拖拽的元素
        const draggedItem = items.splice(draggedIndex, 1)[0];

        // 计算新的插入位置
        let newTargetIndex = items.findIndex((item) => this.config.getItemId(item) === targetId);
        if (insertAfter) {
            newTargetIndex++;
        }

        // 插入到新位置
        items.splice(newTargetIndex, 0, draggedItem);

        await this.commitReorder(items);
    }

    private findItemIndex(item: T): number {
        const itemId = this.config.getItemId(item);
        return this.config.items.findIndex((candidate) => this.config.getItemId(candidate) === itemId);
    }

    private addReorderControls(container: HTMLElement, item: T): void {
        const labels = this.config.reorderLabels;
        if (!labels) return;
        for (const direction of [-1, 1] as const) {
            const label = direction < 0 ? labels.up : labels.down;
            const button = container.createEl("button", {
                text: direction < 0 ? "↑" : "↓",
                cls: "dtb-reorder-button",
                attr: { "aria-label": label },
            });
            button.disabled = !this.canMove(item, direction);
            button.onclick = () => {
                void this.moveItem(item, direction).catch((error) =>
                    logger.error("Reorder", error)
                );
            };
        }
    }

    private async commitReorder(items: T[]): Promise<boolean> {
        if (this.reorderPending) return false;

        const previousItems = [...this.config.items];
        this.reorderPending = true;
        this.config.items.splice(0, this.config.items.length, ...items);
        this.config.setItems?.([...items]);
        try {
            await this.config.onReorder([...items]);
            return true;
        } catch (error) {
            this.config.items.splice(0, this.config.items.length, ...previousItems);
            this.config.setItems?.([...previousItems]);
            throw error;
        } finally {
            this.reorderPending = false;
        }
    }
}
