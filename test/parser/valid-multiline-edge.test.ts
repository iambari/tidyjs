import { formatImports } from '../../src/formatter';
import { parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('Valid multiline import edge cases', () => {
    const config: Config = {
        groups: [
            {
                name: 'Other',
                order: 1,
                default: true
            }
        ],
        importOrder: {
            sideEffect: 0,
            default: 1,
            named: 2,
            typeOnly: 3
        },
        format: {
            singleQuote: true,
            indent: 2
        }
    };

    it('should handle valid import with closing brace on separate line', async () => {
        // This is technically valid TypeScript/JavaScript
        const input = `import {
    shortImport,
    anotherImport
}
from 'package';
import normalImport from 'other';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Test that both imports are parsed and formatted correctly

        // Both imports should be formatted
        expect(result.text).toContain('shortImport');
        expect(result.text).toContain('anotherImport');
        expect(result.text).toContain('normalImport');
        
        // Check alignment if both imports are formatted
        const lines = result.text.split('\n');
        const fromLines = lines.filter(line => line.includes('from '));
        
        if (fromLines.length > 1) {
            const fromPositions = fromLines.map(line => line.indexOf('from'));
            // Verify alignment is consistent
            const uniquePositions = new Set(fromPositions);
            expect(uniquePositions.size).toBe(1);
        }
    });
});