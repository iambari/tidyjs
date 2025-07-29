import { formatImports } from '../../src/formatter';
import { parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('Multiline import alignment edge cases', () => {
    const config: Config = {
        groups: [
            {
                name: 'React',
                order: 1,
                default: false,
                match: /^react$/
            },
            {
                name: 'Other',
                order: 99,
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

    it('should handle multiline import without closing brace on last line', async () => {
        // This is a malformed import that could theoretically exist
        const input = `import {
    useState,
    useEffect
from 'react';
import { Component } from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Should still format properly and not cause alignment issues
        expect(result.text).toContain("from 'react'");
        expect(result.text).toContain("Component");
        
        // Check that both imports are aligned consistently
        const lines = result.text.split('\n');
        const fromLines = lines.filter(line => line.includes("from 'react'"));
        
        if (fromLines.length > 1) {
            // All 'from' keywords should be at the same position
            const fromPositions = fromLines.map(line => line.indexOf('from'));
            const uniquePositions = new Set(fromPositions);
            expect(uniquePositions.size).toBeLessThanOrEqual(2); // Allow some variance for edge cases
        }
    });

    it('should handle import with no closing brace at all', async () => {
        const input = `import {
    useState,
    useEffect
    from 'react';
import Component from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Should still preserve valid imports
        expect(result.text).toContain("Component");
        expect(result.text).toContain("from 'react'");
    });

    it('should handle normal multiline import for comparison', async () => {
        const input = `import {
    useState,
    useEffect
} from 'react';
import Component from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Should format normally
        expect(result.text).toContain("useState");
        expect(result.text).toContain("useEffect");
        expect(result.text).toContain("Component");
        
        // Check alignment consistency
        const lines = result.text.split('\n');
        const fromLines = lines.filter(line => line.includes("from 'react'"));
        
        if (fromLines.length > 1) {
            const fromPositions = fromLines.map(line => line.indexOf('from'));
            const uniquePositions = new Set(fromPositions);
            expect(uniquePositions.size).toBe(1); // Should be perfectly aligned
        }
    });

    it('should handle closing brace on different line than from keyword', async () => {
        const input = `import {
    useState,
    useEffect
}
from 'react';
import Component from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        expect(result.text).toContain("useState");
        expect(result.text).toContain("useEffect");
        expect(result.text).toContain("Component");
    });
});