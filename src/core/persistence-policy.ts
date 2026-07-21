export const MAX_IMAGE_BYTES = 25 * 1_024 * 1_024;

const CONTENT_EXTENSIONS: Record<string, string> = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};
const RESERVED_NAME = /^(?:aux|con|nul|prn|com[1-9]|lpt[1-9])$/iu;

export interface BinaryStore {
    create: (path: string, data: ArrayBuffer) => Promise<void>;
    exists: (path: string) => boolean | Promise<boolean>;
    replace: (path: string, data: ArrayBuffer) => Promise<void>;
}

export function normalizeVaultFolder(value: string): string {
    const normalized = value.replace(/\\/gu, "/").replace(/\/{2,}/gu, "/");
    if (normalized.length === 0 || normalized.startsWith("/") || /^[a-z]:/iu.test(normalized)) {
        throw new Error("Vault folder must be a non-empty relative path");
    }
    const segments = normalized.split("/");
    if (
        segments.some(
            (segment) => segment.length === 0 || segment === "." || segment === ".." || /[:\0]/u.test(segment)
        )
    ) {
        throw new Error("Vault folder contains an unsafe segment");
    }
    return segments.join("/");
}

export function sanitizeImageName(value: string): string {
    const sanitized = value
        .normalize("NFKC")
        .split("")
        .map((character) => {
            const code = character.charCodeAt(0);
            return code <= 31 || code === 127 ? "_" : character;
        })
        .join("")
        .replace(/[<>:"/\\|?*]/gu, "_")
        .replace(/\s+/gu, " ")
        .replace(/[. ]+$/gu, "")
        .trim()
        .slice(0, 80);
    if (sanitized.length === 0) return "wallpaper";
    return RESERVED_NAME.test(sanitized.split(".", 1)[0]) ? `_${sanitized}` : sanitized;
}

export function inspectImageResponse(contentType: string | undefined, byteLength: number): string {
    if (byteLength < 1 || byteLength > MAX_IMAGE_BYTES) {
        throw new Error("Image response has an invalid size");
    }
    const mime = contentType?.split(";", 1)[0].trim().toLowerCase() ?? "";
    const extension = CONTENT_EXTENSIONS[mime];
    if (!extension) throw new Error("Remote response is not a supported image");
    return extension;
}

export function buildImagePath(folder: string, imageName: string, extension: string): string {
    return `${normalizeVaultFolder(folder)}/${sanitizeImageName(imageName)}${extension}`;
}

export async function writeImage(
    store: BinaryStore,
    path: string,
    data: ArrayBuffer,
    confirmReplace: (path: string) => boolean | Promise<boolean>
): Promise<"cancelled" | "created" | "replaced"> {
    if (!(await store.exists(path))) {
        await store.create(path, data);
        return "created";
    }
    if (!(await confirmReplace(path))) return "cancelled";
    await store.replace(path, data);
    return "replaced";
}
