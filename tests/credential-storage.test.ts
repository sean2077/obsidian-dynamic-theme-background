import assert from "node:assert/strict";
import test from "node:test";

import {
    CURRENT_CREDENTIAL_STORAGE_VERSION,
    CredentialMigrationError,
    MissingSecretReferenceError,
    assertSettingsCredentialsAreReferences,
    hydrateWallpaperApiConfig,
    migrateSettingsCredentials,
} from "../src/core/credential-storage";
import type { SecretStore, SensitiveParamResolver } from "../src/core/credential-storage";
import type { DTBSettings } from "../src/types";
import { WallpaperApiType } from "../src/wallpaper-apis/core/types";

class FakeSecretStore implements SecretStore {
    readonly values = new Map<string, string>();
    setCalls = 0;
    failOnSetCall?: number;

    getSecret(id: string): string | null {
        return this.values.get(id) ?? null;
    }

    listSecrets(): string[] {
        return Array.from(this.values.keys());
    }

    setSecret(id: string, secret: string): void {
        this.setCalls += 1;
        if (this.setCalls === this.failOnSetCall) {
            throw new Error("simulated SecretStorage failure");
        }
        this.values.set(id, secret);
    }
}

const sensitiveParams: SensitiveParamResolver = (config) =>
    config.type === WallpaperApiType.Unsplash ? ["client_id"] : [];

function settingsFixture(): DTBSettings {
    return {
        credentialStorageVersion: 0,
        enabled: true,
        statusBarEnabled: true,
        blurDepth: 0,
        brightness4Bg: 0.9,
        saturate4Bg: 1,
        bgColorLight: "#fff",
        bgColorOpacityLight: 0.3,
        bgColorDark: "#000",
        bgColorOpacityDark: 0.4,
        bgSize: "intelligent",
        mode: "manual",
        timeRules: [],
        intervalMinutes: 60,
        localBackgroundFolder: "",
        backgrounds: [],
        currentIndex: 0,
        enableRandomWallpaper: true,
        wallpaperApis: [
            {
                id: "My Unsplash/API",
                type: WallpaperApiType.Unsplash,
                enabled: false,
                name: "Unsplash",
                baseUrl: "https://api.unsplash.com",
                params: { client_id: "provider-secret", query: "mountains" },
                headers: {
                    Authorization: "Bearer header-secret",
                    "X-Trace": "private-header-value",
                },
            },
        ],
    };
}

void test("credential migration replaces password parameters and every custom header with references", () => {
    const source = settingsFixture();
    const store = new FakeSecretStore();

    const result = migrateSettingsCredentials(source, store, sensitiveParams);
    const migrated = result.settings.wallpaperApis[0];
    const serialized = JSON.stringify(result.settings);

    assert.equal(result.migrated, true);
    assert.equal(result.settings.credentialStorageVersion, CURRENT_CREDENTIAL_STORAGE_VERSION);
    assert.deepEqual(migrated.params, { query: "mountains" });
    assert.equal(migrated.headers, undefined);
    assert.ok(migrated.secretRefs?.params?.client_id);
    assert.ok(migrated.secretRefs?.headers?.Authorization);
    assert.ok(migrated.secretRefs?.headers?.["X-Trace"]);
    for (const id of store.listSecrets()) {
        assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    }
    assert.doesNotMatch(serialized, /provider-secret|header-secret|private-header-value/u);
    assert.equal(source.wallpaperApis[0].params.client_id, "provider-secret");
    assert.equal(source.wallpaperApis[0].headers?.Authorization, "Bearer header-secret");
    assertSettingsCredentialsAreReferences(result.settings, sensitiveParams);
});

void test("credential migration is idempotent and reuses an occupied ID only for the same value", () => {
    const store = new FakeSecretStore();
    store.values.set("dynamic-theme-background-my-unsplash-api-param-client-id", "another-user-secret");

    const first = migrateSettingsCredentials(settingsFixture(), store, sensitiveParams);
    const firstRef = first.settings.wallpaperApis[0].secretRefs?.params?.client_id;
    const callsAfterFirst = store.setCalls;
    const second = migrateSettingsCredentials(first.settings, store, sensitiveParams);

    assert.notEqual(firstRef, "dynamic-theme-background-my-unsplash-api-param-client-id");
    assert.match(firstRef ?? "", /-2$/u);
    assert.equal(store.getSecret(firstRef ?? ""), "provider-secret");
    assert.equal(second.migrated, false);
    assert.deepEqual(second.settings, first.settings);
    assert.equal(store.setCalls, callsAfterFirst);
});

