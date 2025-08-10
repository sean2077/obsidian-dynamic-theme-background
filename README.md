<div align="center">

# 🌈 Obsidian DTB
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

## Introduction

Obsidian Dynamic Theme Background is a highly customizable and intelligent wallpaper management plugin for Obsidian. By integrating multiple popular wallpaper sources (Unsplash, Pixabay, Pexels, Wallhaven) and supporting custom APIs, you can easily build a personalized wallpaper library. The plugin supports both local and remote images, and allows automatic switching based on time periods, creating different atmospheres for work and rest.

**Core Goal**: Let every Obsidian user enjoy an ultimate wallpaper experience, making knowledge management more beautiful and inspiring.

## ✨ Key Features

- 🖼️ **Powerful Wallpaper Sources for a Personalized Library**
  - 🌐 **Multi-source Wallpaper Library**: Integrates Unsplash, Pixabay, Pexels, Wallhaven, and custom APIs to build your own Obsidian wallpaper library
  - 📁 **Local & Remote Image Management**: Freely add local or online images for flexible collection and management

- 🎨 **Excellent Visual Experience & Theme Compatibility**
  - 🎚️ **Customizable Wallpaper Properties**: Adjust blur, brightness, saturation, and color to fit any theme style
  - 🧩 **Ultimate Theme Compatibility**: All styles use Obsidian CSS variables, perfectly blending with any theme, supporting both dark and light modes

- ⚡ **Highly Customizable Wallpaper Switching Rules**
  - ⏰ **Smart Time-based Switching**: Automatically change wallpapers based on set time periods, creating different work/rest atmospheres
  - 🔄 **Interval Switching**: Automatically switch wallpapers at set intervals for a fresh visual experience
  - 🎲 **One-click Random/Manual Switching**: Quickly switch wallpapers via command palette for instant inspiration

- 🤝 **Outstanding User Experience & Intuitive Operations**
  - 🚀 **Performance Optimization**: Asynchronous loading and caching for smooth experience
  - 🖼️ **Rich Default Wallpapers & API Examples**: Get started quickly with built-in resources
  - 🏷️ **Type Badges & Preview Animations**: Each wallpaper item features type badges and preview animations for rich visual feedback
  - 🗂️ **Batch Operations & Quick Commands**: Efficiently add, delete, and switch wallpapers in bulk

- 📦 **Richer Background Experience (Planned)**
  - 🌦️ **Real-time Data Integration**: Planned support for automatic background changes based on weather, time, etc.
  - 🎭 **Theme Packs & Marketplace**: Share and download custom theme configurations
  - 🎬 **Dynamic Backgrounds**: Support for video, GIF, and other multimedia backgrounds
  - 🎵 **Audio Backgrounds**: Add ambient sounds for immersive focus
  - 🤖 **AI-generated Backgrounds**: Integrate AI to create unique wallpapers
  - 📱 **Responsive & Mobile Adaptation**: Elegant layouts and smooth interactions on both desktop and mobile
  - 🚧 **More Innovative Features**: Continuous iteration, stay tuned!

## 🖼️ Preview

![](docs/assets/dtb-demo2.gif)
![](docs/assets/dtb-demo3.gif)
![](docs/assets/dtb-demo.gif)

## ⬇️ Installation

### 🛒 Method 1: Install via Obsidian Plugin Marketplace

TODO: Pending approval in Obsidian Plugin Marketplace

pull request: https://github.com/obsidianmd/obsidian-releases/pull/7359

### 🛠️ Method 2: Install via BRAT Plugin

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. In BRAT, Add beta plugin -> enter this repo URL `https://github.com/sean2077/obsidian-dynamic-theme-background` and install
3. Enable the plugin in Obsidian

### 📦 Method 3: Manual Installation

1. Download the latest `main.js`, `manifest.json`, and `styles.css` files
2. Create the folder `.obsidian/plugins/dynamic-theme-background/` in your Obsidian vault
3. Place the downloaded files into this folder
4. Restart Obsidian and enable the plugin in settings

## 🚀 Usage

### ⚡ Quick Start

1. **Enable the plugin**: Enable Dynamic Theme Background in Obsidian settings
2. **Add wallpapers**: Add your favorite wallpapers (local images, online images, or API wallpapers) in the plugin settings page
3. **Configure rules**: Set time-based or interval switching rules
4. **Enjoy the experience**: Use the command palette to quickly switch, or let the plugin automatically change wallpapers for you


