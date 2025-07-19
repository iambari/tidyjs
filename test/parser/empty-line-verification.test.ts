import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';
import { formatImports } from '../../src/formatter';

describe('Empty line verification - Real world scenarios', () => {
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
        isDefault: true,
      },
    ],
    importOrder: {
      sideEffect: 0,
      default: 1,
      named: 2,
      typeOnly: 4,
    }
  };

  it('should handle React component with no empty line', async () => {
    const code = `import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import './styles.css';
const MyComponent = () => {
  return <div>Hello</div>;
};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Verify exactly one empty line between imports and component
    expect(formatted.text).toMatch(/;\n\nconst MyComponent/);
    expect(formatted.text).not.toMatch(/;\n\n\nconst MyComponent/);
  });

  it('should handle file with only imports and comments', async () => {
    const code = `import React from 'react';
import { useState } from 'react';
// TODO: Add component implementation`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toMatch(/;\n\n\/\/ TODO:/);
  });

  it('should handle file with export after imports', async () => {
    const code = `import React from 'react';
import { useState } from 'react';


export const Component = () => {};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toMatch(/;\n\nexport const/);
    expect(formatted.text).not.toMatch(/;\n\n\nexport/);
  });

  it('should handle TypeScript interfaces after imports', async () => {
    const code = `import React from 'react';
import type { FC } from 'react';
interface Props {
  name: string;
}`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toMatch(/;\n\ninterface Props/);
  });

  it('should handle multiple groups with proper spacing', async () => {
    const code = `import React from 'react';
import axios from 'axios';
import { config } from './config';
const App = () => {};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Should have groups separated but only one empty line before code
    const lines = formatted.text.split('\n');
    const lastImportIndex = lines.findIndex(line => line.includes('./config'));
    
    expect(lines[lastImportIndex + 1]).toBe('');
    expect(lines[lastImportIndex + 2]).toContain('const App');
  });

  it('should handle file with only side effect imports', async () => {
    const code = `import './polyfills';
import './styles.css';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Should end with exactly one empty line after the last import
    expect(formatted.text).toContain("'./styles.css';");
    expect(formatted.text.endsWith('\n\n')).toBe(true);
    expect(formatted.text.endsWith('\n\n\n')).toBe(false);
  });
});