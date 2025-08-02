import { App, getLanguage, ItemView, Modal, Notice, Plugin, PluginSettingTab, Setting, SuggestModal, WorkspaceLeaf } from 'obsidian';

// 导入语言文件
import en from './lang/en.json';
import zhCN from './lang/zh-cn.json';

const translations: Record<string, typeof en> = {
    en,
    'zh': zhCN,
};

// Global translation function
let translationsForLang = translations['en'] || en;

function t(key: keyof typeof en, vars?: Record<string, string>) {
    let text = translationsForLang[key] || en[key];
    if (vars) {
        for (const varKey in vars) {
            text = text.replace(`{${varKey}}`, vars[varKey]);
        }
    }
    return text;
}

// Initialize translation language
function initializeTranslation() {
    // 使用 Obsidian 的 getLanguage() API 获取界面语言
    const lang = getLanguage();
    translationsForLang = translations[lang] || en;
}

interface DTBSettings {
    enabled: boolean;

    // 统一的背景模糊度、亮度和饱和度变量、背景颜色
    blurDepth: number; // 默认模糊度
    brightness4Bg: number; // 默认亮度
    saturate4Bg: number; // 默认饱和度
    bgColor: string; // 默认背景颜色
    bgColorOpacity: number; // 默认背景颜色透明度


    mode: 'time-based' | 'interval' | 'manual';
    timeRules: TimeRule[];
    intervalMinutes: number;
    backgrounds: BackgroundItem[];
    currentIndex: number; // 当前背景索引
}

interface TimeRule {
    id: string;
    name: string;
    startTime: string; // "HH:MM" format
    endTime: string;   // "HH:MM" format
    backgroundId: string;
    enabled: boolean;
}

interface BackgroundItem {
    id: string;
    name: string;
    type: 'image' | 'color' | 'gradient';
    value: string; // image URL, color code, or gradient CSS
    preview?: string;
}

let DEFAULT_SETTINGS: DTBSettings;

