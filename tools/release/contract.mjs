import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const VERSION_SOURCE_PATTERN = /export const VERSION = "([^"]+)";/gu;

function pathFor(root, ...parts) {
    return resolve(root, ...parts);
}

function readJson(path) {
    const source = readFileSync(path, "utf8");
    return { source, value: JSON.parse(source) };
}

function serializeJson(source, value) {
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const indent = source.match(/\r?\n([ \t]+)"/u)?.[1] ?? "    ";
    return `${JSON.stringify(value, null, indent).replaceAll("\n", newline)}${newline}`;
}

function readReleaseFiles(root) {
    const paths = {
        manifest: pathFor(root, "manifest.json"),
        packageJson: pathFor(root, "package.json"),
        packageLock: pathFor(root, "package-lock.json"),
        versionSource: pathFor(root, "src", "version.ts"),
    };
    const manifest = readJson(paths.manifest);
    const packageJson = readJson(paths.packageJson);
    const packageLock = readJson(paths.packageLock);
    const versionSource = readFileSync(paths.versionSource, "utf8");
    const versionMatches = [...versionSource.matchAll(VERSION_SOURCE_PATTERN)];

    if (versionMatches.length !== 1) {
        throw new Error("src/version.ts must contain exactly one VERSION export");
    }
    if (typeof packageLock.value.packages?.[""]?.version !== "string") {
        throw new Error('package-lock.json must contain packages[""].version');
    }

    return {
        manifest,
        packageJson,
        packageLock,
        paths,
        versionSource,
        versions: {
            manifest: manifest.value.version,
            packageJson: packageJson.value.version,
            packageLock: packageLock.value.version,
            packageLockRoot: packageLock.value.packages[""].version,
            versionSource: versionMatches[0][1],
        },
    };
}

function alignedVersion(versions) {
    const entries = Object.entries(versions);
    if (entries.some(([, version]) => typeof version !== "string")) {
        throw new Error("Every version authority must contain a string version");
    }
    const unique = new Set(entries.map(([, version]) => version));
    if (unique.size !== 1) {
        const details = entries.map(([name, version]) => `${name}=${String(version)}`).join(", ");
        throw new Error(`Version authorities are not aligned: ${details}`);
    }
    return entries[0][1];
}

export function parseSemver(version) {
    const match = SEMVER_PATTERN.exec(version);
    if (!match) {
        throw new Error(`Expected a bare SemVer version, got: ${version}`);
    }
    const prerelease = match[4]?.split(".") ?? [];
    if (prerelease.some((part) => /^\d+$/u.test(part) && part.length > 1 && part.startsWith("0"))) {
        throw new Error(`Numeric prerelease identifiers cannot contain leading zeroes: ${version}`);
    }
    return {
        build: match[5]?.split(".") ?? [],
        core: [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])],
        prerelease,
        version,
    };
}

export function compareSemver(leftVersion, rightVersion) {
    const left = parseSemver(leftVersion);
    const right = parseSemver(rightVersion);
    for (let index = 0; index < left.core.length; index += 1) {
        if (left.core[index] !== right.core[index]) {
            return left.core[index] < right.core[index] ? -1 : 1;
        }
    }
    if (left.prerelease.length === 0 || right.prerelease.length === 0) {
        if (left.prerelease.length === right.prerelease.length) return 0;
        return left.prerelease.length === 0 ? 1 : -1;
    }
    const length = Math.max(left.prerelease.length, right.prerelease.length);
    for (let index = 0; index < length; index += 1) {
        const leftPart = left.prerelease[index];
        const rightPart = right.prerelease[index];
        if (leftPart === undefined || rightPart === undefined) return leftPart === undefined ? -1 : 1;
        if (leftPart === rightPart) continue;
        const leftNumeric = /^\d+$/u.test(leftPart);
        const rightNumeric = /^\d+$/u.test(rightPart);
        if (leftNumeric && rightNumeric) return BigInt(leftPart) < BigInt(rightPart) ? -1 : 1;
        if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
        return leftPart < rightPart ? -1 : 1;
    }
    return 0;
}

