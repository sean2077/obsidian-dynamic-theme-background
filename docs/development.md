# Development Guide

This guide holds lower-frequency implementation detail referenced by the root `AGENTS.md`. User-facing behavior belongs in `README.md` and `README.zh.md`; commit-message policy belongs in `CONTRIBUTING.md`.

## Authority map

- `src/main.ts` is the bundle entry and re-exports the plugin class from `src/plugin.ts`.
- `src/plugin.ts` is the lifecycle and composition root: it loads and saves settings, constructs services, registers commands and UI, and exposes compatibility proxies used by existing surfaces.
- `src/core/` owns focused runtime services: `BackgroundManager` coordinates selection and modes, `TimeRuleScheduler` owns time-rule calculations, `StyleManager` owns DOM/CSS application, `BackgroundPersistence` saves remote images, and `EventBus` carries typed internal notifications.
- `src/types.ts` and `src/default-settings.ts` define the settings contract and defaults; `src/settings/settings-tab.ts` composes the focused sections under `src/settings/sections/`, while `settings-view.ts` owns the alternate settings view.
- `src/commands/index.ts` is the command registration point.
- `src/wallpaper-apis/core/` owns provider contracts, validation, registry, state, and lifecycle; provider modules under `src/wallpaper-apis/providers/` self-register and are exported through `providers/index.ts`.
- `styles.css` consumes the `--dtb-*` properties written by `src/core/style-manager.ts` and applies the `.dtb-enabled` runtime state.
- `docs/` is the static product site; its translated strings live in `docs/i18n/en.json` and `docs/i18n/zh.json`.

## Setup and checks

Install the locked dependency set with `npm ci`.

| Task | Command | Notes |
|---|---|---|
| Development bundle | `npm run dev` | Starts the esbuild watcher and writes generated `main.js`. |
| Production/type check | `npm run build` | Runs TypeScript checking, then a minified production bundle. |
| Project lint | `npm run lint` | Scans the manifest and TypeScript sources with the current Obsidian-specific and promise-safety rules. |
| CSS lint | `npm run lint:css` | Applies the repository's selector and style rules. |
| TypeScript formatting | `npm run fmt` | Mutates all `src/**/*.ts`; inspect the resulting diff. |

`package.json` currently defines no automated test script. For behavior changes, reload the plugin in an Obsidian vault and exercise the affected flow. Select from these checks rather than claiming broad coverage:

- enable and disable the plugin, confirming timers and the `.dtb-enabled` body class are cleaned up;
- exercise the affected manual, interval, or time-rule background path;
- save settings, reload the plugin, and confirm existing saved data still behaves correctly;
- inspect both light and dark themes when CSS variables or overlays change;
- exercise provider success, failure, and local-background fallback when wallpaper API behavior changes.

## Change maps and invariants

### Settings and translations

Settings load with a shallow `Object.assign` of defaults and saved data. When the schema changes, update the type, default, relevant settings UI, and `src/i18n/en.ts` plus `src/i18n/zh-cn.ts`; explicitly account for older saved values, especially nested objects or arrays.

### Commands

Create or update the command module under `src/commands/`, then keep the central list in `src/commands/index.ts` aligned. Command callbacks that return promises must preserve the repository's no-floating-promise rules.

### Wallpaper providers

A provider change can span the provider type/config contract, the provider implementation and its module-level registry call, the provider barrel export, settings descriptors, and localized labels. Keep enable/disable state notifications and failure rollback behavior consistent with `WallpaperApiManager`.

### Runtime styling

`StyleManager` writes CSS custom properties while `styles.css` renders them. Change both sides together when adding or renaming a property, preserve light/dark mappings, and keep `BackgroundManager.stop()` plus plugin unload cleanup intact.

### Public documentation

Keep `README.md` and `README.zh.md` aligned for user-facing changes. Keep the two `docs/i18n/*.json` catalogs aligned when the static site changes.

## Generated and release-owned files

`main.js` is generated, ignored, and attached to GitHub releases with `manifest.json` and `styles.css`; do not hand-edit or commit it. Pushes to `main` or `master` run semantic-release, which derives the next version from Conventional Commits, updates `CHANGELOG.md`, `manifest.json`, `package.json`, `package-lock.json`, and `src/version.ts`, runs the production build, creates the release commit, and publishes the release assets. Ordinary feature and fix work should not pre-bump those version files.
