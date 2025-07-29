import { ImportParser } from '../../src/parser';
import type { Config as ExtensionGlobalConfig } from '../../src/types';

describe('JSX Parsing Integration', () => {
  let parser: ImportParser;

  beforeEach(() => {
    const config: ExtensionGlobalConfig = {
      groups: [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'Other', order: 999, default: true }
      ],
      importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
      format: { singleQuote: true, indent: 2, removeUnusedImports: false },
      excludedFolders: []
    };
    parser = new ImportParser(config);
  });

  test('should parse JSX component with imports', () => {
    const code = `// Basic import test file
import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@mui/material';
import type { User } from './types';
import './styles.css';

export default function BasicComponent() {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    axios.get('/api/user').then(response => {
      setUser(response.data);
    });
  }, []);

  return (
    <div>
      <Button onClick={() => console.log('clicked')}>
        Hello {user?.name}
      </Button>
    </div>
  );
}`;

    const result = parser.parse(code);

    expect(result.invalidImports).toBeUndefined();
    expect(result.groups).toHaveLength(2);
    expect(result.importRange).toBeDefined();
    expect(result.importRange!.start).toBe(0);
    expect(result.importRange!.end).toBeGreaterThan(0);
    
    // Check that we parsed the imports correctly
    const reactGroup = result.groups.find(g => g.name === 'React');
    const miscGroup = result.groups.find(g => g.name === 'Other');
    
    expect(reactGroup).toBeDefined();
    expect(reactGroup!.imports).toHaveLength(2); // React default + named import
    expect(miscGroup).toBeDefined();
    expect(miscGroup!.imports.length).toBeGreaterThan(0); // axios, Button, User, styles.css
  });

  test('should handle TypeScript syntax in JSX', () => {
    const code = `import React from 'react';
import type { FC, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title?: string;
}

const Component: FC<Props> = ({ children, title = 'Default' }) => {
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
};

export default Component;`;

    const result = parser.parse(code);

    expect(result.invalidImports).toBeUndefined();
    expect(result.groups).toHaveLength(1);
    expect(result.importRange).toBeDefined();
    
    const reactGroup = result.groups.find(g => g.name === 'React');
    expect(reactGroup).toBeDefined();
    expect(reactGroup!.imports).toHaveLength(2); // default and type imports
  });
});