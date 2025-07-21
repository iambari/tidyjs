import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the test suite
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Create a test workspace
        const testWorkspace = path.resolve(__dirname, '../fixtures');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace, // Open test workspace
                // Note: Removed --disable-extensions to allow our extension to load
                '--disable-gpu' // Disable GPU acceleration for CI environments
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();