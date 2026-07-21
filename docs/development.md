# Development Guide

This guide holds lower-frequency implementation detail referenced by the root `AGENTS.md`. User-facing behavior belongs in `README.md` and `README.zh.md`; commit-message policy belongs in `CONTRIBUTING.md`.

## Authority map

- `src/main.ts` is the bundle entry and re-exports the plugin class from `src/plugin.ts`.
- `src/plugin.ts` is the lifecycle and composition root: it loads and saves settings, constructs services, registers commands and UI, and exposes compatibility proxies used by existing surfaces.
- `src/core/` owns focused runtime modules: lifecycle coordination, time rules, settings normalization and credential migration, network and persistence policy, DOM/CSS application, remote image storage, and typed internal notifications.
- `src/types.ts` and `src/default-settings.ts` define the settings contract and defaults; `src/settings/settings-tab.ts` composes the focused sections under `src/settings/sections/`, while `settings-view.ts` owns the alternate settings view.
- `src/commands/index.ts` is the command registration point.
- `src/wallpaper-apis/core/` owns provider contracts, validation, registry, state, and lifecycle; provider modules under `src/wallpaper-apis/providers/` self-register and are exported through `providers/index.ts`.
- `styles.css` consumes the `--dtb-*` properties written by `src/core/style-manager.ts` and applies the `.dtb-enabled` runtime state.
- `docs/` is the static product site; its translated strings live in `docs/i18n/en.json` and `docs/i18n/zh.json`.

## Setup and checks

Install the locked dependency set with `npm ci`. The project pins approval for
esbuild's reviewed install script; after dependency upgrades, run
`npm install-scripts ls` and review any newly reported script before approving it.

| Task | Command | Notes |
|---|---|---|
| Development bundle | `npm run dev` | Starts the esbuild watcher and writes generated `main.js`. |
| Production/type check | `npm run build` | Runs TypeScript checking, then a minified production bundle. |
| Deterministic tests | `npm test` | Bundles `tests/**/*.test.ts` with the existing esbuild dependency, then runs Node's built-in test runner. |
| Project lint | `npm run lint` | Scans the manifest and TypeScript sources with the current Obsidian-specific and promise-safety rules. |
| CSS lint | `npm run lint:css` | Applies the runtime selector and style rules to authored `styles.css`. |
| Complete gate | `npm run check` | Runs build, TypeScript/Obsidian lint, runtime CSS lint, and deterministic tests. |
| Research evaluator | `npm run evaluate` | Emits one JSON line with the frozen modernization score and hard-gate state. |
| TypeScript formatting | `npm run fmt` | Mutates all `src/**/*.ts`; inspect the resulting diff. |

Automated tests cover pure policies and structural lifecycle/release contracts. They do not emulate Obsidian. For behavior changes, reload the plugin in a disposable test vault and exercise the affected flow. Select from these checks rather than claiming broad coverage:

- enable and disable the plugin, confirming timers and the `.dtb-enabled` body class are cleaned up;
- exercise the affected manual, interval, or time-rule background path;
- save settings, reload the plugin, and confirm existing saved data still behaves correctly;
- in a disposable vault with legacy provider credentials, reload once and confirm provider parameters and custom headers still work while `data.json` contains only SecretStorage references; also test a missing reference and confirm that provider stays unavailable without hiding its editable row;
- inspect both light and dark themes when CSS variables or overlays change;
- exercise provider success, failure, and local-background fallback when wallpaper API behavior changes.

## Change maps and invariants

### Settings and translations

Persisted data passes through `src/core/settings.ts`, which clones defaults and validates scalar and nested values before runtime use. When the schema changes, update the type, default, normalizer, relevant settings UI, tests, and `src/i18n/en.ts` plus `src/i18n/zh-cn.ts`.

Provider password fields and every user-defined header value are persisted as SecretStorage IDs under `secretRefs`. `src/core/credential-storage.ts` owns lossless legacy migration, the plaintext save guard, and short-lived runtime hydration; `src/plugin.ts` is the only composition boundary that supplies `app.secretStorage`. Never pass a persisted provider config directly to `WallpaperApiManager` or write hydrated values back to plugin settings.

Obsidian 1.13+ renders `DTBSettingTab.getSettingDefinitions()` as declarative pages. Keep `display()` and the alternate settings view as the Obsidian 1.11.4–1.12 compatibility path; new 1.13-only calls must stay behind `requireApiVersion` guards in `src/core/obsidian-compat.ts`.

### Commands

Create or update the command module under `src/commands/`, then keep the central list in `src/commands/index.ts` aligned. Command callbacks that return promises must preserve the repository's no-floating-promise rules.

### Wallpaper providers

A provider change can span the provider type/config contract, implementation and registry call, barrel export, settings descriptors, and localized labels. Route requests through the shared `BaseWallpaperApi.requestJson` policy so protocol, timeout, response-size, result-count, and credential-redaction rules remain consistent. Treat its result as `unknown` and parse it through the provider-specific validators in `src/wallpaper-apis/core/provider-responses.ts` before using a typed model. Keep enable/disable state notifications and failure rollback behavior consistent with `WallpaperApiManager`.

Custom providers use the no-evaluation JSONPath subset in `src/core/safe-json-path.ts`: properties, quoted keys, indexes, positive-step slices, unions, wildcards, and recursive descent. Filters and script expressions are intentionally rejected.

### Runtime styling

`StyleManager` writes CSS custom properties while `styles.css` renders them. Change both sides together when adding or renaming a property, preserve light/dark mappings, CSS URL escaping, reduced-motion behavior, and `BackgroundManager.stop()` plus plugin unload cleanup.

### Public documentation

Keep `README.md` and `README.zh.md` aligned for user-facing changes. Keep the two `docs/i18n/*.json` catalogs aligned when the static site changes.

## Generated and release-owned files

`main.js` is generated, ignored, and attached to GitHub releases with `manifest.json` and `styles.css`; do not hand-edit or commit it. Pushes to `main` or `master` install with `npm ci`, run `npm run check`, then run semantic-release, which derives the next version from Conventional Commits, updates `CHANGELOG.md`, `manifest.json`, `package.json`, `package-lock.json`, and `src/version.ts`, creates the release commit, and publishes the release assets. Ordinary feature and fix work should not pre-bump those version files.
