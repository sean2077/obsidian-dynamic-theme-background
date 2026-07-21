import type { DTBSettings } from "../types";
import type {
    ApiValueType,
    WallpaperApiConfig,
    WallpaperApiSecretRefs,
} from "../wallpaper-apis/core/types";

export const CURRENT_CREDENTIAL_STORAGE_VERSION = 1;

const SECRET_ID_PREFIX = "dynamic-theme-background";
const SECRET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CREDENTIAL_PARAM_PATTERN =
    /(?:^|[-_.])(?:api[-_]?(?:key|token)|access[-_]?(?:key|token)|client[-_]?(?:id|secret)|refresh[-_]?token|authorization|auth(?:[-_]?token)?|bearer(?:[-_]?token)?|password|passphrase|secret|token|key)(?:$|[-_.])/iu;

export interface SecretStore {
    getSecret(id: string): string | null;
    setSecret(id: string, secret: string): void;
}

export type SensitiveParamResolver = (config: WallpaperApiConfig) => readonly string[];

/** Recognizes conventional query-credential names that must never reach data.json. */
export function isCredentialParameterKey(key: string): boolean {
    return CREDENTIAL_PARAM_PATTERN.test(key.trim());
}

export interface CredentialMigrationResult {
    settings: DTBSettings;
    migrated: boolean;
}

export class CredentialMigrationError extends Error {
    constructor() {
        super("Credential migration failed");
    }
}

export class MissingSecretReferenceError extends Error {
    constructor(readonly apiId: string, readonly field: string) {
        super("Credential reference missing");
    }
}

function cloneSecretRefs(secretRefs: WallpaperApiSecretRefs | undefined): WallpaperApiSecretRefs | undefined {
    if (!secretRefs) return undefined;
    return {
        params: secretRefs.params ? { ...secretRefs.params } : undefined,
        headers: secretRefs.headers ? { ...secretRefs.headers } : undefined,
    };
}

function cloneConfig(config: WallpaperApiConfig): WallpaperApiConfig {
    return {
        ...config,
        endpoints: config.endpoints ? { ...config.endpoints } : undefined,
        headers: config.headers ? { ...config.headers } : undefined,
        params: { ...config.params },
        secretRefs: cloneSecretRefs(config.secretRefs),
        customSettings: config.customSettings ? { ...config.customSettings } : undefined,
    };
}

function cloneSettings(settings: DTBSettings): DTBSettings {
    return {
        ...settings,
        wallpaperApis: settings.wallpaperApis.map(cloneConfig),
    };
}

function normalizeSecretIdPart(value: string): string {
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "");
    return normalized || "field";
}

function baseSecretId(config: WallpaperApiConfig, kind: "header" | "param", field: string): string {
    return [SECRET_ID_PREFIX, normalizeSecretIdPart(config.id), kind, normalizeSecretIdPart(field)].join("-");
}

function findAvailableSecretId(
    baseId: string,
    secret: string,
    store: SecretStore,
    pendingWrites: Map<string, string>
): string {
    let suffix = 1;
    while (true) {
        const candidate = suffix === 1 ? baseId : `${baseId}-${suffix}`;
        const currentValue = pendingWrites.get(candidate) ?? store.getSecret(candidate);
        if (currentValue === null || currentValue === secret) {
            return candidate;
        }
        suffix += 1;
    }
}

function ensureReference(
    config: WallpaperApiConfig,
    kind: "header" | "param",
    field: string,
    secret: string,
    currentReference: string | undefined,
    store: SecretStore,
    pendingWrites: Map<string, string>
): string {
    if (currentReference) {
        const currentValue = pendingWrites.get(currentReference) ?? store.getSecret(currentReference);
        if (currentValue !== null && currentValue !== secret) {
            throw new CredentialMigrationError();
        }
        if (currentValue === null) {
            pendingWrites.set(currentReference, secret);
        }
        return currentReference;
    }

    const id = findAvailableSecretId(baseSecretId(config, kind, field), secret, store, pendingWrites);
    if ((pendingWrites.get(id) ?? store.getSecret(id)) !== secret) {
        pendingWrites.set(id, secret);
    }
    return id;
}

