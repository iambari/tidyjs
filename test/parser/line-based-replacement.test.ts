/**
 * Tests for line-based import replacement approach
 * Ensures comments are properly handled when replacing import sections
 */

import { ImportParser } from '../../src/parser';
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
    importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 4,
    },
    format: {
        removeUnusedImports: true,
        removeMissingModules: true,
    },
    debug: false,
    excludedFolders: [],
};

describe('Line-based Import Replacement', () => {
    test('should remove inline comments with unused imports', async () => {
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
        const missingModules = new Set(['./missing-file']);
        const unusedImports = ['useEffect', 'Button', 'UserProfile'];
        
        const parserResult = parser.parse(sourceCode, missingModules, unusedImports);
        const result = await formatImports(sourceCode, mockConfig, parserResult);
        
        // Should not contain any of the removed import comments
        expect(result.text).not.toContain('// useState utilisé, useEffect non utilisé');
        expect(result.text).not.toContain('// non utilisé');
        expect(result.text).not.toContain('// module manquant');
        
        // Should contain properly formatted remaining imports
        expect(result.text).toContain('// React');
        expect(result.text).toContain("import React        from 'react';");
        expect(result.text).toContain("import { useState } from 'react';");
        
        // Should maintain the component code
        expect(result.text).toContain('export function MyComponent()');
        expect(result.text).toContain('const [count, setCount] = useState(0);');
        
        parser.dispose();
    });

    test('should handle multiline comments in import section', async () => {
        const sourceCode = `/*
 * Import section with multiline comment
 */
import React from 'react';
import { useState } from 'react'; // inline comment
import { unused } from './missing'; /* another comment */

export function Component() {
  return <div>Test</div>;
}`;

        const parser = new ImportParser(mockConfig);
        const missingModules = new Set(['./missing']);
        const unusedImports = ['unused'];
        
        const parserResult = parser.parse(sourceCode, missingModules, unusedImports);
        
        const result = await formatImports(sourceCode, mockConfig, parserResult);
        
        // Should preserve multiline comment that precedes imports (it's not part of import section)
        expect(result.text).toContain('Import section with multiline comment');
        
        // Should remove inline comments that are part of import lines
        expect(result.text).not.toContain('inline comment');
        expect(result.text).not.toContain('another comment');
        expect(result.text).not.toContain('unused');
        
        // Should contain clean formatted imports
        expect(result.text).toContain('// React');
        expect(result.text).toContain("import React        from 'react';");
        expect(result.text).toContain("import { useState } from 'react';");
        
        parser.dispose();
    });

    test('should remove entire import section when no imports remain', async () => {
        const sourceCode = `import { unused1 } from './missing1'; // comment 1
import { unused2 } from './missing2'; // comment 2

export function Component() {
  return <div>Clean code</div>;
}`;

        const parser = new ImportParser(mockConfig);
        const missingModules = new Set(['./missing1', './missing2']);
        const unusedImports = ['unused1', 'unused2'];
        
        const parserResult = parser.parse(sourceCode, missingModules, unusedImports);
        const result = await formatImports(sourceCode, mockConfig, parserResult);
        
        // Should not contain any import-related content
        expect(result.text).not.toContain('import');
        expect(result.text).not.toContain('comment 1');
        expect(result.text).not.toContain('comment 2');
        expect(result.text).not.toContain('missing1');
        expect(result.text).not.toContain('missing2');
        
        // Should start directly with the component
        expect(result.text.trim().startsWith('export function Component()')).toBe(true);
        
        parser.dispose();
    });

    test('should preserve spacing correctly when removing imports', async () => {
        const sourceCode = `
import { unused } from './missing'; // to be removed

// Component section
export function Component() {
  return <div>Test</div>;
}`;

        const parser = new ImportParser(mockConfig);
        const missingModules = new Set(['./missing']);
        const unusedImports = ['unused'];
        
        const parserResult = parser.parse(sourceCode, missingModules, unusedImports);
        const result = await formatImports(sourceCode, mockConfig, parserResult);
        
        // Should preserve file structure  
        expect(result.text).toContain('// Component section');
        expect(result.text).not.toContain('import');
        expect(result.text).not.toContain('to be removed');
        
        // Should have clean transition to component
        expect(result.text.trim().startsWith('// Component section')).toBe(true);
        
        parser.dispose();
    });

    test('should handle complex import section with mixed content', async () => {
        const sourceCode = `// Main imports
import React from 'react'; // keep this
import { useState, useEffect } from 'react'; // mixed usage

// Utility imports
import { helper } from './utils'; // keep
import { unused } from './trash'; // remove

/* 
 * Component definition below
 */
export function App() {
  const [state, setState] = useState(0);
  helper();
  return <div>{state}</div>;
}`;

        const parser = new ImportParser(mockConfig);
        const unusedImports = ['useEffect', 'unused'];
        
        const parserResult = parser.parse(sourceCode, undefined, unusedImports);
        const result = await formatImports(sourceCode, mockConfig, parserResult);
        
        // Should remove inline comments and unused imports
        expect(result.text).not.toContain('// keep this');
        expect(result.text).not.toContain('// mixed usage');
        expect(result.text).not.toContain('// keep');
        expect(result.text).not.toContain('// remove');
        expect(result.text).not.toContain('unused');
        expect(result.text).not.toContain('useEffect');
        
        // Should have clean formatted imports
        expect(result.text).toContain('// React');
        expect(result.text).toContain('// Other');
        expect(result.text).toContain("import React        from 'react';");
        expect(result.text).toContain("import { useState } from 'react';");
        expect(result.text).toContain("import { helper } from './utils';"); // Exact alignment may vary
        
        // Should preserve component comment and code
        expect(result.text).toContain('Component definition below');
        expect(result.text).toContain('const [state, setState] = useState(0);');
        
        parser.dispose();
    });
});
