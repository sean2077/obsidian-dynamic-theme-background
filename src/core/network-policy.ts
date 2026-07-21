export const MAX_IMAGE_RESULTS = 100;
export const MAX_REMOTE_URL_LENGTH = 2_048;
export const MAX_RESPONSE_BYTES = 2 * 1_024 * 1_024;
export const REQUEST_TIMEOUT_MS = 15_000;

const SECRET_NAME =
    /(?:api[-_]?key|access[-_]?key|auth|client[-_.]?id|cookie|pass(?:word|phrase)|secret|token|(?:^|[-_.])key(?:$|[-_.]))/iu;
const SECRET_QUERY =
    /([?&#][^=&#\s]*(?:auth|client[-_.]?id|cookie|key|pass(?:word|phrase)|secret|token)[^=&#\s]*=)[^&#\s]*/giu;
const AUTH_VALUE = /\b(?:Basic|Bearer|Client-ID|Token)\s+[^\s,;]+/giu;

export interface RemoteUrlOptions {
    allowInsecureHttp?: boolean;
}

export interface TimerAdapter {
    clearTimeout: (handle: unknown) => void;
    setTimeout: (callback: () => void, delay: number) => unknown;
}

export function assertRemoteUrl(value: string, options: RemoteUrlOptions = {}): string {
    if (value.length === 0 || value.length > MAX_REMOTE_URL_LENGTH) {
        throw new Error("Remote URL has an invalid length");
    }

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error("Remote URL is invalid");
    }
    const protocolAllowed =
        url.protocol === "https:" || (options.allowInsecureHttp === true && url.protocol === "http:");
    if (!protocolAllowed || url.username || url.password) {
        throw new Error("Remote URL uses a disallowed protocol or credentials");
    }
    return url.toString();
}

export function isAllowedImageUrl(value: string): boolean {
    try {
        assertRemoteUrl(value, { allowInsecureHttp: true });
        return true;
    } catch {
        return false;
    }
}

export function assertResponseSize(byteLength: number): void {
    if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_RESPONSE_BYTES) {
        throw new Error("Remote response exceeds the size limit");
    }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timers: TimerAdapter): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeout = timers.setTimeout(() => {
            reject(new Error("Remote request timed out"));
        }, timeoutMs);
        promise.then(
            (value) => {
                timers.clearTimeout(timeout);
                resolve(value);
            },
            (error: unknown) => {
                timers.clearTimeout(timeout);
                reject(error instanceof Error ? error : new Error("Remote request failed"));
            }
        );
    });
}

export function redactSensitiveText(value: string): string {
    return value.replace(SECRET_QUERY, "$1[REDACTED]").replace(AUTH_VALUE, "[REDACTED]");
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
    if (typeof value === "string") return redactSensitiveText(value);
    if (value instanceof Error) {
        return `${value.name}: ${redactSensitiveText(value.message)}`;
    }
    if (value === null || typeof value !== "object") return value;
    if (depth >= 3) return "[TRUNCATED]";
    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => sanitizeForLog(item, depth + 1));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        sanitized[key] = SECRET_NAME.test(key) ? "[REDACTED]" : sanitizeForLog(item, depth + 1);
    }
    return sanitized;
}
