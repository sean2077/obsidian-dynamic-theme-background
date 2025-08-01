import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
const fs = require('fs');

interface DTBSettings {
    enabled: boolean;

    // 统一的背景模糊度、亮度和饱和度变量、背景颜色
    blurDepth: number; // 默认模糊度
    brightness4Bg: number; // 默认亮度
    saturate4Bg: number; // 默认饱和度
    bgColor: string; // 默认背景颜色


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

const DEFAULT_SETTINGS: DTBSettings = {
    enabled: true,
    blurDepth: 0, // 默认模糊度
    brightness4Bg: 0.9, // 默认亮度
    saturate4Bg: 1, // 默认饱和度
    bgColor: '#1f1e1e80', // 默认背景颜色
    mode: 'time-based',
    timeRules: [
        {
            id: 'morning',
            name: '早晨',
            startTime: '06:00',
            endTime: '09:00',
            backgroundId: 'default-morning',
            enabled: true
        },
        {
            id: 'later-morning',
            name: '上午',
            startTime: '09:00',
            endTime: '11:00',
            backgroundId: 'default-later-morning',
            enabled: true
        },
        {
            id: 'noon',
            name: '中午',
            startTime: '11:00',
            endTime: '13:00',
            backgroundId: 'default-noon',
            enabled: true
        },
        {
            id: 'afternoon',
            name: '下午',
            startTime: '13:00',
            endTime: '17:00',
            backgroundId: 'default-afternoon',
            enabled: true
        },
        {
            id: 'dusk',
            name: '黄昏',
            startTime: '17:00',
            endTime: '18:00',
            backgroundId: 'default-dusk',
            enabled: true
        },
        {
            id: 'evening',
            name: '傍晚',
            startTime: '18:00',
            endTime: '22:00',
            backgroundId: 'default-evening',
            enabled: true
        },
        {
            id: 'night',
            name: '夜晚',
            startTime: '22:00',
            endTime: '06:00',
            backgroundId: 'default-night',
            enabled: true
        }
    ],
    intervalMinutes: 60,
    backgrounds: [
        // 添加默认背景，便于测试
        {
            id: 'default-morning',
            name: '默认早晨背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
            id: 'default-later-morning',
            name: '默认上午背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        },
        {
            id: 'default-noon',
            name: '默认中午背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        },
        {
            id: 'default-afternoon',
            name: '默认下午背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        },
        {
            id: 'default-dusk',
            name: '默认黄昏背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
        },
        {
            id: 'default-evening',
            name: '默认傍晚背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
        },
        {
            id: 'default-night',
            name: '默认夜晚背景',
            type: 'gradient',
            value: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'
        }
    ],
    currentIndex: 0
};

export default class DynamicThemeBackgroundPlugin extends Plugin {
    settings: DTBSettings;
    intervalId: number | null = null;
    styleTag: HTMLStyleElement;

    // 当前的背景
    background: BackgroundItem | null = null;

    async onload() {
        await this.loadSettings();

        // 打印当前设置
        console.log('Dynamic Theme Background plugin settings:', this.settings);

        // 创建样式元素
        this.styleTag = document.createElement('style');
        this.styleTag.id = 'dtb-dynamic-styles';
        document.head.appendChild(this.styleTag);

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
        this.styleTag?.remove();
        console.log('Dynamic Theme Background plugin unloaded');
    }

    addCommands() {
        this.addCommand({
            id: 'toggle-dtb',
            name: '开启/关闭动态背景',
            callback: () => {
                this.settings.enabled = !this.settings.enabled;
                this.saveSettings();

                if (this.settings.enabled) {
                    this.startBackgroundManager();
                    new Notice('动态背景已开启');
                } else {
                    this.stopBackgroundManager();
                    new Notice('动态背景已关闭');
                }
            }
        });

        this.addCommand({
            id: 'next-background',
            name: '切换到下一个背景',
            callback: () => {
                if (this.settings.backgrounds.length > 0) {
                    this.settings.currentIndex =
                        (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                    this.background = this.settings.backgrounds[this.settings.currentIndex];
                    this.updateStyleCss();
                    this.saveSettings();
                    new Notice(`背景已切换到: ${this.background.name}`);
                }
            }
        });

        this.addCommand({
            id: 'test-current-background',
            name: '测试当前时间段背景',
            callback: () => {
                const rule = this.getCurrentTimeRule();
                if (rule) {
                    const bg = this.settings.backgrounds.find(b => b.id === rule.backgroundId);
                    if (bg) {
                        this.background = bg;
                        this.updateStyleCss();
                        new Notice(`当前时间段: ${rule.name}, 背景: ${bg.name}`);
                    } else {
                        new Notice(`时间段 ${rule.name} 没有设置背景`);
                    }
                } else {
                    new Notice('当前时间没有匹配的规则');
                }
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
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
            console.warn(`DTB: 图片文件 ${imagePath} 不存在`);
            return 'none';
        }
        const p = this.app.vault.getResourcePath(file);
        if (!p) {
            console.warn(`DTB: 无法获取图片 ${imagePath} 的资源路径`);
            return 'none';
        }
        console.log(`DTB: 使用图片 ${imagePath} 的资源路径 ${p}`);
        return `url(${p})`; // 形如 app://local/path/to/image.jpg
    }

    // 更新样式（真正更新背景的地方）
    updateStyleCss() {
        if (!this.settings.enabled || !this.background) {
            console.warn('DTB: 背景更新被禁用或没有设置背景');
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
        this.styleTag.innerText = `
			.dtb-enabled {
				--background-primary: ${this.settings.bgColor} !important;
				--background-primary-alt: ${this.settings.bgColor} !important;
				--background-secondary: ${this.settings.bgColor} !important;
				--background-secondary-alt: ${this.settings.bgColor} !important;
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

                    // 调试信息
                    console.log('DTB: TimeRule mode - current time rule', rule);
                }
                break;

            case 'interval':
                if (this.settings.backgrounds.length > 0) {
                    this.background = this.settings.backgrounds[this.settings.currentIndex];
                    this.settings.currentIndex =
                        (this.settings.currentIndex + 1) % this.settings.backgrounds.length;
                    this.saveSettings();
                    needsUpdate = true; // 每次间隔切换都需要更新背景

                    console.log('DTB: Interval mode - current index and background', this.settings.currentIndex, this.background);
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

        contentEl.createEl('h2', { text: `添加${this.type === 'image' ? '图片' : this.type === 'color' ? '颜色' : '渐变'}背景` });

        // Name input
        contentEl.createEl('label', { text: '背景名称:' });
        this.nameInput = contentEl.createEl('input', { type: 'text' });
        this.nameInput.style.width = '100%';
        this.nameInput.style.marginBottom = '10px';

        // Value input
        let valueLabel = '';
        let placeholder = '';

        switch (this.type) {
            case 'image':
                valueLabel = '图片的URL(可以是远程图片链接, 也可以是 vault 内部图片的路径):';
                placeholder = 'https://example.com/image.jpg 或 path/to/image.jpg';
                break;
            case 'color':
                valueLabel = '颜色值 (如 #ff0000):';
                placeholder = '#ffffff';
                break;
            case 'gradient':
                valueLabel = 'CSS 渐变 (如 linear-gradient(45deg, #ff0000, #0000ff)):';
                placeholder = 'linear-gradient(45deg, #ff0000, #0000ff)';
                break;
        }

        contentEl.createEl('label', { text: valueLabel });
        this.valueInput = contentEl.createEl('input', { type: 'text', placeholder });
        this.valueInput.style.width = '100%';
        this.valueInput.style.marginBottom = '20px';

        // Buttons
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';

        const cancelButton = buttonContainer.createEl('button', { text: '取消' });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl('button', { text: '确定' });
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

    constructor(app: App, rule: TimeRule, onSubmit: (rule: { name: string, startTime: string, endTime: string }) => void) {
        super(app);
        this.rule = rule;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: '编辑时间规则' });

        // Name input
        contentEl.createEl('label', { text: '规则名称:' });
        this.nameInput = contentEl.createEl('input', { type: 'text', value: this.rule.name });
        this.nameInput.style.width = '100%';
        this.nameInput.style.marginBottom = '10px';

        // Start time input
        contentEl.createEl('label', { text: '开始时间 (HH:MM):' });
        this.startTimeInput = contentEl.createEl('input', { type: 'time', value: this.rule.startTime });
        this.startTimeInput.style.width = '100%';
        this.startTimeInput.style.marginBottom = '10px';

        // End time input
        contentEl.createEl('label', { text: '结束时间 (HH:MM):' });
        this.endTimeInput = contentEl.createEl('input', { type: 'time', value: this.rule.endTime });
        this.endTimeInput.style.width = '100%';
        this.endTimeInput.style.marginBottom = '20px';

        // Buttons
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';

        const cancelButton = buttonContainer.createEl('button', { text: '取消' });
        cancelButton.onclick = () => this.close();

        const submitButton = buttonContainer.createEl('button', { text: '确定' });
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

        containerEl.createEl('h2', { text: 'Dynamic Theme Background Settings' });

        // 基础设置
        new Setting(containerEl)
            .setName('启用动态背景')
            .setDesc('开启或关闭动态背景功能')
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
            .setName('背景模糊度')
            .setDesc('设置背景模糊度，范围从 0 到 30')
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
                .setTooltip('恢复默认模糊度')
                .onClick(async () => {
                    this.plugin.settings.blurDepth = DEFAULT_SETTINGS.blurDepth; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;

        // 统一的背景亮度设置
        new Setting(containerEl)
            .setName('背景亮度')
            .setDesc('设置背景亮度，范围从 0 到 1.5')
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
                .setTooltip('恢复默认亮度')
                .onClick(async () => {
                    this.plugin.settings.brightness4Bg = DEFAULT_SETTINGS.brightness4Bg; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;

        // 统一的背景饱和度设置
        new Setting(containerEl)
            .setName('背景饱和度')
            .setDesc('设置背景饱和度，范围从 0 到 2')
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
                .setTooltip('恢复默认饱和度')
                .onClick(async () => {
                    this.plugin.settings.saturate4Bg = DEFAULT_SETTINGS.saturate4Bg; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;

        // 统一的背景颜色设置
        new Setting(containerEl)
            .setName('背景颜色')
            .setDesc('设置背景颜色（TODO：该配置暂时有问题，待解决后再使用）')
            .addColorPicker(colorPicker => colorPicker
                .setValue(this.plugin.settings.bgColor)
                .onChange(async (value: string) => {
                    this.plugin.settings.bgColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                }))
            .addExtraButton(button => button
                .setIcon('reset')
                .setTooltip('恢复默认背景颜色')
                .onClick(async () => {
                    this.plugin.settings.bgColor = DEFAULT_SETTINGS.bgColor; // 恢复默认值
                    await this.plugin.saveSettings();
                    this.plugin.updateStyleCss();
                    this.display();
                }))
            ;


        // 背景管理
        containerEl.createEl('h3', { text: '背景管理' });
        const addBgContainer = containerEl.createDiv('dtb-add-bg-container');
        new Setting(addBgContainer)
            .setName('添加新背景')
            .addButton(button => button
                .setButtonText('添加图片背景')
                .onClick(() => this.showAddBackgroundModal('image')))
            .addButton(button => button
                .setButtonText('添加颜色背景')
                .onClick(() => this.showAddBackgroundModal('color')))
            .addButton(button => button
                .setButtonText('添加渐变背景')
                .onClick(() => this.showAddBackgroundModal('gradient')));
        const backgroundContainer = containerEl.createDiv('dtb-background-container');
        this.displayBackgrounds(backgroundContainer);

        // 模式设置
        containerEl.createEl('h3', { text: '模式设置' });
        new Setting(containerEl)
            .setName('切换模式')
            .setDesc('选择背景切换的方式')
            .addDropdown(dropdown => dropdown
                .addOption('time-based', '按时间段')
                .addOption('interval', '按时间间隔')
                .addOption('manual', '手动切换')
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
            containerEl.createEl('h4', { text: '时间规则' });
            // 添加一个恢复默认的按钮
            new Setting(containerEl)
                .setName('恢复默认时间规则')
                .setDesc('将时间规则恢复为默认设置')
                .addButton(button => button
                    .setButtonText('恢复默认')
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
                .setName('切换间隔')
                .setDesc('每隔多少分钟切换一次背景')
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

            actions.createEl('button', { text: '预览' })
                .onclick = () => {
                    this.plugin.background = bg;
                    this.plugin.updateStyleCss();
                };

            actions.createEl('button', { text: '删除' })
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
                    dropdown.addOption('', '选择背景');
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
                    .setButtonText('编辑')
                    .onClick(() => this.showEditTimeRuleModal(rule)))
                .addButton(button => button
                    .setButtonText('删除')
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
}
