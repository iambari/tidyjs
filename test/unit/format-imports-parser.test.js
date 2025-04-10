const { createMockConfig } = require('../constant');
const { formatImportsFromParser } = require('../../src/formatter');
const { ImportParser } = require('tidyjs-parser');

describe('formatImportsFromParser', () => {
  // Configuration de base pour les tests
  let config;

  beforeEach(() => {
    config = createMockConfig();
  });

  // Fonction utilitaire pour créer un résultat de parser
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

  test('traite correctement les commentaires multilignes qui commencent et se terminent sur la même ligne', () => {
    const source = `// Misc
import { FormatterConfig } from './types';
/* Commentaire sur une ligne */ import { ParsedImport } from 'tidyjs-parser';
// Utils
import { logDebug } from './utils/log';`;

    const importRange = { start: 0, end: source.length };
    const parserResult = createParserResult(source);

    const result = formatImportsFromParser(source, importRange, parserResult, config);

    // Vérification que FormatterConfig et ParsedImport sont dans le groupe Misc (FormatterConfig en premier) et logDebug dans le groupe Utils
    expect(result).toBe(
      `// Misc
import { FormatterConfig } from './types';
import { ParsedImport }    from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

`
    );
  });

  test('gère correctement les commentaires vides', () => {
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

  test('gère les commentaires multilignes sur plusieurs lignes', () => {
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
