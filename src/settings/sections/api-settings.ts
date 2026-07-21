/**
 * 壁纸 API 管理设置区段
 * 从 DTBSettingTab 中提取的独立 section 类，负责壁纸 API 的显示、添加、编辑、删除和拖拽排序
 */
import { Notice, Setting } from "obsidian";
import { logger } from "../../core/logger";
import { t } from "../../i18n";
import { WallpaperApiEditorModal } from "../../modals";
import type DynamicThemeBackgroundPlugin from "../../plugin";
import type { BackgroundItem, DTBSettings } from "../../types";
import { DragSort, generateId } from "../../utils";
import {
    ApiStateSubscriber,
    BaseWallpaperApi,
    WallpaperApiConfig,
    WallpaperApiType,
    apiManager,
    apiRegistry,
} from "../../wallpaper-apis";

export class ApiSettingsSection {
    private plugin: DynamicThemeBackgroundPlugin;
    private defaultSettings: DTBSettings;

    private componentId: string;
    private container!: HTMLElement;
    private apiListContainer!: HTMLElement;
    private apiDragSort?: DragSort<WallpaperApiConfig>;

    /** 外部回调：刷新背景列表 */
    private onBackgroundsChanged?: () => void;
    /** 外部回调：刷新时间规则 */
    private onTimeRulesChanged?: () => void;

    constructor(
        plugin: DynamicThemeBackgroundPlugin,
        defaultSettings: DTBSettings,
        callbacks?: {
            onBackgroundsChanged?: () => void;
            onTimeRulesChanged?: () => void;
        }
    ) {
        this.plugin = plugin;
        this.defaultSettings = defaultSettings;
        this.componentId = generateId("api-settings-section");
        this.onBackgroundsChanged = callbacks?.onBackgroundsChanged;
        this.onTimeRulesChanged = callbacks?.onTimeRulesChanged;
    }

    /*
     * 显示壁纸 API 管理设置
     */
    display(container: HTMLElement): void {
        this.container = container;
        const containerEl = this.container;
        containerEl.empty();

        // 壁纸API管理标题
        new Setting(containerEl).setName(t("wallpaper_api_management_title")).setHeading();

        // 添加 API 按钮
        const buttonContainer = containerEl.createDiv("dtb-large-button-container");
        new Setting(buttonContainer)
            .setName(t("add_api_name"))
            .setDesc(t("add_api_desc"))
            .addButton((button) => {
                button.setButtonText(t("add_api_button"));
                button.onClick(() => this.showAddWallpaperApiModal());
            })
            // 添加新增所有默认 API 设置的恢复按钮，如果 API 已经存在则不添加
            .addExtraButton((button) => {
                button.setIcon("refresh-cw");
                button.setTooltip(t("restore_default_apis_tooltip"));
                button.onClick(async () => {
                    // 重新生成默认设置以获取最新的默认 API
                    const defaultApis = this.defaultSettings.wallpaperApis;

                    // 遍历默认 API，检查是否已存在
                    for (const apiConfig of defaultApis) {
                        const existingApi = this.plugin.settings.wallpaperApis.find((api) => api.id === apiConfig.id);
                        if (!existingApi) {
                            // 如果不存在，则添加并创建 API 实例
                            this.plugin.settings.wallpaperApis.push(apiConfig);
                            await this.plugin.createWallpaperApi(apiConfig, this.plugin.settings.enabled);
                        }
                    }
                    new Notice(t("restore_default_apis_success"));

                    await this.plugin.saveSettings();
                    this.display(this.container);
                });
            });

        // 添加 API 提示
        const hint = containerEl.createDiv("dtb-hint");
        hint.textContent = t("wallpaper_api_hint");

        // 显示现有API列表
        this.apiListContainer = containerEl.createDiv("dtb-section-container");
        this.displayWallpaperApis();
    }