function genDefaultSettings() {
    DEFAULT_SETTINGS = {
        enabled: true,
        blurDepth: 0, // default blur
        brightness4Bg: 0.9, // default brightness
        saturate4Bg: 1, // default saturation
        bgColor: '#1f1e1e', // default background color (without alpha)
        bgColorOpacity: 0.5, // default background color opacity (0-1)
        mode: 'time-based',
        timeRules: [
            {
                id: 'morning',
                name: t('default_morning_rule'),
                startTime: '06:00',
                endTime: '09:00',
                backgroundId: 'default-morning',
                enabled: true
            },
            {
                id: 'later-morning',
                name: t('default_later_morning_rule'),
                startTime: '09:00',
                endTime: '11:00',
                backgroundId: 'default-later-morning',
                enabled: true
            },
            {
                id: 'noon',
                name: t('default_noon_rule'),
                startTime: '11:00',
                endTime: '13:00',
                backgroundId: 'default-noon',
                enabled: true
            },
            {
                id: 'afternoon',
                name: t('default_afternoon_rule'),
                startTime: '13:00',
                endTime: '17:00',
                backgroundId: 'default-afternoon',
                enabled: true
            },
            {
                id: 'dusk',
                name: t('default_dusk_rule'),
                startTime: '17:00',
                endTime: '18:00',
                backgroundId: 'default-dusk',
                enabled: true
            },
            {
                id: 'evening',
                name: t('default_evening_rule'),
                startTime: '18:00',
                endTime: '22:00',
                backgroundId: 'default-evening',
                enabled: true
            },
            {
                id: 'night',
                name: t('default_night_rule'),
                startTime: '22:00',
                endTime: '06:00',
                backgroundId: 'default-night',
                enabled: true
            }
        ],
        intervalMinutes: 60,
        backgrounds: [
            {
                id: 'default-morning',
                name: t('default_morning_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            },
            {
                id: 'default-later-morning',
                name: t('default_later_morning_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            },
            {
                id: 'default-noon',
                name: t('default_noon_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
            },
            {
                id: 'default-afternoon',
                name: t('default_afternoon_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
            },
            {
                id: 'default-dusk',
                name: t('default_dusk_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
            },
            {
                id: 'default-evening',
                name: t('default_evening_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
            },
            {
                id: 'default-night',
                name: t('default_night_bg'),
                type: 'gradient',
                value: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
            }
        ],
        currentIndex: 0
    };
}


export default class DynamicThemeBackgroundPlugin extends Plugin {
    settings: DTBSettings;
    intervalId: number | null = null;
    styleTag: HTMLStyleElement;

    // 当前的背景
    background: BackgroundItem | null = null;

    async onload() {
        // Initialize translation
        initializeTranslation();
        // 生成默认设置
        genDefaultSettings();

        await this.loadSettings();

        // 打印当前设置
        console.log('Dynamic Theme Background plugin settings:', this.settings);

        // 创建样式元素
        this.styleTag = document.createElement('style');
        this.styleTag.id = 'dtb-dynamic-styles';
        document.head.appendChild(this.styleTag);

        // 注册自定义视图类型
        this.registerView(
            DTB_SETTINGS_VIEW_TYPE,
            (leaf) => new DTBSettingsView(leaf, this)
        );

        // 添加设置面板
        this.addSettingTab(new DTBSettingTab(this.app, this));

        // 添加命令
        this.addCommands();

        // 启动背景管理器
        if (this.settings.enabled) {
            // 等待 layout-ready 事件，确保 vault 完全加载
            this.app.workspace.onLayoutReady(() => {
                this.startBackgroundManager();
            });
        }

        console.log('Dynamic Theme Background plugin loaded');
    }

    onunload() {
        this.stopBackgroundManager();
        this.deactivateView(); // 清理自定义视图
        this.styleTag?.remove();
        console.log('Dynamic Theme Background plugin unloaded');
    }

    addCommands() {
        this.addCommand({
            id: 'toggle-dtb',
            name: t('command_toggle_name'),
            callback: () => {
                this.settings.enabled = !this.settings.enabled;
                this.saveSettings();

                if (this.settings.enabled) {
                    this.startBackgroundManager();
                    new Notice(t('command_toggle_enabled_notice'));
                } else {
                    this.stopBackgroundManager();
                    new Notice(t('command_toggle_disabled_notice'));
                }
            }
        });

        this.addCommand({
            id: 'next-background',
            name: t('command_next_bg_name'),
            callback: () => {
                if (this.settings.backgrounds.length > 0) {
                    this.settings.currentIndex =
                        (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                    this.background = this.settings.backgrounds[this.settings.currentIndex];
                    this.updateStyleCss();
                    this.saveSettings();
                    new Notice(t('command_next_bg_notice', { bgName: this.background.name }));
                }
            }
        });

        this.addCommand({
            id: 'test-current-background',
            name: t('command_test_bg_name'),
            callback: () => {
                const rule = this.getCurrentTimeRule();
                if (rule) {
                    const bg = this.settings.backgrounds.find(b => b.id === rule.backgroundId);
                    if (bg) {
                        this.background = bg;
                        this.updateStyleCss();
                        new Notice(t('command_test_bg_success_notice', { ruleName: rule.name, bgName: bg.name }));
                    } else {
                        new Notice(t('command_test_bg_no_bg_notice', { ruleName: rule.name }));
                    }
                } else {
                    new Notice(t('command_test_bg_no_rule_notice'));
                }
            }
        });

        // 在新标签页中打开设置
        this.addCommand({
            id: 'open-dtb-settings-tab',
            name: t('command_open_settings_tab_name'),
            callback: () => {
                this.activateView();
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    deactivateView() {
        this.app.workspace.detachLeavesOfType(DTB_SETTINGS_VIEW_TYPE);
    }

    async activateView() {
        this.deactivateView();
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.setViewState({
            type: DTB_SETTINGS_VIEW_TYPE,
            active: true,
        });

        // 确保标签页获得焦点
        this.app.workspace.revealLeaf(leaf);
    }

    // 将图片路径转换为可用的 CSS URL
    sanitizeImagePath(imagePath: string): string {
        // 判断是否是远程图片
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return `url(${imagePath})`;
        }
        // 本地图片路径（只接受 Vault 内的图片）
        const file = this.app.vault.getFileByPath(imagePath);
        if (!file) {
            console.warn(`DTB: Image ${imagePath} not found`);
            return 'none';
        }
        const p = this.app.vault.getResourcePath(file);
        if (!p) {
            console.warn(`DTB: Cannot get resource path for image ${imagePath}`);
            return 'none';
        }
        console.debug(`DTB: Using resource path ${p} for image ${imagePath}`);
        return `url(${p})`; // 形如 app://local/path/to/image.jpg
    }

    // 将十六进制颜色转换为带透明度的rgba格式
    hexToRgba(hex: string, opacity: number): string {
        // 移除 # 符号
        hex = hex.replace('#', '');

        // 处理3位和6位十六进制颜色
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }

        if (hex.length !== 6) {
            console.warn('DTB: Invalid hex color format:', hex);
            return `rgba(31, 30, 30, ${opacity})`;
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // 更新样式（真正更新背景的地方）
    updateStyleCss() {
        if (!this.settings.enabled || !this.background) {
            console.warn('DTB: Background update is disabled or no background is set');
            return;
        }

        let cssValue = '';
        let backgroundProperty = '';

        switch (this.background.type) {
            case 'image':
                cssValue = this.sanitizeImagePath(this.background.value);
                backgroundProperty = 'background-image';
                break;
            case 'color':
                cssValue = this.background.value;
                backgroundProperty = 'background';
                break;
            case 'gradient':
                cssValue = this.background.value;
                backgroundProperty = 'background';
                break;
        }

        // TODO .dtb-enabled 里可能会覆盖已有主题的样式，考虑更好的解法方案
        const bgColorWithOpacity = this.hexToRgba(this.settings.bgColor, this.settings.bgColorOpacity);

        this.styleTag.innerText = `
			.dtb-enabled {
				--background-primary: ${bgColorWithOpacity} !important;
				--background-primary-alt: ${bgColorWithOpacity} !important;
				--background-secondary: ${bgColorWithOpacity} !important;
				--background-secondary-alt: ${bgColorWithOpacity} !important;
				--tab-background-active: transparent !important;
				--tab-outline-width: transparent !important;
			}
			.dtb-enabled .workspace::before {
				${backgroundProperty}: ${cssValue} !important;
				background-size: cover;
				background-repeat: no-repeat;
				filter: blur(${this.settings.blurDepth}px) brightness(${this.settings.brightness4Bg}) saturate(${this.settings.saturate4Bg});
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: -1;
			}
			`
            .trim()
            .replace(/[\r\n\s]+/g, ' ');

        // 通知 css-change
        this.app.workspace.trigger('css-change', {
            source: 'dtb',
        });
    }

    getCurrentTimeRule(): TimeRule | null {
        if (this.settings.mode !== 'time-based') return null;

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        for (const rule of this.settings.timeRules) {
            if (!rule.enabled) continue;

            const [startHour, startMin] = rule.startTime.split(':').map(Number);
            const [endHour, endMin] = rule.endTime.split(':').map(Number);

            const startTime = startHour * 60 + startMin;
            const endTime = endHour * 60 + endMin;

            // 处理跨天的情况（如22:00-06:00）
            if (startTime > endTime) {
                if (currentTime >= startTime || currentTime < endTime) {
                    return rule;
                }
            } else {
                if (currentTime >= startTime && currentTime < endTime) {
                    return rule;
                }
            }
        }

        return null;
    }

    // 更新背景
    updateBackground(forceUpdate: boolean = true) {
        if (!this.settings.enabled) return;

        let needsUpdate = false;
        switch (this.settings.mode) {
            case 'time-based':
                const rule = this.getCurrentTimeRule();
                if (rule) {
                    this.background = this.settings.backgrounds.find(
                        bg => bg.id === rule.backgroundId
                    ) || null;

                    // 判断是否与当前背景不同
                    needsUpdate = this.background?.id !== rule.backgroundId;

                    // 调试信息, 降低等级，避免刷屏
                    console.debug('DTB: TimeRule mode - current time rule', rule);
                }
                break;

            case 'interval':
                if (this.settings.backgrounds.length > 0) {
                    this.background = this.settings.backgrounds[this.settings.currentIndex];
                    this.settings.currentIndex =
                        (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                    this.saveSettings();
                    needsUpdate = true; // 每次间隔切换都需要更新背景

                    console.debug('DTB: Interval mode - current index and background', this.settings.currentIndex, this.background);
                }
                break;
        }

        if (forceUpdate || (needsUpdate && this.background)) {
            this.updateStyleCss();
        }
    };

    startBackgroundManager() {
        this.stopBackgroundManager();

        // 如果没有 'dtb-enabled' 类，则添加
        if (!document.body.classList.contains('dtb-enabled')) {
            document.body.classList.add('dtb-enabled');
        }

        // 立即执行一次更新
        this.updateBackground();

        // 设置定时器
        const intervalMs = this.settings.mode === 'time-based' ? 60000 : // 每分钟检查一次
            this.settings.intervalMinutes * 60000;

        this.intervalId = this.registerInterval(window.setInterval(() => {
            this.updateBackground(false);
        }, intervalMs));

        console.log('DTB: Background manager started', {
            mode: this.settings.mode,
            interval: intervalMs / 1000 + 's'
        });
    }

    stopBackgroundManager() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        document.body.classList.remove('dtb-enabled');
        console.log('DTB: Background manager stopped');
    }

}

// 模态窗口

class BackgroundModal extends Modal {
    type: 'image' | 'color' | 'gradient';
    onSubmit: (name: string, value: string) => void;
    nameInput: HTMLInputElement;
    valueInput: HTMLInputElement;

    constructor(app: App, type: 'image' | 'color' | 'gradient', onSubmit: (name: string, value: string) => void) {
        super(app);
        this.type = type;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        let titleKey: keyof typeof en;
        switch (this.type) {
            case 'image':
                titleKey = 'add_modal_title_image';
                break;
            case 'color':
                titleKey = 'add_modal_title_color';
                break;
            case 'gradient':
                titleKey = 'add_modal_title_gradient';
                break;
        }
        contentEl.createEl('h2', { text: t(titleKey) });

        // Name input
        contentEl.createEl('label', { text: t('bg_name_label') });
        this.nameInput = contentEl.createEl('input', { type: 'text' });
        this.nameInput.style.width = '100%';
        this.nameInput.style.marginBottom = '10px';

        // Value input
        let valueLabel = '';
        let placeholder = '';

        switch (this.type) {
            case 'image':
                valueLabel = t('image_url_label');
                placeholder = 'https://example.com/image.jpg OR path/to/image.jpg';
                break;
            case 'color':
                valueLabel = t('color_value_label');
                placeholder = '#ffffff';
                break;
            case 'gradient':
                valueLabel = t('gradient_css_label');
                placeholder = 'linear-gradient(45deg, #ff0000, #0000ff)';
                break;
        }

        contentEl.createEl('label', { text: valueLabel });

        // 为图片类型创建带有浏览按钮的输入区域
        if (this.type === 'image') {
            const inputContainer = contentEl.createDiv();
            inputContainer.style.display = 'flex';
            inputContainer.style.gap = '8px';
            inputContainer.style.marginBottom = '20px';

            this.valueInput = inputContainer.createEl('input', { type: 'text', placeholder });
            this.valueInput.style.flex = '1';

            const browseButton = inputContainer.createEl('button', { text: 'Browse' });
            browseButton.type = 'button';
            browseButton.onclick = () => {
                const modal = new ImagePathSuggestModal(this.app, (imagePath) => {
                    this.valueInput.value = imagePath;
                });
                modal.open();
            };
        } else {
            this.valueInput = contentEl.createEl('input', { type: 'text', placeholder });
            this.valueInput.style.width = '100%';
            this.valueInput.style.marginBottom = '20px';
        }

        // Buttons
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';

        const cancelButton = buttonContainer.createEl('button', { text: t('cancel_button') });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl('button', { text: t('confirm_button') });
        submitButton.style.marginLeft = '10px';
        submitButton.onclick = () => {
            this.onSubmit(this.nameInput.value, this.valueInput.value || placeholder);
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class TimeRuleModal extends Modal {
    rule: TimeRule;
    onSubmit: (rule: { name: string, startTime: string, endTime: string }) => void;
    nameInput: HTMLInputElement;
    startTimeInput: HTMLInputElement;
    endTimeInput: HTMLInputElement;

    constructor(app: App, rule: TimeRule, onSubmit: (rule: {
        name: string,
        startTime: string,
        endTime: string
    }) => void) {
        super(app);
        this.rule = rule;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: t('edit_time_rule_title') });

        // Name input
        contentEl.createEl('label', { text: t('rule_name_label') });
        this.nameInput = contentEl.createEl('input', { type: 'text', value: this.rule.name });
        this.nameInput.style.width = '100%';
        this.nameInput.style.marginBottom = '10px';

        // Start time input
        contentEl.createEl('label', { text: t('start_time_label') });
        this.startTimeInput = contentEl.createEl('input', { type: 'time', value: this.rule.startTime });
        this.startTimeInput.style.width = '100%';
        this.startTimeInput.style.marginBottom = '10px';

        // End time input
        contentEl.createEl('label', { text: t('end_time_label') });
        this.endTimeInput = contentEl.createEl('input', { type: 'time', value: this.rule.endTime });
        this.endTimeInput.style.width = '100%';
        this.endTimeInput.style.marginBottom = '20px';

        // Buttons
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';

        const cancelButton = buttonContainer.createEl('button', { text: t('cancel_button') });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl('button', { text: t('confirm_button') });
        submitButton.style.marginLeft = '10px';
        submitButton.onclick = () => {
            this.onSubmit({
                name: this.nameInput.value,
                startTime: this.startTimeInput.value,
                endTime: this.endTimeInput.value
            });
            this.close();
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


class ImagePathSuggestModal extends SuggestModal<string> {
    onSubmit: (imagePath: string) => void;

    constructor(app: App, onSubmit: (imagePath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.setPlaceholder('https://example.com/image.jpg OR path/to/image.jpg');
    }

    // 获取所有建议项
    getSuggestions(query: string): string[] {
        // 只有当用户输入了内容时才显示建议
        if (query.trim() === '') {
            return [];
        }

        // 如果是远程URL，不提供补全
        if (query.startsWith('http://') || query.startsWith('https://') || query.startsWith('www.')) {
            return [];
        }

        // 获取所有图片文件
        const files = this.app.vault.getFiles();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];

        // 过滤出图片文件并匹配查询
        return files
            .filter(file => imageExtensions.some(ext => file.path.toLowerCase().endsWith(ext)))
            .map(file => file.path)
            .filter(path => path.toLowerCase().includes(query.toLowerCase()))
            .sort()
            .slice(0, 10); // 限制显示数量
    }

    // 渲染建议项
    renderSuggestion(imagePath: string, el: HTMLElement) {
        const container = el.createDiv({ cls: 'image-suggestion-item' });

        // 创建图标和文本
        const icon = container.createSpan({ cls: 'suggestion-icon' });
        icon.innerHTML = '🖼️'; // 图片图标

        const text = container.createSpan({ cls: 'suggestion-text' });
        text.textContent = imagePath;

        // 添加一些基本样式
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';
    }

    // 选择建议项时的回调
    onChooseSuggestion(imagePath: string, evt: MouseEvent | KeyboardEvent) {
        this.onSubmit(imagePath);
    }
}

class ImageFolderSuggestModal extends SuggestModal<string> {
    onSubmit: (folderPath: string) => void;

    constructor(app: App, onSubmit: (folderPath: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.setPlaceholder(t('folder_path_placeholder'));
    }

    // 获取所有建议项
    getSuggestions(query: string): string[] {
        // 只有当用户输入了内容时才显示建议
        if (query.trim() === '') {
            return [];
        }

        const folders = this.app.vault.getAllFolders();

        // 过滤匹配的文件夹
        return folders
            .map(folder => folder.path)
            .filter(path => path.toLowerCase().includes(query.toLowerCase()))
            .sort()
            .slice(0, 10); // 限制显示数量
    }

    // 渲染建议项
    renderSuggestion(folderPath: string, el: HTMLElement) {
        el.createEl('div', { text: folderPath });
    }

    // 选择建议项时的回调
    onChooseSuggestion(folderPath: string, evt: MouseEvent | KeyboardEvent) {
        this.onSubmit(folderPath);
    }
}

// 设置面板
class DTBSettingTab extends PluginSettingTab {
    plugin: DynamicThemeBackgroundPlugin;

    constructor(app: App, plugin: DynamicThemeBackgroundPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: t('settings_title') });

        // 基础设置
        new Setting(containerEl)
            .setName(t('enable_plugin_name'))
            .setDesc(t('enable_plugin_desc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();

                    if (value) {
                        this.plugin.startBackgroundManager();
                    } else {
                        this.plugin.stopBackgroundManager();
                    }
                }));

        // 统一的背景模糊度设置
        new Setting(containerEl)
            .setName(t('blur_depth_name'))
            .setDesc(t('blur_depth_desc'))
            .addSlider(slider => slider
                .setLimits(0, 30, 1)
                .setValue(this.plugin.settings.blurDepth)
                .setDynamicTooltip()
                .onChange(async (value: number) => {
                    this.plugin.settings.blurDepth = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t('reset_blur_tooltip'))
                .onClick(async () => {
                    this.plugin.settings.blurDepth = DEFAULT_SETTINGS.blurDepth; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;

        // 统一的背景亮度设置
        new Setting(containerEl)
            .setName(t('brightness_name'))
            .setDesc(t('brightness_desc'))
            .addSlider(slider => slider
                .setLimits(0, 1.5, 0.01)
                .setValue(this.plugin.settings.brightness4Bg)
                .setDynamicTooltip()
                .onChange(async (value: number) => {
                    this.plugin.settings.brightness4Bg = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t('reset_brightness_tooltip'))
                .onClick(async () => {
                    this.plugin.settings.brightness4Bg = DEFAULT_SETTINGS.brightness4Bg; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;

        // 统一的背景饱和度设置
        new Setting(containerEl)
            .setName(t('saturate_name'))
            .setDesc(t('saturate_desc'))
            .addSlider(slider => slider
                .setLimits(0, 2, 0.01)
                .setValue(this.plugin.settings.saturate4Bg)
                .setDynamicTooltip()
                .onChange(async (value: number) => {
                    this.plugin.settings.saturate4Bg = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t('reset_saturate_tooltip'))
                .onClick(async () => {
                    this.plugin.settings.saturate4Bg = DEFAULT_SETTINGS.saturate4Bg; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;

        // 统一的背景颜色和透明度设置
        new Setting(containerEl)
            .setName(t('bg_color_name'))
            .setDesc(t('bg_color_desc'))
            .addColorPicker(colorPicker => colorPicker
                .setValue(this.plugin.settings.bgColor)
                .onChange(async (value: string) => {
                    this.plugin.settings.bgColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                }))
            .addSlider(slider => slider
                .setLimits(0, 1, 0.01)
                .setValue(this.plugin.settings.bgColorOpacity)
                .setDynamicTooltip()
                .onChange(async (value: number) => {
                    this.plugin.settings.bgColorOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip(t('reset_bg_color_tooltip'))
                .onClick(async () => {
                    this.plugin.settings.bgColor = DEFAULT_SETTINGS.bgColor;
                    this.plugin.settings.bgColorOpacity = DEFAULT_SETTINGS.bgColorOpacity;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;


        // 背景管理
        containerEl.createEl('h3', { text: t('bg_management_title') });
        const addBgContainer = containerEl.createDiv('dtb-add-bg-container');


        new Setting(addBgContainer)
            .setName(t('add_new_bg_name'))
            .addButton(button => button
                .setButtonText(t('add_image_bg_button'))
                .onClick(() => this.showAddBackgroundModal('image')))
            .addButton(button => button
                .setButtonText(t('add_color_bg_button'))
                .onClick(() => this.showAddBackgroundModal('color')))
            .addButton(button => button
                .setButtonText(t('add_gradient_bg_button'))
                .onClick(() => this.showAddBackgroundModal('gradient')))
            .addButton(button => button
                .setButtonText(t('add_folder_bg_button'))
                .onClick(() => this.showAddFolderModal()));
        const backgroundContainer = containerEl.createDiv('dtb-background-container');
        this.displayBackgrounds(backgroundContainer);

        // 模式设置
        containerEl.createEl('h3', { text: t('mode_settings_title') });
        new Setting(containerEl)
            .setName(t('switch_mode_name'))
            .setDesc(t('switch_mode_desc'))
            .addDropdown(dropdown => dropdown
                .addOption('time-based', t('mode_time_based'))
                .addOption('interval', t('mode_interval'))
                .addOption('manual', t('mode_manual'))
                .setValue(this.plugin.settings.mode)
                .onChange(async (value: 'time-based' | 'interval' | 'manual') => {
                    this.plugin.settings.mode = value;
                    await this.plugin.saveSettings();
                    this.plugin.stopBackgroundManager();
                    this.plugin.startBackgroundManager();
                    this.display();
                }));
        // 时间规则（仅在时间模式下显示）
        if (this.plugin.settings.mode === 'time-based') {
            containerEl.createEl('h4', { text: t('time_rules_title') });
            // 添加一个恢复默认的按钮
            new Setting(containerEl)
                .setName(t('reset_time_rules_name'))
                .setDesc(t('reset_time_rules_desc'))
                .addButton(button => button
                    .setButtonText(t('reset_button'))
                    .onClick(async () => {
                        this.plugin.settings.timeRules = DEFAULT_SETTINGS.timeRules;
                        await this.plugin.saveSettings();
                        this.display();
                    }));
            const timeRulesContainer = containerEl.createDiv('dtb-time-rules-container');
            this.displayTimeRules(timeRulesContainer);
        }
        // 时间间隔设置（仅在间隔模式下显示）
        if (this.plugin.settings.mode === 'interval') {
            new Setting(containerEl)
                .setName(t('interval_name'))
                .setDesc(t('interval_desc'))
                .addText(text => text
                    .setPlaceholder('60')
                    .setValue(this.plugin.settings.intervalMinutes.toString())
                    .onChange(async (value) => {
                        const minutes = parseInt(value) || 60;
                        this.plugin.settings.intervalMinutes = minutes;
                        await this.plugin.saveSettings();
                    }));
        }

    }

    displayBackgrounds(container: HTMLElement) {
        container.empty();

        this.plugin.settings.backgrounds.forEach((bg, index) => {
            const bgEl = container.createDiv('dtb-background-item');
            bgEl.createSpan({ text: bg.name, cls: 'dtb-bg-name' });
            bgEl.createSpan({ text: bg.type, cls: 'dtb-bg-type' });

            // 预览
            const preview = bgEl.createDiv('dtb-bg-preview');
            if (bg.type === 'image') {
                preview.style.backgroundImage = this.plugin.sanitizeImagePath(bg.value);
                preview.style.backgroundSize = 'cover';
            } else {
                preview.style.background = bg.value;
            }

            // 操作按钮
            const actions = bgEl.createDiv('dtb-bg-actions');

            actions.createEl('button', { text: t('preview_button') })
                .onclick = () => {
                    this.plugin.background = bg;
                    this.plugin.updateStyleCss();
                };

            actions.createEl('button', { text: t('delete_button') })
                .onclick = async () => {
                    // 使用 filter 方法删除
                    this.plugin.settings.backgrounds = this.plugin.settings.backgrounds.filter(b => b.id !== bg.id);
                    await this.plugin.saveSettings();
                    this.display();
                };
        });
    }

    displayTimeRules(container: HTMLElement) {
        container.empty();

        this.plugin.settings.timeRules.forEach((rule) => {
            const setting = new Setting(container)
                .setName(rule.name)
                .setDesc(`${rule.startTime} - ${rule.endTime}`)
                .addToggle(toggle => toggle
                    .setValue(rule.enabled)
                    .onChange(async (value) => {
                        rule.enabled = value;
                        await this.plugin.saveSettings();
                    }))
                .addDropdown(dropdown => {
                    dropdown.addOption('', t('select_background_option'));
                    this.plugin.settings.backgrounds.forEach(bg => {
                        dropdown.addOption(bg.id, bg.name);
                    });
                    return dropdown
                        .setValue(rule.backgroundId)
                        .onChange(async (value) => {
                            rule.backgroundId = value;
                            await this.plugin.saveSettings();
                        });
                })
                .addButton(button => button
                    .setButtonText(t('edit_button'))
                    .onClick(() => this.showEditTimeRuleModal(rule)))
                .addButton(button => button
                    .setButtonText(t('delete_button'))
                    .onClick(async () => {
                        // 使用 filter 方法删除
                        this.plugin.settings.timeRules = this.plugin.settings.timeRules.filter(r => r.id !== rule.id);
                        await this.plugin.saveSettings();
                        this.displayTimeRules(container);
                    }));
        });
    }

    async showAddBackgroundModal(type: 'image' | 'color' | 'gradient') {
        const modal = new BackgroundModal(this.app, type, async (name, value) => {
            if (name && value) {
                const newBg: BackgroundItem = {
                    id: Date.now().toString(),
                    name,
                    type,
                    value
                };

                this.plugin.settings.backgrounds.push(newBg);
                await this.plugin.saveSettings();
                this.display();
            }
        });

        modal.open();
    }

    showEditTimeRuleModal(rule: TimeRule) {
        const modal = new TimeRuleModal(this.app, rule, async (newRule) => {
            rule.name = newRule.name;
            rule.startTime = newRule.startTime;
            rule.endTime = newRule.endTime;

            await this.plugin.saveSettings();
            this.display();
        });

        modal.open();
    }

    showAddFolderModal() {
        const modal = new ImageFolderSuggestModal(this.app, async (folderPath: string) => {
            await this.addImagesFromFolder(folderPath);
        });

        modal.open();
    }

    async addImagesFromFolder(folderPath: string) {
        try {
            // 标准化路径：移除开头和结尾的斜杠，只处理 vault 内的相对路径
            folderPath = folderPath.replace(/^\/+|\/+$/g, '');

            let folderFiles: any[] = [];

            if (folderPath !== '') {
                // 尝试获取指定文件夹
                const folder = this.app.vault.getFolderByPath(folderPath);
                if (folder) {
                    // 只获取该文件夹下的直接子文件（不递归）
                    folderFiles = this.app.vault.getFiles().filter(file => {
                        const fileDir = file.path.substring(0, file.path.lastIndexOf('/'));
                        return fileDir === folderPath;
                    });
                } else {
                    new Notice(t('folder_not_found'));
                    return;
                }
            }

            if (folderFiles.length === 0) {
                new Notice(t('folder_not_found'));
                return;
            }

            await this.processImageFiles(folderFiles, folderPath);
        } catch (error) {
            console.error('DTB: Error scanning folder:', error);
            new Notice(t('folder_scan_error', { error: error.message }));
        }
    }

    async processImageFiles(files: any[], folderPath: string) {
        // 支持的图片格式
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];

        // 过滤出图片文件
        const imageFiles = files.filter(file =>
            imageExtensions.some(ext => file.path.toLowerCase().endsWith(ext))
        );

        if (imageFiles.length === 0) {
            new Notice(t('folder_not_found'));
            return;
        }

        let addedCount = 0;

        for (const file of imageFiles) {
            // 检查是否已存在相同路径的背景
            const existingBg = this.plugin.settings.backgrounds.find(bg =>
                bg.type === 'image' && bg.value === file.path
            );

            if (!existingBg) {
                const fileName = file.name.replace(/\.[^/.]+$/, ''); // 移除扩展名
                // 只保留最后一级文件夹名称，避免长路径影响观感
                const folderName = folderPath === '' ? 'root' : folderPath.split('/').pop() || folderPath;
                const newBg: BackgroundItem = {
                    id: Date.now().toString() + '-' + addedCount, // 确保ID唯一
                    name: `${fileName} (${folderName})`,
                    type: 'image',
                    value: file.path
                };

                this.plugin.settings.backgrounds.push(newBg);
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await this.plugin.saveSettings();
            this.display();
            new Notice(t('folder_scan_success', { count: addedCount.toString() }));
        } else {
            new Notice(t('folder_no_new_images'));
        }
    }
}

// 自定义设置视图类 - 用于在标签页中显示设置
export const DTB_SETTINGS_VIEW_TYPE = 'dtb-settings';

export class DTBSettingsView extends ItemView {
    plugin: DynamicThemeBackgroundPlugin;
    settingTab: DTBSettingTab;

    constructor(leaf: WorkspaceLeaf, plugin: DynamicThemeBackgroundPlugin) {
        super(leaf);
        this.plugin = plugin;
        // 创建一个设置标签页实例，但不是真正的设置标签页
        this.settingTab = new DTBSettingTab(this.app, plugin);
    }

    getViewType(): string {
        return DTB_SETTINGS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return t('settings_title');
    }

    getIcon(): string {
        return 'settings';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();

        // 添加标题
        container.createEl('h1', { text: t('settings_title') });

        // 设置容器样式
        container.addClass('dtb-settings-view');

        // 使用设置标签页的显示逻辑，但在我们自己的容器中
        this.settingTab.containerEl = container as HTMLElement;
        this.settingTab.display();
    }

    async onClose(): Promise<void> {
        // 清理资源
        this.settingTab.containerEl.empty();
        this.settingTab.containerEl.removeClass('dtb-settings-view');
        this.settingTab = null as any; // 释放引用，帮助垃圾回收
        this.plugin.deactivateView(); // 确保视图被正确清理
        console.log('DTBSettingsView closed');
    }
}
