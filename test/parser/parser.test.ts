import { ImportParser, parseImports, ParsedImport, ImportGroup, ParserResult } from '../../src/parser';
import { Config } from '../../src/types';
import { containsSpecifier } from '../test-utils';

describe('ImportParser', () => {
  const mockConfig: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        isDefault: false,
        match: /^react$/
      },
      {
        name: 'Libraries',
        order: 2,
        isDefault: false,
        match: /^[^.]/
      },
      {
        name: 'Local',
        order: 3,
        isDefault: true,
        match: /^[.]/
      }
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0
    },
    format: {
      indent: 2,
      singleQuote: true
    }
  };

  describe('Constructor and Configuration', () => {
    test('should initialize ImportParser with correct default settings', () => {
      const parser = new ImportParser(mockConfig);
      expect(parser).toBeInstanceOf(ImportParser);
    });

    test('should handle empty groups configuration', () => {
      const emptyConfig: Config = {
        ...mockConfig,
        groups: []
      };
      const parser = new ImportParser(emptyConfig);
      const result = parser.parse('import React from "react";');
      
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].name).toBe('Misc');
    });
  });

  describe('Basic Import Parsing', () => {
    let parser: ImportParser;

    beforeEach(() => {
      parser = new ImportParser(mockConfig);
    });

    test('should parse default imports correctly', () => {
      const sourceCode = 'import React from "react";';
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].imports).toHaveLength(1);
      
      const importItem = result.groups[0].imports[0];
      expect(importItem.type).toBe('default');
      expect(importItem.source).toBe('react');
      expect(importItem.defaultImport).toBe('React');
      expect(importItem.specifiers).toContain('React');
    });

    test('should parse named imports correctly', () => {
      const sourceCode = 'import { useState, useEffect } from "react";';
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(1);
      const importItem = result.groups[0].imports[0];
      
      expect(importItem.type).toBe('named');
      expect(importItem.source).toBe('react');
      expect(importItem.specifiers).toEqual(['useState', 'useEffect']);
      expect(importItem.defaultImport).toBeUndefined();
    });

    test('should parse mixed imports correctly', () => {
      const sourceCode = 'import React, { useState } from "react";';
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(1);
      // Mixed imports are split into separate default and named imports
      expect(result.groups[0].imports).toHaveLength(2);
      
      const defaultImport = result.groups[0].imports[0];
      expect(defaultImport.type).toBe('default');
      expect(defaultImport.source).toBe('react');
      expect(defaultImport.defaultImport).toBe('React');
      
      const namedImport = result.groups[0].imports[1];
      expect(namedImport.type).toBe('named');
      expect(namedImport.source).toBe('react');
      expect(namedImport.specifiers).toContain('useState');
    });

    test('should parse side effect imports correctly', () => {
      const sourceCode = 'import "./styles.css";';
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(1);
      const importItem = result.groups[0].imports[0];
      
      expect(importItem.type).toBe('sideEffect');
      expect(importItem.source).toBe('./styles.css');
      expect(importItem.specifiers).toHaveLength(0);
      expect(importItem.defaultImport).toBeUndefined();
    });
  });

  describe('Import Grouping and Organization', () => {
    let parser: ImportParser;

    beforeEach(() => {
      parser = new ImportParser(mockConfig);
    });

    test('should group imports correctly based on configuration', () => {
      const sourceCode = `
        import React from "react";
        import lodash from "lodash";
        import { utils } from "./utils";
      `;
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(3);
      
      // React group
      expect(result.groups[0].name).toBe('React');
      expect(result.groups[0].imports[0].source).toBe('react');
      
      // Libraries group
      expect(result.groups[1].name).toBe('Libraries');
      expect(result.groups[1].imports[0].source).toBe('lodash');
      
      // Local group
      expect(result.groups[2].name).toBe('Local');
      expect(result.groups[2].imports[0].source).toBe('./utils');
    });

    test('should sort groups by order property', () => {
      const sourceCode = `
        import { utils } from "./utils";
        import lodash from "lodash";
        import React from "react";
      `;
      const result = parser.parse(sourceCode);

      expect(result.groups[0].name).toBe('React');
      expect(result.groups[0].order).toBe(1);
      expect(result.groups[1].name).toBe('Libraries');
      expect(result.groups[1].order).toBe(2);
      expect(result.groups[2].name).toBe('Local');
      expect(result.groups[2].order).toBe(3);
    });

    test('should handle namespace imports correctly', () => {
      const sourceCode = 'import * as utils from "./utils";';
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(1);
      const importItem = result.groups[0].imports[0];
      
      expect(importItem.type).toBe('default');
      expect(importItem.source).toBe('./utils');
      expect(importItem.specifiers).toContain('* as utils');
    });
  });

  describe('Error Handling', () => {
    let parser: ImportParser;

    beforeEach(() => {
      parser = new ImportParser(mockConfig);
    });

    test('should handle syntax errors gracefully', () => {
      const invalidCode = 'import { from "react";'; // Missing closing brace
      const result = parser.parse(invalidCode);

      expect(result.groups).toHaveLength(0);
      expect(result.invalidImports).toBeDefined();
      expect(result.invalidImports!.length).toBeGreaterThan(0);
      expect(result.invalidImports![0].error).toContain('parsing');
    });

    test('should continue parsing after encountering invalid imports', () => {
      const sourceCode = `
        import React from "react";
        import { invalid } from;
        import { valid } from "./valid";
      `;
      
      // This test assumes the parser can recover from individual import errors
      const result = parser.parse(sourceCode);
      
      expect(result.originalImports).toBeDefined();
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    let parser: ImportParser;

    beforeEach(() => {
      parser = new ImportParser(mockConfig);
    });

    test('should handle empty source code', () => {
      const result = parser.parse('');
      
      expect(result.groups).toHaveLength(0);
      expect(result.originalImports).toHaveLength(0);
      expect(result.invalidImports).toBeUndefined();
    });

    test('should handle source code with only comments', () => {
      const sourceCode = `
        // This is a comment
        /* Multi-line comment */
      `;
      const result = parser.parse(sourceCode);
      
      expect(result.groups).toHaveLength(0);
      expect(result.originalImports).toHaveLength(0);
    });

    test('should preserve original import strings', () => {
      const sourceCode = `
        import React from "react";
        import { useState } from "react";
      `;
      const result = parser.parse(sourceCode);
      
      expect(result.originalImports).toHaveLength(2);
      expect(result.originalImports[0]).toContain('import React from "react"');
      expect(result.originalImports[1]).toContain('import { useState } from "react"');
    });

    test('should handle imports with aliases', () => {
      const sourceCode = 'import { useState as state, useEffect as effect } from "react";';
      const result = parser.parse(sourceCode);

      expect(result.groups).toHaveLength(1);
      const importItem = result.groups[0].imports[0];
      
      expect(importItem.type).toBe('named');
      expect(containsSpecifier(importItem.specifiers, 'useState')).toBe(true);
      expect(containsSpecifier(importItem.specifiers, 'useEffect')).toBe(true);
    });
  });

  describe('Utility Function parseImports', () => {
    test('should work as a standalone function', () => {
      const sourceCode = 'import React from "react";';
      const result = parseImports(sourceCode, mockConfig);

      expect(result).toBeDefined();
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].imports[0].source).toBe('react');
    });

    test('should produce same results as class instance', () => {
      const sourceCode = `
        import React from "react";
        import { utils } from "./utils";
      `;
      
      const parser = new ImportParser(mockConfig);
      const classResult = parser.parse(sourceCode);
      const functionResult = parseImports(sourceCode, mockConfig);

      expect(functionResult.groups).toHaveLength(classResult.groups.length);
      expect(functionResult.originalImports).toEqual(classResult.originalImports);
    });
  });
});