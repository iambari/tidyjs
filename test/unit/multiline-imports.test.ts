const fs = require('fs');
const path = require('path');
const tidyjsParser = require('tidyjs-parser');
const formatter = require('../../src/formatter');
const constant = require('../constant');

describe('multiline imports', () => {
    test('correctly formats multiline imports', () => {
        const inputPath = path.join(__dirname, '../fixtures/input/multiline-import.tsx');
        const expectedPath = path.join(__dirname, '../fixtures/expected/multiline-import.tsx');
        
        const input = fs.readFileSync(inputPath, 'utf8');
        const expected = fs.readFileSync(expectedPath, 'utf8');

        const config = constant.createMockConfig();
        const parser = new tidyjsParser.ImportParser({
            importGroups: config.importGroups,
            typeOrder: config.typeOrder,
            patterns: config.patterns
        });
        
        const parserResult = parser.parse(input);
        const importRange = { start: 0, end: input.length };
        const result = formatter.formatImportsFromParser(input, importRange, parserResult, config);

        // Normaliser la sortie en supprimant les lignes vides finales
        const normalizedResult = result.trimEnd();
        const normalizedExpected = expected.trimEnd();
        
        expect(normalizedResult).toBe(normalizedExpected);
    });
});
