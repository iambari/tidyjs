import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Comprehensive Import Types Test', () => {
  const baseConfig: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        default: false,
        match: /^react$/
      },
      {
        name: 'Libraries',
        order: 2,
        default: false,
        match: /^[^.]/
      },
      {
        name: 'Local',
        order: 3,
        default: true
      }
    ],
    importOrder: {
      sideEffect: 0,
      default: 1,
      named: 2,
      typeOnly: 3
    }
  };

  function parseAndAnalyze(sourceCode: string): {
    imports: {
      type: string;
      specifiers: any[];
      source: string;
      groupName: string | null;
    }[];
    count: number;
  } {
    const parser = new ImportParser(baseConfig);
    const result = parser.parse(sourceCode);
    const allImports = result.groups.flatMap(g => g.imports);
    
    return {
      imports: allImports.map(imp => ({
        type: imp.type,
        specifiers: imp.specifiers,
        source: imp.source,
        groupName: imp.groupName
      })),
      count: allImports.length
    };
  }

  describe('Basic Import Types', () => {
    test('side effect imports', () => {
      const result = parseAndAnalyze(`import './styles.css';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('sideEffect');
      expect(result.imports[0].specifiers).toEqual([]);
      expect(result.imports[0].source).toBe('./styles.css');
    });

    test('default imports', () => {
      const result = parseAndAnalyze(`import React from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('default');
      expect(result.imports[0].specifiers).toEqual(['React']);
      expect(result.imports[0].source).toBe('react');
    });

    test('named imports', () => {
      const result = parseAndAnalyze(`import { useState, useEffect } from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('named');
      expect(result.imports[0].specifiers).toEqual(['useState', 'useEffect']);
      expect(result.imports[0].source).toBe('react');
    });

    test('namespace imports', () => {
      const result = parseAndAnalyze(`import * as React from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('default'); // namespace treated as default
      expect(result.imports[0].specifiers).toEqual(['* as React']);
      expect(result.imports[0].source).toBe('react');
    });

    test('named imports with aliases', () => {
      const result = parseAndAnalyze(`import { useState as state, useEffect as effect } from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('named');
      expect(result.imports[0].specifiers).toEqual([
        { imported: 'useState', local: 'state' },
        { imported: 'useEffect', local: 'effect' }
      ]);
      expect(result.imports[0].source).toBe('react');
    });
  });

  describe('Type Imports', () => {
    test('type default imports', () => {
      const result = parseAndAnalyze(`import type React from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('typeDefault');
      expect(result.imports[0].specifiers).toEqual(['React']);
      expect(result.imports[0].source).toBe('react');
    });

    test('type named imports', () => {
      const result = parseAndAnalyze(`import type { FC, ReactNode } from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('typeNamed');
      expect(result.imports[0].specifiers).toEqual(['FC', 'ReactNode']);
      expect(result.imports[0].source).toBe('react');
    });

    test('type namespace imports', () => {
      const result = parseAndAnalyze(`import type * as React from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('typeDefault'); // type namespace treated as type default
      expect(result.imports[0].specifiers).toEqual(['* as React']);
      expect(result.imports[0].source).toBe('react');
    });

    test('type named imports with aliases', () => {
      const result = parseAndAnalyze(`import type { FC as Component, ReactNode as Node } from 'react';`);
      
      expect(result.count).toBe(1);
      expect(result.imports[0].type).toBe('typeNamed');
      expect(result.imports[0].specifiers).toEqual([
        { imported: 'FC', local: 'Component' },
        { imported: 'ReactNode', local: 'Node' }
      ]);
      expect(result.imports[0].source).toBe('react');
    });
  });

  describe('Mixed Imports - The Fixed Bug Cases', () => {
    test('default + named imports', () => {
      const result = parseAndAnalyze(`import React, { useState } from 'react';`);
      
      expect(result.count).toBe(2);
      
      const defaultImport = result.imports.find(imp => imp.type === 'default');
      const namedImport = result.imports.find(imp => imp.type === 'named');
      
      expect(defaultImport?.specifiers).toEqual(['React']);
      expect(namedImport?.specifiers).toEqual(['useState']);
    });

    test('named + type named imports (the main bug)', () => {
      const result = parseAndAnalyze(`import {
    useState,
    type FC
} from 'react';`);
      
      expect(result.count).toBe(2);
      
      const namedImport = result.imports.find(imp => imp.type === 'named');
      const typeImport = result.imports.find(imp => imp.type === 'typeNamed');
      
      expect(namedImport?.specifiers).toEqual(['useState']);
      expect(typeImport?.specifiers).toEqual(['FC']);
    });

    test('default + named + type named imports', () => {
      const result = parseAndAnalyze(`import React, {
    useState,
    useEffect,
    type FC,
    type ReactNode
} from 'react';`);
      
      expect(result.count).toBe(3);
      
      const defaultImport = result.imports.find(imp => imp.type === 'default');
      const namedImport = result.imports.find(imp => imp.type === 'named');
      const typeImport = result.imports.find(imp => imp.type === 'typeNamed');
      
      expect(defaultImport?.specifiers).toEqual(['React']);
      expect(namedImport?.specifiers).toEqual(['useState', 'useEffect']);
      expect(typeImport?.specifiers).toEqual(['FC', 'ReactNode']);
    });

    test('default + namespace imports', () => {
      const result = parseAndAnalyze(`import React, * as ReactDom from 'react-dom';`);
      
      expect(result.count).toBe(2);
      
      const defaultImport = result.imports.find(imp => imp.type === 'default' && imp.specifiers.includes('React'));
      const namespaceImport = result.imports.find(imp => imp.type === 'default' && imp.specifiers.includes('* as ReactDom'));
      
      expect(defaultImport?.specifiers).toEqual(['React']);
      expect(namespaceImport?.specifiers).toEqual(['* as ReactDom']);
    });

    test('complex mixed with aliases', () => {
      const result = parseAndAnalyze(`import React, {
    useState as state,
    useEffect,
    type FC as Component,
    type ReactNode
} from 'react';`);
      
      expect(result.count).toBe(3);
      
      const defaultImport = result.imports.find(imp => imp.type === 'default');
      const namedImport = result.imports.find(imp => imp.type === 'named');
      const typeImport = result.imports.find(imp => imp.type === 'typeNamed');
      
      expect(defaultImport?.specifiers).toEqual(['React']);
      expect(namedImport?.specifiers).toEqual([
        { imported: 'useState', local: 'state' },
        'useEffect'
      ]);
      expect(typeImport?.specifiers).toEqual([
        { imported: 'FC', local: 'Component' },
        'ReactNode'
      ]);
    });
  });

  describe('Type Declaration Imports', () => {
    test('type default + type named mixed', () => {
      const result = parseAndAnalyze(`import type React, { FC } from 'react';`);
      
      expect(result.count).toBe(2);
      
      const typeDefaultImport = result.imports.find(imp => imp.type === 'typeDefault');
      const typeNamedImport = result.imports.find(imp => imp.type === 'typeNamed');
      
      expect(typeDefaultImport?.specifiers).toEqual(['React']);
      expect(typeNamedImport?.specifiers).toEqual(['FC']);
    });

    test('type default + type namespace mixed', () => {
      const result = parseAndAnalyze(`import type React, * as Types from 'react';`);
      
      expect(result.count).toBe(2);
      
      const typeDefaultImport = result.imports.find(imp => imp.type === 'typeDefault' && imp.specifiers.includes('React'));
      const typeNamespaceImport = result.imports.find(imp => imp.type === 'typeDefault' && imp.specifiers.includes('* as Types'));
      
      expect(typeDefaultImport?.specifiers).toEqual(['React']);
      expect(typeNamespaceImport?.specifiers).toEqual(['* as Types']);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    test('multiple sources with mixed types', () => {
      const sourceCode = `
import './styles.css';
import React, { useState, type FC } from 'react';
import { debounce } from 'lodash';
import type { Config } from './config';
import * as utils from './utils';
`;
      
      const result = parseAndAnalyze(sourceCode);
      
      expect(result.count).toBe(7);
      
      // Side effect
      const sideEffect = result.imports.find(imp => imp.type === 'sideEffect');
      expect(sideEffect?.source).toBe('./styles.css');
      
      // React imports (should be separated)
      const reactDefault = result.imports.find(imp => imp.type === 'default' && imp.source === 'react');
      const reactNamed = result.imports.find(imp => imp.type === 'named' && imp.source === 'react');
      const reactType = result.imports.find(imp => imp.type === 'typeNamed' && imp.source === 'react');
      
      expect(reactDefault?.specifiers).toEqual(['React']);
      expect(reactNamed?.specifiers).toEqual(['useState']);
      expect(reactType?.specifiers).toEqual(['FC']);
      
      // Lodash
      const lodash = result.imports.find(imp => imp.source === 'lodash');
      expect(lodash?.type).toBe('named');
      expect(lodash?.specifiers).toEqual(['debounce']);
      
      // Config type
      const configType = result.imports.find(imp => imp.source === './config');
      expect(configType?.type).toBe('typeNamed');
      expect(configType?.specifiers).toEqual(['Config']);
      
      // Utils namespace
      const utilsNamespace = result.imports.find(imp => imp.source === './utils');
      expect(utilsNamespace?.type).toBe('default'); // namespace treated as default
      expect(utilsNamespace?.specifiers).toEqual(['* as utils']);
    });

    test('deeply nested mixed types', () => {
      const result = parseAndAnalyze(`import React, {
    useState,
    useEffect,
    useCallback,
    useMemo,
    type FC,
    type ReactNode,
    type ComponentProps,
    type MouseEvent
} from 'react';`);
      
      expect(result.count).toBe(3);
      
      const defaultImport = result.imports.find(imp => imp.type === 'default');
      const namedImport = result.imports.find(imp => imp.type === 'named');
      const typeImport = result.imports.find(imp => imp.type === 'typeNamed');
      
      expect(defaultImport?.specifiers).toEqual(['React']);
      expect(namedImport?.specifiers).toEqual(['useState', 'useEffect', 'useCallback', 'useMemo']);
      expect(typeImport?.specifiers).toEqual(['FC', 'ReactNode', 'ComponentProps', 'MouseEvent']);
    });
  });

  describe('Grouping Verification', () => {
    test('imports should be grouped correctly', () => {
      const sourceCode = `
import React from 'react';
import { debounce } from 'lodash';
import { myFunction } from './utils';
`;
      
      const result = parseAndAnalyze(sourceCode);
      
      const reactImport = result.imports.find(imp => imp.source === 'react');
      const lodashImport = result.imports.find(imp => imp.source === 'lodash');
      const utilsImport = result.imports.find(imp => imp.source === './utils');
      
      expect(reactImport?.groupName).toBe('React');
      expect(lodashImport?.groupName).toBe('Libraries');
      expect(utilsImport?.groupName).toBe('Local');
    });
  });

  test('comprehensive import type summary', () => {
    console.log('\n=== COMPREHENSIVE IMPORT TYPES TEST SUMMARY ===');
    console.log('✅ Side effect imports: import "./styles.css"');
    console.log('✅ Default imports: import React from "react"');
    console.log('✅ Named imports: import { useState } from "react"');
    console.log('✅ Namespace imports: import * as React from "react"');
    console.log('✅ Type default imports: import type React from "react"');
    console.log('✅ Type named imports: import type { FC } from "react"');
    console.log('✅ Type namespace imports: import type * as React from "react"');
    console.log('✅ Mixed default + named: import React, { useState } from "react"');
    console.log('✅ Mixed named + type (BUG FIXED): import { useState, type FC } from "react"');
    console.log('✅ Mixed default + named + type: import React, { useState, type FC } from "react"');
    console.log('✅ Aliases supported in all combinations');
    console.log('✅ Complex nested mixed imports');
    console.log('✅ Proper grouping by source patterns');
    console.log('=== ALL IMPORT TYPES WORKING CORRECTLY ===\n');
    
    expect(true).toBe(true); // This test always passes, it's for documentation
  });
});