export function readVersionAuthorities(root = process.cwd()) {
    const files = readReleaseFiles(root);
    return { current: alignedVersion(files.versions), versions: files.versions };
}

export function extractChangelogSection(changelog, version) {
    parseSemver(version);
    const normalized = changelog.replaceAll("\r\n", "\n");
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const headingPattern = new RegExp(`^## \\[${escapedVersion}\\].*$`, "gmu");
    const headings = [...normalized.matchAll(headingPattern)];
    if (headings.length !== 1) {
        throw new Error(`CHANGELOG.md must contain exactly one level-two [${version}] heading`);
    }
    const start = headings[0].index;
    const searchFrom = start + headings[0][0].length;
    const nextHeading = /^#{1,2}\s+(?:\[)?\d+\.\d+\.\d+/gmu;
    nextHeading.lastIndex = searchFrom;
    const next = nextHeading.exec(normalized);
    const section = normalized.slice(start, next?.index ?? normalized.length).trimEnd();
    const bodyStart = section.indexOf("\n");
    const body = bodyStart === -1 ? "" : section.slice(bodyStart + 1).trim();
    if (body.length === 0) {
        throw new Error(`CHANGELOG.md section ${version} has no release notes`);
    }
    return `${section}\n`;
}

export function prepareRelease(root, targetVersion) {
    parseSemver(targetVersion);
    const files = readReleaseFiles(root);
    const currentVersion = alignedVersion(files.versions);
    parseSemver(currentVersion);
    if (compareSemver(targetVersion, currentVersion) <= 0) {
        throw new Error(`Target version ${targetVersion} must be newer than ${currentVersion}`);
    }

    files.manifest.value.version = targetVersion;
    files.packageJson.value.version = targetVersion;
    files.packageLock.value.version = targetVersion;
    files.packageLock.value.packages[""].version = targetVersion;
    const nextVersionSource = files.versionSource.replace(
        VERSION_SOURCE_PATTERN,
        `export const VERSION = "${targetVersion}";`
    );
    const outputs = new Map([
        [files.paths.manifest, serializeJson(files.manifest.source, files.manifest.value)],
        [files.paths.packageJson, serializeJson(files.packageJson.source, files.packageJson.value)],
        [files.paths.packageLock, serializeJson(files.packageLock.source, files.packageLock.value)],
        [files.paths.versionSource, nextVersionSource],
    ]);
    const originals = new Map([
        [files.paths.manifest, files.manifest.source],
        [files.paths.packageJson, files.packageJson.source],
        [files.paths.packageLock, files.packageLock.source],
        [files.paths.versionSource, files.versionSource],
    ]);

    try {
        for (const [path, content] of outputs) writeFileSync(path, content, "utf8");
        const prepared = readVersionAuthorities(root);
        if (prepared.current !== targetVersion)
            throw new Error("Prepared files did not converge on the target version");
    } catch (error) {
        const rollbackFailures = [];
        for (const [path, content] of originals) {
            try {
                writeFileSync(path, content, "utf8");
            } catch (rollbackError) {
                rollbackFailures.push(rollbackError);
            }
        }
        const suffix = rollbackFailures.length === 0 ? "changes were rolled back" : "rollback was incomplete";
        throw new Error(`Release preparation failed; ${suffix}`, { cause: error });
    }

    return [...outputs.keys()];
}

export function verifyRelease(root, version) {
    parseSemver(version);
    const authorities = readVersionAuthorities(root);
    if (authorities.current !== version) {
        throw new Error(`Release tag ${version} does not match version authorities (${authorities.current})`);
    }
    const changelog = readFileSync(pathFor(root, "CHANGELOG.md"), "utf8");
    return {
        authorities,
        notes: extractChangelogSection(changelog, version),
    };
}

export function writeReleaseNotes(root, version, outputPath) {
    const { notes } = verifyRelease(root, version);
    writeFileSync(outputPath, notes, { encoding: "utf8", flag: "wx" });
    return notes;
}
