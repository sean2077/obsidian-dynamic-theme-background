// ============================================================================
// Tooltip 使用示例和说明
// ============================================================================

/*
 * 为下拉选项添加 tooltip 的几种方法：
 *
 * 1. 简单方法：直接设置 HTML title 属性
 *    dropdown.selectEl.title = "提示文本";
 *
 * 2. 使用通用方法：addDropdownTooltip (从 utils 导入)
 *    为整个下拉框和每个选项都添加 tooltip
 *    addDropdownTooltip(dropdown, {
 *        "value1": "选项1的说明",
 *        "value2": "选项2的说明"
 *    }, "默认提示文本");
 *
 * 3. 使用增强方法：addEnhancedDropdownTooltip (从 utils 导入)
 *    支持自定义格式化和动态内容
 *    addEnhancedDropdownTooltip(dropdown, {
 *        tooltipMap: { "value1": "详细说明1" },
 *        showSelectedValue: true,
 *        customFormatter: (value, text) => `当前选择: ${text} (${value})`
 *    });
 *
 * 4. 专门的悬停选项方法：addDropdownOptionHoverTooltip (推荐用于悬停显示)
 *    专门优化悬停在选项上时的 tooltip 显示
 *    addDropdownOptionHoverTooltip(dropdown, {
 *        "value1": "悬停在选项1上时显示的详细说明",
 *        "value2": "悬停在选项2上时显示的详细说明"
 *    }, {
 *        defaultTooltip: "默认提示",
 *        updateOnChange: true
 *    });
 */

/**
 * 为下拉选项添加动态 tooltip 功能的配置选项
 */
export interface DropdownTooltipOptions {
    tooltipMap?: Record<string, string>;
    defaultTooltip?: string;
    showSelectedValue?: boolean;
    customFormatter?: (value: string, text: string) => string;
}

/**
 * 为下拉选项添加动态 tooltip 功能
 * @param dropdown 下拉选项组件
 * @param tooltipMap 选项值到tooltip文本的映射
 * @param defaultTooltip 默认tooltip文本
 */
export function addDropdownTooltip(
    dropdown: { selectEl: HTMLSelectElement },
    tooltipMap: Record<string, string>,
    defaultTooltip?: string
): void {
    const selectEl = dropdown.selectEl;

    // 为每个选项添加 title 属性（悬停时显示）
    Array.from(selectEl.options).forEach((option) => {
        const value = option.value;
        const tooltipText = tooltipMap[value] ?? defaultTooltip ?? "";
        if (tooltipText) {
            option.title = tooltipText;
        }
    });

    // 设置整个下拉框的初始 tooltip
    if (defaultTooltip) {
        selectEl.title = defaultTooltip;
    }

    // 监听选项变化，更新整个下拉框的 tooltip
    selectEl.addEventListener("change", () => {
        const selectedValue = selectEl.value;
        const tooltipText = tooltipMap[selectedValue] ?? defaultTooltip ?? "";
        selectEl.title = tooltipText;
    });

    // 设置初始选中项的 tooltip
    const initialValue = selectEl.value;
    if (tooltipMap[initialValue]) {
        selectEl.title = tooltipMap[initialValue];
    }
}

/**
 * 为下拉选项添加动态 tooltip 功能（增强版）
 * @param dropdown 下拉选项组件
 * @param options 配置选项
 */
