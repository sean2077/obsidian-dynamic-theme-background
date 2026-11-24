<div align="center">

# 🌈 动态主题背景 (DTB)

### 在 Obsidian 中打造你的专属壁纸库！
*让每一次笔记体验都充满视觉灵感*

**[🇺🇸 English](README.md) ｜ 🇨🇳 中文版**

<p align="center">
    <a href="https://community.obsidian.md/plugins/dynamic-theme-background"><img
            src="https://img.shields.io/badge/Obsidian%20Plugin-1e1e1e?logo=obsidian&logoColor=white"
            alt="Obsidian Plugin" /></a>
    <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/releases/latest"><img
            src="https://img.shields.io/github/v/release/sean2077/obsidian-dynamic-theme-background"
            alt="Latest Release" /></a>
    <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/releases"><img
            src="https://img.shields.io/github/downloads/sean2077/obsidian-dynamic-theme-background/total?logo=github"
            alt="GitHub Downloads" /></a>
    <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/stargazers"><img
            src="https://img.shields.io/github/stars/sean2077/obsidian-dynamic-theme-background"
            alt="GitHub Stars" /></a>
    <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/actions"><img
            src="https://img.shields.io/github/actions/workflow/status/sean2077/obsidian-dynamic-theme-background/release.yml"
            alt="Build Status" /></a>
    <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/blob/master/LICENSE"><img
            src="https://img.shields.io/github/license/sean2077/obsidian-dynamic-theme-background" alt="License" /></a>
</p>

</div>

---

## 预览

![](docs/assets/dtb-demo2.gif)
![](docs/assets/dtb-demo3.gif)
![](docs/assets/dtb-demo.gif)

## 主要特性

- **多源整合** — Unsplash / Pixabay / Pexels / Wallhaven + 自定义 API 与本地文件夹
- **可调视觉** — 模糊、亮度、饱和度、色相实时调节，兼容暗/亮主题
- **智能轮换** — 时间段、固定间隔、命令面板快捷切换
- **性能优化** — 异步加载 + 缓存，对编辑性能影响极小

## 安装

> 需要 Obsidian 1.13.0 或更高版本。

### Obsidian 社区插件市场

1. 打开**设置 → 社区插件 → 浏览**
2. 搜索 [Dynamic Theme Background](https://community.obsidian.md/plugins/dynamic-theme-background)
3. 点击**安装**，然后**启用**

### BRAT

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin → `https://github.com/sean2077/obsidian-dynamic-theme-background`
3. 在设置中启用

### 手动安装

1. 从 [Releases](https://github.com/sean2077/obsidian-dynamic-theme-background/releases) 下载 `main.js`、`manifest.json`、`styles.css`
2. 创建 `.obsidian/plugins/obsidian-dynamic-theme-background/`
3. 放入文件，重启 Obsidian，启用插件

## 快速开始

1. **添加源** — 本地图片或 API 源（Unsplash / Pixabay / Pexels / Wallhaven / 自定义）
2. **设置轮换** — 间隔 + 可选时间段（早/日/夜）
3. **控制** — 状态栏或命令面板（`dtb`）切换、保存与获取

**状态栏操作：**
- 左键 → 随机壁纸
- 中键 → 打开设置
- 右键 → 保存当前背景

## 网络与隐私

- 本地图片、纯色和渐变无需请求壁纸服务。启用壁纸提供商、使用自定义 JSON 接口或应用/保存远程图片时，可能访问所配置的第三方；相应服务的条款与隐私政策适用。
- 提供商密钥、令牌和所有自定义请求头值通过 Obsidian SecretStorage 保存。插件的 `data.json` 只包含非敏感设置和 SecretStorage ID，不包含这些凭据值。
- 自定义 API 的查询凭据必须使用**密钥查询参数**。原始**额外参数** JSON 只接受非敏感的字符串、数字和布尔值；请求时会把这些参数追加到自定义端点。
- 升级后首次加载时，旧版明文凭据会先完整写入 SecretStorage，再替换 `data.json`。若任一密钥写入失败，旧 `data.json` 会保持不变并停止插件启动，避免凭据丢失或半迁移。
- 密钥可能由多个插件或配置共享，因此删除 DTB API 只会移除引用，不会删除由 Obsidian 管理的密钥。
- 插件不包含遥测或分析。诊断日志会清理带凭据的 URL 与请求头、限制嵌套数据规模，并且不会有意记录 API key 或 token。
- 保存远程壁纸必须由用户明确触发，且只会写入插件设置中经过校验的 vault 相对目录。

## 注意事项

- 每个窗口只绘制一次壁纸和明暗主题遮罩。正文、侧栏、标签栏与页头使用协调的主题底色。现有壁纸设置及单张图片的覆盖设置都会保留，移除旧版重复叠加的遮罩后，视觉透明度可能有所变化。
- 工作区样式适配当前页头变量、标签页状态和新版新标签页按钮。文字、图标、菜单、设置及编辑控件沿用主题原有配色。
- 弹出窗口同步当前背景，并按各自窗口尺寸计算智能填充。禁用插件时会清理所有已跟踪窗口中的背景层和样式。
- 叠放面板、移动端抽屉、Canvas 卡片和 Bases 固定表头在需要防止内容透叠的地方保留实底。Obsidian 的“半透明窗口”选项有独立适配。
- 自带壁纸或强制覆盖背景的主题、CSS 片段仍可能产生冲突，需要相应调整。

<details>
<summary>通过 CSS 片段调整工作区底色透明度</summary>

下面的可选变量控制壁纸与遮罩上方的主题底色。百分比越高，对比度越强，无需修改已保存的壁纸设置。

```css
body.dtb-enabled {
    --dtb-surface-content: color-mix(in srgb, var(--background-primary) 50%, transparent);
    --dtb-surface-chrome: color-mix(in srgb, var(--background-secondary) 70%, transparent);
    --dtb-surface-control: color-mix(in srgb, var(--background-primary) 88%, transparent);
}
```

</details>

## 规划中

- 天气/系统主题联动
- 视频/GIF 背景
- AI 生成背景
- 移动端优化
- 预设包与收藏夹

## 贡献

- [报告 Bug](https://github.com/sean2077/obsidian-dynamic-theme-background/issues/new?template=bug_report.md)
- [功能建议](https://github.com/sean2077/obsidian-dynamic-theme-background/issues/new?template=feature_request.md)
- 觉得有用就点个 Star！

## 许可证

[MIT](LICENSE)
