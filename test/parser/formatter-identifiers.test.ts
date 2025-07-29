import { formatImports } from '../../src/formatter';
import { parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('Formatter - JavaScript Identifier Preservation', () => {
    const config: Config = {
        groups: [
            {
                name: 'Libraries',
                order: 1,
                default: false,
                match: /^[a-zA-Z]/
            },
            {
                name: 'Other',
                order: 99,
                default: true
            }
        ],
        importOrder: {
            sideEffect: 1,
            default: 2,
            named: 3,
            typeOnly: 4
        }
    };

    test('should preserve valid JavaScript identifiers with digits', async () => {
        const input = `import import2 from 'library2';
import lib3utils from 'lib3utils';
import { config4, helper5 } from 'utils5';
import axios2 from 'axios2';`;

        const parsedImports = parseImports(input, config);
        const result = await formatImports(input, config, parsedImports);
        
        // The key test: verify identifiers aren't broken by spaces
        expect(result.text).toContain('import2');
        expect(result.text).toContain('lib3utils');
        expect(result.text).toContain('config4');
        expect(result.text).toContain('helper5');
        expect(result.text).toContain('axios2');
        
        // Verify broken identifiers don't exist
        expect(result.text).not.toContain('import 2');
        expect(result.text).not.toContain('lib 3utils');
        expect(result.text).not.toContain('config 4');
        expect(result.text).not.toContain('helper 5');
        expect(result.text).not.toContain('axios 2');
    });

    test('should not break valid JavaScript variable names', async () => {
        const input = `import import2test from 'import2test';
import var123abc from 'var123abc';
import { func456def, class789ghi } from 'complex-names';`;

        const parsedImports = parseImports(input, config);
        const result = await formatImports(input, config, parsedImports);
        
        // The most important test: verify no spaces were inserted in the identifiers
        expect(result.text).toContain('import2test');
        expect(result.text).toContain('var123abc');
        expect(result.text).toContain('func456def');
        expect(result.text).toContain('class789ghi');
        
        // Verify the regex pattern is NOT breaking valid identifiers
        expect(result.text).not.toContain('import 2test');
        expect(result.text).not.toContain('var 123abc');
        expect(result.text).not.toContain('func 456def');
        expect(result.text).not.toContain('class 789ghi');
        
        // Also check that it doesn't break common patterns
        expect(result.text).not.toContain('config 4');
        expect(result.text).not.toContain('helper 5');
        expect(result.text).not.toContain('axios 2');
        expect(result.text).not.toContain('lib 3utils');
    });
});