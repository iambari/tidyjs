module.exports = {
    testEnvironment: 'node',
    testMatch: [
        "**/unit/**/*.ts",
        "**/parser/**/*.ts"
    ],
    moduleNameMapper: {
        "^vscode$": "<rootDir>/test/mocks/vscode.js"
    },
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/.vscode-test/"
    ],
    modulePathIgnorePatterns: [
        "/.vscode-test/"
    ]
};
