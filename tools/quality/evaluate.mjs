import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BASELINE = Object.freeze({
    bundleBytes: 174_744,
    bundleGzipBytes: 44_642,
    score: 32,
    target: 42,
});

const REQUIRED_TESTS = Object.freeze({
    "tests/background-coordinator.test.ts": 6,
    "tests/persistence.test.ts": 6,
    "tests/provider-policy.test.ts": 6,
    "tests/settings.test.ts": 6,
    "tests/time-rule-scheduler.test.ts": 6,
    "tests/lifecycle.test.ts": 5,
    "tests/release-contract.test.ts": 5,
    "tests/style-manager.test.ts": 5,
    "tests/architecture.test.ts": 5,
});

function run(command, args, timeout = 120_000) {
    const startedAt = performance.now();
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
        timeout,
    });

    return {
        durationMs: Math.round(performance.now() - startedAt),
        ok: result.status === 0 && result.error === undefined,
    };
}

function npm(args) {
    if (process.platform === "win32") {
        return run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`]);
    }

    return run("npm", args);
}

function read(path) {
    return readFileSync(path, "utf8");
}

const packageJson = JSON.parse(read("package.json"));
const hasTests = typeof packageJson.scripts?.test === "string";
const test = hasTests ? npm(["test", "--silent"]) : { durationMs: 0, ok: false };
const build = npm(["run", "build", "--silent"]);
const lint = npm(["run", "lint", "--silent"]);
const cssLint = npm(["run", "lint:css", "--silent"]);
const diffCheck = run("git", ["diff", "--check"], 30_000);
const productionAudit = npm(["audit", "--omit=dev", "--audit-level=high", "--silent"]);

const styles = read("styles.css");
const transitionAllCount = (styles.match(/transition\s*:\s*all\b/giu) ?? []).length;
const importantCount = (styles.match(/!important\b/gu) ?? []).length;
const hasReducedMotion = /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/iu.test(styles);

const bundleExists = build.ok && existsSync("main.js");
const bundleBytes = bundleExists ? statSync("main.js").size : null;
const bundleGzipBytes = bundleExists ? gzipSync(readFileSync("main.js")).byteLength : null;

const testFiles = Object.fromEntries(Object.entries(REQUIRED_TESTS).map(([path]) => [path, existsSync(path)]));
const requiredTestsPresent = Object.values(testFiles).every(Boolean);

const releaseWorkflow = existsSync(".github/workflows/release.yml") ? read(".github/workflows/release.yml") : "";
const developmentGuide = existsSync("docs/development.md") ? read("docs/development.md") : "";

const scores = {
    behavior: test.ok
        ? Object.entries(REQUIRED_TESTS)
              .filter(
                  ([path]) =>
                      path.includes("coordinator") ||
                      path.includes("persistence") ||
                      path.includes("provider") ||
                      path.includes("settings") ||
                      path.includes("scheduler")
              )
              .reduce((total, [path, weight]) => total + (testFiles[path] ? weight : 0), 0)
        : 0,
    integrity: test.ok
        ? Object.entries(REQUIRED_TESTS)
              .filter(
                  ([path]) =>
                      path.includes("lifecycle") || path.includes("release-contract") || path.includes("style-manager")
              )
              .reduce((total, [path, weight]) => total + (testFiles[path] ? weight : 0), 0)
        : 0,
    architecture: test.ok && testFiles["tests/architecture.test.ts"] ? 5 : 0,
    quality: (build.ok ? 5 : 0) + (lint.ok ? 5 : 0) + (cssLint.ok ? 5 : 0) + (diffCheck.ok ? 5 : 0),
    css:
        (transitionAllCount === 0 ? 3 : 0) +
        (hasReducedMotion ? 3 : 0) +
        (importantCount <= 12 ? 2 : 0) +
        (statSync("styles.css").size <= 36_057 ? 2 : 0),
    performance:
        (bundleBytes !== null && bundleBytes <= BASELINE.bundleBytes ? 5 : 0) +
        (bundleGzipBytes !== null && bundleGzipBytes <= BASELINE.bundleGzipBytes ? 5 : 0),
    dependencies: productionAudit.ok ? 5 : 0,
    delivery:
        (/\bnpm ci\b/u.test(releaseWorkflow) ? 2 : 0) +
        (/npm run (?:check|evaluate)/u.test(releaseWorkflow) ? 2 : 0) +
        (/\bnpm test\b/u.test(developmentGuide) ? 1 : 0),
};

const score = Object.values(scores).reduce((total, value) => total + value, 0);
const hardGates = {
    build: build.ok,
    bundleBudget:
        bundleBytes !== null &&
        bundleBytes <= BASELINE.bundleBytes &&
        bundleGzipBytes !== null &&
        bundleGzipBytes <= BASELINE.bundleGzipBytes,
    cssLint: cssLint.ok,
    diffCheck: diffCheck.ok,
    lint: lint.ok,
    productionAudit: productionAudit.ok,
    reducedMotion: hasReducedMotion,
    requiredTests: test.ok && requiredTestsPresent,
    transitionScope: transitionAllCount === 0,
};
const passed = score >= BASELINE.target && Object.values(hardGates).every(Boolean);

process.stdout.write(
    `${JSON.stringify({
        baseline: BASELINE.score,
        checks: {
            build,
            cssLint,
            diffCheck,
            lint,
            productionAudit,
            test,
        },
        hardGates,
        metrics: {
            bundleBytes,
            bundleGzipBytes,
            importantCount,
            transitionAllCount,
        },
        pass: passed,
        score,
        scores,
        target: BASELINE.target,
    })}\n`
);

process.exitCode = passed ? 0 : 1;
