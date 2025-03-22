module.exports = {
    testEnvironment: 'node',
    testMatch: [
        "**/unit/**/*.js"
    ],
    moduleNameMapper: {
        "^vscode$": "<rootDir>/test/mocks/vscode.js"
    },
    transform: {
        "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
