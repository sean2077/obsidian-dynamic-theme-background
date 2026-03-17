/**
 * 背景管理区块
 * 从 DTBSettingTab 中提取的背景管理相关功能
 */
import { Notice, Setting, TFile } from "obsidian";
import { logger } from "../../core/logger";
import { t } from "../../i18n";
import { BackgroundModal, ImageFolderSuggestModal } from "../../modals";
import type DynamicThemeBackgroundPlugin from "../../plugin";
import type { BackgroundItem, DTBSettings } from "../../types";
import { DragSort, generateId } from "../../utils";

export class BgManagementSection {
    private plugin: DynamicThemeBackgroundPlugin;
    private defaultSettings: DTBSettings;

    private container!: HTMLElement;
    private bgListContainer!: HTMLElement;
    private backgroundDragSort?: DragSort<BackgroundItem>;

    /** Callback invoked when backgrounds change and external sections (e.g. time rules) need refresh */
    private onChanged?: () => void;

    constructor(
        plugin: DynamicThemeBackgroundPlugin,
        defaultSettings: DTBSettings,
        options?: { onChanged?: () => void }
    ) {
        this.plugin = plugin;
        this.defaultSettings = defaultSettings;
        this.onChanged = options?.onChanged;
    }

    display(container: HTMLElement): void {
        this.container = container;
        const containerEl = this.container;
        containerEl.empty();

        // 背景管理标题
        new Setting(containerEl).setName(t("bg_management_title")).setHeading();

        // 保存远程图片的本地路径
        const imageFolderInputContainer = containerEl.createDiv("setting-item dtb-flex-container-spaced");
        imageFolderInputContainer.createEl("label", { text: t("save_image_path_title") });
        const valueInput = imageFolderInputContainer.createEl("input", {
            type: "text",
            title: t("save_image_path_title"),
            placeholder: t("save_image_path_placeholder"),
            value: this.plugin.settings.localBackgroundFolder ?? "",
            cls: "dtb-flex-1",
        });
        valueInput.oninput = () => {
            this.plugin.settings.localBackgroundFolder = valueInput.value;
            void this.plugin.saveSettings();
        };
        const browseButton = imageFolderInputContainer.createEl("button", {
            type: "button",
            text: t("button_browse"),
            cls: "dtb-button",
        });
        browseButton.onclick = () => {
            const modal = new ImageFolderSuggestModal(this.plugin.app, (imagePath: string) => {
                valueInput.value = imagePath;
                this.plugin.settings.localBackgroundFolder = imagePath;
                void this.plugin.saveSettings();
            });
            modal.open();
        };

        // 添加背景的一组按钮
        const buttonContainer = containerEl.createDiv("dtb-large-button-container");
        new Setting(buttonContainer)
            .setName(t("add_new_bg_name"))
            .setDesc(t("add_new_bg_desc"))
            .addButton((button) =>
                button.setButtonText(t("add_image_bg_button")).onClick(() => this.showAddBackgroundModal("image"))
            )
            .addButton((button) =>
                button.setButtonText(t("add_color_bg_button")).onClick(() => this.showAddBackgroundModal("color"))
            )
            .addButton((button) =>
                button.setButtonText(t("add_gradient_bg_button")).onClick(() => this.showAddBackgroundModal("gradient"))
            )
            .addButton((button) =>
                button.setButtonText(t("add_folder_bg_button")).onClick(() => this.showAddFolderModal())
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip(t("restore_default_bg_tooltip"))
                    .onClick(() => this.restoreDefaultBackgrounds())
            );

        // 添加拖拽提示
        const dragHint = containerEl.createDiv("dtb-hint");
        dragHint.textContent = t("background_management_hint");

        this.bgListContainer = containerEl.createDiv("dtb-section-container");
        this.displayBackgrounds();
    }

