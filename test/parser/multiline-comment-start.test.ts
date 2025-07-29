import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Parser - Multiline Comment at Start', () => {
    const defaultConfig: Config = {
        groups: [
            {
                name: 'React',
                match: /^react/,
                order: 1,
            },
            {
                name: '@app',
                match: /^@app\//,
                order: 2,
            },
            {
                name: 'Other',
                order: 999,
                default: true,
            },
        ],
        importOrder: {
            default: 1,
            named: 2,
            sideEffect: 0,
            typeOnly: 3,
        },
        format: {
            singleQuote: true,
            indent: 2,
        },
    };

    let parser: ImportParser;

    beforeEach(() => {
        parser = new ImportParser(defaultConfig);
    });

    afterEach(() => {
        parser.dispose();
    });

    it('should correctly parse imports when file starts with multiline comment', () => {
        const sourceCode = `/*
 * This is a file header comment
 * It contains multiple lines
 */
import React from 'react';
import { useState } from 'react';
import Button from '@app/components/Button';

const Component = () => <Button />;`;

        const result = parser.parse(sourceCode);

        // Should parse all imports correctly
        expect(result.groups).toHaveLength(2);
        
        const reactGroup = result.groups.find(g => g.name === 'React');
        expect(reactGroup?.imports).toHaveLength(2);
        
        const appGroup = result.groups.find(g => g.name === '@app');
        expect(appGroup?.imports).toHaveLength(1);
    });

    it('should calculate correct import range with leading multiline comment', () => {
        const sourceCode = `/*
 * Copyright (c) 2024
 */
import React from 'react';
import { FC } from 'react';

export const App: FC = () => <div />;`;

        const result = parser.parse(sourceCode);

        // Import range should include the imports but not the comment
        expect(result.importRange).toBeDefined();
        if (result.importRange) {
            const importSection = sourceCode.substring(result.importRange.start, result.importRange.end);
            
            // Should start with the first import
            expect(importSection.trim()).toMatch(/^import React/);
            
            // Should not include the copyright comment
            expect(importSection).not.toContain('Copyright');
        }
    });

    it('should handle edge case with no blank line between comment and imports', () => {
        const sourceCode = `/* License */
import React from 'react';`;

        const result = parser.parse(sourceCode);

        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].imports).toHaveLength(1);
        expect(result.groups[0].imports[0].source).toBe('react');
    });

    it('should handle multiple comments before imports', () => {
        const sourceCode = `/*
 * File: Component.tsx
 */

// This component does X

/* Another comment */

import React from 'react';
import { useState, useEffect } from 'react';

const Component = () => null;`;

        const result = parser.parse(sourceCode);

        // Should still parse imports correctly
        const reactGroup = result.groups.find(g => g.name === 'React');
        expect(reactGroup?.imports).toHaveLength(2);
    });

    it('should not include file header comment in import range', () => {
        const sourceCode = `/**
 * @fileoverview Main application component
 * @author John Doe
 */

import React from 'react';
import App from '@app/App';

export default App;`;

        const result = parser.parse(sourceCode);

        if (result.importRange) {
            const beforeImports = sourceCode.substring(0, result.importRange.start);
            const importSection = sourceCode.substring(result.importRange.start, result.importRange.end);
            
            // File header should be before import range
            expect(beforeImports).toContain('@fileoverview');
            expect(importSection).not.toContain('@fileoverview');
        }
    });
});