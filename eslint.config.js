// eslint.config.js
import obsidianmd from "eslint-plugin-obsidianmd";
import tsParser from "@typescript-eslint/parser";

export default [
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
            // The recommended rules from eslint-plugin-obsidianmd
            ...obsidianmd.configs.recommended,

            // Override: 降低 UI sentence case 的严格程度，因为表情符号会导致误报
            "obsidianmd/ui/sentence-case": ["warn", { enforceCamelCaseLower: false }],
        },
    },
];
