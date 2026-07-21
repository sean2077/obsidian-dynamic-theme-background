import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    compareSemver,
    extractChangelogSection,
    parseSemver,
    prepareRelease,
    readVersionAuthorities,
    verifyRelease,
    writeReleaseNotes,
} from "../tools/release/contract.mjs";

function createFixture(version = "1.2.3", notes = "* shipped safely"): string {
    const root = mkdtempSync(join(tmpdir(), "dtb-release-tools-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "manifest.json"), `${JSON.stringify({ id: "fixture", version }, null, "\t")}\n`, "utf8");
    writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "fixture", version }, null, 4)}\n`, "utf8");
    writeFileSync(
        join(root, "package-lock.json"),
        `${JSON.stringify({ lockfileVersion: 3, name: "fixture", packages: { "": { version } }, version }, null, 4)}\n`,
        "utf8"
    );
    writeFileSync(join(root, "src", "version.ts"), `export const VERSION = "${version}";\n`, "utf8");
    writeFileSync(
        join(root, "CHANGELOG.md"),
        `## [${version}](https://example.test/${version}) (2026-07-21)\n\n${notes}\n\n## [1.2.2]\n\n* older\n`,
        "utf8"
    );
    return root;
}

void test("release versions use strict bare SemVer precedence", () => {
    assert.equal(parseSemver("1.2.3-beta.1").version, "1.2.3-beta.1");
    assert.equal(compareSemver("1.2.3-beta.1", "1.2.3-beta.2"), -1);
    assert.equal(compareSemver("1.2.3-beta.2", "1.2.3"), -1);
    assert.equal(compareSemver("9007199254740993.0.0", "9007199254740992.0.0"), 1);
    assert.equal(compareSemver("1.2.3+one", "1.2.3+two"), 0);
    assert.throws(() => parseSemver("v1.2.3"), /bare SemVer/u);
    assert.throws(() => parseSemver("1.2.3-beta.01"), /leading zeroes/u);
});

void test("release preparation updates only aligned version authorities", () => {
    const root = createFixture();
    try {
        const paths = prepareRelease(root, "1.3.0");
        assert.equal(paths.length, 4);
        assert.equal(readVersionAuthorities(root).current, "1.3.0");
        assert.match(readFileSync(join(root, "manifest.json"), "utf8"), /\n\t"version": "1\.3\.0"/u);
        assert.throws(() => prepareRelease(root, "1.3.0"), /must be newer/u);
        assert.throws(() => prepareRelease(root, "1.2.9"), /must be newer/u);
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

void test("release preparation fails before writing when authorities drift", () => {
    const root = createFixture();
    try {
        const packageBefore = readFileSync(join(root, "package.json"), "utf8");
        writeFileSync(join(root, "manifest.json"), '{"id":"fixture","version":"1.2.4"}\n', "utf8");
        assert.throws(() => prepareRelease(root, "1.3.0"), /not aligned/u);
        assert.equal(readFileSync(join(root, "package.json"), "utf8"), packageBefore);
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

void test("release notes extract one exact non-empty changelog section", () => {
    const changelog =
        "## [2.0.0](https://example.test/2.0.0) (2026-07-21)\r\n\r\n### Features\r\n\r\n* added\r\n\r\n## [1.9.0]\r\n\r\n* older\r\n";
    assert.equal(
        extractChangelogSection(changelog, "2.0.0"),
        "## [2.0.0](https://example.test/2.0.0) (2026-07-21)\n\n### Features\n\n* added\n"
    );
    assert.throws(() => extractChangelogSection("## [2.0.0]\n\n## [1.9.0]\n\n* older\n", "2.0.0"), /no release notes/u);
    assert.throws(() => extractChangelogSection("## [1.9.0]\n\n* older\n", "2.0.0"), /exactly one/u);
});

void test("release verification exports notes without overwriting", () => {
    const root = createFixture();
    const output = join(root, "release-notes.md");
    try {
        assert.match(verifyRelease(root, "1.2.3").notes, /shipped safely/u);
        const notes = writeReleaseNotes(root, "1.2.3", output);
        assert.equal(readFileSync(output, "utf8"), notes);
        assert.throws(() => writeReleaseNotes(root, "1.2.3", output), /EEXIST/u);
        assert.throws(() => verifyRelease(root, "1.2.4"), /does not match/u);
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});
