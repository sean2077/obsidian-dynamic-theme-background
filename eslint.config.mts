import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

const sentenceCaseOptions = {
    acronyms: ["API", "CSS", "DTB", "HTML", "HTTP", "ID", "JSON", "UI", "URL"],
    enforceCamelCaseLower: false,
};

export default defineConfig(
    globalIgnores([
        ".agents",
        ".claude",
        ".codex",
        ".internal",
        ".worktrees",
        "docs",
        "node_modules",
        "main.js",
        "esbuild.config.mjs",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
    ]),
    {
        languageOptions: {
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                projectService: {
                    allowDefaultProject: [
                        "eslint.config.mts",
                        "manifest.json",
                        "tools/quality/evaluate.mjs",
                        "tools/quality/test.mjs",
                        "tools/release/notes.mjs",
                        "tools/release/prepare.mjs",
                        "tools/release/verify.mjs",
                    ],
                },
                tsconfigRootDir: import.meta.dirname,
                extraFileExtensions: [".json"],
            },
        },
    },
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.ts"],
        rules: {
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/require-await": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-unsafe-argument": "error",
            "@typescript-eslint/no-unsafe-assignment": "error",
            "@typescript-eslint/no-unsafe-call": "error",
            "@typescript-eslint/no-unsafe-member-access": "error",
            "@typescript-eslint/no-unsafe-return": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "obsidianmd/settings-tab/prefer-setting-definitions": "off",
            "obsidianmd/ui/sentence-case": ["error", sentenceCaseOptions],
            "obsidianmd/ui/sentence-case-locale-module": ["error", { ...sentenceCaseOptions, allowAutoFix: true }],
        },
    },
    {
        files: ["tests/**/*.ts", "tools/**/*.mjs"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            "obsidianmd/no-global-this": "off",
            "obsidianmd/no-nodejs-modules": "off",
        },
    }
);
