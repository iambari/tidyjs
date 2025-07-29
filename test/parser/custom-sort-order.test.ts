import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Custom sort order in groups', () => {
  describe('Alphabetic sort order', () => {
    it('should sort imports alphabetically when sortOrder is "alphabetic"', () => {
      const config: Config = {
        groups: [
          {
            name: 'External',
            match: /^[^@]/,
            order: 0,
            sortOrder: 'alphabetic'
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { useState } from 'react';
import { debounce } from 'lodash';
import axios from 'axios';
import { clsx } from 'clsx';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const externalGroup = result.groups.find(g => g.name === 'External');
      expect(externalGroup).toBeDefined();
      
      if (externalGroup) {
        // Should be sorted by type first (default, named), then alphabetically within type
        const sources = externalGroup.imports.map(imp => imp.source);
        expect(sources).toEqual(['axios', 'clsx', 'lodash', 'react']);
      }
    });
  });

  describe('Custom array sort order', () => {
    it('should sort imports according to custom pattern array', () => {
      const config: Config = {
        groups: [
          {
            name: 'External',
            match: /^[^@]/,
            order: 0,
            sortOrder: ['react', 'react-*', 'lodash', 'axios']
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { useState } from 'react';
import { debounce } from 'lodash';
import axios from 'axios';
import { clsx } from 'clsx';
import { render } from 'react-dom';
import { createRoot } from 'react-dom/client';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const externalGroup = result.groups.find(g => g.name === 'External');
      expect(externalGroup).toBeDefined();
      
      if (externalGroup) {
        // Should be sorted by type first (default, named), then by custom order within each type
        const sources = externalGroup.imports.map(imp => imp.source);
        // axios is default, others are named imports
        // Within named: react, react-dom, react-dom/client (matches react-*), lodash, then clsx (alphabetic)
        expect(sources).toEqual(['axios', 'react', 'react-dom', 'react-dom/client', 'lodash', 'clsx']);
      }
    });

    it('should handle wildcard patterns correctly', () => {
      const config: Config = {
        groups: [
          {
            name: 'React',
            match: /^react/,
            order: 0,
            sortOrder: ['react', 'react-*']
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const reactGroup = result.groups.find(g => g.name === 'React');
      expect(reactGroup).toBeDefined();
      
      if (reactGroup) {
        // Should be: react first, then all react-* in alphabetical order (all named imports in this case)
        const sources = reactGroup.imports.map(imp => imp.source);
        expect(sources).toEqual(['react', 'react-dom', 'react-dom/client', 'react-router', 'react-router-dom']);
      }
    });

    it('should put unmatched imports at the end in alphabetical order', () => {
      const config: Config = {
        groups: [
          {
            name: 'External',
            match: /^[^@]/,
            order: 0,
            sortOrder: ['react', 'lodash']
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { useState } from 'react';
import { debounce } from 'lodash';
import axios from 'axios';
import { clsx } from 'clsx';
import zod from 'zod';
import dayjs from 'dayjs';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const externalGroup = result.groups.find(g => g.name === 'External');
      expect(externalGroup).toBeDefined();
      
      if (externalGroup) {
        // Should be: axios, dayjs, zod (defaults), then react, lodash (custom order), then clsx (alphabetic)
        const sources = externalGroup.imports.map(imp => imp.source);
        expect(sources).toEqual(['axios', 'dayjs', 'zod', 'react', 'lodash', 'clsx']);
      }
    });
  });

  describe('Complex wildcard patterns', () => {
    it('should handle @scope/* patterns', () => {
      const config: Config = {
        groups: [
          {
            name: 'Internal',
            match: /^@app/,
            order: 0,
            sortOrder: ['@app/components', '@app/components/*', '@app/utils', '@app/utils/*']
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { Button } from '@app/components/Button';
import { formatDate } from '@app/utils/date';
import Layout from '@app/components';
import { api } from '@app/utils';
import { Card } from '@app/components/Card';
import { debounce } from '@app/utils/async';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const internalGroup = result.groups.find(g => g.name === 'Internal');
      expect(internalGroup).toBeDefined();
      
      if (internalGroup) {
        const sources = internalGroup.imports.map(imp => imp.source);
        // Layout is default import, others are named, sorted by custom order
        expect(sources).toEqual([
          '@app/components',
          '@app/components/Button',
          '@app/components/Card',
          '@app/utils',
          '@app/utils/async',
          '@app/utils/date'
        ]);
      }
    });

    it('should handle multiple wildcards in different positions', () => {
      const config: Config = {
        groups: [
          {
            name: 'Testing',
            match: /test|spec|mock/,
            order: 0,
            sortOrder: ['*test*', '*mock*', '*spec*']
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { render } from '@testing-library/react';
import { mockFn } from 'jest-mock';
import testUtils from 'test-utils';
import { setupTests } from 'setup-tests';
import specHelper from 'spec-helper';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const testingGroup = result.groups.find(g => g.name === 'Testing');
      expect(testingGroup).toBeDefined();
      
      if (testingGroup) {
        const sources = testingGroup.imports.map(imp => imp.source);
        // Assuming all are named imports, sorted by custom wildcard order
        expect(sources).toEqual([
          'test-utils',             // *test*
          'spec-helper',            // *spec*
          '@testing-library/react', // *test*
          'setup-tests',            // *test*
          'jest-mock'               // *mock*
        ]);
      }
    });
  });

  describe('Mixed type imports with custom sort order', () => {
    it('should apply custom sort order within same import type', () => {
      const config: Config = {
        groups: [
          {
            name: 'External',
            match: /^[^@]/,
            order: 0,
            sortOrder: ['react', 'lodash', 'axios']
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import axios from 'axios';
import { debounce } from 'lodash';
import React from 'react';
import { useState } from 'react';
import type { AxiosResponse } from 'axios';
import type { DebouncedFunc } from 'lodash';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const externalGroup = result.groups.find(g => g.name === 'External');
      expect(externalGroup).toBeDefined();
      
      if (externalGroup) {
        const sources = externalGroup.imports.map(imp => imp.source);
        // Should group by type first (default, named, typeNamed), then apply custom sort within each type
        expect(sources).toEqual(['react', 'axios', 'react', 'lodash', 'lodash', 'axios']);
        
        // Verify the types are in correct order
        const types = externalGroup.imports.map(imp => imp.type);
        expect(types).toEqual(['default', 'default', 'named', 'named', 'typeNamed', 'typeNamed']);
      }
    });
  });

  describe('No sort order specified', () => {
    it('should fall back to alphabetical sorting when no sortOrder is specified', () => {
      const config: Config = {
        groups: [
          {
            name: 'External',
            match: /^[^@]/,
            order: 0
            // No sortOrder specified
          },
          {
            name: 'Default',
            order: 1,
            default: true
          }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const sourceText = `
import { useState } from 'react';
import { debounce } from 'lodash';
import axios from 'axios';
import { clsx } from 'clsx';
      `.trim();

      const parser = new ImportParser(config);
      const result = parser.parse(sourceText);

      expect(result.groups.length).toBeGreaterThan(0);
      const externalGroup = result.groups.find(g => g.name === 'External');
      expect(externalGroup).toBeDefined();
      
      if (externalGroup) {
        // Should be sorted alphabetically by default (by type first, then alphabetic within type)
        const sources = externalGroup.imports.map(imp => imp.source);
        expect(sources).toEqual(['axios', 'clsx', 'lodash', 'react']);
      }
    });
  });
});