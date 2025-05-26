import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Import Types Detection', () => {
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
      onSave: true,
      singleQuote: true
    }
  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(basicConfig);
  });

  test('should detect default import type', () => {
    const sourceCode = 'import React from "react";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('default');
    expect(result.groups[0].imports[0].defaultImport).toBe('React');
    expect(result.groups[0].imports[0].specifiers).toContain('React');
  });

  test('should detect named import type', () => {
    const sourceCode = 'import { Component, Fragment } from "react";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('named');
    expect(result.groups[0].imports[0].specifiers).toEqual(['Component', 'Fragment']);
    expect(result.groups[0].imports[0].defaultImport).toBeUndefined();
  });

  test('should split mixed import into separate default and named imports', () => {
    const sourceCode = 'import React, { Component, useState, useEffect, memo, lazy } from "react";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports).toHaveLength(2);
    
    // First import should be default
    expect(result.groups[0].imports[0].type).toBe('default');
    expect(result.groups[0].imports[0].defaultImport).toBe('React');
    expect(result.groups[0].imports[0].specifiers).toEqual(['React']);
    
    // Second import should be named
    expect(result.groups[0].imports[1].type).toBe('named');
    expect(result.groups[0].imports[1].specifiers).toContain('Component');
    expect(result.groups[0].imports[1].specifiers).toContain('useState');
    expect(result.groups[0].imports[1].specifiers).toContain('useEffect');
    expect(result.groups[0].imports[1].specifiers).toContain('memo');
    expect(result.groups[0].imports[1].specifiers).toContain('lazy');
    expect(result.groups[0].imports[1].defaultImport).toBeUndefined();
  });

  test('should detect side effect import type', () => {
    const sourceCode = 'import "./global.css";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('sideEffect');
    expect(result.groups[0].imports[0].specifiers).toHaveLength(0);
    expect(result.groups[0].imports[0].defaultImport).toBeUndefined();
  });

  test('should detect namespace import as default type', () => {
    const sourceCode = 'import * as Utils from "./utils";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('default');
    expect(result.groups[0].imports[0].specifiers).toContain('* as Utils');
  });

  test('should detect mixed import with namespace', () => {
    const sourceCode = 'import React, * as Utils from "./react-utils";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('mixed');
    expect(result.groups[0].imports[0].defaultImport).toBe('React');
    expect(result.groups[0].imports[0].specifiers).toContain('* as Utils');
  });

  test('should handle complex mixed imports', () => {
    const sourceCode = 'import React, { Component, Fragment, PureComponent } from "react";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('mixed');
    expect(result.groups[0].imports[0].defaultImport).toBe('React');
    expect(result.groups[0].imports[0].specifiers).toContain('Component');
    expect(result.groups[0].imports[0].specifiers).toContain('Fragment');
    expect(result.groups[0].imports[0].specifiers).toContain('PureComponent');
  });

  test('should handle imports with aliases', () => {
    const sourceCode = 'import { useState as state, useEffect as effect } from "react";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('named');
    expect(result.groups[0].imports[0].specifiers).toContain('useState');
    expect(result.groups[0].imports[0].specifiers).toContain('useEffect');
  });

  test('should handle single named import', () => {
    const sourceCode = 'import { Component } from "react";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('named');
    expect(result.groups[0].imports[0].specifiers).toEqual(['Component']);
  });

  test('should handle empty import statement (side effect)', () => {
    const sourceCode = 'import "polyfill";';
    const result = parser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].type).toBe('sideEffect');
    expect(result.groups[0].imports[0].source).toBe('polyfill');
    expect(result.groups[0].imports[0].specifiers).toHaveLength(0);
  });
});