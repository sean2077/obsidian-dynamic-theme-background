# Obsidian Dynamic Theme Background Plugin

[中文版](README.zh.md) | English

## Introduction

This is a plugin for Obsidian that dynamically changes backgrounds based on time periods and user settings.

## Features

- **Time-based backgrounds**: Automatically switch backgrounds according to time periods
- **Manual switching**: Allows users to manually switch backgrounds
- **Custom settings**: Users can customize background blur, brightness, saturation, and color
- **Multiple background types support**: Including image, color, and gradient backgrounds, with image backgrounds supporting both remote images and local vault images
- **Compatible with existing themes**: This plugin can be used with existing Obsidian themes (but will override some styles, see [Notes](#notes))

![](assets/dtb-demo.gif)

## Installation

### Method 1: Install via Obsidian Plugin Market

TODO: Pending approval from Obsidian plugin market

pull request: https://github.com/obsidianmd/obsidian-releases/pull/7291

### Method 2: Install via BRAT Plugin

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. In BRAT plugin, Add beta plugin -> Enter this project's GitHub URL `https://github.com/sean2077/obsidian-dynamic-theme-background`, and install
3. Enable the plugin in Obsidian

### Method 3: Manual Installation
1. Download the plugin's main.js, manifest.json, and style.css files
2. Place them in Obsidian's plugin folder .obsidian/plugins/dynamic-theme-background/
   - Ensure the folder structure is correct
3. Enable the plugin in Obsidian

## Usage

- Configure the plugin in settings
- Use the command palette to switch backgrounds

### Commands

Just type `dtb` in the command palette to find related commands.

Note: You can use commands to open the settings page in a tab for better viewing and modifying settings.

## Notes

1. Currently, the plugin is optimized for dark themes; light themes may have visual issues.

2. Currently, the plugin works by modifying the workspace background through the following styles. Please be aware of the areas where existing theme styles will be overridden:

```css
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
```

## Contributing

Issues and feature requests are welcome! If you'd like to contribute code, please follow these steps:

1. Fork this repository
2. Create a new branch
3. Commit your changes
4. Create a Pull Request

## License

See the [LICENSE](LICENSE) file.
