<div align="center">

# 🌈 Dynamic Theme Background

### Build Your Own Wallpaper Library in Obsidian!
*Make every note-taking experience visually inspiring*

**🇺🇸 English ｜ [🇨🇳 中文版](README.zh.md)**

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

## Preview

![](docs/assets/dtb-demo2.gif)
![](docs/assets/dtb-demo3.gif)
![](docs/assets/dtb-demo.gif)

## Features

- **Multi-source Library** — Unsplash, Pixabay, Pexels, Wallhaven + custom API & local folders
- **Visual Tuning** — Blur, brightness, saturation, hue adjustments; dark/light theme aware
- **Smart Rotation** — Time windows, interval auto-change, command palette quick switch
- **Performance** — Async loading, caching, minimal impact on editor responsiveness

## Installation

> Requires Obsidian 1.7.2 or later.

### Marketplace (Pending)

> Currently in Obsidian review queue. Track: [obsidian-releases#7359](https://github.com/obsidianmd/obsidian-releases/pull/7359)

### BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add beta plugin → `https://github.com/sean2077/obsidian-dynamic-theme-background`
3. Enable in settings

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/sean2077/obsidian-dynamic-theme-background/releases)
2. Create `.obsidian/plugins/obsidian-dynamic-theme-background/`
3. Place files inside, restart Obsidian, enable

## Quick Start

1. **Add Sources** — Local images or API providers (Unsplash / Pixabay / Pexels / Wallhaven / Custom)
2. **Set Rotation** — Interval + optional time windows (morning / day / night)
3. **Control** — Status bar clicks or Command Palette (`dtb`) to switch, save & fetch

**Status Bar:**
- Left Click → Random wallpaper
- Middle Click → Open settings
- Right Click → Save current background

## Notes

- Optimized for dark themes; light themes may need parameter adjustments
- Uses Obsidian CSS variables — compatible with most themes
- If your theme defines custom backgrounds, choose one or the other to avoid conflicts

<details>
<summary>CSS Override Details</summary>

```css
.dtb-enabled .workspace::before {
    background-image: var(--dtb-bg-image);
    filter: blur(var(--dtb-blur-depth)) brightness(var(--dtb-brightness)) saturate(var(--dtb-saturate));
    /* ... */
}
```

</details>

## Roadmap

- Weather / system theme driven wallpaper sets
- Video / GIF backgrounds
- AI-generated backgrounds
- Mobile refinements
- Preset packs & collections

## Contributing

- [Report Bug](https://github.com/sean2077/obsidian-dynamic-theme-background/issues/new?template=bug_report.md)
- [Feature Request](https://github.com/sean2077/obsidian-dynamic-theme-background/issues/new?template=feature_request.md)
- Star the project if it helps!

## License

[MIT](LICENSE)
