import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Alias Import Parsing', () => {
  const config: Config = {
    groups: [
      {
        name: 'External',
        order: 1,
        match: /^[\w@]/,
      },
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0,
    }
  };

  it('should parse import aliases correctly', () => {
    const code = `import { useState as state, useEffect as effect } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    
    expect(result.groups[0].imports[0].specifiers).toEqual([
      { imported: 'useState', local: 'state' },
      { imported: 'useEffect', local: 'effect' },
    ]);
  });

  it('should handle mixed aliases and regular imports', () => {
    const code = `import { useState, useEffect as effect, Component } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    
    expect(result.groups[0].imports[0].specifiers).toEqual([
      'useState',
      { imported: 'useEffect', local: 'effect' },
      'Component',
    ]);
  });

  it('should parse type import aliases correctly', () => {
    const code = `import type { ComponentType as MyComponentType, ReactNode } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    
    expect(result.groups[0].imports[0].specifiers).toEqual([
      { imported: 'ComponentType', local: 'MyComponentType' },
      'ReactNode',
    ]);
  });

  it('should handle default as named import alias', () => {
    const code = `import { default as React } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    
    expect(result.groups[0].imports[0].specifiers).toEqual([
      { imported: 'default', local: 'React' },
    ]);
  });

  it('should handle mixed default alias with other named imports', () => {
    const code = `import { default as lodash, debounce, throttle } from 'lodash';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    
    expect(result.groups[0].imports[0].type).toBe('named');
    expect(result.groups[0].imports[0].specifiers).toEqual([
      { imported: 'default', local: 'lodash' },
      'debounce',
      'throttle',
    ]);
  });

  it('should differentiate between standard default import and named default alias', () => {
    const code1 = `import React from 'react';`;
    const code2 = `import { default as React } from 'react';`;
    
    const parser = new ImportParser(config);
    const result1 = parser.parse(code1);
    const result2 = parser.parse(code2);
    
    // Standard default import
    expect(result1.groups[0].imports[0].type).toBe('default');
    expect(result1.groups[0].imports[0].defaultImport).toBe('React');
    expect(result1.groups[0].imports[0].specifiers).toEqual(['React']);
    
    // Named import of default with alias
    expect(result2.groups[0].imports[0].type).toBe('named');
    expect(result2.groups[0].imports[0].defaultImport).toBeUndefined();
    expect(result2.groups[0].imports[0].specifiers).toEqual([
      { imported: 'default', local: 'React' },
    ]);
  });

  it('should handle multiple aliases with special characters', () => {
    const code = `import { $http as http, _lodash as lodash } from 'utils';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    
    expect(result.groups[0].imports[0].specifiers).toEqual([
      { imported: '$http', local: 'http' },
      { imported: '_lodash', local: 'lodash' },
    ]);
  });
});