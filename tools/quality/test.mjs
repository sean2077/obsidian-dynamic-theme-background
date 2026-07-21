import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";

import { build } from "esbuild";

const projectRoot = resolve(".");
const outputDirectory = resolve(".internal", "test-build");

if (!outputDirectory.startsWith(`${projectRoot}${sep}`)) {
    throw new Error("Refusing to clean a test output path outside the project");
}

function findTests(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            return findTests(path);
        }
        return entry.isFile() && entry.name.endsWith(".test.ts") ? [path] : [];
    });
}

const entryPoints = findTests(resolve("tests"));
if (entryPoints.length === 0) {
    throw new Error("No test files found");
}

rmSync(outputDirectory, { force: true, recursive: true });

await build({
    bundle: true,
    entryNames: "[name]",
    entryPoints,
    format: "esm",
    logLevel: "silent",
    outdir: outputDirectory,
    packages: "external",
    platform: "node",
    target: "node20",
});

const builtTests = readdirSync(outputDirectory)
    .filter((path) => path.endsWith(".test.js"))
    .map((path) => resolve(outputDirectory, path));
const result = spawnSync(process.execPath, ["--test", ...builtTests], {
    stdio: "inherit",
});

process.exitCode = result.status ?? 1;