function compactSecretRefs(secretRefs: WallpaperApiSecretRefs): WallpaperApiSecretRefs | undefined {
    const params = secretRefs.params && Object.keys(secretRefs.params).length > 0 ? secretRefs.params : undefined;
    const headers = secretRefs.headers && Object.keys(secretRefs.headers).length > 0 ? secretRefs.headers : undefined;
    return params || headers ? { params, headers } : undefined;
}

function resolveCredentialFields(
    config: WallpaperApiConfig,
    resolveSensitiveParams: SensitiveParamResolver
): string[] {
    return Array.from(
        new Set([
            ...resolveSensitiveParams(config),
            ...Object.keys(config.params).filter(isCredentialParameterKey),
        ])
    );
}

/**
 * Copies legacy credentials into SecretStorage and returns a sanitized settings clone.
 * The caller should persist the returned clone only after this function succeeds.
 */
export function migrateSettingsCredentials(
    source: DTBSettings,
    store: SecretStore,
    resolveSensitiveParams: SensitiveParamResolver
): CredentialMigrationResult {
    const settings = cloneSettings(source);
    const pendingWrites = new Map<string, string>();
    let migrated = settings.credentialStorageVersion < CURRENT_CREDENTIAL_STORAGE_VERSION;

    try {
        for (const config of settings.wallpaperApis) {
            const refs = cloneSecretRefs(config.secretRefs) ?? {};
            refs.params ??= {};
            refs.headers ??= {};

            for (const field of resolveCredentialFields(config, resolveSensitiveParams)) {
                if (!(field in config.params)) continue;
                const rawValue = config.params[field];
                delete config.params[field];
                migrated = true;
                if (rawValue === "") continue;
                const secret = String(rawValue);
                refs.params[field] = ensureReference(
                    config,
                    "param",
                    field,
                    secret,
                    refs.params[field],
                    store,
                    pendingWrites
                );
            }

            for (const [field, secret] of Object.entries(config.headers ?? {})) {
                migrated = true;
                if (secret === "") continue;
                refs.headers[field] = ensureReference(
                    config,
                    "header",
                    field,
                    secret,
                    refs.headers[field],
                    store,
                    pendingWrites
                );
            }

            config.headers = undefined;
            config.secretRefs = compactSecretRefs(refs);
        }

        for (const [id, secret] of pendingWrites) {
            if (!SECRET_ID_PATTERN.test(id)) {
                throw new CredentialMigrationError();
            }
            store.setSecret(id, secret);
        }
    } catch (error) {
        if (error instanceof CredentialMigrationError) throw error;
        throw new CredentialMigrationError();
    }

    settings.credentialStorageVersion = CURRENT_CREDENTIAL_STORAGE_VERSION;
    return { settings, migrated };
}

function hydrateReferences(
    target: Record<string, ApiValueType> | Record<string, string>,
    refs: Record<string, string> | undefined,
    config: WallpaperApiConfig,
    store: SecretStore,
    kind: "header" | "param"
): void {
    for (const [field, id] of Object.entries(refs ?? {})) {
        const secret = store.getSecret(id);
        if (secret === null) {
            throw new MissingSecretReferenceError(config.id, `${kind}:${field}`);
        }
        target[field] = secret;
    }
}

/** Returns a short-lived runtime clone containing the resolved credential values. */
export function hydrateWallpaperApiConfig(config: WallpaperApiConfig, store: SecretStore): WallpaperApiConfig {
    const hydrated = cloneConfig(config);
    hydrated.headers ??= {};
    hydrateReferences(hydrated.params, hydrated.secretRefs?.params, config, store, "param");
    hydrateReferences(hydrated.headers, hydrated.secretRefs?.headers, config, store, "header");
    if (Object.keys(hydrated.headers).length === 0) {
        hydrated.headers = undefined;
    }
    return hydrated;
}

/** Prevents any future settings write from reintroducing plaintext credentials. */
export function assertSettingsCredentialsAreReferences(
    settings: DTBSettings,
    resolveSensitiveParams: SensitiveParamResolver
): void {
    for (const config of settings.wallpaperApis) {
        const hasSensitiveParam = resolveCredentialFields(config, resolveSensitiveParams).some(
            (field) => field in config.params
        );
        const hasHeaders = Object.keys(config.headers ?? {}).length > 0;
        if (hasSensitiveParam || hasHeaders) {
            throw new Error("Refusing to persist plaintext credentials in wallpaper API settings");
        }
    }
}
