<div align="center">

# 🌈 动态主题背景 (DTB)

### 在 Obsidian 中打造你的专属壁纸库！
*让每一次笔记体验都充满视觉灵感*

**[🇺🇸 English](README.md) ｜ 🇨🇳 中文版**

<p align="center">
    <a href="https://obsidian.md/"><img
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
            src="https://img.shields.io/github/actions/workflow/status/sean2077/obsidian-dynamic-theme-background/release.yml?branch=master"
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

> 需要 Obsidian 1.7.2 或更高版本。

### 社区市场（审核中）

> 当前在官方审核队列。跟踪进度：[obsidian-releases#7359](https://github.com/obsidianmd/obsidian-releases/pull/7359)

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

## 注意事项

- 主要针对暗色主题优化，浅色主题可能需要调整参数
- 使用 Obsidian CSS 变量，兼容大多数主题
- 如果主题自带背景功能，请二选一避免冲突

<details>
<summary>CSS 覆盖说明</summary>

```css
.dtb-enabled .workspace::before {
    background-image: var(--dtb-bg-image);
    filter: blur(var(--dtb-blur-depth)) brightness(var(--dtb-brightness)) saturate(var(--dtb-saturate));
    /* ... */
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
