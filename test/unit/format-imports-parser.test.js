const { createMockConfig } = require('../constant');
const { formatImportsFromParser } = require('../../src/formatter');
const { ImportParser } = require('tidyjs-parser');

describe('formatImportsFromParser', () => {
  // Base configuration for tests
  let config;

  beforeEach(() => {
    config = createMockConfig();
  });

  // Utility function to create a parser result
  function createParserResult(sourceText) {
    const parserConfig = {
      importGroups: config.importGroups,
      typeOrder: config.typeOrder,
      patterns: {
        subfolderPattern: config.patterns?.subfolderPattern
      }
    };
    const parser = new ImportParser(parserConfig);
    return parser.parse(sourceText);
  }

  test('correctly processes multiline comments that start and end on the same line', () => {
    const source = `// Misc
import { FormatterConfig } from './types';
/* Commentaire sur une ligne */ import { ParsedImport } from 'tidyjs-parser';
// Utils
import { logDebug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    // Verification that FormatterConfig and ParsedImport are in the Misc group (FormatterConfig first) and logDebug in the Utils group
    expect(result).toBe(
      `// Misc
import { FormatterConfig } from './types';
import { ParsedImport }    from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

`
    );
  });

  test('handles empty comments correctly', () => {
    const source = `// Misc
import { FormatterConfig } from './types';
//
import { ParsedImport } from 'tidyjs-parser';
// Utils
import { logDebug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    expect(result).toBe(
      `// Misc
import { FormatterConfig } from './types';
import { ParsedImport }    from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

`
    );
  });

  test('handles multiline comments spanning multiple lines', () => {
    const source = `// Misc
import { FormatterConfig } from './types';
/* Premier commentaire
   sur plusieurs lignes
   qui se termine ici */ 
import { ParsedImport } from 'tidyjs-parser';
// Utils
import { logDebug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    expect(result).toBe(
      `// Misc
import { FormatterConfig } from './types';
import { ParsedImport }    from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

`
    );
});

test('handles imports with from keyword on new line', () => {
    const source = `// Misc
import { FormatterConfig } 
    from './types';
import { ParsedImport } 
from 'tidyjs-parser';
// Utils
import { logDebug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    expect(result).toBe(
      `// Misc
import { FormatterConfig } from './types';
import { ParsedImport }    from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

`
    );
  });

  test('formate correctement les importations avec des alias', () => {
    const source = `// Misc
import { FormatterConfig as Config } from './types';
import { ParsedImport as Parser } from 'tidyjs-parser';
// Utils
import { logDebug as debug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    expect(result).toBe(
      `// Misc
import { FormatterConfig as Config } from './types';
import { ParsedImport as Parser }    from 'tidyjs-parser';

// Utils
import { logDebug as debug } from './utils/log';

`
    );
  });

  test('gère correctement les groupes d\'importation mixtes', () => {
    const source = `// Misc
import { FormatterConfig } from './types';
// External
import axios from 'axios';
// Utils
import { logDebug } from './utils/log';
// Dependencies
import { useState } from 'react';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    expect(result).toBe(
      `// Misc
import axios               from 'axios';
import { useState }        from 'react';
import { FormatterConfig } from './types';

// Utils
import { logDebug } from './utils/log';

`
    );
  });
});
