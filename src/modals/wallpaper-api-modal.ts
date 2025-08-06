import { App, Modal, Notice } from "obsidian";
import {
    apiManager,
    apiRegistry,
    WallpaperApiConfig,
    WallpaperApiParamDescriptor,
    WallpaperApiType,
} from "../wallpaper-apis";

export class WallpaperApiEditorModal extends Modal {
    apiConfig: WallpaperApiConfig;
    onSubmit: (apiConfig: WallpaperApiConfig) => void;

    // 基础配置输入元素
    nameInput: HTMLInputElement;
    descInput: HTMLInputElement; // 可选描述输入
    typeSelect: HTMLSelectElement;
    urlInput: HTMLInputElement;

    // 动态参数输入元素映射
    paramInputs: Map<string, HTMLElement> = new Map();

    // 参数配置容器的引用
    paramsSectionContainer: HTMLElement;

    // 额外参数输入
    extraParamsTextarea: HTMLTextAreaElement;

    // Headers配置
    headersContainer: HTMLDivElement;
    headerInputs: Array<{ key: HTMLInputElement; value: HTMLInputElement }> = [];

    // 自定义设置输入元素
    customSettingsInputs: Map<string, HTMLInputElement> = new Map();

    constructor(app: App, apiConfig: WallpaperApiConfig, onSubmit: (apiConfig: WallpaperApiConfig) => void) {
        super(app);
        this.apiConfig = apiConfig;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // 为模态框添加自定义CSS类以控制宽度
        contentEl.addClass("dtb-api-modal-container");

        contentEl.createEl("h2", {
            text: this.apiConfig.id ? "Edit Wallpaper API" : "Add Wallpaper API",
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
        section.createEl("h3", { text: "Basic Configuration" });

        // API名称
        section.createEl("label", { text: "API Name" });
        this.nameInput = section.createEl("input", {
            type: "text",
            value: this.apiConfig.name || "",
            placeholder: "e.g., Unsplash Nature",
            cls: ["dtb-input"],
        });
        // 可选描述
        section.createEl("label", { text: "Description (optional)" });
        this.descInput = section.createEl("input", {
            type: "text",
            value: this.apiConfig.description || "",
            placeholder: this.getDefaultDescriptionForType(this.apiConfig.type),
            cls: ["dtb-input"],
        });

        // API类型选择
        section.createEl("label", { text: "API Type" });
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

        // 监听类型变化，重新生成参数配置
        this.typeSelect.addEventListener("change", () => {
            this.updateUrlPlaceholder();
            this.updateDescriptionPlaceholder();
            this.refreshParamsSection();
        });

        // API URL
        section.createEl("label", { text: "API URL" });

        // 获取默认 URL 作为 placeholder
        const defaultUrl = this.getDefaultUrlForType(this.apiConfig.type);
        this.urlInput = section.createEl("input", {
            type: "text",
            value: this.apiConfig.baseUrl || "",
            placeholder: defaultUrl || "https://api.example.com/...",
            cls: "dtb-input",
        });

        // Headers配置
        this.createHeadersSection(section);
    }

    // 创建Headers配置部分
    private createHeadersSection(container: HTMLElement) {
        container.createEl("label", { text: "Headers (optional)" });
        this.headersContainer = container.createDiv("dtb-list-container");

        // 渲染已有的headers
        if (this.apiConfig.headers) {
            Object.entries(this.apiConfig.headers).forEach(([key, value]) => {
                this.addHeaderInput(key, value);
            });
        }

        // 添加header按钮
        const addHeaderBtn = container.createEl("button", {
            text: "Add Header",
            type: "button",
            cls: "dtb-action-button",
        });
        addHeaderBtn.onclick = () => this.addHeaderInput();
    }

    // 添加header输入行
    private addHeaderInput(key = "", value = "") {
        const headerRow = this.headersContainer.createDiv("dtb-list-row");

        const keyInput = headerRow.createEl("input", {
            type: "text",
            value: key,
            placeholder: "Header Key",
            cls: "dtb-input",
        });

        const valueInput = headerRow.createEl("input", {
            type: "text",
            value: value,
            placeholder: "Header Value",
            cls: "dtb-input",
        });

        const removeBtn = headerRow.createEl("button", {
            text: "×",
            type: "button",
            cls: "dtb-remove-button",
        });
        removeBtn.onclick = () => {
            headerRow.remove();
            const index = this.headerInputs.findIndex((h) => h.key === keyInput);
            if (index > -1) {
                this.headerInputs.splice(index, 1);
            }
        };

        this.headerInputs.push({ key: keyInput, value: valueInput });
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

        // 使用保存的容器引用而不是DOM查询
        if (!this.paramsSectionContainer) return;

        // 清空容器并重新创建所有内容
        this.paramsSectionContainer.empty();

        // 重新创建标题和文档链接
        this.createParamsSectionHeader();

        // 创建参数输入
        const selectedType = this.typeSelect?.value || this.apiConfig.type;
        const paramDescriptors = this.getParamDescriptorsForType(selectedType);

        if (paramDescriptors.length > 0) {
            this.createDynamicParamInputs(this.paramsSectionContainer, paramDescriptors);
        }

        // 额外参数JSON输入
        this.createExtraParamsInput(this.paramsSectionContainer);
    }

    // 创建参数部分的标题和文档链接
    private createParamsSectionHeader() {
        const headerContainer = this.paramsSectionContainer.createDiv("dtb-section-header");
        headerContainer.createEl("h3", { text: "API Parameters" });

        // 创建链接容器，放在右侧
        const linksContainer = headerContainer.createDiv("dtb-doc-links");

        const selectedType = (this.typeSelect?.value as WallpaperApiType) || this.apiConfig.type;

        // 添加 API 文档链接
        const docUrl = apiRegistry.getApiDocUrl(selectedType);
        if (docUrl) {
            const docLink = linksContainer.createEl("a", {
                text: "📖 API Documentation",
                href: docUrl,
                cls: "dtb-doc-link",
            });
            docLink.setAttribute("target", "_blank");
            docLink.setAttribute("rel", "noopener noreferrer");
        }

        // 添加 token URL 链接
        const tokenUrl = apiRegistry.getTokenUrl(selectedType);
        if (tokenUrl) {
            const tokenLink = linksContainer.createEl("a", {
                text: "🔑 Token URL",
                href: tokenUrl,
                cls: "dtb-doc-link",
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
        return apiRegistry.getDefaultDescription(type) || "No description provided.";
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
        descriptors.forEach((descriptor) => {
            const paramContainer = container.createDiv("dtb-field-container");

            const labelText = descriptor.required ? `${descriptor.label} *` : descriptor.label;
            const label = paramContainer.createEl("label", { text: labelText });

            if (descriptor.description) {
                label.createEl("small", {
                    text: ` (${descriptor.description})`,
                    cls: "dtb-field-description",
                });
            }

            // 使用转换函数处理当前值
            let currentValue = this.apiConfig.params[descriptor.key] || descriptor.defaultValue;
            if (descriptor.fromApiValue && currentValue !== undefined) {
                currentValue = descriptor.fromApiValue(currentValue);
            }

            let input: HTMLElement;

            switch (descriptor.type) {
                case "select":
                    input = this.createSelectInput(paramContainer, descriptor, currentValue);
                    break;
                case "multiselect":
                    input = this.createMultiSelectInput(paramContainer, descriptor, currentValue);
                    break;
                case "boolean":
                    input = this.createBooleanInput(paramContainer, descriptor, currentValue);
                    break;
                case "number":
                    input = this.createNumberInput(paramContainer, descriptor, currentValue);
                    break;
                case "password":
                    input = this.createStringInput(paramContainer, descriptor, currentValue);
                    (input as HTMLInputElement).type = "password";
                    break;
                default: // string
                    input = this.createStringInput(paramContainer, descriptor, currentValue);
                    break;
            }

            this.paramInputs.set(descriptor.key, input);
        });
    }

    // 创建字符串输入
    private createStringInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: string | number | boolean | string[] | undefined
    ): HTMLInputElement {
        return container.createEl("input", {
            type: "text",
            value: currentValue?.toString() || descriptor.defaultValue?.toString() || "",
            placeholder: descriptor.placeholder || "",
            cls: "dtb-input",
        });
    }

    // 创建数字输入
    private createNumberInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: string | number | boolean | string[] | undefined
    ): HTMLInputElement {
        return container.createEl("input", {
            type: "number",
            value: currentValue?.toString() || descriptor.defaultValue?.toString() || "",
            placeholder: descriptor.placeholder || "",
            cls: "dtb-input",
        });
    }

    // 创建布尔输入
    private createBooleanInput(
        container: HTMLElement,
        descriptor: WallpaperApiParamDescriptor,
        currentValue: string | number | boolean | string[] | undefined
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
        currentValue: string | number | boolean | string[] | undefined
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
        currentValue: string | number | boolean | string[] | undefined
    ): HTMLElement {
        const multiContainer = container.createDiv("dtb-multiselect-container");
        const selectedValues = Array.isArray(currentValue)
            ? currentValue
            : typeof currentValue === "string"
              ? currentValue.split(",")
              : [];

        descriptor.options?.forEach((option) => {
            const checkboxContainer = multiContainer.createDiv("dtb-checkbox-container");

            const checkbox = checkboxContainer.createEl("input", {
                type: "checkbox",
                value: option.value.toString(),
            });

            checkbox.checked = selectedValues.includes(option.value.toString());

            checkboxContainer.createEl("label", { text: option.label });
        });

        return multiContainer;
    }

    // 创建额外参数JSON输入
    private createExtraParamsInput(container: HTMLElement) {
        container.createEl("label", { text: "Extra Parameters (JSON)" });
        container.createEl("small", {
            text: "Additional parameters not covered above, in JSON format",
            cls: "dtb-field-description",
        });

        // 构建额外参数JSON
        const knownKeys = Array.from(this.paramInputs.keys());
        const extraParams: Record<string, string | number | boolean | string[]> = {};

        Object.entries(this.apiConfig.params).forEach(([key, value]) => {
            if (!knownKeys.includes(key) && value !== undefined) {
                extraParams[key] = value;
            }
        });

        this.extraParamsTextarea = container.createEl("textarea", {
            value: Object.keys(extraParams).length > 0 ? JSON.stringify(extraParams, null, 2) : "",
            placeholder: '{\n  "customParam": "value",\n  "anotherParam": 123\n}',
            cls: "dtb-modal-textarea",
        });
    }

    // 创建自定义设置部分
    private createCustomSettingsSection(container: HTMLElement) {
        const section = container.createDiv("dtb-section-container");
        section.createEl("h3", { text: "Custom Settings (Not Implemented)" });

        const customSettings = [
            { key: "imageUrlJsonPath", label: "Image URL JSON Path", placeholder: "images[].url" },
            // TODO: 添加更多自定义设置项
        ];

        customSettings.forEach((setting) => {
            section.createEl("label", { text: setting.label });
            const input = section.createEl("input", {
                type: "text",
                value: this.apiConfig.customSettings?.[setting.key] || "",
                placeholder: setting.placeholder,
                cls: "dtb-input",
            });
            this.customSettingsInputs.set(setting.key, input);
        });
    }

    // 创建按钮部分
    private createButtonSection(container: HTMLElement) {
        const buttonContainer = container.createDiv("dtb-flex-container-end");

        const testButton = buttonContainer.createEl("button", {
            text: "Test API",
            cls: "dtb-action-button",
        });
        testButton.onclick = async () => {
            await this.testApiConfig();
        };

        const cancelButton = buttonContainer.createEl("button", {
            text: "Cancel",
            cls: "dtb-action-button",
        });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl("button", {
            text: "Save",
            cls: ["dtb-action-button", "mod-cta"],
        });
        submitButton.onclick = () => {
            this.saveApiConfig();
        };
    }

    // 构建API配置对象
    buildApiConfig(): WallpaperApiConfig {
        // 收集动态参数
        const params: Record<string, string | number | boolean | string[]> = {};

        // 获取当前参数描述符以便使用转换函数
        const selectedType = this.typeSelect.value;
        const paramDescriptors = this.getParamDescriptorsForType(selectedType);
        const descriptorMap = new Map(paramDescriptors.map((desc) => [desc.key, desc]));

        // 从动态输入中收集参数
        this.paramInputs.forEach((input, key) => {
            let value: string | number | boolean | string[] | undefined;

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
            } else if (input.classList.contains("dtb-multiselect-container")) {
                // 多选
                const checkboxes = input.querySelectorAll(
                    'input[type="checkbox"]:checked'
                ) as NodeListOf<HTMLInputElement>;
                const selectedValues = Array.from(checkboxes).map((cb) => cb.value);
                value = selectedValues.length > 0 ? selectedValues : undefined;
            }

            if (value !== undefined) {
                // 使用转换函数处理值
                const descriptor = descriptorMap.get(key);
                if (descriptor?.toApiValue) {
                    value = descriptor.toApiValue(value);
                }
                params[key] = value;
            }
        });

        // 解析额外参数JSON
        if (this.extraParamsTextarea.value.trim()) {
            try {
                const extraParams = JSON.parse(this.extraParamsTextarea.value);
                Object.assign(params, extraParams);
            } catch (error) {
                new Notice("Invalid JSON in extra parameters");
            }
        }

        // 收集headers
        const headers: Record<string, string> = {};
        this.headerInputs.forEach(({ key, value }) => {
            if (key.value.trim() && value.value.trim()) {
                headers[key.value.trim()] = value.value.trim();
            }
        });

        // 收集自定义设置
        const customSettings: Record<string, string> = {};
        this.customSettingsInputs.forEach((input, key) => {
            if (input.value.trim()) {
                customSettings[key] = input.value.trim();
            }
        });

        return {
            id: this.apiConfig.id || `api-${Date.now()}`,
            name: this.nameInput.value || "Unnamed API",
            description: this.descInput.value || "",
            type: this.typeSelect.value as WallpaperApiType,
            baseUrl: this.urlInput.value,
            enabled: this.apiConfig.enabled ?? false, // 默认不启用
            params,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            customSettings: Object.keys(customSettings).length > 0 ? customSettings : undefined,
        };
    }

    validateApiConfig(config: WallpaperApiConfig): boolean {
        // 基本验证
        if (!config.name.trim()) {
            new Notice("Please enter an API name");
            return false;
        }
        // 调用 API 注册器验证参数
        const validation = apiRegistry.validateParams(config.type, config.params);
        if (!validation.valid) {
            new Notice("Invalid API parameters: " + validation.errors);
            return false;
        }
        return true;
    }

    // 保存API配置
    saveApiConfig() {
        const config = this.buildApiConfig();
        if (!this.validateApiConfig(config)) {
            return;
        }
        this.onSubmit(config);
        this.close();
    }

    // 测试API配置
    async testApiConfig() {
        try {
            new Notice("Testing API configuration...");

            const config = this.buildApiConfig();
            if (!this.validateApiConfig(config)) {
                new Notice("Cannot test due to invalid configuration");
                return;
            }

            // 这里需临时创建个实例来测试
            await apiManager.createApi(config);
            // 如果能成功启用则测试通过
            await apiManager.enableApi(config.id);

            new Notice("API test successful!");

            apiManager.deleteApi(config.id); // 测试后删除临时实例
        } catch (error) {
            new Notice(`API test failed: ${(error as Error).message}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