### 💡 Commands

Type `dtb` in the command palette (Ctrl/Cmd + P) to find all related commands.

💡 **Tip**: Use the command to open the settings page in a new tab for preview and adjustment.

## ❓ FAQ

- **Wallpapers appear blurry or unclear?**
  - Adjust the blur parameter in settings, or choose higher resolution images.
- **How to add local images as wallpapers?**
  - Click "Add Wallpaper" in the settings page, select "Image" type, and enter the path relative to the vault root.
- **API fails to fetch wallpapers?**
  - Check your network connection, ensure the API key is configured correctly, and check the status indicator in plugin settings.
- **API activation fails?**
  - When enabling an API, the plugin will try to fetch wallpapers from the source. If it fails, an error message will be shown and the API will be disabled.
- **Plugin is not compatible with my theme?**
  - The plugin uses standard Obsidian CSS variables and should be compatible with most themes. If you encounter issues, please submit an issue on GitHub.

## 📝 Notes

1. **Dark and Light Theme**: The plugin is optimized for dark themes. You may need to adjust parameters for light themes.
2. **Theme Compatibility**: The plugin uses standard Obsidian CSS variables and should be compatible with most themes. If you encounter issues, please submit an issue on GitHub. If your theme supports defining backgrounds, please choose between enabling theme custom backgrounds and DTB backgrounds, as this may cause style conflicts.
3. **Style Override Notice**: The plugin uses the following CSS variables to achieve background effects. Be aware of possible impacts on existing topics:

```css
/* Workspace Background */
.dtb-enabled :not(.modal):not(.modal *) {
    --background-primary: var(--dtb-bg-color) !important;
    --background-primary-alt: var(--dtb-bg-color) !important;
    --background-secondary: var(--dtb-bg-color) !important;
    --background-secondary-alt: var(--dtb-bg-color) !important;
}
.dtb-enabled .workspace::before {
    background-image: var(--dtb-bg-image);
    background-size: var(--dtb-bg-size);
    background-repeat: no-repeat;
    background-position: center;
    filter: blur(var(--dtb-blur-depth)) brightness(var(--dtb-brightness)) saturate(var(--dtb-saturate));
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
}

/* Changes to other parts of the workspace */
.dtb-enabled .workspace-tab-header-container,
.dtb-enabled .workspace-tab-header-container .workspace-tab-header.tappable.is-active,
.dtb-enabled .workspace-tab-header.tappable.is-active,
.dtb-enabled .workspace-split.mod-vertical.mod-root,
.dtb-enabled .workspace-split.mod-horizontal.mod-sidedock.mod-left-split,
.dtb-enabled .workspace-split.mod-horizontal.mod-sidedock.mod-right-split,
.dtb-enabled .titlebar-button-container.mod-right,
.dtb-enabled .status-bar,
.dtb-enabled .workspace-ribbon::before,
.dtb-enabled .workspace-ribbon {
    background-color: var(--dtb-bg-color) !important;
}

```

## 📄 License

See [LICENSE](LICENSE) file.

## 🤝 Contributing & Support

We welcome all forms of contribution!

### 🛠️ Contribute Code
1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### 💡 Feedback & Suggestions
- 🐛 [Report Bug](https://github.com/sean2077/obsidian-dynamic-theme-background/issues)
- 💡 [Feature Request](https://github.com/sean2077/obsidian-dynamic-theme-background/issues)

### ✨ Support the Project
If this plugin helps you, you can:
- Star the project on GitHub ⭐
- Share with other Obsidian users 📢
- Join discussions and suggest improvements 💬

### 👥 Contributors

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/sean2077"><img src="https://avatars.githubusercontent.com/u/37324769?v=4?s=100" width="100px;" alt="sean2077"/><br /><sub><b>sean2077</b></sub></a><br /><a href="https://github.com/sean2077/obsidian-dynamic-theme-background/commits?author=sean2077" title="Code">💻</a> <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/commits?author=sean2077" title="Documentation">📖</a> <a href="https://github.com/sean2077/obsidian-dynamic-theme-background/commits?author=sean2077" title="Tests">⚠️</a> <a href="#maintenance-sean2077" title="Maintenance">🚧</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