    /*
     * 显示所有已配置的壁纸 API
     */
    displayWallpaperApis(): void {
        const container = this.apiListContainer;
        this.apiDragSort?.disableAllDrag();
        container.empty();

        // 初始化 API 拖拽排序
        this.apiDragSort = new DragSort<WallpaperApiConfig>({
            container,
            items: this.plugin.settings.wallpaperApis,
            getItemId: (api) => api.id,
            itemClass: "dtb-draggable",
            idDataAttribute: "apiId",
            onReorder: async (reorderedApis) => {
                this.plugin.settings.wallpaperApis = reorderedApis;
                await this.plugin.saveSettings();
                this.displayWallpaperApis();
            },
        });

        // API 列表
        this.plugin.settings.wallpaperApis.forEach((apiConfig: WallpaperApiConfig, index: number) => {
            const apiInstance = apiManager.getApiById(apiConfig.id);
            if (!apiInstance) {
                logger.warn(`API instance not found for ${apiConfig.name}`);
            }

            const description =
                apiInstance?.getDescription() ??
                apiConfig.description ??
                apiRegistry.getDefaultDescription(apiConfig.type) ??
                t("notice_api_secret_unavailable");
            const setting = new Setting(container).setName(apiConfig.name).setDesc(description);

            // 在设置项的控件区域直接添加类型标签
            setting.controlEl.createSpan({ text: apiConfig.type ?? "Unknown", cls: "dtb-badge" });

            // 注意：状态指示器和启用按钮的状态都以 API 实例的状态为准，配置项的 enabled 字段仅用于初始状态和保存设置时的同步。

            // 添加状态指示器
            const statusIndicator = setting.controlEl.createDiv("dtb-api-status");
            const statusDot = statusIndicator.createDiv("dtb-api-status-dot");
            const statusText = statusIndicator.createSpan();
            // 根据API的启用状态设置初始状态
            if (!apiInstance) {
                statusDot.addClass("error");
                statusText.textContent = t("status_error");
                statusText.title = t("notice_api_secret_unavailable");
            } else if (apiInstance.getEnabled()) {
                statusDot.addClass("enabled");
                statusText.textContent = t("status_enabled");
            } else {
                statusDot.addClass("disabled");
                statusText.textContent = t("status_disabled");
            }

            // 创建 toggle 并保存引用
            let toggleComponent: { setValue: (value: boolean) => void; getValue: () => boolean } | null = null;
            setting.addToggle((toggle) => {
                toggleComponent = toggle; // 保存 toggle 引用
                const toggleEl = toggle.setValue(apiInstance?.getEnabled() ?? false).setDisabled(!apiInstance);

                // 使用智能API管理方法
                toggleEl.onChange(async (value) => {
                    // 禁用toggle防止用户重复点击，并添加loading样式
                    toggle.setDisabled(true);
                    toggleEl.toggleEl.addClass("dtb-loading");

                    try {
                        let success: boolean;

                        if (value) {
                            // 使用智能启用方法
                            success = await apiManager.enableApi(apiConfig.id);
                        } else {
                            // 使用智能禁用方法
                            success = await apiManager.disableApi(apiConfig.id);
                        }

                        const action = value ? t("action_enable") : t("action_disable");
                        if (!success) {
                            new Notice(
                                t("notice_api_failed_enable_disable", { action, apiName: apiConfig.name }),
                                3000
                            );
                        } else {
                            new Notice(
                                t("notice_api_success_enable_disable", { action, apiName: apiConfig.name }),
                                3000
                            );
                        }
                    } catch (error) {
                        logger.error(`Error ${value ? "enabling" : "disabling"} API:`, error);
                        const action = value ? t("action_enable") : t("action_disable");
                        new Notice(t("notice_api_error_enable_disable", { action, apiName: apiConfig.name }), 3000);
                    } finally {
                        // 重新启用toggle并移除loading样式
                        toggle.setDisabled(false);
                        toggleEl.toggleEl.removeClass("dtb-loading");
                    }
                });

                return toggleEl;
            });

            // 订阅状态变化，使用 ApiStateSubscriber 对象进行标识
            const subscriber = new ApiStateSubscriber("toggle", this.componentId, apiConfig.id);
            apiManager.stateManager.subscribe(subscriber, async (state) => {
                // 更新状态点的样式
                statusDot.removeClass("enabled", "disabled", "error", "loading");

                if (state.isLoading) {
                    statusDot.addClass("loading");
                    statusText.textContent = t("status_loading");
                } else if (state.error) {
                    statusDot.addClass("error");
                    statusText.textContent = t("status_error");
                    statusText.title = state.error;
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== false) {
                        toggleComponent.setValue(false);
                    }
                    apiConfig.enabled = false;
                    await this.plugin.saveSettings();
                } else if (state.instanceEnabled) {
                    statusDot.addClass("enabled");
                    statusText.textContent = t("status_enabled");
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== true) {
                        toggleComponent.setValue(true);
                    }
                    apiConfig.enabled = true;
                    await this.plugin.saveSettings();
                } else {
                    statusDot.addClass("disabled");
                    statusText.textContent = t("status_disabled");
                    // 同步更新 toggle 状态
                    if (toggleComponent && toggleComponent.getValue() !== false) {
                        toggleComponent.setValue(false);
                    }
                    apiConfig.enabled = false;
                    await this.plugin.saveSettings();
                }
            });

            setting
                .addButton((button) =>
                    button
                        .setButtonText(t("button_add"))
                        .setTooltip(t("add_api_bg_tooltip"))
                        .setDisabled(!apiInstance)
                        .onClick(async () => {
                            if (apiInstance) await this.fetchWallpaperFromApi(apiInstance);
                        })
                )
                .addButton((button) =>
                    button.setButtonText(t("button_edit")).onClick(() => {
                        this.showEditWallpaperApiModal(apiConfig, index);
                    })
                )
                .addButton((button) =>
                    button.setButtonText(t("button_delete")).onClick(() => {
                        // 删除API实例
                        void apiManager.deleteApi(apiConfig.id);
                        // 删除插件设置中的API配置
                        this.plugin.settings.wallpaperApis = this.plugin.settings.wallpaperApis.filter(
                            (api) => api.id !== apiConfig.id
                        );
                        void this.plugin.saveSettings();
                        this.displayWallpaperApis();
                    })
                );

            // 设置拖拽属性
            setting.settingEl.addClass("dtb-draggable");
            setting.settingEl.dataset.apiId = apiConfig.id;

            // 添加通用条目样式类
            setting.settingEl.addClass("dtb-button-container"); // 按钮样式

            // 启用拖拽功能
            this.apiDragSort?.enableDragForElement(setting.settingEl, apiConfig);
        });
    }

    // 显示添加壁纸API的模态窗口
    private showAddWallpaperApiModal() {
        const emptyConfig: WallpaperApiConfig = {
            id: "",
            name: "",
            type: WallpaperApiType.Custom,
            baseUrl: "",
            enabled: false,
            params: {},
        };

        const modal = new WallpaperApiEditorModal(this.plugin, emptyConfig, async (apiConfig) => {
            // 添加到插件设置中
            this.plugin.settings.wallpaperApis.push(apiConfig);
            await this.plugin.saveSettings();
            await this.plugin.createWallpaperApi(apiConfig, this.plugin.settings.enabled);
            // 这里仅需刷新 api 列表
            this.displayWallpaperApis();
        });

        modal.open();
    }

    // 显示编辑壁纸API的模态窗口
    private showEditWallpaperApiModal(apiConfig: WallpaperApiConfig, index: number) {
        const modal = new WallpaperApiEditorModal(this.plugin, apiConfig, async (updatedConfig) => {
            this.plugin.settings.wallpaperApis[index] = updatedConfig;
            await this.plugin.saveSettings();
            // 有可能api类型也修改了，重新创建API实例覆盖原来的
            await this.plugin.createWallpaperApi(updatedConfig, this.plugin.settings.enabled);
            // 这里仅需刷新 api 列表
            this.displayWallpaperApis();
        });

        modal.open();
    }

    // 从API获取壁纸并添加到背景列表
    private async fetchWallpaperFromApi(api: BaseWallpaperApi) {
        if (!api.getEnabled()) {
            new Notice(t("notice_api_disabled", { apiName: api.getName() }));
            return;
        }

        try {
            // 显示加载提示
            const loadingNotice = new Notice(t("notice_api_fetching", { apiName: api.getName() }), 0);

            // 使用API管理器获取随机壁纸
            const wallpaperImages = await apiManager.getRandomWallpapers(api.getId());

            // 关闭加载提示
            loadingNotice.hide();

            if (wallpaperImages) {
                // 创建新的图片背景项
                const newBg: BackgroundItem = {
                    id: api.generateBackgroundId(),
                    name: api.generateBackgroundName(),
                    type: "image",
                    value: wallpaperImages[0].url,
                };

                // 添加到背景列表
                this.plugin.settings.backgrounds.push(newBg);
                await this.plugin.saveSettings();

                // 立即应用这个背景
                this.plugin.background = newBg;
                this.plugin.updateStyleCss();

                // 这里仅需刷新背景列表和时间规则
                this.onBackgroundsChanged?.();
                this.onTimeRulesChanged?.();

                new Notice(t("notice_api_success_applied", { apiName: api.getName() }));
            } else {
                new Notice(t("notice_api_failed_fetch", { apiName: api.getName() }));
            }
        } catch (error) {
            new Notice(t("notice_api_error_fetch", { apiName: api.getName(), error: (error as Error).message }));
            logger.error("Error fetching wallpaper:", error);
        }
    }

    /**
     * 清理工作
     */
    cleanup(): void {
        // 清理拖拽排序实例
        this.apiDragSort?.disableAllDrag();

        // 使用组件ID清理该组件的所有订阅
        apiManager.stateManager.cleanupByComponent(this.componentId);
    }
}