    // 在指定的容器元素中渲染所有背景项
    displayBackgrounds(): void {
        const container = this.bgListContainer;
        this.backgroundDragSort?.disableAllDrag();
        container.empty();

        // 初始化背景拖拽排序
        this.backgroundDragSort = new DragSort<BackgroundItem>({
            container,
            items: this.plugin.settings.backgrounds,
            getItemId: (bg) => bg.id,
            itemClass: "dtb-draggable",
            idDataAttribute: "bgId",
            onReorder: async (reorderedBackgrounds) => {
                this.plugin.settings.backgrounds = reorderedBackgrounds;
                await this.plugin.saveSettings();
                // 这里仅需刷新背景列表和时间规则列表
                this.displayBackgrounds();
                this.onChanged?.();
            },
        });
        this.plugin.settings.backgrounds.forEach((bg: BackgroundItem, index: number) => {
            const bgEl = container.createDiv("dtb-item dtb-draggable");

            // 添加拖拽相关属性
            bgEl.draggable = true;
            bgEl.dataset.bgId = bg.id;
            bgEl.dataset.index = index.toString();

            // 添加拖拽手柄
            const dragHandle = bgEl.createDiv("dtb-drag-handle");
            dragHandle.textContent = "⋮⋮"; // 使用双点符号作为拖拽手柄
            dragHandle.title = t("drag_handle_tooltip");

            // 背景名称
            const contentDiv = bgEl.createDiv("dtb-bg-content");
            contentDiv.createSpan({ text: bg.name, cls: "dtb-bg-name" });

            // 如果是启用背景，添加图标
            if (bg.id === this.plugin.background?.id) {
                const icon = contentDiv.createSpan();
                icon.setText("🔥");
                icon.title = t("current_background");
            }

            // 背景类型
            contentDiv.createSpan({ text: bg.type, cls: "dtb-badge" });

            // 预览图
            const preview = contentDiv.createDiv("dtb-bg-preview");
            this.setPreviewBackground(preview, bg);

            // 操作按钮
            const actions = contentDiv.createDiv("dtb-button-container");

            // 预览按钮
            actions.createEl("button", { text: t("button_preview") }).onclick = () => {
                this.plugin.background = bg;
                this.plugin.settings.currentIndex = index; // 更新当前索引
                void this.plugin.saveSettings();
                this.plugin.updateStyleCss();
                this.displayBackgrounds(); // 刷新激活图标
            };

            // 保存按钮
            actions.createEl("button", { text: t("button_save") }).onclick = () => {
                void this.plugin.saveBackground(bg);
            };

            // 编辑按钮
            actions.createEl("button", { text: t("button_edit") }).onclick = () => {
                this.showEditBackgroundModal(bg, index);
            };

            // 删除按钮
            actions.createEl("button", { text: t("button_delete") }).onclick = () => {
                // 使用 filter 方法删除
                this.plugin.settings.backgrounds = this.plugin.settings.backgrounds.filter(
                    (b: BackgroundItem) => b.id !== bg.id
                );
                void this.plugin.saveSettings();
                // 这里仅需刷新背景列表和时间规则列表
                this.displayBackgrounds();
                this.onChanged?.();
            };

            // 启用拖拽功能
            this.backgroundDragSort?.enableDragForElement(bgEl, bg);
        });
    }

    cleanup(): void {
        this.backgroundDragSort?.disableAllDrag();
    }

    // 显示添加或编辑背景的模态窗口
    private showAddBackgroundModal(type: "image" | "color" | "gradient"): void {
        // 创建一个新的背景项，初始值为空
        const bg: BackgroundItem = {
            id: "",
            name: "",
            type,
            value: "",
        };
        const modal = new BackgroundModal(this.plugin.app, this.plugin, bg, (newBg: BackgroundItem) => {
            if (!newBg.name.trim() || !newBg.value.trim()) {
                new Notice(t("notice_name_and_value_required"));
                return;
            }
            newBg.name = newBg.name.trim();
            newBg.value = newBg.value.trim();

            // 生成唯一ID
            newBg.id = generateId("bg");

            // 添加到设置中
            this.plugin.settings.backgrounds.push(newBg);
            void this.plugin.saveSettings();

            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.onChanged?.();
        });

        modal.open();
    }

    // 显示编辑背景的模态窗口
    private showEditBackgroundModal(bg: BackgroundItem, index: number): void {
        const modal = new BackgroundModal(this.plugin.app, this.plugin, bg, (newBg: BackgroundItem) => {
            if (!newBg.name.trim() || !newBg.value.trim()) {
                new Notice(t("notice_name_and_value_required"));
                return;
            }
            newBg.name = newBg.name.trim();
            newBg.value = newBg.value.trim();

            // 更新现有背景项
            this.plugin.settings.backgrounds[index] = newBg;

            void this.plugin.saveSettings();

            // 如果当前正在使用这个背景，则更新显示
            if (this.plugin.background?.id === bg.id) {
                this.plugin.background = this.plugin.settings.backgrounds[index];
                this.plugin.updateStyleCss();
            }

            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.onChanged?.();
        });

        // 打开模态窗口（初始值已在 BackgroundModal.onOpen() 中从 bgItem 设置）
        modal.open();
    }

    private showAddFolderModal(): void {
        const modal = new ImageFolderSuggestModal(this.plugin.app, (folderPath: string) => {
            if (!folderPath.trim()) {
                new Notice(t("notice_valid_folder_path_required"));
                return;
            }

            // 检查文件夹是否存在
            const folder = this.plugin.app.vault.getAbstractFileByPath(folderPath);
            if (!folder) {
                new Notice(t("notice_folder_not_found"));
                return;
            }

            // 处理文件夹中的图片文件
            this.addImagesFromFolder(folderPath)
                .then(() => {
                    new Notice(t("notice_folder_added_successfully", { folderPath }));
                })
                .catch((error) => {
                    logger.error("Error adding images from folder:", error);
                    new Notice(t("notice_error_adding_folder_images"));
                });
        });

        modal.open();
    }

