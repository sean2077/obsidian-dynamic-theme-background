<div align="center">

# 🌈 Dynamic Theme Background

### Build Your Own Wallpaper Library in Obsidian!
*Make every note-taking experience visually inspiring*

**🇺🇸 English ｜ [🇨🇳 中文版](README.zh.md)**

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

> Requires Obsidian 1.13.0 or later.

### Obsidian Community Plugins

1. Open **Settings → Community plugins → Browse**
2. Search for [Dynamic Theme Background](https://community.obsidian.md/plugins/dynamic-theme-background)
3. Select **Install**, then **Enable**

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

## Network and Privacy

- Local images, colors, and gradients work without provider requests. Enabling a wallpaper provider, using a custom JSON endpoint, or applying/saving a remote image can contact the configured third party; that service's terms and privacy policy apply.
- Provider keys, tokens, and every custom-header value are stored through Obsidian SecretStorage. The plugin's `data.json` contains only non-secret settings and SecretStorage IDs, not those credential values.
- Custom API query credentials must use **Secret query parameters**. The raw **Extra parameters** JSON accepts only non-secret string, number, and boolean values; those parameters are appended to the custom endpoint at request time.
- On the first load after upgrading, legacy plaintext credentials are copied to SecretStorage before `data.json` is replaced. If any secret write fails, the old `data.json` is left unchanged and plugin startup stops so credentials are not lost or partially migrated.
- Secrets can be shared across plugins or configurations, so deleting a DTB API removes only its reference and does not delete the Obsidian-owned secret.
- The plugin has no telemetry or analytics. Diagnostic logging sanitizes credential-bearing URLs and headers, bounds nested data, and does not intentionally log API keys or tokens.
- Saving a remote wallpaper is an explicit action and writes only to the validated vault-relative folder selected in plugin settings.

## Notes

- The wallpaper and your light/dark tint are drawn once per window. Content panes, sidebars, tabs and headers use coordinated, theme-derived surfaces. Existing wallpaper settings and per-image overrides are preserved, although removing the old stacked tints can change the apparent opacity.
- Workspace styling supports the current file-header tokens, tab states and redesigned new-tab actions. Theme text, icons, menus, settings and editing controls keep their native colors.
- Pop-out windows share the selected background and calculate intelligent sizing for their own dimensions. Disabling the plugin removes its layers and styles from every tracked window.
- Stacked panes, mobile drawers, Canvas cards and sticky Bases headers keep solid surfaces where transparency would reveal overlapping content. Obsidian's translucent-window option is handled separately.
- Themes or CSS snippets with their own wallpapers or forceful background overrides can still conflict. Adjust the theme or snippet if necessary.

<details>
<summary>Adjust workspace surface opacity with a CSS snippet</summary>

These optional variables control the theme surface above the wallpaper and its configured tint. Higher percentages improve contrast. No change to your saved wallpaper settings is needed.

```css
body.dtb-enabled {
    --dtb-surface-content: color-mix(in srgb, var(--background-primary) 50%, transparent);
    --dtb-surface-chrome: color-mix(in srgb, var(--background-secondary) 70%, transparent);
    --dtb-surface-control: color-mix(in srgb, var(--background-primary) 88%, transparent);
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
