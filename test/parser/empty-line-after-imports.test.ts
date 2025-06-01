import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';
import { formatImports } from '../../src/formatter';

describe('Empty line after imports', () => {
  const config: Config = {
    groups: [
      {
        name: 'External',
        order: 1,
        match: /^[\w@]/,
      },
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0,
    },
    format: {
      onSave: false,
    },
  };

  it('should add exactly one empty line when no empty line exists', async () => {
    const code = `import React from 'react';
import { useState } from 'react';
const Component = () => {};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Check that there's exactly one newline between imports and code
    expect(formatted.text).toContain(';\n\nconst Component');
    expect(formatted.text).not.toContain(';\n\n\nconst');
  });

  it('should keep exactly one empty line when one exists', async () => {
    const code = `import React from 'react';
import { useState } from 'react';

const Component = () => {};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain(';\n\nconst Component');
    expect(formatted.text).not.toContain(';\n\n\nconst');
  });

  it('should reduce multiple empty lines to exactly one', async () => {
    const code = `import React from 'react';
import { useState } from 'react';



const Component = () => {};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain(';\n\nconst Component');
    expect(formatted.text).not.toContain(';\n\n\nconst');
  });

  it('should handle comments after imports correctly', async () => {
    const code = `import React from 'react';
import { useState } from 'react';
// This is a comment
const Component = () => {};`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Should add empty line before the comment
    expect(formatted.text).toContain(';\n\n// This is a comment');
  });

  it('should handle file ending with imports', async () => {
    const code = `import React from 'react';
import { useState } from 'react';`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    // Should end with exactly one empty line (two newlines total)
    expect(formatted.text).toMatch(/;\n\n$/);
    expect(formatted.text).not.toMatch(/;\n\n\n$/);
  });

  it('should handle mixed import types with proper spacing', async () => {
    const code = `import React from 'react';
import { useState } from 'react';
import type { FC } from 'react';
import './styles.css';
interface Props {}`;
    
    const parser = new ImportParser(config);
    const result = parser.parse(code);
    const formatted = await formatImports(code, config, result);
    
    expect(formatted.text).toContain(';\n\ninterface Props');
  });
});