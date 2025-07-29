import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Mixed Type Imports Bug', () => {
  const baseConfig: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        default: false,
        match: /^react$/
      },
      {
        name: 'Default',
        order: 2,
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

  test('should separate mixed named and type imports - BUG FIXED', () => {
    const parser = new ImportParser(baseConfig);
    
    // This is the problematic import that should be separated
    const sourceCode = `import {
    useState,
    type FC
} from 'react';`;

    console.log('INPUT:', sourceCode);
    
    const result = parser.parse(sourceCode);
    
    console.log('PARSED RESULT:', JSON.stringify(result, null, 2));
    
    // Check how many imports were created
    const allImports = result.groups.flatMap(g => g.imports);
    console.log('Number of imports found:', allImports.length);
    console.log('Import details:', allImports.map(imp => ({
      type: imp.type,
      specifiers: imp.specifiers,
      source: imp.source
    })));
    
    // BUG FIXED: Now correctly creates TWO separate imports:
    // 1. import { useState } from 'react';
    // 2. import type { FC } from 'react';
    expect(allImports.length).toBe(2); // Should be 2 separate imports
    
    // Find the named import and type import
    const namedImport = allImports.find(imp => imp.type === 'named');
    const typeImport = allImports.find(imp => imp.type === 'typeNamed');
    
    expect(namedImport).toBeDefined();
    expect(typeImport).toBeDefined();
    
    expect(namedImport?.specifiers).toEqual(['useState']);
    expect(typeImport?.specifiers).toEqual(['FC']);
    expect(namedImport?.source).toBe('react');
    expect(typeImport?.source).toBe('react');
  });

  test('should handle multiple mixed type patterns', () => {
    const parser = new ImportParser(baseConfig);
    
    const sourceCode = `import {
    useState,
    useEffect,
    type FC,
    type ReactNode,
    createContext
} from 'react';`;

    const result = parser.parse(sourceCode);
    const allImports = result.groups.flatMap(g => g.imports);
    
    console.log('MULTIPLE MIXED - Number of imports:', allImports.length);
    console.log('MULTIPLE MIXED - Import details:', allImports.map(imp => ({
      type: imp.type,
      specifiers: imp.specifiers,
      source: imp.source
    })));
    
    // Should create TWO imports:
    // 1. import { useState, useEffect, createContext } from 'react';
    // 2. import type { FC, ReactNode } from 'react';
    
    expect(allImports.length).toBe(2);
    
    const namedImport = allImports.find(imp => imp.type === 'named');
    const typeImport = allImports.find(imp => imp.type === 'typeNamed');
    
    expect(namedImport?.specifiers).toEqual(['useState', 'useEffect', 'createContext']);
    expect(typeImport?.specifiers).toEqual(['FC', 'ReactNode']);
  });

  test('should handle default + named + type imports', () => {
    const parser = new ImportParser(baseConfig);
    
    const sourceCode = `import React, {
    useState,
    type FC
} from 'react';`;

    const result = parser.parse(sourceCode);
    const allImports = result.groups.flatMap(g => g.imports);
    
    console.log('DEFAULT+NAMED+TYPE - Number of imports:', allImports.length);
    console.log('DEFAULT+NAMED+TYPE - Import details:', allImports.map(imp => ({
      type: imp.type,
      specifiers: imp.specifiers,
      source: imp.source
    })));
    
    // Should create THREE imports:
    // 1. import React from 'react';
    // 2. import { useState } from 'react';
    // 3. import type { FC } from 'react';
    
    expect(allImports.length).toBe(3);
    
    const defaultImport = allImports.find(imp => imp.type === 'default');
    const namedImport = allImports.find(imp => imp.type === 'named');
    const typeImport = allImports.find(imp => imp.type === 'typeNamed');
    
    expect(defaultImport?.specifiers).toEqual(['React']);
    expect(namedImport?.specifiers).toEqual(['useState']);
    expect(typeImport?.specifiers).toEqual(['FC']);
  });

  test('should not affect pure type imports', () => {
    const parser = new ImportParser(baseConfig);
    
    const sourceCode = `import type { FC, ReactNode } from 'react';`;

    const result = parser.parse(sourceCode);
    const allImports = result.groups.flatMap(g => g.imports);
    
    // Pure type import should be typeNamed (named type import)
    expect(allImports.length).toBe(1);
    expect(allImports[0].type).toBe('typeNamed');
    expect(allImports[0].specifiers).toEqual(['FC', 'ReactNode']);
  });

  test('should not affect pure named imports', () => {
    const parser = new ImportParser(baseConfig);
    
    const sourceCode = `import { useState, useEffect } from 'react';`;

    const result = parser.parse(sourceCode);
    const allImports = result.groups.flatMap(g => g.imports);
    
    // Pure named import should remain as single named import
    expect(allImports.length).toBe(1);
    expect(allImports[0].type).toBe('named');
    expect(allImports[0].specifiers).toEqual(['useState', 'useEffect']);
  });
});