import { RATIO_CLOSE_THRESHOLD, RATIO_LARGE_DIFF_THRESHOLD } from "../constants";

export function toCssUrl(value: string): string {
    const escaped = value
        .replace(/\\/gu, "\\\\")
        .replace(/"/gu, '\\"')
        .replace(/\r/gu, "\\D ")
        .replace(/\n/gu, "\\A ")
        .replace(/\f/gu, "\\C ")
        .replace(/\0/gu, "�");
    return `url("${escaped}")`;
}

export function selectBackgroundSize(
    imageWidth: number,
    imageHeight: number,
    viewportWidth: number,
    viewportHeight: number
): "contain" | "cover" {
    if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
        return "contain";
    }
    const imageRatio = imageWidth / imageHeight;
    const viewportRatio = viewportWidth / viewportHeight;
    const difference = Math.abs(imageRatio - viewportRatio) / viewportRatio;
    if (difference < RATIO_CLOSE_THRESHOLD) return "cover";
    if (imageRatio > viewportRatio) return "contain";
    return difference > RATIO_LARGE_DIFF_THRESHOLD ? "contain" : "cover";
}
