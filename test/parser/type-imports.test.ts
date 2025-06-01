import { ImportParser } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import type { Config as ExtensionGlobalConfig } from '../../src/types';

describe('Type Import Handling', () => {
  let parser: ImportParser;
  let config: ExtensionGlobalConfig;

  beforeEach(() => {
    config = {
      groups: [
        { name: 'Misc', order: 0, match: /^react/, isDefault: false },
        { name: '@app/dossier', order: 1, match: /^@app\/dossier/, isDefault: false },
        { name: '@library', order: 2, match: /^@library/, isDefault: false },
        { name: 'DS', order: 3, match: /^ds/, isDefault: false },
        { name: 'Default', order: 999, isDefault: true }
      ],
      importOrder: { sideEffect: 0, default: 1, named: 2, typeDefault: 3, typeNamed: 4 },
      format: { onSave: false, singleQuote: true, indent: 2, removeUnusedImports: false },
      excludedFolders: []
    };
    parser = new ImportParser(config);
  });

  test('should correctly detect and format type-only imports', async () => {
    const code = `import {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo
} from 'react';
import { get } from 'lodash';
import { useYpWrapperContext } from 'ds';
import FicheTypeEnum from '@app/dossier/models/enums/FicheTypeEnum';
import useHistorisationService from '@app/dossier/services/fiches/HistorisationService';
import type {
    TDynamicSearchItem,
    TDynamicSearchModel
} from '@app/dossier/models/fiches/FicheDynamicSearch';
import { WsDataModel } from '@library/form-new/models/ProviderModel';
import type {
    TCallParams,
    TDataProviderReturn
} from '@library/form-new/models/ProviderModel';`;

    const parserResult = parser.parse(code);
    const formatted = await formatImports(code, config, parserResult);

    expect(formatted.error).toBeUndefined();
    expect(formatted.text).toContain('import type {');
    
    // Check that type imports are properly formatted
    expect(formatted.text).toContain('import type {\n    TDynamicSearchItem,\n    TDynamicSearchModel\n}');
    
    // Check that value and type imports from same source are separated
    expect(formatted.text).toContain('import { WsDataModel }');
    expect(formatted.text).toContain('import type {\n    TCallParams,\n    TDataProviderReturn\n}');
  });

  test('should consolidate type imports from same source', async () => {
    const code = `import type { TypeA } from './types';
import type { TypeB } from './types';
import { valueA } from './types';
import { valueB } from './types';`;

    const parserResult = parser.parse(code);
    const formatted = await formatImports(code, config, parserResult);

    expect(formatted.error).toBeUndefined();
    
    // Should consolidate type imports
    expect(formatted.text).toContain('import {\n    valueA,\n    valueB\n}');
    expect(formatted.text).toContain('import type {\n    TypeA,\n    TypeB\n}');
    
    // Should not have multiple imports from same source
    const importLines = formatted.text.split('\n').filter(line => line.includes("from './types'"));
    expect(importLines).toHaveLength(2); // One for values, one for types
  });

  test('should handle mixed default and type imports', async () => {
    const code = `import React from 'react';
import type { FC } from 'react';
import { useState } from 'react';`;

    const parserResult = parser.parse(code);
    const formatted = await formatImports(code, config, parserResult);

    expect(formatted.error).toBeUndefined();
    expect(formatted.text).toContain('import React');
    expect(formatted.text).toContain('import { useState }');
    expect(formatted.text).toContain('import type { FC }');
  });
});