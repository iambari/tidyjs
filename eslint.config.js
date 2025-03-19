const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const eslintJs = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'test',
            'coverage/**',
            '*.js',
            '*.d.ts',
        ],
    },
    eslintJs.configs.recommended,
    {
        files: ['src/**/*.ts'],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module"
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
            "warn", // or "error"
            {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
                "caughtErrorsIgnorePattern": "^_"
            }
            ],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',

            'quotes': ['error', 'single', { avoidEscape: true }],
            'semi': ['error', 'always'],
        },
    },
];
