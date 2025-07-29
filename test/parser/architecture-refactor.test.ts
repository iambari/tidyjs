/**
 * Test de la nouvelle architecture refactorisée
 * Vérifie que la séparation des responsabilités fonctionne correctement
 */

import { ImportParser, ImportType } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import { Config } from '../../src/types';

const mockConfig: Config = {
    groups: [
        {
            name: 'React',
            match: /^react$/,
            order: 1,
            default: false,
        },
        {
            name: 'Other',
            order: 999,
            default: true,
        },
    ],
    format: {
        removeUnusedImports: true,
        removeMissingModules: true,
    },
    debug: false,
    excludedFolders: [],
    importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 4,
    },
};

describe('Architecture Refactor Tests', () => {
    describe('Parser Responsibility - Clean AST Production', () => {
        test('should produce clean AST with only valid imports', () => {
            const sourceCode = `import React from 'react';                    // utilisé
import { useState, useEffect } from 'react';  // useState utilisé, useEffect non utilisé
import { Button } from '@mui/material';       // non utilisé
import { UserProfile } from './missing-file'; // module manquant

export function MyComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}`;

            const parser = new ImportParser(mockConfig);

            // Simulated filtering parameters (what extension would provide)
            const missingModules = new Set(['./missing-file']);
            const unusedImports = ['useEffect', 'Button', 'UserProfile'];

            const result = parser.parse(sourceCode, missingModules, unusedImports);

            // Parser should return clean AST with only valid imports
            expect(result.groups).toHaveLength(1); // Only React group
            expect(result.groups[0].imports).toHaveLength(2); // React default + useState

            // Check specific imports
            const reactGroup = result.groups[0];
            expect(reactGroup.name).toBe('React');

            const imports = reactGroup.imports;
            expect(imports.some((imp) => imp.type === ImportType.DEFAULT && imp.specifiers.includes('React'))).toBe(true);
            expect(imports.some((imp) => imp.type === ImportType.NAMED && imp.specifiers.includes('useState'))).toBe(true);

            // Should NOT contain filtered imports
            expect(
                imports.some((imp) =>
                    imp.specifiers.some((spec) => (typeof spec === 'string' ? spec.includes('useEffect') : spec.local.includes('useEffect')))
                )
            ).toBe(false);
            expect(imports.some((imp) => imp.source === '@mui/material')).toBe(false);
            expect(imports.some((imp) => imp.source === './missing-file')).toBe(false);

            parser.dispose();
        });

        test('should return importRange even when all imports are filtered', () => {
            const sourceCode = `import { Button } from '@mui/material';       // non utilisé
import { UserProfile } from './missing-file'; // module manquant

export function MyComponent() {
  return <div>Hello World</div>;
}`;

            const parser = new ImportParser(mockConfig);

            const missingModules = new Set(['./missing-file']);
            const unusedImports = ['Button', 'UserProfile'];

            const result = parser.parse(sourceCode, missingModules, unusedImports);

            // Parser should still return importRange for formatter to clean up
            expect(result.importRange).toBeDefined();
            expect(result.groups).toHaveLength(0);

            parser.dispose();
        });
    });

    describe('Formatter Responsibility - Pure Formatting', () => {
        test('should handle empty groups with valid importRange', async () => {
            const sourceCode = `import { unused } from './missing';

export function Component() {
  return <div>Test</div>;
}`;

            const parserResult = {
                groups: [], // No groups but parser provides range to clean
                originalImports: [],
                importRange: { start: 0, end: 35 }, // Parser provides range to remove
            };

            const result = await formatImports(sourceCode, mockConfig, parserResult);

            // Formatter should remove the import section entirely
            expect(result.text).not.toContain('import');
            expect(result.text).toContain('export function Component()');
            expect(result.error).toBeUndefined();
        });

        test('should format clean imports without filtering logic', async () => {
            const sourceCode = `import React from 'react';
import { useState } from 'react';

export function Component() {
  return <div>Test</div>;
}`;

            // Parser already provided clean imports
            const parserResult = {
                groups: [
                    {
                        name: 'React',
                        order: 1,
                        imports: [
                            {
                                type: ImportType.DEFAULT,
                                source: 'react',
                                specifiers: ['React'],
                                defaultImport: 'React',
                                raw: "import React from 'react';",
                                groupName: 'React',
                                isPriority: false,
                                sourceIndex: 0,
                            },
                            {
                                type: ImportType.NAMED,
                                source: 'react',
                                specifiers: ['useState'],
                                defaultImport: undefined,
                                raw: "import { useState } from 'react';",
                                groupName: 'React',
                                isPriority: false,
                                sourceIndex: 1,
                            },
                        ],
                    },
                ],
                originalImports: ["import React from 'react';", "import { useState } from 'react';"],
                importRange: { start: 0, end: 54 },
            };

            const result = await formatImports(sourceCode, mockConfig, parserResult);

            // Should format the clean imports nicely
            expect(result.text).toContain('// React');
            expect(result.text).toContain("import React        from 'react';");
            expect(result.text).toContain("import { useState } from 'react';");
            expect(result.error).toBeUndefined();
        });
    });

    describe('Integration - Complete Flow', () => {
        test('should demonstrate correct architecture flow', async () => {
            const sourceCode = `import React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import { UserProfile } from './missing-file';

export function MyComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}`;

            // 1. Extension prepares filtering parameters
            const missingModules = new Set(['./missing-file']);
            const unusedImports = ['useEffect', 'Button', 'UserProfile'];

            // 2. Parser produces clean AST
            const parser = new ImportParser(mockConfig);
            const parserResult = parser.parse(sourceCode, missingModules, unusedImports);

            // Verify parser did its job correctly
            expect(parserResult.groups).toHaveLength(1);
            expect(parserResult.groups[0].imports).toHaveLength(2); // React + useState only

            // 3. Formatter formats the clean AST
            const formatResult = await formatImports(sourceCode, mockConfig, parserResult);

            // 4. Verify final output
            expect(formatResult.text).toContain('// React');
            expect(formatResult.text).toContain("import React        from 'react';");
            expect(formatResult.text).toContain("import { useState } from 'react';");
            expect(formatResult.text).not.toContain('useEffect');
            expect(formatResult.text).not.toContain('@mui/material');
            expect(formatResult.text).not.toContain('./missing-file');
            expect(formatResult.text).toContain('export function MyComponent()');

            parser.dispose();
        });

        test('should handle complete import removal correctly', async () => {
            const sourceCode = `import { unused1 } from './missing1';
import { unused2 } from './missing2';

export function Component() {
  return <div>Clean code</div>;
}`;

            const missingModules = new Set(['./missing1', './missing2']);
            const unusedImports = ['unused1', 'unused2'];

            const parser = new ImportParser(mockConfig);
            const parserResult = parser.parse(sourceCode, missingModules, unusedImports);

            // Parser should return importRange and no groups
            expect(parserResult.importRange).toBeDefined();
            expect(parserResult.groups).toHaveLength(0);

            const formatResult = await formatImports(sourceCode, mockConfig, parserResult);

            // Formatter should clean up the file
            expect(formatResult.text).not.toContain('import');
            expect(formatResult.text).toContain('export function Component()');
            expect(formatResult.text.trim().startsWith('export')).toBe(true);

            parser.dispose();
        });
    });
});
