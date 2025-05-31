import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Error Recovery and Invalid Imports', () => {
  const basicConfig: Config = {
    groups: [
      {
        name: 'Default',
        order: 1,
        isDefault: true
      }
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0
    },
    format: {
      onSave: true
    }
  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(basicConfig);
  });

  test('should handle syntax errors in source code', () => {
    const invalidCode = `
      import { unclosed from "react";
      const invalid = function(
    `;
    
    const result = parser.parse(invalidCode);
    
    expect(result.groups).toHaveLength(0);
    expect(result.originalImports).toHaveLength(0);
    expect(result.invalidImports).toBeDefined();
    expect(result.invalidImports!.length).toBeGreaterThan(0);
    expect(result.invalidImports![0].error).toContain('parsing');
  });

  test('should handle missing closing braces in imports', () => {
    const invalidCode = 'import { useState, useEffect from "react";';
    
    const result = parser.parse(invalidCode);
    
    expect(result.invalidImports).toBeDefined();
    expect(result.invalidImports!.length).toBeGreaterThan(0);
  });

  test('should handle missing quotes in import statements', () => {
    const invalidCode = 'import React from react;';
    
    const result = parser.parse(invalidCode);
    
    expect(result.invalidImports).toBeDefined();
    expect(result.invalidImports!.length).toBeGreaterThan(0);
  });

  test('should handle malformed import specifiers', () => {
    const invalidCode = 'import { , } from "react";';
    
    const result = parser.parse(invalidCode);
    
    expect(result.invalidImports).toBeDefined();
  });

  test('should handle empty import source', () => {
    const invalidCode = 'import React from "";';
    
    const result = parser.parse(invalidCode);
    
    // Empty string is technically valid, but might be flagged depending on implementation
    expect(result).toBeDefined();
  });

  test('should handle imports with invalid characters', () => {
    const invalidCode = 'import React from "re@ct#$%";';
    
    const result = parser.parse(invalidCode);
    
    // Invalid characters in module names should still parse
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports[0].source).toBe('re@ct#$%');
  });

  test('should provide meaningful error messages', () => {
    const invalidCode = 'import { from "react";';
    
    const result = parser.parse(invalidCode);
    
    expect(result.invalidImports).toBeDefined();
    expect(result.invalidImports![0].error).toBeDefined();
    expect(typeof result.invalidImports![0].error).toBe('string');
    expect(result.invalidImports![0].error.length).toBeGreaterThan(0);
  });

  test('should preserve raw import text in error cases', () => {
    const invalidCode = 'import { broken from "react";';
    
    const result = parser.parse(invalidCode);
    
    expect(result.invalidImports).toBeDefined();
    expect(result.invalidImports![0].raw).toBeDefined();
    expect(result.invalidImports![0].raw).toContain('broken');
  });

  test('should handle mixed valid and invalid imports', () => {
    const mixedCode = `
      import React from "react";
      import { broken from "broken";
      import { useState } from "react";
    `;
    
    const result = parser.parse(mixedCode);
    
    // Should handle the parsing error for the entire code block
    expect(result.invalidImports).toBeDefined();
  });

  test('should handle completely empty source code', () => {
    const emptyCode = '';
    
    const result = parser.parse(emptyCode);
    
    expect(result.groups).toHaveLength(0);
    expect(result.originalImports).toHaveLength(0);
    expect(result.invalidImports).toBeUndefined();
  });

  test('should handle whitespace-only source code', () => {
    const whitespaceCode = '   \n\t  \n  ';
    
    const result = parser.parse(whitespaceCode);
    
    expect(result.groups).toHaveLength(0);
    expect(result.originalImports).toHaveLength(0);
    expect(result.invalidImports).toBeUndefined();
  });

  test('should handle comments-only source code', () => {
    const commentsCode = `
      // This is a comment
      /* Multi-line
         comment */
    `;
    
    const result = parser.parse(commentsCode);
    
    expect(result.groups).toHaveLength(0);
    expect(result.originalImports).toHaveLength(0);
    expect(result.invalidImports).toBeUndefined();
  });

  test('should handle very long import statements', () => {
    const longImportCode = `import { ${Array(1000).fill('item').map((_, i) => `item${i}`).join(', ')} } from "very-long-import";`;
    
    const result = parser.parse(longImportCode);
    
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports[0].specifiers).toHaveLength(1000);
  });

  test('should handle imports with unicode characters', () => {
    const unicodeCode = 'import { café, naïve, 中文 } from "unicode-module";';
    
    const result = parser.parse(unicodeCode);
    
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports[0].specifiers).toContain('café');
    expect(result.groups[0].imports[0].specifiers).toContain('naïve');
    expect(result.groups[0].imports[0].specifiers).toContain('中文');
  });

  test('should handle nested quotes in import strings', () => {
    const nestedQuotesCode = 'import module from "path/with\'quotes";';
    
    const result = parser.parse(nestedQuotesCode);
    
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports[0].source).toBe("path/with'quotes");
  });

  test('should handle imports with escape sequences', () => {
    const escapeCode = 'import module from "path\\\\with\\\\backslashes";';
    
    const result = parser.parse(escapeCode);
    
    expect(result.groups).toHaveLength(1);
    // The parser correctly interprets escape sequences
    expect(result.groups[0].imports[0].source).toBe('path\\with\\backslashes');
  });
});