import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Priority Integration Tests', () => {
    it('should apply priority correctly in real parser scenario', () => {
        const config: Config = {
            groups: [
                {
                    name: 'Other', 
                    match: /.*/, // Matches everything
                    order: 1,
                    priority: 0, // Low priority
                    default: false
                },
                {
                    name: 'React',
                    match: /^react/,
                    order: 2, 
                    priority: 10, // High priority - should win over Other
                    default: false
                },
                {
                    name: 'Default',
                    order: 999,
                    default: true
                }
            ],
            importOrder: {
                sideEffect: 0,
                default: 1,
                named: 2,
                typeOnly: 3
            },
            format: {
                indent: 4,
                singleQuote: true,
                bracketSpacing: true
            }
        };

        const sourceCode = `
import React from 'react';
import { useState } from 'react';
import lodash from 'lodash';
`;

        const parser = new ImportParser(config);
        const result = parser.parse(sourceCode);

        // Find the groups
        const reactGroup = result.groups.find(g => g.name === 'React');
        const miscGroup = result.groups.find(g => g.name === 'Other');

        // React imports should be in React group (high priority), not Other
        expect(reactGroup).toBeDefined();
        expect(reactGroup!.imports).toHaveLength(2);
        expect(reactGroup!.imports[0].source).toBe('react');
        expect(reactGroup!.imports[1].source).toBe('react');

        // Lodash should be in Other group
        expect(miscGroup).toBeDefined();
        expect(miscGroup!.imports).toHaveLength(1);
        expect(miscGroup!.imports[0].source).toBe('lodash');

        parser.dispose();
    });

    it('should handle complex priority scenarios with overlapping patterns', () => {
        const config: Config = {
            groups: [
                {
                    name: 'AllExternal',
                    match: /^[^@./]/, // Matches all external packages
                    order: 1,
                    priority: 1,
                    default: false
                },
                {
                    name: 'ReactFamily',
                    match: /^react/, // Matches react*
                    order: 2,
                    priority: 5,
                    default: false
                },
                {
                    name: 'ReactDomSpecific',
                    match: /^react-dom/, // Matches react-dom specifically
                    order: 3,
                    priority: 10, // Highest priority
                    default: false
                },
                {
                    name: 'Default',
                    order: 999,
                    default: true
                }
            ],
            importOrder: {
                sideEffect: 0,
                default: 1,
                named: 2,
                typeOnly: 3
            },
            format: {
                indent: 4,
                singleQuote: true
            }
        };

        const sourceCode = `
import React from 'react';
import { render } from 'react-dom';
import { Router } from 'react-router';
import lodash from 'lodash';
import '@internal/styles';
`;

        const parser = new ImportParser(config);
        const result = parser.parse(sourceCode);

        // react should go to ReactFamily (priority 5 > 1)
        const reactFamilyGroup = result.groups.find(g => g.name === 'ReactFamily');
        expect(reactFamilyGroup).toBeDefined();
        
        const reactImports = reactFamilyGroup!.imports.filter(imp => imp.source === 'react');
        expect(reactImports).toHaveLength(1);

        // react-dom should go to ReactDomSpecific (priority 10 > 5 > 1)
        const reactDomGroup = result.groups.find(g => g.name === 'ReactDomSpecific');
        expect(reactDomGroup).toBeDefined();
        
        const reactDomImports = reactDomGroup!.imports.filter(imp => imp.source === 'react-dom');
        expect(reactDomImports).toHaveLength(1);

        // react-router should go to ReactFamily (priority 5 > 1)
        const reactRouterImports = reactFamilyGroup!.imports.filter(imp => imp.source === 'react-router');
        expect(reactRouterImports).toHaveLength(1);

        // lodash should go to AllExternal (only matches this pattern)
        const allExternalGroup = result.groups.find(g => g.name === 'AllExternal');
        expect(allExternalGroup).toBeDefined();
        
        const lodashImports = allExternalGroup!.imports.filter(imp => imp.source === 'lodash');
        expect(lodashImports).toHaveLength(1);

        // @internal/styles should go to Default (doesn't match any pattern)
        const defaultGroup = result.groups.find(g => g.name === 'Default');
        expect(defaultGroup).toBeDefined();
        
        const internalImports = defaultGroup!.imports.filter(imp => imp.source === '@internal/styles');
        expect(internalImports).toHaveLength(1);

        parser.dispose();
    });

    it('should respect priority when groups have same order', () => {
        const config: Config = {
            groups: [
                {
                    name: 'LowPriority',
                    match: /^react/,
                    order: 1,
                    priority: 3,
                    default: false
                },
                {
                    name: 'HighPriority',
                    match: /^react/,
                    order: 1, // Same order as LowPriority
                    priority: 8, // Higher priority
                    default: false
                },
                {
                    name: 'Default',
                    order: 999,
                    default: true
                }
            ],
            importOrder: {
                sideEffect: 0,
                default: 1,
                named: 2,
                typeOnly: 3
            },
            format: {
                indent: 4,
                singleQuote: true
            }
        };

        const sourceCode = `import React from 'react';`;

        const parser = new ImportParser(config);
        const result = parser.parse(sourceCode);

        // Should go to HighPriority group
        const highPriorityGroup = result.groups.find(g => g.name === 'HighPriority');
        expect(highPriorityGroup).toBeDefined();
        expect(highPriorityGroup!.imports).toHaveLength(1);
        expect(highPriorityGroup!.imports[0].source).toBe('react');

        // Should NOT be in LowPriority group
        const lowPriorityGroup = result.groups.find(g => g.name === 'LowPriority');
        expect(lowPriorityGroup).toBeUndefined(); // No imports, so group shouldn't exist

        parser.dispose();
    });
});
