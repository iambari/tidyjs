import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Group Matching Logic', () => {
  const advancedConfig: Config = {
    groups: [
      {
        name: 'App Modules',
        order: 1,
        isDefault: false,
        match: /^app\//
      },
      {
        name: 'Node Modules',
        order: 2,
        isDefault: false,
        match: /^[a-zA-Z0-9-]+$/  // Only match simple package names
      },
      {
        name: 'Scoped Packages',
        order: 3,
        isDefault: false,
        match: /^@/
      },
      {
        name: 'Parent Imports',
        order: 4,
        isDefault: false,
        match: /^\.\./
      },
      {
        name: 'Current Directory',
        order: 5,
        isDefault: false,
        match: /^\.\/[^/]/
      },
      {
        name: 'Miscellaneous',
        order: 6,
        isDefault: true
      }
    ],
    importOrder: {
      default: 1,
      named: 1,
      typeOnly: 1,
      sideEffect: 1
    },
    format: {
      onSave: true
    }
  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(advancedConfig);
  });

  test('should match node modules group correctly', () => {
    const sourceCode = `
      import react from "react";
      import lodash from "lodash";
      import moment from "moment";
    `;
    const result = parser.parse(sourceCode);
    
    const nodeModulesGroup = result.groups.find(g => g.name === 'Node Modules');
    expect(nodeModulesGroup).toBeDefined();
    expect(nodeModulesGroup!.imports).toHaveLength(3);
    // Imports are sorted alphabetically by source
    expect(nodeModulesGroup!.imports.map(i => i.source)).toEqual(['lodash', 'moment', 'react']);
  });

  test('should match scoped packages group correctly', () => {
    const sourceCode = `
      import { Component } from "@angular/core";
      import styled from "@emotion/styled";
      import { render } from "@testing-library/react";
    `;
    const result = parser.parse(sourceCode);
    
    const scopedGroup = result.groups.find(g => g.name === 'Scoped Packages');
    expect(scopedGroup).toBeDefined();
    expect(scopedGroup!.imports).toHaveLength(3);
    // With same type order, imports are sorted alphabetically by source
    expect(scopedGroup!.imports.map(i => i.source)).toEqual([
      '@angular/core',
      '@emotion/styled',
      '@testing-library/react'
    ]);
  });

  test('should match parent directory imports correctly', () => {
    const sourceCode = `
      import { utils } from "../utils";
      import config from "../../config";
      import { types } from "../../../types";
    `;
    const result = parser.parse(sourceCode);
    
    const parentGroup = result.groups.find(g => g.name === 'Parent Imports');
    expect(parentGroup).toBeDefined();
    expect(parentGroup!.imports).toHaveLength(3);
    // Imports are sorted alphabetically by source
    expect(parentGroup!.imports.map(i => i.source)).toEqual([
      '../../../types',
      '../../config',
      '../utils'
    ]);
  });

  test('should match current directory imports correctly', () => {
    const sourceCode = `
      import { helper } from "./helper";
      import styles from "./styles.css";
      import { constants } from "./constants";
    `;
    const result = parser.parse(sourceCode);
    
    const currentGroup = result.groups.find(g => g.name === 'Current Directory');
    expect(currentGroup).toBeDefined();
    expect(currentGroup!.imports).toHaveLength(3);
    // Imports are sorted alphabetically by source
    expect(currentGroup!.imports.map(i => i.source)).toEqual([
      './constants',
      './helper',
      './styles.css'
    ]);
  });

  test('should handle default group with match pattern', () => {
    const sourceCode = `
      import { Routes } from "app/routes";
      import { store } from "app/store";
      import { api } from "app/api";
    `;
    const result = parser.parse(sourceCode);
    
    const appGroup = result.groups.find(g => g.name === 'App Modules');
    expect(appGroup).toBeDefined();
    expect(appGroup!.imports).toHaveLength(3);
    // Imports are sorted alphabetically by source
    expect(appGroup!.imports.map(i => i.source)).toEqual([
      'app/api',
      'app/routes',
      'app/store'
    ]);
  });

  test('should fallback to default group for unmatched imports', () => {
    const sourceCode = `
      import something from "weird:protocol";
      import other from "file://local";
    `;
    const result = parser.parse(sourceCode);
    
    const miscGroup = result.groups.find(g => g.name === 'Miscellaneous');
    expect(miscGroup).toBeDefined();
    expect(miscGroup!.imports).toHaveLength(2);
  });

  test('should maintain group order in results', () => {
    const sourceCode = `
      import { helper } from "./helper";
      import { Component } from "@angular/core";
      import react from "react";
      import { utils } from "../utils";
      import { Routes } from "app/routes";
    `;
    const result = parser.parse(sourceCode);
    
    expect(result.groups).toHaveLength(5);
    expect(result.groups[0].name).toBe('App Modules');
    expect(result.groups[0].order).toBe(1);
    expect(result.groups[1].name).toBe('Node Modules');
    expect(result.groups[1].order).toBe(2);
    expect(result.groups[2].name).toBe('Scoped Packages');
    expect(result.groups[2].order).toBe(3);
    expect(result.groups[3].name).toBe('Parent Imports');
    expect(result.groups[3].order).toBe(4);
    expect(result.groups[4].name).toBe('Current Directory');
    expect(result.groups[4].order).toBe(5);
  });

  test('should handle empty groups configuration gracefully', () => {
    const emptyConfig: Config = {
      ...advancedConfig,
      groups: []
    };
    const emptyParser = new ImportParser(emptyConfig);
    
    const sourceCode = 'import React from "react";';
    const result = emptyParser.parse(sourceCode);
    
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('Misc');
  });

  test('should prefer first matching non-default group', () => {
    const conflictConfig: Config = {
      groups: [
        {
          name: 'React Specific',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'All Node Modules',
          order: 2,
          isDefault: false,
          match: /^[^.]/
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
    
    const conflictParser = new ImportParser(conflictConfig);
    const sourceCode = 'import React from "react";';
    const result = conflictParser.parse(sourceCode);
    
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('React Specific');
  });

  test('should handle priority groups correctly', () => {
    const priorityConfig: Config = {
      ...advancedConfig,
      groups: advancedConfig.groups.map(g => ({
        ...g,
        priority: g.name === 'Scoped Packages' ? 1 : undefined
      }))
    };
    
    const priorityParser = new ImportParser(priorityConfig);
    const sourceCode = 'import { Component } from "@angular/core";';
    const result = priorityParser.parse(sourceCode);
    
    expect(result.groups[0].imports[0].isPriority).toBe(true);
  });
});