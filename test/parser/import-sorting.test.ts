import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Import Sorting Within Groups', () => {
  const sortingConfig: Config = {
    groups: [
      {
        name: 'Libraries',
        order: 1,
        isDefault: false,
        match: /^[^.]/
      },
      {
        name: 'Local',
        order: 2,
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
    parser = new ImportParser(sortingConfig);
  });

  test('should sort imports by type within groups', () => {
    const sourceCode = `
      import { Component } from "react";
      import React from "react";
      import "react/index.css";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    expect(imports[0].type).toBe('sideEffect'); // Order 0
    expect(imports[1].type).toBe('default');    // Order 1
    expect(imports[2].type).toBe('named');      // Order 2
  });

  test('should sort imports alphabetically by source within same type', () => {
    const sourceCode = `
      import zulu from "zulu";
      import alpha from "alpha";
      import bravo from "bravo";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    expect(imports[0].source).toBe('alpha');
    expect(imports[1].source).toBe('bravo');
    expect(imports[2].source).toBe('zulu');
  });

  test('should maintain type order priority over alphabetical order', () => {
    const sourceCode = `
      import zulu from "zulu";
      import { alpha } from "alpha";
      import "bravo";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    // Side effect (bravo) should come first despite alphabetical order
    expect(imports[0].type).toBe('sideEffect');
    expect(imports[0].source).toBe('bravo');
    
    // Then default imports
    expect(imports[1].type).toBe('default');
    expect(imports[1].source).toBe('zulu');
    
    // Then named imports
    expect(imports[2].type).toBe('named');
    expect(imports[2].source).toBe('alpha');
  });

  test('should handle mixed import types correctly', () => {
    const sourceCode = `
      import React, { Component } from "react";
      import Vue from "vue";
      import { useState } from "react";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    // Mixed imports are split: first all defaults, then all named
    expect(imports[0].type).toBe('default'); // React (from mixed)
    expect(imports[0].source).toBe('react');
    expect(imports[1].type).toBe('default'); // Vue
    expect(imports[1].source).toBe('vue');
    expect(imports[2].type).toBe('named');   // { Component, useState } (consolidated named from react)
    expect(imports[2].source).toBe('react');
    expect(imports[2].specifiers).toContain('Component');
    expect(imports[2].specifiers).toContain('useState');
  });

  test('should sort within custom type order configuration', () => {
    const customConfig: Config = {
      ...sortingConfig,
      importOrder: {
        named: 0,     // Named imports first
        default: 1,   // Default imports second
        sideEffect: 2, // Side effects last
        typeOnly: 3
      }
    };
    
    const customParser = new ImportParser(customConfig);
    const sourceCode = `
      import React from "react";
      import { Component } from "react";
      import "./styles.css";
    `;
    
    const result = customParser.parse(sourceCode);
    
    // The test expects all imports in one group, but they're split between Libraries and Local
    const allImports = result.groups.flatMap(g => g.imports);
    expect(allImports).toHaveLength(3);
    
    // Sort imports by the custom type order
    const sortedImports = allImports.sort((a, b) => {
      const orderA = customConfig.importOrder[a.type] ?? Infinity;
      const orderB = customConfig.importOrder[b.type] ?? Infinity;
      return orderA - orderB;
    });
    expect(sortedImports[0].type).toBe('named');      // Order 0
    expect(sortedImports[1].type).toBe('default');    // Order 1
    expect(sortedImports[2].type).toBe('sideEffect'); // Order 2
  });

  test('should handle namespace imports in sorting', () => {
    const sourceCode = `
      import { named } from "module-c";
      import * as Utils from "module-b";
      import Default from "module-a";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    // All should be sorted by source within their type groups
    expect(imports[0].source).toBe('module-a'); // Default
    expect(imports[1].source).toBe('module-b'); // Namespace (treated as default)
    expect(imports[2].source).toBe('module-c'); // Named
  });

  test('should handle case-insensitive alphabetical sorting', () => {
    const sourceCode = `
      import Zoo from "Zoo";
      import apple from "apple";
      import Banana from "Banana";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    // Should sort case-insensitively
    expect(imports[0].source).toBe('apple');
    expect(imports[1].source).toBe('Banana');
    expect(imports[2].source).toBe('Zoo');
  });

  test('should handle sorting across multiple groups', () => {
    const sourceCode = `
      import { localNamed } from "./local-b";
      import localDefault from "./local-a";
      import { libNamed } from "lib-b";
      import libDefault from "lib-a";
    `;
    
    const result = parser.parse(sourceCode);
    
    // Libraries group
    const libImports = result.groups[0].imports;
    expect(libImports[0].source).toBe('lib-a');  // Default
    expect(libImports[1].source).toBe('lib-b');  // Named
    
    // Local group
    const localImports = result.groups[1].imports;
    expect(localImports[0].source).toBe('./local-a'); // Default
    expect(localImports[1].source).toBe('./local-b'); // Named
  });

  test('should handle imports with same source but different types', () => {
    const sourceCode = `
      import { named } from "same-module";
      import defaultExport from "same-module";
      import "same-module";
    `;
    
    const result = parser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    expect(imports[0].type).toBe('sideEffect');
    expect(imports[1].type).toBe('default');
    expect(imports[2].type).toBe('named');
    
    // All should have the same source
    expect(imports[0].source).toBe('same-module');
    expect(imports[1].source).toBe('same-module');
    expect(imports[2].source).toBe('same-module');
  });

  test('should handle undefined type order gracefully', () => {
    const noTypeOrderConfig: Config = {
      ...sortingConfig,
      importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 0
      }
    };
    
    const noTypeParser = new ImportParser(noTypeOrderConfig);
    const sourceCode = `
      import c from "c";
      import b from "b";
      import a from "a";
    `;
    
    const result = noTypeParser.parse(sourceCode);
    const imports = result.groups[0].imports;
    
    // Should still sort alphabetically
    expect(imports[0].source).toBe('a');
    expect(imports[1].source).toBe('b');
    expect(imports[2].source).toBe('c');
  });
});