export function addEnhancedDropdownTooltip(
    dropdown: { selectEl: HTMLSelectElement },
    options: DropdownTooltipOptions
): void {
    const { tooltipMap = {}, defaultTooltip = "", showSelectedValue = false, customFormatter } = options;
    const selectEl = dropdown.selectEl;

    const updateTooltip = () => {
        const selectedValue = selectEl.value;
        const selectedText = selectEl.options[selectEl.selectedIndex]?.text ?? selectedValue;

        let tooltipText = "";

        if (customFormatter) {
            tooltipText = customFormatter(selectedValue, selectedText);
        } else if (tooltipMap[selectedValue]) {
            tooltipText = tooltipMap[selectedValue];
            if (showSelectedValue && selectedText !== selectedValue) {
                tooltipText = `${selectedText}: ${tooltipText}`;
            }
        } else if (defaultTooltip) {
            tooltipText = defaultTooltip;
        }

        selectEl.title = tooltipText;
    };

    // 为每个选项添加 title 属性（悬停时显示）
    const updateOptionTooltips = () => {
        Array.from(selectEl.options).forEach((option) => {
            const value = option.value;
            const text = option.text;
            let tooltipText = "";

            if (customFormatter) {
                tooltipText = customFormatter(value, text);
            } else if (tooltipMap[value]) {
                tooltipText = tooltipMap[value];
                if (showSelectedValue && text !== value) {
                    tooltipText = `${text}: ${tooltipText}`;
                }
            } else if (defaultTooltip) {
                tooltipText = defaultTooltip;
            }

            if (tooltipText) {
                option.title = tooltipText;
            }
        });
    };

    // 初始化选项的 tooltip
    updateOptionTooltips();

    // 设置整个下拉框的初始 tooltip
    if (defaultTooltip) {
        selectEl.title = defaultTooltip;
    }

    // 监听选项变化，更新整个下拉框的 tooltip
    selectEl.addEventListener("change", updateTooltip);

    // 监听下拉框内容变化（如动态添加选项），重新设置选项 tooltip
    const observer = new MutationObserver(() => {
        updateOptionTooltips();
    });

    observer.observe(selectEl, {
        childList: true,
        subtree: true,
    });

    // 设置初始选中项的 tooltip
    setTimeout(updateTooltip, 0);
}

/**
 * 专门为下拉选项添加悬停时的 tooltip 功能
 * 当用户展开下拉框并悬停在选项上时显示详细说明
 * @param dropdown 下拉选项组件
 * @param tooltipMap 选项值到tooltip文本的映射
 * @param options 额外配置选项
 */
export function addDropdownOptionHoverTooltip(
    dropdown: { selectEl: HTMLSelectElement },
    tooltipMap: Record<string, string>,
    options: {
        defaultTooltip?: string;
        customFormatter?: (value: string, text: string) => string;
        updateOnChange?: boolean; // 是否在选择后更新整个下拉框的 tooltip
    } = {}
): void {
    const { defaultTooltip = "", customFormatter, updateOnChange = true } = options;
    const selectEl = dropdown.selectEl;

    // 为每个选项设置 tooltip
    const updateAllOptionTooltips = () => {
        Array.from(selectEl.options).forEach((option) => {
            const value = option.value;
            const text = option.text;
            let tooltipText = "";

            if (customFormatter) {
                tooltipText = customFormatter(value, text);
            } else {
                tooltipText = tooltipMap[value] ?? defaultTooltip;
            }

            if (tooltipText) {
                option.title = tooltipText;
            }
        });
    };

    // 初始化所有选项的 tooltip
    updateAllOptionTooltips();

    // 如果需要，在选择变化时更新整个下拉框的 tooltip
    if (updateOnChange) {
        selectEl.addEventListener("change", () => {
            const selectedValue = selectEl.value;
            const selectedText = selectEl.options[selectEl.selectedIndex]?.text ?? selectedValue;

            let tooltipText = "";
            if (customFormatter) {
                tooltipText = customFormatter(selectedValue, selectedText);
            } else {
                tooltipText = tooltipMap[selectedValue] ?? defaultTooltip;
            }

            selectEl.title = tooltipText;
        });

        // 设置初始的整体 tooltip
        const initialValue = selectEl.value;
        if (initialValue) {
            const initialText = selectEl.options[selectEl.selectedIndex]?.text ?? initialValue;
            let initialTooltip = "";
            if (customFormatter) {
                initialTooltip = customFormatter(initialValue, initialText);
            } else {
                initialTooltip = tooltipMap[initialValue] ?? defaultTooltip;
            }
            selectEl.title = initialTooltip;
        } else if (defaultTooltip) {
            selectEl.title = defaultTooltip;
        }
    }

    // 监听选项动态变化
    const observer = new MutationObserver(() => {
        updateAllOptionTooltips();
    });

    observer.observe(selectEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value"],
    });
}
