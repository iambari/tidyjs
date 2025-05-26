import { findImportsWithBabel } from '../../src/formatter';

// Mock the log functions to avoid console output during tests
jest.mock('../../src/utils/log', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../src/utils/misc', () => ({
  logError: jest.fn(),
  isEmptyLine: (line: string) => line.trim() === '',
  showMessage: {
    error: jest.fn(),
  },
}));

describe('Import Detection Integration Tests', () => {
  describe('findImportsWithBabel with TypeScript parser', () => {
    test('should detect simple import range', async () => {
      const code = `import React from 'react';
import { Component } from 'react';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.end).toBeGreaterThan(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle imports with numbers in package names', async () => {
      const code = `import React18 from 'react18';
import { Auth2fa } from '@auth/2fa';
import { version2024 } from './config-2024-01-01';

const app = React18.createElement('div');`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle date-like strings in module paths', async () => {
      const code = `import { api } from './2024-01-01-api-client';
import { logger } from './utils/2024-logger';

const client = api.create();`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should detect error for invalid import syntax', async () => {
      const code = `import { default } from 'react';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.error).toBeDefined();
      expect(result!.error).toContain('Syntax error');
    });

    test('should detect error for leading comma in import', async () => {
      const code = `import { , Component } from 'react';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.error).toBeDefined();
    });

    test('should handle multiline imports correctly', async () => {
      const code = `import React, { 
  useState, 
  useEffect,
  version2024 
} from 'react18';
import { 
  Auth2fa,
  TwoFactorAuth 
} from '@auth/2fa-module';

const component = () => {};`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle empty file', async () => {
      const code = '';

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.end).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle file with no imports', async () => {
      const code = `function hello() {
  console.log('Hello world');
}

export default hello;`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.end).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle comments before imports', async () => {
      const code = `// This is a component file
/* 
 * Multi-line comment
 */
import React from 'react';
import { Component } from 'react';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should include type imports in detection', async () => {
      const code = `import type { ComponentProps } from 'react';
import React, { type FC } from 'react';
import { useState } from 'react';

const component: FC = () => {};`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle namespace imports', async () => {
      const code = `import * as React from 'react';
import * as Utils2024 from './utils-2024';

const component = React.createElement('div');`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle side effect imports', async () => {
      const code = `import './styles.css';
import './polyfills-2024-01-01';
import React from 'react';

const component = () => {};`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should correctly detect end of import section', async () => {
      const code = `import React from 'react';
import { Component } from 'react';

const CONSTANT = 'value';

function MyComponent() {
  return <div>Hello</div>;
}`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      
      // The end should be after the imports but before the constant
      const detectedSection = code.substring(result!.start, result!.end);
      expect(detectedSection).toContain('import React');
      expect(detectedSection).toContain('import { Component }');
      expect(detectedSection).not.toContain('const CONSTANT');
    });

    test('should handle imports with mixed quotes', async () => {
      const code = `import React from "react";
import { Component } from 'react';
import * as Utils from './utils';

const component = () => {};`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });
  });

  describe('Complex scenarios that previously failed', () => {
    test('should handle code with timestamps in comments', async () => {
      const code = `// Generated on 2024-01-01T12:00:00Z
import React18 from 'react18';
import { version2024 } from './config';

const component = () => {};`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle numeric module paths', async () => {
      const code = `import { api } from './api/v2';
import { auth } from '@company/auth-2fa';
import { React18Component } from 'react18-components';

const app = () => {};`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });

    test('should handle legitimate code that looks suspicious to regex', async () => {
      const code = `import { parseISO } from 'date-fns';
import { log2024 } from './logger-2024-01-01';
import { React18 } from 'react18';

// This timestamp: 2024-01-01T12:00:00Z should not cause issues
const timestamp = '2024-01-01T12:00:00Z';`;

      const result = await findImportsWithBabel(code);
      expect(result).not.toBeNull();
      expect(result!.start).toBe(0);
      expect(result!.error).toBeUndefined();
    });
  });
});