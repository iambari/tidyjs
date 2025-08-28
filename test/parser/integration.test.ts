import { ImportParser, parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Integration Tests', () => {
  const realWorldConfig: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        default: false,
        match: /^react$/
      },
      {
        name: 'React Related',
        order: 2,
        default: false,
        match: /^react-/
      },
      {
        name: 'Node Modules',
        order: 3,
        default: false,
        match: /^[a-zA-Z0-9-]+$/  // Only match simple package names
      },
      {
        name: 'Scoped Packages',
        order: 4,
        default: false,
        match: /^@/
      },
      {
        name: 'Parent Directories',
        order: 5,
        default: false,
        match: /^\.\./
      },
      {
        name: 'Current Directory',
        order: 6,
        default: false,
        match: /^\.\/[^/]/
      },
      {
        name: 'App Components',
        order: 7,
        default: false,
        match: /^(components|pages|hooks|utils|services|constants)/
      },
      {
        name: 'Miscellaneous',
        order: 8,
        default: true
      }
    ],
    importOrder: {
      sideEffect: 0,
      default: 1,
      named: 2,
      typeOnly: 3
    },
    format: {
      singleQuote: true,
      indent: 2
    }
  };

  test('should handle a complete real-world React component file', () => {
    const realWorldCode = `
      import "normalize.css";
      import "./global.css";
      
      import React, { useState, useEffect, useCallback } from "react";
      import ReactDOM from "react-dom";
      import { BrowserRouter, Route, Routes } from "react-router-dom";
      
      import lodash from "lodash";
      import axios from "axios";
      import moment from "moment";
      
      import { ThemeProvider } from "@emotion/react";
      import { Button } from "@mui/material";
      import { styled } from "@styled-components/native";
      
      import { config } from "../../config";
      import { utils } from "../utils";
      import { constants } from "../constants";
      
      import { Header } from "./Header";
      import { Footer } from "./Footer";
      
      import { useAuth } from "hooks/useAuth";
      import { UserService } from "services/UserService";
      import { HomePage } from "pages/HomePage";
      
      import customModule from "custom:module";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(realWorldCode);

    // Some groups might be empty and not included
    expect(result.groups.length).toBeGreaterThanOrEqual(6);
    expect(result.groups.length).toBeLessThanOrEqual(8);

    // Verify React group
    const reactGroup = result.groups.find(g => g.name === 'React');
    expect(reactGroup).toBeDefined();
    // Mixed import is split into 2 imports: default and named
    expect(reactGroup!.imports).toHaveLength(2);
    expect(reactGroup!.imports[0].source).toBe('react');
    expect(reactGroup!.imports[1].source).toBe('react');
    // Should have both default and named imports
    const defaultImport = reactGroup!.imports.find(i => i.type === 'default');
    const namedImport = reactGroup!.imports.find(i => i.type === 'named');
    expect(defaultImport).toBeDefined();
    expect(namedImport).toBeDefined();
    expect(defaultImport!.specifiers).toContain('React');
    expect(namedImport!.specifiers).toContain('useState');
    expect(namedImport!.specifiers).toContain('useEffect');
    expect(namedImport!.specifiers).toContain('useCallback');

    // Verify React Related group
    const reactRelatedGroup = result.groups[1];
    expect(reactRelatedGroup.name).toBe('React Related');
    expect(reactRelatedGroup.imports).toHaveLength(2);
    expect(reactRelatedGroup.imports.map(i => i.source)).toEqual(['react-dom', 'react-router-dom']);

    // Verify Node Modules group
    const nodeModulesGroup = result.groups.find(g => g.name === 'Node Modules');
    expect(nodeModulesGroup).toBeDefined();
    expect(nodeModulesGroup!.imports).toHaveLength(3);
    expect(nodeModulesGroup!.imports.map(i => i.source).sort()).toEqual(['axios', 'lodash', 'moment']);

    // Verify Scoped Packages group
    const scopedGroup = result.groups.find(g => g.name === 'Scoped Packages');
    expect(scopedGroup).toBeDefined();
    expect(scopedGroup!.imports).toHaveLength(3);

    // Verify Parent Directories group
    const parentGroup = result.groups.find(g => g.name === 'Parent Directories');
    expect(parentGroup).toBeDefined();
    expect(parentGroup!.imports).toHaveLength(3);

    // Verify Current Directory group
    const currentGroup = result.groups.find(g => g.name === 'Current Directory');
    expect(currentGroup).toBeDefined();
    expect(currentGroup!.imports).toHaveLength(3); // includes ./global.css

    // Verify App Components group
    const appGroup = result.groups.find(g => g.name === 'App Components');
    expect(appGroup).toBeDefined();
    expect(appGroup!.imports).toHaveLength(3);

    // Verify Miscellaneous group
    const miscGroup = result.groups.find(g => g.name === 'Miscellaneous');
    expect(miscGroup).toBeDefined();
    // The test already expects 2 imports
    const sources = miscGroup!.imports.map(i => i.source).sort();
    expect(sources).toContain('custom:module');
    expect(sources).toContain('normalize.css');
  });

  test('should handle TypeScript-style imports', () => {
    const typescriptCode = `
      import type { ComponentType } from "react";
      import type { User } from "./types";
      import React from "react";
      import { useState } from "react";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(typescriptCode);

    // Parser now correctly distinguishes TypeScript type imports
    expect(result.groups).toHaveLength(2); // React and Current Directory groups
    const totalImports = result.groups.reduce((sum, g) => sum + g.imports.length, 0);
    expect(totalImports).toBe(4); // React default+named+type + current directory type import
  });

  test('should handle complex project structure imports', () => {
    const complexCode = `
      import { api } from "services/api/userService";
      import { Button } from "components/ui/Button";
      import { Modal } from "components/common/Modal";
      import { useLocalStorage } from "hooks/storage/useLocalStorage";
      import { formatDate } from "utils/dateUtils";
      import { ROUTES } from "constants/routes";
      import { HomePage } from "pages/home/HomePage";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(complexCode);

    // All imports should be matched by App Components group
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('App Components');
    expect(result.groups[0].imports).toHaveLength(7);
  });

  test('should maintain import order within groups for mixed types', () => {
    const mixedCode = `
      import "react/index.css";
      import React, { Component } from "react";
      import { Fragment } from "react";
      import ReactDOM from "react-dom";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(mixedCode);

    const reactGroup = result.groups.find(g => g.name === 'React');
    const reactRelatedGroup = result.groups.find(g => g.name === 'React Related');

    expect(reactGroup!.imports).toHaveLength(2); // split mixed + named (but named consolidated)
    expect(reactRelatedGroup!.imports).toHaveLength(1);
    
    // The CSS import goes to Miscellaneous group because it doesn't match any pattern
    const miscGroup = result.groups.find(g => g.name === 'Miscellaneous');
    const cssImport = miscGroup?.imports.find(i => i.source === 'react/index.css');
    expect(cssImport).toBeDefined();
    expect(cssImport!.type).toBe('sideEffect');

    // Within React group, should be sorted by type then alphabetically
    const reactImports = reactGroup!.imports;
    // CSS import is missing - it's a different source ("react/index.css") 
    // So reactGroup only has imports from "react" source
    expect(reactImports).toHaveLength(2); // split mixed + named (but named are consolidated)
    expect(reactImports[0].type).toBe('default');    // React from mixed import
    expect(reactImports[1].type).toBe('named');      // { Component, Fragment } consolidated
    expect(reactImports[1].specifiers).toContain('Component');
    expect(reactImports[1].specifiers).toContain('Fragment');
  });

  test('should handle empty groups gracefully in real-world scenario', () => {
    const simpleCode = `
      import React from "react";
      import { utils } from "./utils";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(simpleCode);

    // Should only create groups that have imports
    expect(result.groups.length).toBeLessThan(realWorldConfig.groups.length);
    expect(result.groups.every(group => group.imports.length > 0)).toBe(true);
  });

  test('should handle performance with large number of imports', () => {
    const manyImports = Array.from({ length: 100 }, (_, i) => 
      `import module${i} from "module${i}";`
    ).join('\n');

    const parser = new ImportParser(realWorldConfig);
    const startTime = performance.now();
    const result = parser.parse(manyImports);
    const endTime = performance.now();

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should produce consistent results with parseImports function', () => {
    const code = `
      import React from "react";
      import { utils } from "./utils";
      import lodash from "lodash";
    `;

    const parser = new ImportParser(realWorldConfig);
    const classResult = parser.parse(code);
    const functionResult = parseImports(code, realWorldConfig);

    expect(functionResult.groups.length).toBe(classResult.groups.length);
    expect(functionResult.originalImports).toEqual(classResult.originalImports);
    
    for (let i = 0; i < functionResult.groups.length; i++) {
      expect(functionResult.groups[i].name).toBe(classResult.groups[i].name);
      expect(functionResult.groups[i].order).toBe(classResult.groups[i].order);
      expect(functionResult.groups[i].imports.length).toBe(classResult.groups[i].imports.length);
    }
  });

  test('should handle multiple parser instances with different configs', () => {
    const simpleConfig: Config = {
      groups: [{ name: 'All', order: 1, default: true }],
      importOrder: { default: 1, named: 2, typeOnly: 3, sideEffect: 0 }
    };

    const parser1 = new ImportParser(realWorldConfig);
    const parser2 = new ImportParser(simpleConfig);

    const code = `
      import React from "react";
      import { utils } from "./utils";
    `;

    const result1 = parser1.parse(code);
    const result2 = parser2.parse(code);

    expect(result1.groups.length).toBeGreaterThan(result2.groups.length);
    expect(result2.groups).toHaveLength(1);
    expect(result2.groups[0].name).toBe('All');
  });

  test('should handle real-world error scenarios gracefully', () => {
    const problematicCode = `
      import React from "react";
      import { broken from "broken-module";
      import { working } from "./working";
    `;

    const parser = new ImportParser(realWorldConfig);
    const result = parser.parse(problematicCode);

    // With fallback parser, we now extract imports even with syntax errors
    expect(result.invalidImports).toBeDefined();
    expect(result.invalidImports).toHaveLength(1);
    expect(result.groups.length).toBeGreaterThan(0); // Fallback parser extracts valid imports
  });
});