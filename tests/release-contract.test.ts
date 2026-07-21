import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

void test("release CI is tag-triggered and publishes verified changelog notes", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    const evaluator = readFileSync("tools/quality/evaluate.mjs", "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
        allowScripts?: Record<string, boolean>;
        scripts?: Record<string, string>;
    };

    assert.match(workflow, /node-version: 22/u);
    assert.match(workflow, /tags:\s*\n\s*- "\[0-9\]\*\.\[0-9\]\*\.\[0-9\]\*"/u);
    assert.doesNotMatch(workflow, /branches:/u);
    assert.match(workflow, /run: npm ci/u);
    assert.match(workflow, /git cat-file -t/u);
    assert.match(workflow, /merge-base --is-ancestor/u);
    assert.match(workflow, /npm run release:verify/u);
    assert.match(workflow, /run: npm run check/u);
    assert.match(workflow, /attestations: write/u);
    assert.match(workflow, /id-token: write/u);
    assert.match(workflow, /uses: actions\/attest@v4/u);
    assert.match(workflow, /subject-path:\s*\|\s*main\.js\s*styles\.css/u);
    assert.match(workflow, /npm run release:notes/u);
    assert.match(workflow, /gh release create/u);
    assert.match(workflow, /gh release upload "\$RELEASE_TAG" main\.js manifest\.json styles\.css --clobber/u);
    assert.match(workflow, /--draft=false/u);
    assert.match(workflow, /main\.js,manifest\.json,styles\.css/u);
    assert.doesNotMatch(workflow, /semantic-release/iu);
    assert.doesNotMatch(workflow, /npm install/u);
    assert.equal(existsSync(".releaserc.yml"), false);
    assert.equal(packageJson.scripts?.check, "npm run build && npm run lint && npm run lint:css && npm test");
    assert.equal(packageJson.scripts?.["release:prepare"], "node tools/release/prepare.mjs");
    assert.equal(packageJson.scripts?.["release:verify"], "node tools/release/verify.mjs");
    assert.equal(packageJson.scripts?.["release:notes"], "node tools/release/notes.mjs");
    assert.deepEqual(packageJson.allowScripts, { "esbuild@0.28.1": true });
    assert.match(evaluator, /pass:\s*passed/u);
    assert.doesNotMatch(evaluator, /\n\s*passed,/u);
});

void test("version authorities and mobile compatibility stay aligned", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
        devDependencies?: Record<string, string>;
        version: string;
    };
    const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
        packages: Record<string, { version: string }>;
        version: string;
    };
    const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as {
        isDesktopOnly: boolean;
        minAppVersion: string;
        version: string;
    };
    const versionSource = readFileSync("src/version.ts", "utf8");

    assert.equal(packageJson.version, manifest.version);
    assert.equal(packageLock.version, manifest.version);
    assert.equal(packageLock.packages[""].version, manifest.version);
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
    assert.match(development, /`npm run release:prepare -- <version>`/u);
    assert.match(development, /annotated tag/u);
    assert.match(agents, /Run `npm run check`/u);
    assert.match(agents, /`npm run release:prepare -- <version>`/u);
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
