import { Config } from '../../src/types';
import { ImportParser, ImportType } from '../../src/parser';

const DEFAULT_CONFIG: Config = {
  debug: false,
  groups: [
    {
      name: 'Side Effects',
      order: 0,
      default: false,
      match: /\.(css|scss|sass)$/,
    },
    {
      name: 'External',
      order: 1,
      default: false,
      match: /^[^.]/,
    },
    {
      name: 'Local',
      order: 2,
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

describe('Side-effect imports filtering', () => {
  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(DEFAULT_CONFIG);
  });

  afterEach(() => {
    parser.dispose();
  });

  describe('applyFilters with side-effect imports', () => {
    test('should preserve side-effect imports when filtering unused imports', () => {
      const sourceCode = `
        import './styles.css';
        import './polyfills.js';
        import React from 'react';
        import { useState, useEffect } from 'react';
      `;

      const unusedImports = ['React', 'useEffect'];
      const result = parser.parse(sourceCode, undefined, unusedImports);

      const allImports = result.groups.flatMap(group => group.imports);

      const sideEffectImports = allImports.filter(imp => imp.type === ImportType.SIDE_EFFECT);
      expect(sideEffectImports).toHaveLength(2);
      expect(sideEffectImports[0].source).toBe('./styles.css');
      expect(sideEffectImports[1].source).toBe('./polyfills.js');

      const reactNamedImport = allImports.find(
        imp => imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactNamedImport).toBeDefined();
      expect(reactNamedImport!.specifiers).not.toContain('useEffect');
    });

    test('should preserve CSS/SCSS imports when all other imports are unused', () => {
      const sourceCode = `
        import 'normalize.css';
        import './styles.scss';
        import './theme.css';
        import React from 'react';
        import { Component } from 'react';
      `;

      const unusedImports = ['React', 'Component'];
      const result = parser.parse(sourceCode, undefined, unusedImports);

      const allImports = result.groups.flatMap(group => group.imports);

      expect(allImports).toHaveLength(3);
      expect(allImports.every(imp => imp.type === ImportType.SIDE_EFFECT)).toBe(true);

      const sources = allImports.map(imp => imp.source);
      expect(sources).toContain('normalize.css');
      expect(sources).toContain('./styles.scss');
      expect(sources).toContain('./theme.css');
    });

    test('should preserve polyfill imports when filtering unused imports', () => {
      const sourceCode = `
        import 'core-js/stable';
        import 'regenerator-runtime/runtime';
        import 'zone.js/dist/zone';
        import { UnusedComponent } from './components';
      `;

      const unusedImports = ['UnusedComponent'];
      const result = parser.parse(sourceCode, undefined, unusedImports);

      const allImports = result.groups.flatMap(group => group.imports);

      const polyfills = allImports.filter(imp => imp.type === ImportType.SIDE_EFFECT);
      expect(polyfills).toHaveLength(3);
      expect(polyfills[0].source).toBe('core-js/stable');
      expect(polyfills[1].source).toBe('regenerator-runtime/runtime');
      expect(polyfills[2].source).toBe('zone.js/dist/zone');

      const componentImport = allImports.find(imp => imp.source === './components');
      expect(componentImport).toBeUndefined();
    });

    test('should preserve side-effect imports with missing modules filtering', () => {
      const sourceCode = `
        import './init.js';
        import '@sentry/react';
        import { MissingComponent } from '@missing/package';
        import React from 'react';
      `;

      const missingModules = new Set(['@missing/package']);
      const result = parser.parse(sourceCode, missingModules, undefined);

      const allImports = result.groups.flatMap(group => group.imports);

      const sideEffectImports = allImports.filter(imp => imp.type === ImportType.SIDE_EFFECT);
      expect(sideEffectImports).toHaveLength(2);

      const sideEffectSources = sideEffectImports.map(imp => imp.source);
      expect(sideEffectSources).toContain('./init.js');
      expect(sideEffectSources).toContain('@sentry/react');

      const missingImport = allImports.find(imp => imp.source === '@missing/package');
      expect(missingImport).toBeUndefined();

      const reactImport = allImports.find(imp => imp.source === 'react');
      expect(reactImport).toBeDefined();
    });

    test('should preserve side-effect imports with both filtering types', () => {
      const sourceCode = `
        import 'reflect-metadata';
        import './styles.css';
        import React from 'react';
        import { useState } from 'react';
        import { MissingType } from '@missing/types';
      `;

      const missingModules = new Set(['@missing/types']);
      const unusedImports = ['React'];
      const result = parser.parse(sourceCode, missingModules, unusedImports);

      const allImports = result.groups.flatMap(group => group.imports);

      const sideEffectImports = allImports.filter(imp => imp.type === ImportType.SIDE_EFFECT);
      expect(sideEffectImports).toHaveLength(2);

      const sideEffectSources = sideEffectImports.map(imp => imp.source);
      expect(sideEffectSources).toContain('reflect-metadata');
      expect(sideEffectSources).toContain('./styles.css');

      const reactNamedImport = allImports.find(
        imp => imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactNamedImport).toBeDefined();

      const reactDefaultImport = allImports.find(
        imp => imp.source === 'react' && imp.defaultImport === 'React'
      );
      expect(reactDefaultImport).toBeUndefined();

      const missingImport = allImports.find(imp => imp.source === '@missing/types');
      expect(missingImport).toBeUndefined();
    });

    test('should handle real-world application entry point with many side-effects', () => {
      const sourceCode = `
        import 'reflect-metadata';
        import 'zone.js/dist/zone';
        import './polyfills/array';
        import './polyfills/string';
        import 'core-js/stable';
        import 'regenerator-runtime/runtime';
        import React from 'react';
        import ReactDOM from 'react-dom';
        import { Provider } from 'react-redux';
        import './index.css';
        import './styles/global.scss';
        import 'intersection-observer';
        import '@sentry/react';
        import { UnusedHelper } from './helpers';
      `;

      const unusedImports = ['UnusedHelper'];
      const result = parser.parse(sourceCode, undefined, unusedImports);

      const allImports = result.groups.flatMap(group => group.imports);

      const sideEffectImports = allImports.filter(imp => imp.type === ImportType.SIDE_EFFECT);
      expect(sideEffectImports.length).toBeGreaterThanOrEqual(10);

      const cssImports = sideEffectImports.filter(imp =>
        imp.source.endsWith('.css') || imp.source.endsWith('.scss')
      );
      expect(cssImports).toHaveLength(2);

      const polyfillImports = sideEffectImports.filter(imp =>
        imp.source.includes('polyfill') ||
        imp.source.includes('core-js') ||
        imp.source.includes('regenerator-runtime') ||
        imp.source.includes('zone.js')
      );
      expect(polyfillImports.length).toBeGreaterThanOrEqual(5);

      const helperImport = allImports.find(imp => imp.source === './helpers');
      expect(helperImport).toBeUndefined();

      const reactImports = allImports.filter(imp =>
        imp.source === 'react' ||
        imp.source === 'react-dom' ||
        imp.source === 'react-redux'
      );
      expect(reactImports.length).toBeGreaterThanOrEqual(3);
    });

    test('should preserve empty import statements (side-effects)', () => {
      const sourceCode = `
        import 'package-with-side-effects';
        import React, { useState } from 'react';
      `;

      const unusedImports = ['React'];
      const result = parser.parse(sourceCode, undefined, unusedImports);

      const allImports = result.groups.flatMap(group => group.imports);

      const sideEffectImport = allImports.find(imp =>
        imp.source === 'package-with-side-effects'
      );
      expect(sideEffectImport).toBeDefined();
      expect(sideEffectImport!.type).toBe(ImportType.SIDE_EFFECT);
      expect(sideEffectImport!.specifiers).toHaveLength(0);

      const reactNamedImport = allImports.find(
        imp => imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactNamedImport).toBeDefined();
    });
  });

  describe('Integration with formatter', () => {
    test('should format side-effect imports correctly after filtering', () => {
      const sourceCode = `
        import './styles.css';
        import React from 'react';
        import { unused } from 'lodash';
      `;

      const unusedImports = ['unused', 'React'];
      const result = parser.parse(sourceCode, undefined, unusedImports);

      expect(result.groups.length).toBeGreaterThan(0);

      const allImports = result.groups.flatMap(group => group.imports);
      expect(allImports).toHaveLength(1);
      expect(allImports[0].type).toBe(ImportType.SIDE_EFFECT);
      expect(allImports[0].source).toBe('./styles.css');
    });
  });
});
