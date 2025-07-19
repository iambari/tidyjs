import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('TidyJS Multiline Comment Bug E2E Tests', () => {
    const testWorkspaceDir = path.join(__dirname, '../fixtures');
    let extension: vscode.Extension<any> | undefined;

    before(async () => {
        // Ensure fixtures directory exists
        if (!fs.existsSync(testWorkspaceDir)) {
            fs.mkdirSync(testWorkspaceDir, { recursive: true });
        }
        
        // Wait for VS Code and extensions to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get the TidyJS extension
        extension = vscode.extensions.getExtension('Asmir.tidyjs') || 
                   vscode.extensions.all.find(ext => 
                       ext.id.includes('tidyjs') || 
                       ext.packageJSON?.name === 'tidyjs' ||
                       ext.packageJSON?.displayName === 'TidyJS'
                   );
        
        if (extension && !extension.isActive) {
            await extension.activate();
        }
    });

    afterEach(async () => {
        // Close all editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    it('should handle file starting with multiline comment correctly', async function() {
        if (!extension) {
            this.skip();
            return;
        }
        const testFilePath = path.join(testWorkspaceDir, 'test-multiline-comment.ts');
        
        // Create test content with multiline comment at the beginning
        const testContent = `/*
 * This is a multiline comment at the beginning of the file
 * It should be preserved and imports should be placed after it
 * properly formatted
 */
import { useState } from 'react';
import Button from '@app/components/Button';
import React from 'react';
import { FC } from 'react';

const MyComponent: FC = () => {
    const [count, setCount] = useState(0);
    return <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>;
};

export default MyComponent;`;

        // Expected result - comment should be preserved, imports organized
        const expectedContent = `/*
 * This is a multiline comment at the beginning of the file
 * It should be preserved and imports should be placed after it
 * properly formatted
 */

// Misc
import React, { FC, useState } from 'react';

// @app
import Button from '@app/components/Button';

const MyComponent: FC = () => {
    const [count, setCount] = useState(0);
    return <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>;
};

export default MyComponent;`;

        // Write test file
        fs.writeFileSync(testFilePath, testContent);

        // Open the document
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);

        // Execute format command
        await vscode.commands.executeCommand('extension.format');
        
        // Wait for formatting to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the formatted content
        const formattedContent = editor.document.getText();

        // Verify the multiline comment is preserved
        assert.ok(
            formattedContent.startsWith('/*'),
            'Multiline comment at the beginning should be preserved'
        );

        // Verify imports are organized correctly
        assert.ok(
            formattedContent.includes('// Misc\nimport React'),
            'Misc imports should be grouped correctly'
        );

        // Clean up
        fs.unlinkSync(testFilePath);
    });

    it('should handle file with only multiline comment and imports', async function() {
        if (!extension) {
            this.skip();
            return;
        }
        const testFilePath = path.join(testWorkspaceDir, 'test-only-comment-imports.ts');
        
        // Create test content with ONLY multiline comment and imports
        const testContent = `/*
 * File header comment
 */
import { FC } from 'react';
import React from 'react';`;

        // Expected result - comment preserved, imports organized
        const expectedPattern = `/*
 * File header comment
 */

// Misc
import React, { FC } from 'react';`;

        // Write test file
        fs.writeFileSync(testFilePath, testContent);

        // Open and format
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand('extension.format');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const formattedContent = editor.document.getText();

        // Verify structure
        assert.ok(
            formattedContent.startsWith('/*'),
            'Comment should be preserved at the beginning'
        );
        
        assert.ok(
            formattedContent.includes('// Misc'),
            'Import group comment should be added'
        );

        // Clean up
        fs.unlinkSync(testFilePath);
    });

    it('should handle edge case with comment immediately before imports', async function() {
        if (!extension) {
            this.skip();
            return;
        }
        const testFilePath = path.join(testWorkspaceDir, 'test-comment-immediate-imports.ts');
        
        // No blank line between comment and imports
        const testContent = `/* Copyright notice */
import React from 'react';
import { useState } from 'react';`;

        // Write and format
        fs.writeFileSync(testFilePath, testContent);
        const document = await vscode.workspace.openTextDocument(testFilePath);
        const editor = await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand('extension.format');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const formattedContent = editor.document.getText();

        // Should have proper separation
        assert.ok(
            formattedContent.includes('/* Copyright notice */\n\n'),
            'Should add blank line after comment before imports'
        );

        // Clean up
        fs.unlinkSync(testFilePath);
    });
});