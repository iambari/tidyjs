import { formatImports } from '../../src/formatter';
import { parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('Inline multiline comments handling', () => {
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

    it('should preserve lines with inline multiline comments', async () => {
        const input = `import React from 'react'; /* some comment */ import { useState } from 'react';
import { useEffect } from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Should preserve both imports even with inline comment
        expect(result.text).toContain("import React");
        expect(result.text).toContain("from 'react'");
        expect(result.text).toContain("useState");
        expect(result.text).toContain("useEffect");
    });

    it('should handle inline comments at different positions', async () => {
        const input = `/* start comment */ import React from 'react'; /* middle comment */
import { Component } /* inline comment */ from 'react';
import PropTypes from 'prop-types'; /* end comment */`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Should preserve all imports even with inline comments
        expect(result.text).toContain("import React");
        expect(result.text).toContain("from 'react'");
        expect(result.text).toContain("Component");
        expect(result.text).toContain("PropTypes");
        expect(result.text).toContain("from 'prop-types'");
    });

    it('should handle multiple inline comments on same line', async () => {
        const input = `import /* comment1 */ React /* comment2 */ from /* comment3 */ 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        expect(result.text).toContain("import React");
        expect(result.text).toContain("from 'react'");
    });

    it('should differentiate between inline and multiline comments', async () => {
        const input = `import React from 'react';
/* This is a 
   multiline comment
   that should be removed */
import { useState } from 'react';
import { useEffect } from 'react'; /* inline comment */`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        expect(result.text).toContain("import React");
        expect(result.text).toContain("from 'react'");
        expect(result.text).toContain("useState");
        expect(result.text).toContain("useEffect");
        expect(result.text).not.toContain("multiline comment");
    });

    it('should handle edge case where inline comment contains code-like text', async () => {
        const input = `import React from 'react'; /* import fake from 'fake'; */
import { Component } from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        expect(result.text).toContain("import React");
        expect(result.text).toContain("Component");
        expect(result.text).not.toContain("fake");
    });

    it('should preserve lines with inline comments in cleanUpLines', async () => {
        const input = `import React from 'react';
/* inline comment */ import { Component } from 'react';
import { useState } from 'react';`;

        const parserResult = parseImports(input, config);
        const result = await formatImports(input, config, parserResult);

        // Check that all imports are preserved
        expect(result.text).toContain("import React");
        expect(result.text).toContain("Component");
        expect(result.text).toContain("useState");
        expect(result.text).toContain("from 'react'");
    });
});