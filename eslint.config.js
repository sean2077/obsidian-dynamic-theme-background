// eslint.config.js
import tsParser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
    // TypeScript-ESLint 推荐规则（不含严格类型检查）
    ...tseslint.configs.recommended,

    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        plugins: {
            obsidianmd,
        },
        rules: {
            // 使用 obsidianmd 官方推荐规则
            ...obsidianmd.configs.recommended,

            // 官方审查要求的关键规则
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/await-thenable": "error",
            "@typescript-eslint/require-await": "error",
            "@typescript-eslint/no-misused-promises": "error",

            // 项目特定覆盖
            // "obsidianmd/ui/sentence-case": ["warn", { enforceCamelCaseLower: false }],
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
];
