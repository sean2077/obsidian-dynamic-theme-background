/**
 * 通用拖拽排序工具类
 * 支持对任意列表进行拖拽排序操作
 */

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
    /** 拖拽项目类名 */
    itemClass?: string;
    /** ID数据属性名 */
    idDataAttribute?: string;
    /** 排序完成后的回调函数 */
    onReorder: (items: T[]) => Promise<void> | void;
    /** 拖拽开始时的回调函数 */
    onDragStart?: (item: T) => void;
    /** 拖拽结束时的回调函数 */
    onDragEnd?: (item: T) => void;
}

/**
 * 通用拖拽排序工具类
 */
export class DragSort<T> {
    private config: DragSortConfig<T>;
    private dragHandles: WeakMap<HTMLElement, () => void> = new WeakMap();

    constructor(config: DragSortConfig<T>) {
        this.config = {
            itemClass: "dtb-draggable",
            idDataAttribute: "itemId",
            ...config,
        };
    }

    /**
     * 为指定元素添加拖拽功能
     */
    public enableDragForElement(element: HTMLElement, item: T): void {
        const itemId = this.config.getItemId(item);

        // 设置拖拽属性
        element.draggable = true;
        if (this.config.itemClass) {
            element.classList.add(this.config.itemClass);
        }
        if (this.config.idDataAttribute) {
            element.dataset[this.config.idDataAttribute] = itemId;
        }

        // 添加拖拽事件监听器
        this.addDragListeners(element, item);
    }

    /**
     * 为容器内的所有项目启用拖拽功能
     */
    public enableDragForAllItems(): void {
        const elements = this.config.container.querySelectorAll(`.${this.config.itemClass}`);
        elements.forEach((element, index) => {
            if (index < this.config.items.length) {
                this.enableDragForElement(element as HTMLElement, this.config.items[index]);
            }
        });
    }

    /**
     * 禁用指定元素的拖拽功能
     */
    public disableDragForElement(element: HTMLElement): void {
        element.draggable = false;
        if (this.config.itemClass) {
            element.classList.remove(this.config.itemClass);
        }

        // 移除事件监听器
        const cleanup = this.dragHandles.get(element);
        if (cleanup) {
            cleanup();
            this.dragHandles.delete(element);
        }
    }

    /**
     * 禁用所有拖拽功能
     */
    public disableAllDrag(): void {
        const elements = this.config.container.querySelectorAll(`.${this.config.itemClass}`);
        elements.forEach((element) => {
            this.disableDragForElement(element as HTMLElement);
        });
    }

    /**
     * 更新配置
     */
    public updateConfig(newConfig: Partial<DragSortConfig<T>>): void {
        this.config = { ...this.config, ...newConfig };
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
            this.config.onDragStart?.(item);
        };

        const dragEndHandler = () => {
            element.classList.remove("dtb-dragging");
            // 移除所有拖拽相关的样式
            const allItems = this.config.container.querySelectorAll(`.${this.config.itemClass}`);
            allItems?.forEach((item) => {
                item.classList.remove("dtb-drag-over", "dtb-drag-over-top", "dtb-drag-over-bottom");
            });
            this.config.onDragEnd?.(item);
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

        const dropHandler = async (e: DragEvent) => {
            e.preventDefault();

            const draggedId = e.dataTransfer?.getData("text/plain");
            const targetId = this.config.idDataAttribute ? element.dataset[this.config.idDataAttribute] : undefined;

            if (!draggedId || !targetId || draggedId === targetId) {
                return;
            }

            // 确定插入位置
            const rect = element.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const insertAfter = e.clientY >= midpoint;

            await this.reorderItems(draggedId, targetId, insertAfter);

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
            console.warn("DTB: Invalid drag operation - item not found");
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

        // 更新配置中的项目列表
        this.config.items.splice(0, this.config.items.length, ...items);

        // 调用重排序回调
        await this.config.onReorder(items);
    }
}
