import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

void test("release CI installs the lockfile and runs the shared gate first", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
        allowScripts?: Record<string, boolean>;
        scripts?: Record<string, string>;
    };

    assert.match(workflow, /node-version: 22/u);
    assert.match(workflow, /run: npm ci/u);
    assert.match(workflow, /run: npm run check/u);
    assert.doesNotMatch(workflow, /npm install/u);
    assert.equal(packageJson.scripts?.check, "npm run build && npm run lint && npm run lint:css && npm test");
    assert.deepEqual(packageJson.allowScripts, { "esbuild@0.28.1": true });
});

void test("version authorities and mobile compatibility stay aligned", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
        devDependencies?: Record<string, string>;
        version: string;
    };
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
        isDesktopOnly: boolean;
        minAppVersion: string;
        version: string;
    };
    const versionSource = readFileSync("src/version.ts", "utf8");

    assert.equal(packageJson.version, manifest.version);
    assert.match(versionSource, new RegExp(`"${manifest.version}"`, "u"));
    assert.equal(manifest.isDesktopOnly, false);
    assert.equal(manifest.minAppVersion, "1.11.4");
    assert.equal(packageJson.devDependencies?.obsidian, "^1.13.1");
    assert.match(readFileSync(".gitignore", "utf8"), /^main\.js$/mu);
});

void test("older Obsidian releases retain a compatible plugin fallback", () => {
    const versions = JSON.parse(readFileSync("versions.json", "utf8")) as Record<string, string>;

    assert.equal(versions["2.9.2"], "1.7.2");
});

void test("developer and agent guidance names tests and the complete gate", () => {
    const development = readFileSync("docs/development.md", "utf8");
    const agents = readFileSync("AGENTS.md", "utf8");

    assert.match(development, /`npm test`/u);
    assert.match(development, /`npm run check`/u);
    assert.match(agents, /Run `npm run check`/u);
    assert.doesNotMatch(agents, /There is no automated test script/u);
});

void test("both READMEs disclose network, credential-storage, and telemetry boundaries", () => {
    for (const path of ["README.md", "README.zh.md"]) {
        const readme = readFileSync(path, "utf8");
        assert.match(readme, /data\.json/u);
        assert.match(readme, /Obsidian 1\.11\.4/u);
        assert.match(readme, /SecretStorage/u);
        assert.match(readme, /telemetry|遥测/u);
        assert.match(readme, /third party|第三方/u);
    }
});
