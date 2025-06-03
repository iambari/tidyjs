import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Double Format Test', () => {
  const config: Config = {
    groups: [
      {
        name: 'Misc',
        order: 0,
        isDefault: true
      }
    ],
    importOrder: {
      sideEffect: 0,
      default: 1,
      named: 2,
      typeOnly: 3
    },

  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(config);
  });

  test('should handle repeated parsing of the same content', () => {
    const sourceCode = `
import React, { useState, useEffect } from 'react';
import { Button, TextField } from '@mui/material';
`;

    // First parse
    const result1 = parser.parse(sourceCode);
    
    // Second parse with same content
    const result2 = parser.parse(sourceCode);
    
    // Results should be identical
    expect(result1.groups).toHaveLength(result2.groups.length);
    expect(result1.groups[0].imports).toHaveLength(result2.groups[0].imports.length);
    
    // Check that we have the expected number of imports (consolidated)
    expect(result1.groups[0].imports).toHaveLength(3); // React default, useState+useEffect named (consolidated), Button+TextField named (consolidated)
  });

  test('should consolidate imports from same source', () => {
    const sourceCode = `
import React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import { TextField } from '@mui/material';
`;

    const result = parser.parse(sourceCode);
    
    // Should have 3 imports after consolidation:
    // 1. React default
    // 2. useState+useEffect named from react
    // 3. Button+TextField named from @mui/material
    expect(result.groups[0].imports).toHaveLength(3);
    
    const reactNamed = result.groups[0].imports.find(imp => 
      imp.source === 'react' && imp.type === 'named'
    );
    expect(reactNamed?.specifiers).toContain('useState');
    expect(reactNamed?.specifiers).toContain('useEffect');
    
    const muiNamed = result.groups[0].imports.find(imp => 
      imp.source === '@mui/material' && imp.type === 'named'
    );
    expect(muiNamed?.specifiers).toContain('Button');
    expect(muiNamed?.specifiers).toContain('TextField');
  });
});