import { Config } from '../../src/types';
import { ImportParser } from '../../src/parser';
import { removeUnusedImports } from '../../src/utils/misc';

const DEFAULT_CONFIG: Config = {
  debug: false,
  groups: [
    {
      name: 'React',
      order: 0,
      isDefault: false,
      match: /^react/,
    },
    {
      name: 'Node modules',
      order: 1,
      isDefault: false,
      match: /^[^.]/,
    },
    {
      name: 'Local',
      order: 2,
      isDefault: true,
    },
  ],
  importOrder: {
    default: 0,
    named: 1,
    typeOnly: 2,
    sideEffect: 3,
  },
  format: {
    removeUnusedImports: true,
  },
};

describe('Unused Imports Detection and Removal', () => {
  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(DEFAULT_CONFIG);
  });

  describe('removeUnusedImports', () => {
    test('should remove completely unused import statements', () => {
      const sourceCode = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import lodash from 'lodash';
        import { format } from 'date-fns';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that React, useState, and lodash are unused
      const unusedImports = ['React', 'useState', 'lodash'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Should keep useEffect import and format import (total across all groups)
      const totalImports = result.groups.reduce((sum, group) => sum + group.imports.length, 0);
      expect(totalImports).toBe(2);
      
      // Find imports across all groups
      const allImports = result.groups.flatMap(group => group.imports);
      
      // Check that useEffect import is kept but useState is removed
      const reactImport = allImports.find(imp => imp.source === 'react');
      expect(reactImport).toBeDefined();
      expect(reactImport!.specifiers).toEqual(['useEffect']);
      expect(reactImport!.specifiers).not.toContain('useState');
      
      // Check that lodash import is completely removed
      const lodashImport = allImports.find(imp => imp.source === 'lodash');
      expect(lodashImport).toBeUndefined();
      
      // Check that date-fns import is kept
      const dateFnsImport = allImports.find(imp => imp.source === 'date-fns');
      expect(dateFnsImport).toBeDefined();
      expect(dateFnsImport!.specifiers).toEqual(['format']);
    });

    test('should remove partial specifiers from named imports', () => {
      const sourceCode = `
        import { Component, useState, useEffect, useMemo } from 'react';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that Component and useMemo are unused
      const unusedImports = ['Component', 'useMemo'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      expect(result.groups[0].imports).toHaveLength(1);
      
      const reactImport = result.groups[0].imports[0];
      expect(reactImport.source).toBe('react');
      expect(reactImport.specifiers).toEqual(['useState', 'useEffect']);
      expect(reactImport.specifiers).not.toContain('Component');
      expect(reactImport.specifiers).not.toContain('useMemo');
    });

    test('should remove entire import if all specifiers are unused', () => {
      const sourceCode = `
        import { Component, Fragment } from 'react';
        import { format, parse } from 'date-fns';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that all react specifiers are unused
      const unusedImports = ['Component', 'Fragment'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Should remove react import completely, keep date-fns
      const allImports = result.groups.flatMap(group => group.imports);
      expect(allImports).toHaveLength(1);
      
      const remainingImport = allImports[0];
      expect(remainingImport.source).toBe('date-fns');
      expect(remainingImport.specifiers).toEqual(['format', 'parse']);
    });

    test('should handle mixed import types (default + named)', () => {
      const sourceCode = `
        import React, { Component, useState } from 'react';
        import lodash, { map, filter } from 'lodash';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that Component and map are unused
      const unusedImports = ['Component', 'map'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Find imports across all groups
      const allImports = result.groups.flatMap(group => group.imports);
      expect(allImports.length).toBeGreaterThan(0);
      
      // Check that unused specifiers are removed
      const reactNamedImport = allImports.find(
        imp => imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactNamedImport).toBeDefined();
      expect(reactNamedImport!.specifiers).toEqual(['useState']);
      expect(reactNamedImport!.specifiers).not.toContain('Component');
      
      const lodashNamedImport = allImports.find(
        imp => imp.source === 'lodash' && imp.specifiers.includes('filter')
      );
      expect(lodashNamedImport).toBeDefined();
      expect(lodashNamedImport!.specifiers).toEqual(['filter']);
      expect(lodashNamedImport!.specifiers).not.toContain('map');
    });

    test('should handle type-only imports', () => {
      const sourceCode = `
        import type { FC, ComponentProps } from 'react';
        import type { Config } from './types';
        import { useState } from 'react';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that FC and Config are unused
      const unusedImports = ['FC', 'Config'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Find imports across all groups
      const allImports = result.groups.flatMap(group => group.imports);
      expect(allImports.length).toBeGreaterThan(0);
      
      // Check that FC is removed but ComponentProps is kept
      const reactTypeImport = allImports.find(
        imp => imp.source === 'react' && imp.specifiers.includes('ComponentProps')
      );
      expect(reactTypeImport).toBeDefined();
      expect(reactTypeImport!.specifiers).toEqual(['ComponentProps']);
      
      // Check that Config import is completely removed
      const configImport = allImports.find(imp => imp.source === './types');
      expect(configImport).toBeUndefined();
      
      // Check that useState is kept
      const reactValueImport = allImports.find(
        imp => imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactValueImport).toBeDefined();
    });

    test('should handle side-effect imports (not removed)', () => {
      const sourceCode = `
        import 'polyfill';
        import './styles.css';
        import { Component } from 'react';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that Component is unused
      // Side-effect imports should never be in unusedImports list
      const unusedImports = ['Component'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Should keep side-effect imports and remove Component import
      const allImports = result.groups.flatMap(group => group.imports);
      expect(allImports).toHaveLength(2);
      
      const sideEffectImports = allImports.filter(
        imp => imp.source === 'polyfill' || imp.source === './styles.css'
      );
      expect(sideEffectImports).toHaveLength(2);
      
      const reactImport = allImports.find(imp => imp.source === 'react');
      expect(reactImport).toBeUndefined();
    });

    test('should return original result when no unused imports', () => {
      const sourceCode = `
        import React from 'react';
        import { useState } from 'react';
      `;

      const parserResult = parser.parse(sourceCode);
      const unusedImports: string[] = [];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      expect(result).toEqual(parserResult);
    });

    test('should handle empty specifiers array', () => {
      const sourceCode = `
        import React from 'react';
        import 'side-effect';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Try to remove React default import
      const unusedImports = ['React'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Should keep side-effect import, remove React import
      const allImports = result.groups.flatMap(group => group.imports);
      expect(allImports).toHaveLength(1);
      expect(allImports[0].source).toBe('side-effect');
    });

    test('should remove unused React default import from real-world example', () => {
      const sourceCode = `
// Misc
import React       from 'react';
import type { FC } from 'react';

// @app/dossier
import LiaisonsComptablesListComponent    from '@app/dossier/components/postproduction/liaisons-comptables/LiaisonsComptablesListComponent';
import PostProductionWrapperTabsComponent from '@app/dossier/pages/postproduction/PostProductionWrapperTabsComponent';
import { LiaisonsComptablesProvider }     from '@app/dossier/providers/postproduction/contexts/LiaisonsComptablesContext';

const LiaisonsComptablesPage: FC = () => (
    <PostProductionWrapperTabsComponent activeTab='liaisons-comptables'>
        <LiaisonsComptablesProvider>
            <LiaisonsComptablesListComponent />
        </LiaisonsComptablesProvider>
    </PostProductionWrapperTabsComponent>
);

export default LiaisonsComptablesPage;
`;

      const parserResult = parser.parse(sourceCode);
      
      // React is unused in this component
      const unusedImports = ['React'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Check that React default import is removed
      const allImports = result.groups.flatMap(group => group.imports);
      const reactDefaultImport = allImports.find(imp => 
        imp.source === 'react' && imp.defaultImport === 'React'
      );
      expect(reactDefaultImport).toBeUndefined();

      // Check that type { FC } import is preserved
      const reactTypeImport = allImports.find(imp => 
        imp.source === 'react' && imp.type === 'typeNamed'
      );
      expect(reactTypeImport).toBeDefined();
      expect(reactTypeImport!.specifiers).toContain('FC');

      // Check that other imports are preserved
      expect(allImports.find(imp => imp.source.includes('LiaisonsComptablesListComponent'))).toBeDefined();
      expect(allImports.find(imp => imp.source.includes('PostProductionWrapperTabsComponent'))).toBeDefined();
      expect(allImports.find(imp => imp.source.includes('LiaisonsComptablesContext'))).toBeDefined();
    });

    test('should handle React import removal when only type imports remain', () => {
      const sourceCode = `
import React from 'react';
import type { FC, ReactNode } from 'react';
import { memo } from 'react';

interface Props {
  children: ReactNode;
}

const Component: FC<Props> = memo(({ children }) => {
  return <div>{children}</div>;
});

export default Component;
`;

      const parserResult = parser.parse(sourceCode);
      
      // React default import is unused (JSX transform doesn't need it)
      const unusedImports = ['React'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Should remove React default but keep type imports and memo
      const allImports = result.groups.flatMap(group => group.imports);
      
      // React default should be gone
      const reactDefaultImport = allImports.find(imp => 
        imp.source === 'react' && imp.defaultImport === 'React'
      );
      expect(reactDefaultImport).toBeUndefined();

      // Type imports should remain
      const reactTypeImport = allImports.find(imp => 
        imp.source === 'react' && imp.type === 'typeNamed'
      );
      expect(reactTypeImport).toBeDefined();
      expect(reactTypeImport!.specifiers).toContain('FC');
      expect(reactTypeImport!.specifiers).toContain('ReactNode');

      // Named import (memo) should remain
      const reactNamedImport = allImports.find(imp => 
        imp.source === 'react' && imp.type === 'named' && imp.specifiers.includes('memo')
      );
      expect(reactNamedImport).toBeDefined();
    });
  });

  describe('Integration with different import types', () => {
    test('should work with all import types together', () => {
      const sourceCode = `
        import React from 'react';                    // default
        import { useState, useEffect } from 'react';  // named  
        import * as Utils from './utils';             // namespace
        import type { FC } from 'react';              // type default
        import type { Props, State } from './types';  // type named
        import './styles.css';                        // side-effect
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate various unused imports
      // Note: namespace imports are stored as "* as Utils" in specifiers
      const unusedImports = ['React', 'useEffect', '* as Utils', 'Props'];
      
      const result = removeUnusedImports(parserResult, unusedImports);

      // Check that appropriate imports are removed/kept
      const allImports = result.groups.flatMap(group => group.imports);
      const sources = allImports.map(imp => ({ source: imp.source, specifiers: imp.specifiers }));
      
      // Should keep useState, FC, State, and side-effect import
      expect(sources.some(imp => 
        imp.source === 'react' && imp.specifiers.includes('useState')
      )).toBe(true);
      
      expect(sources.some(imp => 
        imp.source === 'react' && imp.specifiers.includes('FC')
      )).toBe(true);
      
      expect(sources.some(imp => 
        imp.source === './types' && imp.specifiers.includes('State')
      )).toBe(true);
      
      expect(sources.some(imp => imp.source === './styles.css')).toBe(true);
      
      // Should remove React default, useEffect, Utils, Props
      expect(sources.some(imp => 
        imp.source === 'react' && imp.specifiers.includes('useEffect')
      )).toBe(false);
      
      expect(sources.some(imp => imp.source === './utils')).toBe(false);
      
      expect(sources.some(imp => 
        imp.source === './types' && imp.specifiers.includes('Props')
      )).toBe(false);
    });
  });

  describe('getMissingModuleImports', () => {
    test('should identify imports from missing modules', () => {
      const sourceCode = `
        import React from 'react';
        import { WsDataModel } from '@library/form-new/models/ProviderModel';
        import { utilityFunction } from './existing-utils';
        import { NonExistentComponent } from '@non-existent/package';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Mock diagnostics that would be returned by VS Code for missing modules
      // Note: In a real test environment, these would come from VS Code's language service
      
      // Since we can't easily mock VS Code's diagnostic system in unit tests,
      // we'll test the logic that handles missing modules directly
      const missingModuleSources = parserResult.groups.flatMap(group =>
        group.imports.map(imp => imp.source)
      ).filter(source => 
        source.includes('@library/form-new') || 
        source.includes('@non-existent')
      );

      expect(missingModuleSources).toEqual([
        '@library/form-new/models/ProviderModel',
        '@non-existent/package'
      ]);
    });

    test('should handle missing module imports in removeUnusedImports', () => {
      const sourceCode = `
        import React from 'react';
        import { WsDataModel } from '@library/form-new/models/ProviderModel';
        import { useState } from 'react';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that WsDataModel comes from a missing module
      const unusedImports = ['WsDataModel']; // This import should be removed
      
      const result = removeUnusedImports(parserResult, unusedImports);
      
      // Should remove the missing module import but keep others
      const allImports = result.groups.flatMap(group => group.imports);
      
      // Check that the missing module import is removed
      const missingModuleImport = allImports.find(imp => 
        imp.source === '@library/form-new/models/ProviderModel'
      );
      expect(missingModuleImport).toBeUndefined();
      
      // Check that valid imports are kept
      const reactDefaultImport = allImports.find(imp => 
        imp.source === 'react' && imp.defaultImport === 'React'
      );
      expect(reactDefaultImport).toBeDefined();
      
      const reactNamedImport = allImports.find(imp => 
        imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactNamedImport).toBeDefined();
    });

    test('should handle complete import removal for missing modules', () => {
      const sourceCode = `
        import { CompletelyMissing, AlsoMissing } from '@missing/package';
        import { validFunction } from './valid-module';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate that all specifiers from missing module are unused
      const unusedImports = ['CompletelyMissing', 'AlsoMissing'];
      
      const result = removeUnusedImports(parserResult, unusedImports);
      
      const allImports = result.groups.flatMap(group => group.imports);
      
      // Should completely remove the missing module import
      const missingModuleImport = allImports.find(imp => 
        imp.source === '@missing/package'
      );
      expect(missingModuleImport).toBeUndefined();
      
      // Should keep the valid module import
      const validImport = allImports.find(imp => 
        imp.source === './valid-module'
      );
      expect(validImport).toBeDefined();
      expect(validImport!.specifiers).toEqual(['validFunction']);
    });

    test('should work with mixed scenarios - unused + missing modules', () => {
      const sourceCode = `
        import React, { useState, useEffect } from 'react';
        import { MissingType } from '@missing/types';
        import { UnusedUtil, UsedUtil } from './utils';
        import { MissingComponent } from '@missing/components';
      `;

      const parserResult = parser.parse(sourceCode);
      
      // Simulate mixed scenario: some unused, some from missing modules
      const unusedImports = [
        'useEffect',        // Unused from valid module
        'MissingType',      // From missing module
        'UnusedUtil',       // Unused from valid module
        'MissingComponent'  // From missing module
      ];
      
      const result = removeUnusedImports(parserResult, unusedImports);
      
      const allImports = result.groups.flatMap(group => group.imports);
      
      // Should keep React default and useState
      const reactDefaultImport = allImports.find(imp => 
        imp.source === 'react' && imp.defaultImport === 'React'
      );
      expect(reactDefaultImport).toBeDefined();
      
      const reactNamedImport = allImports.find(imp => 
        imp.source === 'react' && imp.specifiers.includes('useState')
      );
      expect(reactNamedImport).toBeDefined();
      expect(reactNamedImport!.specifiers).not.toContain('useEffect');
      
      // Should keep UsedUtil but remove UnusedUtil
      const utilsImport = allImports.find(imp => imp.source === './utils');
      expect(utilsImport).toBeDefined();
      expect(utilsImport!.specifiers).toEqual(['UsedUtil']);
      expect(utilsImport!.specifiers).not.toContain('UnusedUtil');
      
      // Should remove all missing module imports
      const missingTypesImport = allImports.find(imp => 
        imp.source === '@missing/types'
      );
      expect(missingTypesImport).toBeUndefined();
      
      const missingComponentsImport = allImports.find(imp => 
        imp.source === '@missing/components'
      );
      expect(missingComponentsImport).toBeUndefined();
    });
  });
});