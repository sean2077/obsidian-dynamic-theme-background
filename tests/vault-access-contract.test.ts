import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readTypeScriptTree(directory: string): string {
    return readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) return [readTypeScriptTree(path)];
            return entry.isFile() && entry.name.endsWith(".ts") ? [readFileSync(path, "utf8")] : [];
        })
        .join("\n");
}

void test("local image selection never enumerates every file in the vault", () => {
    const source = readTypeScriptTree("src");
    const folderSuggest = readFileSync("src/modals/image-folder-suggest-modal.ts", "utf8");
    const imageSuggest = readFileSync("src/modals/image-path-suggest-modal.ts", "utf8");
    const backgroundManagement = readFileSync("src/settings/sections/bg-management.ts", "utf8");

    assert.doesNotMatch(source, /\.vault\.(?:getFiles|getMarkdownFiles|getAllLoadedFiles|getAllFolders)\s*\(/u);
    assert.match(folderSuggest, /parent\.children/u);
    assert.match(folderSuggest, /getFolderByPath/u);
    assert.match(imageSuggest, /folder\.children/u);
    assert.match(imageSuggest, /getFolderByPath/u);
    assert.match(backgroundManagement, /folder\.children/u);
});