    private async restoreDefaultBackgrounds() {
        // 重新生成默认设置以获取最新的默认背景
        const defaultBackgrounds = this.defaultSettings.backgrounds;

        let addedCount = 0;

        // 遍历默认背景，只添加不存在的
        for (const defaultBg of defaultBackgrounds) {
            const existingBg = this.plugin.settings.backgrounds.find((bg) => bg.id === defaultBg.id);

            if (!existingBg) {
                // 创建新的背景项，确保 ID 唯一
                const newBg: BackgroundItem = {
                    id: defaultBg.id,
                    name: defaultBg.name,
                    type: defaultBg.type,
                    value: defaultBg.value,
                };

                this.plugin.settings.backgrounds.push(newBg);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await this.plugin.saveSettings();
            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.onChanged?.();
            new Notice(
                t("restore_default_bg_success", {
                    count: addedCount.toString(),
                })
            );
        } else {
            new Notice(t("restore_default_bg_no_new"));
        }
    }

    // 设置预览元素的背景样式 * 使用 CSS 自定义属性而不是内联样式，遵循 Obsidian 官方建议
    private setPreviewBackground(preview: HTMLElement, bg: BackgroundItem): void {
        // 移除之前的类型特定类名
        preview.removeClass("dtb-preview-image", "dtb-preview-color", "dtb-preview-gradient");

        // 清除之前设置的 CSS 自定义属性
        preview.setCssProps({
            "--dtb-preview-bg-image": "",
            "--dtb-preview-bg": "",
        });

        switch (bg.type) {
            case "image": {
                preview.addClass("dtb-preview-image");
                const sanitizedImagePath = this.plugin.getBgURL(bg);
                // 只有当图片路径有效时才设置 CSS 变量
                if (sanitizedImagePath && sanitizedImagePath !== "none") {
                    preview.setCssProps({
                        "--dtb-preview-bg-image": sanitizedImagePath,
                    });
                }
                break;
            }
            case "color":
            case "gradient": {
                preview.addClass(`dtb-preview-${bg.type}`);
                // 验证颜色/渐变值的有效性
                if (bg.value && bg.value.trim()) {
                    preview.setCssProps({
                        "--dtb-preview-bg": bg.value,
                    });
                }
                break;
            }
            default:
                logger.warn(`Unknown background type: ${bg.type as string}`);
                break;
        }
    }

    // 添加文件夹中的图片到背景列表
    private async addImagesFromFolder(folderPath: string) {
        try {
            // 标准化路径：移除开头和结尾的斜杠，只处理 vault 内的相对路径
            folderPath = folderPath.replace(/^\/+|\/+$/g, "");

            let folderFiles: TFile[] = [];

            if (folderPath !== "") {
                // 尝试获取指定文件夹
                const folder = this.plugin.app.vault.getFolderByPath(folderPath);
                if (folder) {
                    // 只获取该文件夹下的直接子文件（不递归）
                    folderFiles = this.plugin.app.vault.getFiles().filter((file) => {
                        const fileDir = file.path.substring(0, file.path.lastIndexOf("/"));
                        return fileDir === folderPath;
                    });
                } else {
                    new Notice(t("folder_not_found"));
                    return;
                }
            }

            if (folderFiles.length === 0) {
                new Notice(t("folder_not_found"));
                return;
            }

            await this.processImageFiles(folderFiles, folderPath);
        } catch (error) {
            logger.error("Error scanning folder:", error);
            new Notice(t("folder_scan_error", { error: (error as Error).message }));
        }
    }

    // 处理文件夹中的图片文件
    private async processImageFiles(files: TFile[], folderPath: string) {
        // 支持的图片格式
        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

        // 过滤出图片文件
        const imageFiles = files.filter((file) => imageExtensions.some((ext) => file.path.toLowerCase().endsWith(ext)));

        if (imageFiles.length === 0) {
            new Notice(t("folder_not_found"));
            return;
        }

        let addedCount = 0;

        for (const file of imageFiles) {
            // 检查是否已存在相同路径的背景
            const existingBg = this.plugin.settings.backgrounds.find(
                (bg) => bg.type === "image" && bg.value === file.path
            );

            if (!existingBg) {
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除扩展名
                // 只保留最后一级文件夹名称，避免长路径影响观感
                const folderName = folderPath === "" ? "root" : (folderPath.split("/").pop() ?? folderPath);
                const newBg: BackgroundItem = {
                    id: generateId("bg"),
                    name: `${fileName} (${folderName})`,
                    type: "image",
                    value: file.path,
                };

                this.plugin.settings.backgrounds.push(newBg);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await this.plugin.saveSettings();
            // 这里仅需刷新背景列表和时间规则列表
            this.displayBackgrounds();
            this.onChanged?.();
            new Notice(t("folder_scan_success", { count: addedCount.toString() }));
        } else {
            new Notice(t("folder_no_new_images"));
        }
    }
}
