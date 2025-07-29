import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';
import { formatImports } from '../../src/formatter';

describe('Alias preservation', () => {
  const config: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        match: /^react$/,
      },
      {
        name: 'External',
        order: 2,
        match: /^[\w@]/,
      },
      {
        name: 'Internal',
        order: 3,
        default: true,
      },
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0,
    },
  };

  it('should preserve single alias in named import', async () => {
    const code = `import { Component as MyComponent } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('Component as MyComponent');
  });

  it('should preserve multiple aliases in named imports', async () => {
    const code = `import { Component as MyComponent, useState as useMyState } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('Component as MyComponent');
    expect(formatted.text).toContain('useState as useMyState');
  });

  it('should preserve aliases with regular imports', async () => {
    const code = `import { Component as MyComponent, useState, useEffect as useMyEffect } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('Component as MyComponent');
    expect(formatted.text).toContain('useState');
    expect(formatted.text).toContain('useEffect as useMyEffect');
  });

  it('should preserve aliases in multiline imports', async () => {
    const code = `import {
      Component as MyComponent,
      useState as useMyState,
      useEffect
    } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('Component as MyComponent');
    expect(formatted.text).toContain('useState as useMyState');
    expect(formatted.text).toContain('useEffect');
  });

  it('should preserve aliases in type imports', async () => {
    const code = `import type { ComponentType as MyComponentType } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('ComponentType as MyComponentType');
    expect(formatted.text).toContain('import type');
  });

  it('should handle merging imports with aliases from same source', async () => {
    const code = `
import { Component } from 'react';
import { useState as useMyState } from 'react';
import { useEffect } from 'react';
`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Should merge into single import with aliases preserved
    const importCount = (formatted.text.match(/import\s+{/g) || []).length;
    expect(importCount).toBe(1);
    expect(formatted.text).toContain('Component');
    expect(formatted.text).toContain('useState as useMyState');
    expect(formatted.text).toContain('useEffect');
  });

  it('should not duplicate imports when same alias is used', async () => {
    const code = `
import { Component as MyComponent } from 'react';
import { Component as MyComponent } from 'react';
`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Should only have one occurrence of the aliased import
    const matches = formatted.text.match(/Component as MyComponent/g) || [];
    expect(matches.length).toBe(1);
  });

  it('should preserve default export aliased as named import', async () => {
    const code = `import { default as React } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('{ default as React }');
  });

  it('should preserve mixed default alias with other imports', async () => {
    const code = `import { default as lodash, debounce, throttle } from 'lodash';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain('default as lodash');
    expect(formatted.text).toContain('debounce');
    expect(formatted.text).toContain('throttle');
  });

  it('should maintain difference between standard default and aliased default', async () => {
    const code = `
import React from 'react';
import { default as ReactAlias } from 'react-dom';
`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Check that standard default import is preserved
    expect(formatted.text).toMatch(/import React from ['"]react['"]/);
    // Check that aliased default is preserved as named import
    expect(formatted.text).toMatch(/import { default as ReactAlias } from ['"]react-dom['"]/);
  });
});