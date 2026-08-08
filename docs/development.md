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
The bundle follows Obsidian's official `es2021` sample target and emits UTF-8 so
localized strings do not expand into ASCII escape sequences.

| Task | Command | Notes |
|---|---|---|
| Development bundle | `npm run dev` | Starts the esbuild watcher and writes generated `main.js`. |
| Production/type check | `npm run build` | Runs TypeScript checking, then a minified production bundle. |
| Deterministic tests | `npm test` | Bundles `tests/**/*.test.ts` with the existing esbuild dependency, then runs Node's built-in test runner. |
| Project lint | `npm run lint` | Scans the manifest and TypeScript sources with the current Obsidian-specific, promise-safety, and unsafe-value rules. |
| CSS lint | `npm run lint:css` | Applies the runtime selector and style rules to authored `styles.css`. |
| Complete gate | `npm run check` | Runs build, TypeScript/Obsidian lint, runtime CSS lint, and deterministic tests. |
| Research evaluator | `npm run evaluate` | Emits one JSON line with the frozen modernization score and hard-gate state. |
| Prepare release | `npm run release:prepare -- <version>` | Bumps only the four version authorities; it does not edit notes, commit, tag, or push. |
| Verify release | `npm run release:verify -- <version>` | Requires aligned version authorities and one non-empty CHANGELOG section. |
| Extract release notes | `npm run release:notes -- <version> <output>` | Writes that exact CHANGELOG section to a new file without overwriting an existing path. |
| TypeScript formatting | `npm run fmt` | Mutates all `src/**/*.ts`; inspect the resulting diff. |

Automated tests cover pure policies and structural lifecycle/release contracts. They do not emulate Obsidian. For behavior changes, reload the plugin in a disposable test vault and exercise the affected flow. Select from these checks rather than claiming broad coverage:

- enable and disable the plugin, confirming timers and the `.dtb-enabled` body class are cleaned up;
- exercise the affected manual, interval, or time-rule background path;
- save settings, reload the plugin, and confirm existing saved data still behaves correctly;
- in a disposable vault with legacy provider credentials, reload once and confirm provider parameters and custom headers still work while `data.json` contains only SecretStorage references; also test a missing reference and confirm that provider stays unavailable without hiding its editable row;
- inspect both light and dark themes when CSS variables or overlays change, including settings widths below 1100 px and the mobile layout;
- add a local background by navigating into a nested folder with Browse, then import a folder and confirm that only its direct image children are added;
- exercise provider success, failure, and local-background fallback when wallpaper API behavior changes.

## Change maps and invariants

### Settings and translations

Persisted data passes through `src/core/settings.ts`, which clones defaults and validates scalar and nested values before runtime use. When the schema changes, update the type, default, normalizer, relevant settings UI, tests, and `src/i18n/en.ts` plus `src/i18n/zh-cn.ts`.

Provider password fields, credential-like custom query parameters, and every user-defined header value are persisted as SecretStorage IDs under `secretRefs`. `src/core/credential-storage.ts` owns lossless legacy migration, the plaintext save guard, and short-lived runtime hydration; `src/plugin.ts` is the only composition boundary that supplies `app.secretStorage`. Never pass a persisted provider config directly to `WallpaperApiManager` or write hydrated values back to plugin settings.

Obsidian 1.13+ renders `DTBSettingTab.getSettingDefinitions()` as declarative pages. Dynamic sections use `SettingDefinitionPage.page` with `SettingPage`; the alternate workspace view calls `displayWorkspaceView()` directly. Do not reintroduce the deprecated `PluginSettingTab.display()` fallback.

### Commands

Create or update the command module under `src/commands/`, then keep the central list in `src/commands/index.ts` aligned. Command callbacks that return promises must preserve the repository's no-floating-promise rules.

### Wallpaper providers

A provider change can span the provider type/config contract, implementation and registry call, barrel export, settings descriptors, and localized labels. Route requests through the shared `BaseWallpaperApi.requestJson` policy so protocol, timeout, response-size, result-count, and credential-redaction rules remain consistent. Treat its result as `unknown` and parse it through the provider-specific validators in `src/wallpaper-apis/core/provider-responses.ts` before using a typed model. Keep enable/disable state notifications and failure rollback behavior consistent with `WallpaperApiManager`.

Custom providers append validated primitive `params` to the endpoint query. Query credentials must enter through `secretRefs.params` so only the hydrated runtime clone contains their values. Custom providers use the no-evaluation JSONPath subset in `src/core/safe-json-path.ts`: properties, quoted keys, indexes, positive-step slices, unions, wildcards, and recursive descent. Filters and script expressions are intentionally rejected.

### Runtime styling

`StyleManager` writes CSS custom properties while `styles.css` renders them. Change both sides together when adding or renaming a property, preserve light/dark mappings, CSS URL escaping, reduced-motion behavior, and `BackgroundManager.stop()` plus plugin unload cleanup.

### Public documentation

Keep `README.md` and `README.zh.md` aligned for user-facing changes. Keep the two `docs/i18n/*.json` catalogs aligned when the static site changes.

## Generated and release-owned files

`main.js` is generated, ignored, and attached to GitHub releases with `manifest.json` and `styles.css`; do not hand-edit or commit it. `versions.json` preserves the most recent compatible plugin release whenever `minAppVersion` increases. Ordinary feature and fix work must not pre-bump release files.

## Release workflow

Releases use bare SemVer tags such as `2.10.1`. The committed CHANGELOG is the release-note authority. Select the next version from the latest reachable bare SemVer tag with the `semver-release` rules: breaking changes bump major, `feat` bumps minor, and other releasable Conventional Commits bump patch; an exact owner-selected version wins when valid.

1. From an up-to-date, clean `master`, create a release worktree such as `bash .agents/tools/worktree.sh new release-2-10-1 --type chore --trunk master`.
2. In that worktree, run `npm run release:prepare -- 2.10.1`. Add one newest-first `## [2.10.1]...` section to `CHANGELOG.md` with at least one user-facing note. If `minAppVersion` changed, update `versions.json` before continuing.
3. Run `npm audit`, `npm run release:verify -- 2.10.1`, and `npm run check`; inspect and stage only the release files, then commit them as `release: 2.10.1`.
4. Finish the worktree with `bash .agents/tools/worktree.sh done --trunk master`. This merges and pushes `master`; never push the tag first.
5. At the resulting clean `master` tip, create an annotated tag with `git tag -a 2.10.1 -m "2.10.1"`, then push only that new tag with `git push origin 2.10.1`. Never move or recreate an existing tag.
6. The tag-triggered Release workflow audits the locked dependency graph, verifies that the tag commit is on `origin/master`, checks all version authorities and the non-empty CHANGELOG section, runs the full gate, creates GitHub provenance attestations for the generated `main.js` and authored `styles.css`, extracts that section, uploads `main.js`, `manifest.json`, and `styles.css` to a draft GitHub Release, and publishes it only after every upload succeeds. Verify the workflow, tag/commit identity, release state, all three assets, and both attestations before declaring completion. After downloading the release assets, use `gh attestation verify main.js --repo sean2077/obsidian-dynamic-theme-background` and the equivalent command for `styles.css`.
