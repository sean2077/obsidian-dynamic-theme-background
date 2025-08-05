/**
 * @file src/utils.ts
 * @description Utility functions for the Obsidian Dynamic Theme Background plugin.
 */

/**
 * Converts a hexadecimal color string to an RGBA color string with the specified opacity.
 *
 * Supports both 3-digit and 6-digit hex color formats. If the input is invalid,
 * returns a default RGBA color (`rgba(31, 30, 30, opacity)`).
 *
 * @param hex - The hexadecimal color string (e.g., "#fff" or "#ffffff").
 * @param opacity - The opacity value for the RGBA color (between 0 and 1).
 * @returns The RGBA color string representation.
 */
export function hexToRgba(hex: string, opacity: number): string {
    // 移除 # 符号
    hex = hex.replace("#", "");

    // 处理3位和6位十六进制颜色
    if (hex.length === 3) {
        hex = hex
            .split("")
            .map((char) => char + char)
            .join("");
    }

    if (hex.length !== 6) {
        console.warn("DTB: Invalid hex color format:", hex);
        return `rgba(31, 30, 30, ${opacity})`;
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
