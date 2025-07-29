import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('TidyJS Specific Scenarios E2E Tests', () => {
    const testWorkspaceDir = path.join(__dirname, '../fixtures');

    before(async () => {
        if (!fs.existsSync(testWorkspaceDir)) {
            fs.mkdirSync(testWorkspaceDir, { recursive: true });
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterEach(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    it('should handle React project structure', async () => {
        // Create a realistic React project structure
        const projectStructure = [
            { path: 'src/components/Button.tsx', content: `import React from 'react';\nimport styled from 'styled-components';\nimport { ButtonProps } from '../types';\n\nconst Button: React.FC<ButtonProps> = ({ children, onClick }) => {\n  return <StyledButton onClick={onClick}>{children}</StyledButton>;\n};\n\nexport default Button;` },
            { path: 'src/components/Modal.tsx', content: `import React, { useEffect, useState } from 'react';\nimport { createPortal } from 'react-dom';\nimport { ModalProps } from '../types';\nimport Button from './Button';\n\nconst Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {\n  if (!isOpen) return null;\n  return createPortal(<div>{children}<Button onClick={onClose}>Close</Button></div>, document.body);\n};\n\nexport default Modal;` },
            { path: 'src/hooks/useApi.ts', content: `import { useState, useEffect } from 'react';\nimport axios from 'axios';\nimport { ApiResponse } from '../types/api';\n\nexport const useApi = <T>(url: string) => {\n  const [data, setData] = useState<T | null>(null);\n  const [loading, setLoading] = useState(true);\n  \n  useEffect(() => {\n    axios.get<ApiResponse<T>>(url).then(res => setData(res.data.data)).finally(() => setLoading(false));\n  }, [url]);\n  \n  return { data, loading };\n};` },
            { path: 'src/utils/helpers.ts', content: `import { format } from 'date-fns';\nimport { debounce } from 'lodash';\nimport { ValidationRule } from '../types';\n\nexport const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');\nexport const debouncedValidate = debounce((value: string, rules: ValidationRule[]) => {\n  return rules.every(rule => rule.test(value));\n}, 300);` }
        ];

        // Create all files
        for (const file of projectStructure) {
            const fullPath = path.join(testWorkspaceDir, file.path);
            const dir = path.dirname(fullPath);
            
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(fullPath, file.content);
        }

        // Test each file type
        for (const file of projectStructure) {
            const fullPath = path.join(testWorkspaceDir, file.path);
            const document = await vscode.workspace.openTextDocument(fullPath);
            
            // Verify language detection
            const expectedLang = file.path.endsWith('.tsx') ? 'typescriptreact' : 'typescript';
            assert.strictEqual(document.languageId, expectedLang, `Language detection for ${file.path}`);
            
            // Analyze imports
            const content = document.getText();
            const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
            
            console.log(`${file.path}: ${importLines.length} imports detected`);
            importLines.forEach(line => console.log(`  - ${line.trim()}`));
            
            assert.strictEqual(importLines.length > 0, true, `Should detect imports in ${file.path}`);
        }

        // Clean up
        for (const file of projectStructure) {
            const fullPath = path.join(testWorkspaceDir, file.path);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        // Clean up directories
        const dirsToRemove = ['src/components', 'src/hooks', 'src/utils', 'src/types', 'src'];
        for (const dir of dirsToRemove) {
            const fullPath = path.join(testWorkspaceDir, dir);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.rmdirSync(fullPath);
                } catch (error) {
                    // Directory might not be empty, that's ok
                }
            }
        }
    });

    it('should test import organization scenarios', async () => {
        const scenarios = [
            {
                name: 'Mixed import types',
                content: `import type { FC } from 'react';\nimport React, { useState, useEffect } from 'react';\nimport { debounce } from 'lodash';\nimport axios from 'axios';\nimport './styles.css';\nimport '../global.scss';\nimport 'polyfill';\nimport { utils } from '@app/utils';\nimport { config } from '@shared/config';`
            },
            {
                name: 'Multiline imports',
                content: `import {\n  Component,\n  PureComponent,\n  useState,\n  useEffect,\n  useCallback,\n  useMemo\n} from 'react';\nimport {\n  Button,\n  TextField,\n  Dialog,\n  DialogTitle,\n  DialogContent\n} from '@mui/material';`
            },
            {
                name: 'Duplicate and redundant imports',
                content: `import React from 'react';\nimport { useState } from 'react';\nimport { useState, useEffect } from 'react';\nimport React, { Component } from 'react';\nimport { debounce } from 'lodash';\nimport { throttle } from 'lodash';`
            },
            {
                name: 'Complex path imports',
                content: `import { utils } from '../../../shared/utils';\nimport { config } from '@app/config';\nimport { Logger } from '@shared/logger';\nimport { api } from '../../services/api';\nimport { constants } from './constants';\nimport type { User } from '../types/user';\nimport defaultConfig from '../config/default.json';`
            }
        ];

        for (const scenario of scenarios) {
            const testFilePath = path.join(testWorkspaceDir, `scenario-${scenario.name.replace(/\s+/g, '-').toLowerCase()}.ts`);
            fs.writeFileSync(testFilePath, scenario.content);

            const document = await vscode.workspace.openTextDocument(testFilePath);
            await vscode.window.showTextDocument(document);

            // Analyze the import structure
            const content = document.getText();
            const lines = content.split('\n');
            const importLines = lines.filter(line => line.trim().startsWith('import'));
            
            // Categorize imports
            const categories = {
                sideEffect: importLines.filter(line => !line.includes('from') && (line.includes("'") || line.includes('"'))),
                default: importLines.filter(line => line.includes('from') && !line.includes('{') && !line.includes('type')),
                named: importLines.filter(line => line.includes('{') && !line.includes('type')),
                type: importLines.filter(line => line.includes('type')),
                multiline: importLines.filter(line => line.includes('{')).length !== lines.filter(line => line.includes('}')).length
            };

            console.log(`\nScenario: ${scenario.name}`);
            console.log(`  Total imports: ${importLines.length}`);
            console.log(`  Side effects: ${categories.sideEffect.length}`);
            console.log(`  Default: ${categories.default.length}`);
            console.log(`  Named: ${categories.named.length}`);
            console.log(`  Type: ${categories.type.length}`);
            console.log(`  Has multiline: ${categories.multiline}`);

            assert.strictEqual(importLines.length > 0, true, `Should detect imports in ${scenario.name}`);

            fs.unlinkSync(testFilePath);
        }
    });

    it('should test configuration schema validation', async () => {
        // Test various configuration scenarios that TidyJS might encounter
        const configScenarios = [
            {
                name: 'Basic groups config',
                config: {
                    groups: [
                        { name: 'React', match: '^react', order: 0 },
                        { name: 'External', match: '^[^@./]', order: 1 },
                        { name: 'Internal', match: '^[@./]', order: 2 },
                        { name: 'Other', order: 3, default: true }
                    ]
                }
            },
            {
                name: 'Complex groups with priority',
                config: {
                    groups: [
                        { name: 'Priority', match: '^(react|vue|angular)', order: 0, priority: true },
                        { name: 'UI Libraries', match: '^(@mui|@chakra-ui|antd)', order: 1 },
                        { name: 'Utils', match: '^(lodash|ramda|date-fns)', order: 2 },
                        { name: 'App', match: '^@app', order: 3 },
                        { name: 'Shared', match: '^@shared', order: 4 },
                        { name: 'Relative', match: '^[./]', order: 5 },
                        { name: 'Default', order: 6, default: true }
                    ]
                }
            },
            {
                name: 'Format options',
                config: {
                    format: {
                        removeUnusedImports: true,
                        removeMissingModules: true,
                        singleQuote: true,
                        bracketSpacing: true,
                        indent: 2
                    },
                    excludedFolders: ['node_modules', 'dist', 'build', '.next']
                }
            }
        ];

        for (const scenario of configScenarios) {
            console.log(`\nTesting config scenario: ${scenario.name}`);
            
            // Test that we can access configuration API
            const tidyjsConfig = vscode.workspace.getConfiguration('tidyjs');
            
            // Simulate configuration validation
            if (scenario.config.groups) {
                const groups = scenario.config.groups;
                const hasDefault = groups.some(g => g.default);
                const orderNumbers = groups.map(g => g.order);
                const uniqueOrders = new Set(orderNumbers);
                
                console.log(`  Groups: ${groups.length}`);
                console.log(`  Has default group: ${hasDefault}`);
                console.log(`  Unique orders: ${uniqueOrders.size}/${orderNumbers.length}`);
                
                assert.strictEqual(groups.length > 0, true, 'Should have groups');
                assert.strictEqual(hasDefault, true, 'Should have default group');
            }

            if (scenario.config.format) {
                const format = scenario.config.format;
                console.log(`  Format options:`, format);
                assert.strictEqual(typeof format.removeUnusedImports, 'boolean', 'removeUnusedImports should be boolean');
            }

            if (scenario.config.excludedFolders) {
                const excluded = scenario.config.excludedFolders;
                console.log(`  Excluded folders: ${excluded.length}`);
                assert.strictEqual(Array.isArray(excluded), true, 'excludedFolders should be array');
            }
        }
    });

    it('should test file pattern matching for activation', async () => {
        // Test files that should trigger TidyJS activation
        const activationFiles = [
            { name: 'component.ts', shouldActivate: true },
            { name: 'component.tsx', shouldActivate: true },
            { name: 'utils.js', shouldActivate: true },
            { name: 'hooks.jsx', shouldActivate: true },
            { name: 'index.mts', shouldActivate: false }, // Module TypeScript
            { name: 'config.json', shouldActivate: false },
            { name: 'styles.css', shouldActivate: false },
            { name: 'README.md', shouldActivate: false }
        ];

        for (const file of activationFiles) {
            const testFilePath = path.join(testWorkspaceDir, file.name);
            const content = file.shouldActivate ? 
                `import React from 'react';\nimport { utils } from './utils';\n\nexport const test = 'value';` :
                `/* This is a ${path.extname(file.name)} file */\nconst config = { test: true };`;
            
            fs.writeFileSync(testFilePath, content);
            
            const document = await vscode.workspace.openTextDocument(testFilePath);
            
            // Check language ID for activation events
            const activationLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
            const shouldActivateByLanguage = activationLanguages.includes(document.languageId);
            
            console.log(`${file.name}: ${document.languageId} - Should activate: ${file.shouldActivate}, Would activate: ${shouldActivateByLanguage}`);
            
            if (file.shouldActivate) {
                assert.strictEqual(shouldActivateByLanguage, true, `${file.name} should trigger activation`);
            }

            // If it's a JS/TS file, test import detection
            if (shouldActivateByLanguage) {
                const hasImports = document.getText().includes('import');
                console.log(`  Has imports: ${hasImports}`);
                
                if (file.shouldActivate) {
                    assert.strictEqual(hasImports, true, `${file.name} should have imports`);
                }
            }
            
            fs.unlinkSync(testFilePath);
        }
    });

    it('should test error handling scenarios', async () => {
        const errorScenarios = [
            {
                name: 'Malformed imports',
                content: `import { incomplete from 'module';\nimport React from\nimport from 'no-default';\nimport { } from 'empty-destructure';\nimport 'side-effect';`
            },
            {
                name: 'Very long imports',
                content: `import { ${Array.from({length: 50}, (_, i) => `veryLongVariableName${i}`).join(', ')} } from 'module-with-many-exports';\nimport defaultExportWithVeryLongVariableNameThatExceedsNormalLimits from 'module-with-long-default';`
            },
            {
                name: 'Mixed quotes and syntax',
                content: `import React from "react";\nimport { useState } from 'react';\nimport * as lodash from "lodash";\nimport type { FC } from 'react';\nimport './styles.css';\nimport "../styles.scss";`
            },
            {
                name: 'Comments and imports',
                content: `// This is a comment\nimport React from 'react'; // React import\n/* Block comment */\nimport { useState } from 'react';\n/**\n * JSDoc comment\n */\nimport { useEffect } from 'react';`
            }
        ];

        for (const scenario of errorScenarios) {
            const testFilePath = path.join(testWorkspaceDir, `error-${scenario.name.replace(/\s+/g, '-').toLowerCase()}.ts`);
            fs.writeFileSync(testFilePath, scenario.content);

            const document = await vscode.workspace.openTextDocument(testFilePath);
            await vscode.window.showTextDocument(document);

            // Wait for diagnostics
            await new Promise(resolve => setTimeout(resolve, 1000));

            const diagnostics = vscode.languages.getDiagnostics(document.uri);
            
            console.log(`\nError scenario: ${scenario.name}`);
            console.log(`  Diagnostics: ${diagnostics.length}`);
            
            if (diagnostics.length > 0) {
                diagnostics.slice(0, 3).forEach((diag, index) => {
                    console.log(`    ${index + 1}. ${diag.message} (${vscode.DiagnosticSeverity[diag.severity]})`);
                });
            }

            // Test that document is still readable despite errors
            const content = document.getText();
            const lines = content.split('\n');
            const importLines = lines.filter(line => line.trim().startsWith('import'));
            
            console.log(`  Import lines detected: ${importLines.length}`);
            assert.strictEqual(importLines.length > 0, true, `Should detect some imports in ${scenario.name}`);

            fs.unlinkSync(testFilePath);
        }
    });
});