void test("a failed SecretStorage write leaves the persisted source fully recoverable", () => {
    const source = settingsFixture();
    const before = JSON.stringify(source);
    const store = new FakeSecretStore();
    store.failOnSetCall = 2;

    assert.throws(
        () => migrateSettingsCredentials(source, store, sensitiveParams),
        (error: unknown) => error instanceof CredentialMigrationError
    );
    assert.equal(JSON.stringify(source), before);
    assert.equal(source.credentialStorageVersion, 0);
});

void test("a partial write can be retried without creating duplicate secret IDs", () => {
    const source = settingsFixture();
    const store = new FakeSecretStore();
    store.failOnSetCall = 2;

    assert.throws(() => migrateSettingsCredentials(source, store, sensitiveParams), CredentialMigrationError);
    store.failOnSetCall = undefined;
    const retried = migrateSettingsCredentials(source, store, sensitiveParams);

    assert.equal(
        retried.settings.wallpaperApis[0].secretRefs?.params?.client_id,
        "dynamic-theme-background-my-unsplash-api-param-client-id"
    );
    assert.equal(store.listSecrets().some((id) => /param-client-id-2$/u.test(id)), false);
    assertSettingsCredentialsAreReferences(retried.settings, sensitiveParams);
});

void test("storage failures and reference conflicts reject generically without exposing credential values", () => {
    const source = settingsFixture();
    const unavailableStore: SecretStore = {
        getSecret: () => {
            throw new Error("provider-secret");
        },
        setSecret: () => undefined,
    };

    assert.throws(
        () => migrateSettingsCredentials(source, unavailableStore, sensitiveParams),
        (error: unknown) =>
            error instanceof CredentialMigrationError && !error.message.includes("provider-secret")
    );

    const conflictStore = new FakeSecretStore();
    conflictStore.values.set("existing-reference", "different-value");
    source.wallpaperApis[0].secretRefs = { params: { client_id: "existing-reference" } };
    const before = JSON.stringify(source);
    assert.throws(
        () => migrateSettingsCredentials(source, conflictStore, sensitiveParams),
        (error: unknown) =>
            error instanceof CredentialMigrationError && !error.message.includes("provider-secret")
    );
    assert.equal(JSON.stringify(source), before);
});

void test("already-sanitized settings do not read SecretStorage during load", () => {
    const initialStore = new FakeSecretStore();
    const sanitized = migrateSettingsCredentials(settingsFixture(), initialStore, sensitiveParams).settings;
    const noEnumerationStore: SecretStore = {
        getSecret: () => {
            throw new Error("getSecret should not run during an idempotent migration");
        },
        setSecret: () => {
            throw new Error("setSecret should not run during an idempotent migration");
        },
    };

    const result = migrateSettingsCredentials(sanitized, noEnumerationStore, sensitiveParams);

    assert.equal(result.migrated, false);
    assert.deepEqual(result.settings, sanitized);
});

void test("runtime hydration returns an isolated config and fails closed for missing references", () => {
    const store = new FakeSecretStore();
    const migrated = migrateSettingsCredentials(settingsFixture(), store, sensitiveParams).settings.wallpaperApis[0];
    const hydrated = hydrateWallpaperApiConfig(migrated, store);

    assert.equal(hydrated.params.client_id, "provider-secret");
    assert.equal(hydrated.headers?.Authorization, "Bearer header-secret");
    assert.equal(hydrated.headers?.["X-Trace"], "private-header-value");
    assert.notEqual(hydrated, migrated);
    assert.equal(migrated.params.client_id, undefined);
    assert.equal(migrated.headers, undefined);

    const missingRef = migrated.secretRefs?.params?.client_id;
    assert.ok(missingRef);
    store.values.delete(missingRef);
    assert.throws(
        () => hydrateWallpaperApiConfig(migrated, store),
        (error: unknown) => error instanceof MissingSecretReferenceError
    );
});

void test("the persistence guard rejects both legacy password fields and custom headers", () => {
    const source = settingsFixture();

    assert.throws(() => assertSettingsCredentialsAreReferences(source, sensitiveParams), /plaintext credentials/u);
});
