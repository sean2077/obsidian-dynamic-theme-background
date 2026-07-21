import { Modal, Notice, SecretComponent } from "obsidian";
import { isCredentialParameterKey } from "../core/credential-storage";
import { logger } from "../core/logger";
import type DynamicThemeBackgroundPlugin from "../plugin";
import { generateId } from "../utils/utils";
import { isRecord } from "../utils/type-guards";
import { t } from "../i18n";
import {
    apiManager,
    apiRegistry,
    ApiValueType,
    OptionalApiValueType,
    OptionalUiValueType,
    WallpaperApiConfig,
    WallpaperApiParamDescriptor,
    WallpaperApiType,
} from "../wallpaper-apis";

function isApiValue(value: unknown): value is ApiValueType {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

type SecretInput = { key: HTMLInputElement; secretId: string };

/**
 * 壁纸 API 编辑模态框类，用于在 Obsidian 插件中创建和编辑壁纸 API 配置。
 */
export class WallpaperApiEditorModal extends Modal {
    plugin: DynamicThemeBackgroundPlugin;
    apiConfig: WallpaperApiConfig;
    onSubmit: (apiConfig: WallpaperApiConfig) => void | Promise<void>;

    // 基础配置输入元素
    nameInput!: HTMLInputElement;
    descInput!: HTMLInputElement; // 可选描述输入
    typeSelect!: HTMLSelectElement;
    urlInput!: HTMLInputElement;
    // Headers配置
    headersContainer!: HTMLDivElement;
    headerInputs: SecretInput[] = [];

    // 参数配置容器的引用
    paramsSectionContainer!: HTMLElement;
    // 动态参数输入元素映射
    paramInputs: Map<string, HTMLElement> = new Map();
    secretParamRefs: Map<string, string> = new Map();
    secretParamsContainer!: HTMLDivElement;
    extraSecretParamInputs: SecretInput[] = [];
    // 额外参数输入
    extraParamsTextarea!: HTMLTextAreaElement;

    // 自定义设置容器的引用
    customSettingsSectionContainer!: HTMLElement;
    // 自定义设置输入元素
    customSettingsInputs: Map<string, HTMLElement> = new Map();

    constructor(
        plugin: DynamicThemeBackgroundPlugin,
        apiConfig: WallpaperApiConfig,
        onSubmit: (apiConfig: WallpaperApiConfig) => void | Promise<void>
    ) {
        super(plugin.app);
        this.plugin = plugin;
        this.apiConfig = apiConfig;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // 为模态框添加自定义CSS类以控制宽度
        contentEl.addClass("dtb-api-modal-container");

        contentEl.createEl("h2", {
            text: this.apiConfig.id ? t("api_modal_title_edit") : t("api_modal_title_add"),
        });

        // 第一部分：基础配置
        this.createBasicConfigSection(contentEl);

        // 第二部分：API参数配置
        this.createParamsSection(contentEl);

        // 第三部分：自定义设置
        this.createCustomSettingsSection(contentEl);

        // 按钮
        this.createButtonSection(contentEl);
    }

    // 创建基础配置部分
    private createBasicConfigSection(container: HTMLElement) {
        const section = container.createDiv("dtb-section-container");
        section.createEl("h3", { text: t("api_modal_basic_config") });

        // API名称
        section.createEl("label", { text: t("api_modal_api_name") });
        this.nameInput = section.createEl("input", {
            type: "text",
            value: this.apiConfig.name,
            placeholder: t("api_modal_api_name_placeholder"),
            cls: ["dtb-input"],
        });
        // 可选描述
        section.createEl("label", { text: t("api_modal_description_optional") });
        this.descInput = section.createEl("input", {
            type: "text",
            value: this.apiConfig.description,
            placeholder: this.getDefaultDescriptionForType(this.apiConfig.type),
            cls: ["dtb-input"],
        });

        // API类型选择
        section.createEl("label", { text: t("api_modal_api_type") });
        this.typeSelect = section.createEl("select", { cls: "dtb-dropdown" });

        const apiTypes = Object.values(WallpaperApiType);
        apiTypes.forEach((type) => {
            const option = this.typeSelect.createEl("option", {
                value: type,
                text: type,
            });
            if (this.apiConfig.type === type) {
                option.selected = true;
            }
        });

        // 监听类型变化，重新生成参数配置和自定义设置
        this.typeSelect.addEventListener("change", () => {
            this.updateDescriptionPlaceholder();
            this.updateUrlPlaceholder();
            this.refreshParamsSection();
            this.refreshCustomSettingsSection(); // 新增：刷新自定义设置
        });

        // API URL
        section.createEl("label", { text: t("api_modal_api_url") });

        // 获取默认 URL 作为 placeholder
        const defaultUrl = this.getDefaultUrlForType(this.apiConfig.type);
        this.urlInput = section.createEl("input", {
            type: "text",
            value: this.apiConfig.baseUrl,
            placeholder: defaultUrl || "https://api.example.com/...",
            cls: "dtb-input",
        });

        // Headers配置
        this.createHeadersSection(section);
    }

    // 创建Headers配置部分
    private createHeadersSection(container: HTMLElement) {
        container.createEl("label", { text: t("api_modal_headers_optional") });
        this.headersContainer = container.createDiv("dtb-list-container");

        // 渲染已有的 SecretStorage 引用
        if (this.apiConfig.secretRefs?.headers) {
            Object.entries(this.apiConfig.secretRefs.headers).forEach(([key, secretId]) => {
                this.addSecretInput("header", key, secretId);
            });
        }

        // 添加header按钮
        const addHeaderBtn = container.createEl("button", {
            text: t("api_modal_add_header"),
            type: "button",
            cls: "dtb-button",
        });
        addHeaderBtn.onclick = () => this.addSecretInput("header");
    }

    // 创建参数配置部分
    private createParamsSection(container: HTMLElement) {
        this.paramsSectionContainer = container.createDiv("dtb-section-container");
        this.refreshParamsSection();
    }

    // 刷新参数配置部分
    private refreshParamsSection() {
        // 清除现有的参数输入
        this.paramInputs.clear();
        this.secretParamRefs.clear();
        this.extraSecretParamInputs = [];

        // 使用保存的容器引用而不是DOM查询
        if (!this.paramsSectionContainer) return;

        // 清空容器并重新创建所有内容
        this.paramsSectionContainer.empty();

        // 重新创建标题和文档链接
        this.createParamsSectionHeader();

        // 创建参数输入
        const selectedType = (this.typeSelect?.value as WallpaperApiType) || this.apiConfig.type;
        const paramDescriptors = this.getParamDescriptorsForType(selectedType);

        if (paramDescriptors.length > 0) {
            this.createDynamicParamInputs(this.paramsSectionContainer, paramDescriptors);
        }

        // 额外参数JSON输入
        this.createExtraParamsInput(this.paramsSectionContainer);
        if (selectedType === WallpaperApiType.Custom) {
            this.createSecretParamsSection(this.paramsSectionContainer, paramDescriptors);
        }
    }

    // 创建参数部分的标题和文档链接
    private createParamsSectionHeader() {
        const headerContainer = this.paramsSectionContainer.createDiv("dtb-section-header");
        headerContainer.createEl("h3", { text: t("api_modal_api_parameters") });

        // 创建链接容器，放在右侧
        const linksContainer = headerContainer.createDiv("dtb-links");

        const selectedType = (this.typeSelect?.value as WallpaperApiType) || this.apiConfig.type;

        // 添加 API 文档链接
        const docUrl = apiRegistry.getApiDocUrl(selectedType);
        if (docUrl) {
            const docLink = linksContainer.createEl("a", {
                text: t("api_modal_api_documentation"),
                href: docUrl,
                cls: "dtb-link",
            });
            docLink.setAttribute("target", "_blank");
            docLink.setAttribute("rel", "noopener noreferrer");
        }

        // 添加 token URL 链接
        const tokenUrl = apiRegistry.getTokenUrl(selectedType);
        if (tokenUrl) {
            const tokenLink = linksContainer.createEl("a", {
                text: t("api_modal_token_url"),
                href: tokenUrl,
                cls: "dtb-link",
            });
            tokenLink.setAttribute("target", "_blank");
            tokenLink.setAttribute("rel", "noopener noreferrer");
        }
    }

    // 获取指定类型的默认 URL
    private getDefaultUrlForType(type: WallpaperApiType): string {
        return apiRegistry.getDefaultBaseUrl(type) || "https://api.example.com/...";
    }

    // 更新 URL placeholder
    private updateUrlPlaceholder() {
        if (this.urlInput) {
            const selectedType = this.typeSelect.value as WallpaperApiType;
            this.urlInput.placeholder = this.getDefaultUrlForType(selectedType);
        }
    }

    // 获取默认描述
    private getDefaultDescriptionForType(type: WallpaperApiType): string {
        return apiRegistry.getDefaultDescription(type) || t("api_modal_no_description");
    }

    // 更新 描述 placeholder
    private updateDescriptionPlaceholder() {
        if (this.descInput) {
            const selectedType = this.typeSelect.value as WallpaperApiType;
            this.descInput.placeholder = this.getDefaultDescriptionForType(selectedType);
        }
    }

    // 获取指定类型的参数描述
    private getParamDescriptorsForType(type: string): WallpaperApiParamDescriptor[] {
        const apiType = type as WallpaperApiType;
        const descriptors = apiRegistry.getParamDescriptors(apiType);

        return descriptors;
    }

    // 创建动态参数输入
    private createDynamicParamInputs(container: HTMLElement, descriptors: WallpaperApiParamDescriptor[]) {
        const selectedType = this.typeSelect.value as WallpaperApiType;
        this.createDynamicInputs(
            container,
            descriptors,
            (key) => this.apiConfig.params[key],
            (key, input) => this.paramInputs.set(key, input),
            (key) => (selectedType === this.apiConfig.type ? this.apiConfig.secretRefs?.params?.[key] : undefined),
            (key, secretId) => {
                if (secretId) {
                    this.secretParamRefs.set(key, secretId);
                } else {
                    this.secretParamRefs.delete(key);
                }
            }
        );
    }

    // 创建额外参数JSON输入
    private createExtraParamsInput(container: HTMLElement) {
        container.createEl("label", { text: t("api_modal_extra_params") });
        container.createEl("small", {
            text: t("api_modal_extra_params_desc"),
            cls: "dtb-field-description",
        });

        // 构建额外参数JSON
        const knownKeys = this.getParamDescriptorsForType(this.typeSelect.value).map((descriptor) => descriptor.key);
        const extraParams: Record<string, string | number | boolean | string[]> = {};

        Object.entries(this.apiConfig.params).forEach(([key, value]) => {
            if (!knownKeys.includes(key) && value !== undefined) {
                extraParams[key] = value;
            }
        });

        this.extraParamsTextarea = container.createEl("textarea", {
            value: Object.keys(extraParams).length > 0 ? JSON.stringify(extraParams, null, 2) : "",
            placeholder: t("api_modal_extra_params_placeholder"),
            cls: "dtb-textarea",
        });
    }

    private createSecretParamsSection(
        container: HTMLElement,
        descriptors: WallpaperApiParamDescriptor[]
    ): void {
        container.createEl("label", { text: t("api_modal_secret_params_optional") });
        container.createEl("small", {
            text: t("api_modal_secret_params_desc"),
            cls: "dtb-field-description",
        });
        this.secretParamsContainer = container.createDiv("dtb-list-container");

        const descriptorSecretKeys = new Set(
            descriptors.filter((descriptor) => descriptor.type === "password").map((descriptor) => descriptor.key)
        );
        if ((this.typeSelect.value as WallpaperApiType) === this.apiConfig.type) {
            for (const [key, secretId] of Object.entries(this.apiConfig.secretRefs?.params ?? {})) {
                if (!descriptorSecretKeys.has(key)) this.addSecretInput("param", key, secretId);
            }
        }

        const addButton = container.createEl("button", {
            text: t("api_modal_add_secret_param"),
            type: "button",
            cls: "dtb-button",
        });
        addButton.onclick = () => this.addSecretInput("param");
    }

    private addSecretInput(kind: "header" | "param", key = "", secretId = ""): void {
        const inputs = kind === "header" ? this.headerInputs : this.extraSecretParamInputs;
        const container = kind === "header" ? this.headersContainer : this.secretParamsContainer;
        const row = container.createDiv("dtb-list-row");
        const keyInput = row.createEl("input", {
            type: "text",
            value: key,
            placeholder: t(kind === "header" ? "api_modal_header_key" : "api_modal_secret_param_key"),
            cls: "dtb-input",
        });
        const secretContainer = row.createDiv("dtb-secret-control");
        secretContainer.setAttribute("aria-label", t("api_modal_header_secret"));
        const input = { key: keyInput, secretId };
        new SecretComponent(this.app, secretContainer).setValue(secretId).onChange((value) => {
            input.secretId = value;
        });

        const removeButton = row.createEl("button", {
            text: "×",
            type: "button",
            cls: "dtb-remove-button",
        });
        removeButton.onclick = () => {
            row.remove();
            const index = inputs.indexOf(input);
            if (index >= 0) inputs.splice(index, 1);
        };
        inputs.push(input);
    }

    // 创建自定义设置部分
    private createCustomSettingsSection(container: HTMLElement) {
        this.customSettingsSectionContainer = container.createDiv("dtb-section-container");
        this.refreshCustomSettingsSection();
    }

    // 刷新自定义设置部分
    private refreshCustomSettingsSection() {
        // 清除现有的自定义设置输入
        this.customSettingsInputs.clear();

        // 使用保存的容器引用
        if (!this.customSettingsSectionContainer) return;

        // 清空容器并重新创建所有内容
        this.customSettingsSectionContainer.empty();

        // 重新创建标题
        this.customSettingsSectionContainer.createEl("h3", { text: t("api_modal_custom_settings") });

        // 获取当前选择的API类型的自定义设置描述符
        const selectedType = this.typeSelect?.value ?? this.apiConfig.type;
        const customSettingDescriptors = apiRegistry.getCustomSettingDescriptors(selectedType as WallpaperApiType);

        if (customSettingDescriptors.length > 0) {
            this.createDynamicInputs(
                this.customSettingsSectionContainer,
                customSettingDescriptors,
                (key: string) => this.apiConfig.customSettings?.[key],
                (key: string, input: HTMLElement) => this.customSettingsInputs.set(key, input)
            );
        } else {
            // 如果没有自定义设置，显示提示信息
            this.customSettingsSectionContainer.createEl("p", {
                text: t("api_modal_no_custom_settings"),
                cls: "dtb-field-description",
            });
        }
    }

    /**
     * 根据参数描述符数组动态创建输入控件，并将其添加到指定的容器元素中。
     *
     * 对每个参数描述符，会创建一个包含标签和描述的输入字段容器，并根据参数类型生成相应的输入控件。
     * 标签会根据参数是否必填显示星号，描述信息会以小号字体显示。
     * 当前值会通过 `getCurrentValue` 获取，并根据需要使用 `fromApiValue` 转换为 UI 显示值，若转换失败则使用默认值。
     * 创建的输入控件会通过 `setInput` 方法进行注册，便于后续获取用户输入。
     *
     * @param container 用于添加输入控件的父级 HTML 元素
     * @param descriptors 参数描述符数组，定义每个输入控件的属性和行为
     * @param getCurrentValue 获取指定参数当前值的函数
     * @param setInput 注册输入控件的函数，便于后续获取用户输入
     */
    private createDynamicInputs(
        container: HTMLElement,
        descriptors: WallpaperApiParamDescriptor[],
        getCurrentValue: (key: string) => OptionalApiValueType,
        setInput: (key: string, input: HTMLElement) => void,
        getCurrentSecretRef?: (key: string) => string | undefined,
        setSecretRef?: (key: string, secretId: string) => void
    ) {
        descriptors.forEach((descriptor) => {
            const paramContainer = container.createDiv("dtb-field");

            const labelText = descriptor.required ? `${descriptor.label} *` : descriptor.label;
            const label = paramContainer.createEl("label", { text: labelText });

            if (descriptor.description) {
                label.createEl("small", {
                    text: ` (${descriptor.description})`,
                    cls: "dtb-field-description",
                });
            }

            if (descriptor.type === "password" && getCurrentSecretRef && setSecretRef) {
                const currentRef = getCurrentSecretRef(descriptor.key) ?? "";
                const secretContainer = paramContainer.createDiv("dtb-secret-control");
                secretContainer.setAttribute("aria-label", descriptor.label);
                setSecretRef(descriptor.key, currentRef);
                new SecretComponent(this.app, secretContainer).setValue(currentRef).onChange((secretId) => {
                    setSecretRef(descriptor.key, secretId);
                });
                return;
            }

            // 使用转换函数处理当前值，转为 UI 显示值
            let currentValue: OptionalUiValueType = getCurrentValue(descriptor.key) ?? descriptor.defaultValue;
            if (descriptor.fromApiValue && currentValue !== undefined) {
                try {
                    currentValue = descriptor.fromApiValue(currentValue);
                } catch (error) {
                    logger.warn(`Failed to convert value for ${descriptor.key}:`, error);
                    currentValue = descriptor.defaultValue;
                }
            }

            const input = this.createInputByType(paramContainer, descriptor, currentValue);
            setInput(descriptor.key, input);
        });
    }

    /**
     * 根据参数描述符的类型，在指定的容器中创建相应类型的输入控件，并返回该控件的 HTMLElement 实例。
     * 支持的类型包括：select（下拉选择）、multiselect（多选）、boolean（布尔值）、number（数字）、password（密码输入）和默认的 string（文本输入）。
     *
     * @param container 用于放置输入控件的 HTML 容器元素。
     * @param descriptor 输入参数的描述符，包含类型及相关配置。
     * @param currentValue 当前输入控件的值，用于初始化控件显示。
     * @returns 创建好的输入控件 HTMLElement。
     */
    private createInputByType(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: OptionalUiValueType
    ): HTMLElement {
        let input: HTMLElement;

        switch (descriptor.type) {
            case "select":
                input = this.createSelectInput(container, descriptor, currentValue);
                break;
            case "multiselect":
                input = this.createMultiSelectInput(container, descriptor, currentValue);
                break;
            case "boolean":
                input = this.createBooleanInput(container, descriptor, currentValue);
                break;
            case "number":
                input = this.createNumberInput(container, descriptor, currentValue);
                break;
            case "password":
                input = this.createStringInput(container, descriptor, currentValue);
                break;
            default: // string
                input = this.createStringInput(container, descriptor, currentValue);
                break;
        }

        return input;
    }

    // 创建字符串输入
    private createStringInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: OptionalUiValueType
    ): HTMLInputElement {
        return container.createEl("input", {
            type: "text",
            value: currentValue?.toString() ?? descriptor.defaultValue?.toString() ?? "",
            placeholder: descriptor.placeholder ?? "",
            cls: "dtb-input",
        });
    }

    // 创建数字输入
    private createNumberInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: OptionalUiValueType
    ): HTMLInputElement {
        return container.createEl("input", {
            type: "number",
            value: currentValue?.toString() ?? descriptor.defaultValue?.toString() ?? "",
            placeholder: descriptor.placeholder ?? "",
            cls: "dtb-input",
        });
    }

    // 创建布尔输入
    private createBooleanInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: OptionalUiValueType
    ): HTMLInputElement {
        const checkbox = container.createEl("input", {
            type: "checkbox",
            cls: "dtb-checkbox",
        });

        const boolValue = currentValue !== undefined ? Boolean(currentValue) : Boolean(descriptor.defaultValue);
        checkbox.checked = boolValue;

        return checkbox;
    }

    // 创建选择输入
    private createSelectInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: OptionalUiValueType
    ): HTMLSelectElement {
        const select = container.createEl("select", { cls: "dtb-dropdown" });

        descriptor.options?.forEach((option) => {
            const optionEl = select.createEl("option", {
                value: option.value.toString(),
                text: option.label,
            });

            if (
                currentValue?.toString() === option.value.toString() ||
                (!currentValue && descriptor.defaultValue?.toString() === option.value.toString())
            ) {
                optionEl.selected = true;
            }
        });

        return select;
    }

    // 创建多选输入
    private createMultiSelectInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: OptionalUiValueType
    ): HTMLElement {
        const multiContainer = container.createDiv("dtb-multiselect");
        const selectedValues: string[] = Array.isArray(currentValue)
            ? currentValue.map((val) => val.toString())
            : typeof currentValue === "string"
              ? currentValue.split(",")
              : [];

        descriptor.options?.forEach((option) => {
            const checkboxContainer = multiContainer.createDiv("dtb-checkbox");

            const checkbox = checkboxContainer.createEl("input", {
                type: "checkbox",
                value: option.value.toString(),
            });

            checkbox.checked = selectedValues.includes(option.value.toString());

            checkboxContainer.createEl("label", { text: option.label });
        });

        return multiContainer;
    }

    // 创建按钮部分
    private createButtonSection(container: HTMLElement) {
        const buttonContainer = container.createDiv("dtb-flex-container-end");

        const testButton = buttonContainer.createEl("button", {
            text: t("api_modal_test_api"),
            cls: "dtb-button",
        });
        testButton.onclick = async () => {
            await this.testApiConfig();
        };

        const cancelButton = buttonContainer.createEl("button", {
            text: t("button_cancel"),
            cls: "dtb-button",
        });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl("button", {
            text: t("api_modal_save"),
            cls: ["dtb-button", "mod-cta"],
        });
        submitButton.onclick = async () => {
            await this.saveApiConfig();
        };
    }

    // 构建API配置对象
    buildApiConfig(): WallpaperApiConfig | null {
        const selectedType = this.typeSelect.value;

        // 收集动态参数
        const paramDescriptors = this.getParamDescriptorsForType(selectedType);
        const paramDescriptorMap = new Map(paramDescriptors.map((desc) => [desc.key, desc]));

        const params = this.collectInputValues(
            this.paramInputs,
            paramDescriptorMap,
            (value) => value // 参数直接返回值
        );

        // 收集自定义设置
        const customSettingDescriptors = apiRegistry.getCustomSettingDescriptors(selectedType as WallpaperApiType);
        const customDescriptorMap = new Map(customSettingDescriptors.map((desc) => [desc.key, desc]));

        const customSettings = this.collectInputValues(
            this.customSettingsInputs,
            customDescriptorMap,
            (value) => value.toString() // 自定义设置转换为字符串
        );

        // 解析额外参数JSON
        if (this.extraParamsTextarea.value.trim()) {
            try {
                const extraParams: unknown = JSON.parse(this.extraParamsTextarea.value);
                if (!isRecord(extraParams)) {
                    new Notice(t("api_modal_invalid_json"));
                    return null;
                }
                for (const [key, value] of Object.entries(extraParams)) {
                    if (!isApiValue(value)) {
                        new Notice(t("api_modal_invalid_extra_param", { key }));
                        return null;
                    }
                    if (paramDescriptorMap.has(key)) {
                        new Notice(t("api_modal_duplicate_param", { key }));
                        return null;
                    }
                    if (isCredentialParameterKey(key)) {
                        new Notice(t("api_modal_sensitive_extra_param", { key }));
                        return null;
                    }
                    params[key] = value;
                }
            } catch {
                new Notice(t("api_modal_invalid_json"));
                return null;
            }
        }
        for (const descriptor of paramDescriptors) {
            if (descriptor.type === "password") {
                delete params[descriptor.key];
            }
        }

        // 收集 SecretStorage 引用；请求头值本身不会进入配置对象
        const headerSecretRefs: Record<string, string> = {};
        this.headerInputs.forEach(({ key, secretId }) => {
            if (key.value.trim() && secretId) {
                headerSecretRefs[key.value.trim()] = secretId;
            }
        });
        const paramSecretRefs: Record<string, string> = {};
        this.secretParamRefs.forEach((secretId, key) => {
            if (secretId) paramSecretRefs[key] = secretId;
        });
        const configuredParamKeys = new Set([...Object.keys(params), ...Object.keys(paramSecretRefs)]);
        for (const { key: keyInput, secretId } of this.extraSecretParamInputs) {
            const key = keyInput.value.trim();
            if (!key && !secretId) continue;
            if (!key || !secretId) {
                new Notice(t("api_modal_secret_missing"));
                return null;
            }
            if (configuredParamKeys.has(key)) {
                new Notice(t("api_modal_duplicate_param", { key }));
                return null;
            }
            paramSecretRefs[key] = secretId;
            configuredParamKeys.add(key);
        }
        const hasParamSecrets = Object.keys(paramSecretRefs).length > 0;
        const hasHeaderSecrets = Object.keys(headerSecretRefs).length > 0;

        return {
            id: this.apiConfig.id || generateId("api"),
            name: this.nameInput.value || t("api_modal_unnamed_api"),
            description: this.descInput.value || "",
            type: this.typeSelect.value as WallpaperApiType,
            baseUrl: this.urlInput.value,
            enabled: this.apiConfig.enabled ?? false, // 默认不启用
            params,
            secretRefs:
                hasParamSecrets || hasHeaderSecrets
                    ? {
                          params: hasParamSecrets ? paramSecretRefs : undefined,
                          headers: hasHeaderSecrets ? headerSecretRefs : undefined,
                      }
                    : undefined,
            customSettings: Object.keys(customSettings).length > 0 ? customSettings : undefined,
        };
    }

    // 通用的值收集方法
    private collectInputValues<T>(
        inputMap: Map<string, HTMLElement>,
        descriptorMap: Map<string, WallpaperApiParamDescriptor>,
        processValue: (value: ApiValueType, descriptor?: WallpaperApiParamDescriptor) => T
    ): Record<string, T> {
        const result: Record<string, T> = {};

        inputMap.forEach((input, key) => {
            let value: OptionalUiValueType;

            if (input.tagName === "INPUT") {
                const inputEl = input as HTMLInputElement;
                if (inputEl.type === "checkbox") {
                    value = inputEl.checked;
                } else if (inputEl.type === "number") {
                    value = inputEl.value ? parseInt(inputEl.value) : undefined;
                } else {
                    value = inputEl.value || undefined;
                }
            } else if (input.tagName === "SELECT") {
                const selectEl = input as HTMLSelectElement;
                value = selectEl.value || undefined;
            } else if (input.classList.contains("dtb-multiselect")) {
                // 多选
                const checkboxes = input.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
                const selectedValues = Array.from(checkboxes).map((cb) => cb.value);
                value = selectedValues.length > 0 ? selectedValues : undefined;
            }

            if (value !== undefined) {
                const descriptor = descriptorMap.get(key);
                let finalValue: ApiValueType;

                // 如果是数组类型的值，需要转换为API可接受的单值
                if (Array.isArray(value)) {
                    if (descriptor?.toApiValue) {
                        finalValue = descriptor.toApiValue(value);
                    } else {
                        // 默认转换：数组转为逗号分隔的字符串
                        finalValue = value.join(",");
                    }
                } else if (descriptor?.toApiValue) {
                    finalValue = descriptor.toApiValue(value);
                } else {
                    finalValue = value;
                }

                result[key] = processValue(finalValue, descriptor);
            }
        });

        return result;
    }

    private prepareValidatedConfig(config: WallpaperApiConfig): WallpaperApiConfig | null {
        let runtimeConfig: WallpaperApiConfig;
        try {
            runtimeConfig = this.plugin.prepareWallpaperApiConfig(config);
        } catch {
            new Notice(t("api_modal_secret_missing"));
            return null;
        }

        // 调用 API 注册器验证参数
        const validation = apiRegistry.validateParams(runtimeConfig.type, runtimeConfig.params);
        if (!validation.valid) {
            new Notice(t("api_modal_invalid_params", { errors: validation.errors?.join(", ") ?? "Unknown error" }));
            return null;
        }
        return runtimeConfig;
    }

    // 保存API配置
    async saveApiConfig(): Promise<void> {
        const config = this.buildApiConfig();
        if (!config || !this.prepareValidatedConfig(config)) {
            return;
        }
        await this.onSubmit(config);
        this.close();
    }

    // 测试API配置
    async testApiConfig() {
        let testApiId: string | null = null;
        try {
            new Notice(t("api_modal_testing_config"));

            const storedConfig = this.buildApiConfig();
            if (!storedConfig) {
                new Notice(t("api_modal_cannot_test_invalid"));
                return;
            }
            const runtimeConfig = this.prepareValidatedConfig(storedConfig);
            if (!runtimeConfig) {
                new Notice(t("api_modal_cannot_test_invalid"));
                return;
            }

            // 使用临时 ID 避免覆盖同 ID 的已有实例
            testApiId = generateId("api-test");
            const testConfig = { ...runtimeConfig, enabled: false, id: testApiId };

            await apiManager.createApi(testConfig, false);
            const success = apiManager.getApiById(testApiId) ? await apiManager.enableApi(testApiId) : false;
            if (!success) {
                new Notice(t("api_modal_test_failed", { error: t("api_modal_test_rejected") }));
                return;
            }

            new Notice(t("api_modal_test_successful"));
        } catch (error) {
            logger.warn("API configuration test failed", error);
            new Notice(t("api_modal_test_failed", { error: t("api_modal_test_unexpected") }));
        } finally {
            if (testApiId) {
                await apiManager.deleteApi(testApiId);
            }
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
