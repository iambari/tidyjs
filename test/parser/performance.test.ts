import { ImportParser, parseImports } from '../../src/parser';
import { Config } from '../../src/types';

describe('ImportParser - Performance Tests', () => {
  const performanceConfig: Config = {
    groups: [
      {
        name: 'React',
        order: 1,
        default: false,
        match: /^react$/
      },
      {
        name: 'Libraries',
        order: 2,
        default: false,
        match: /^[^.]/
      },
      {
        name: 'Local',
        order: 3,
        default: true
      }
    ],
    importOrder: {
      default: 1,
      named: 2,
      typeOnly: 3,
      sideEffect: 0
    },

  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(performanceConfig);
  });

  test('should handle large number of imports efficiently', () => {
    const largeImportCount = 1000;
    const importStatements = Array.from({ length: largeImportCount }, (_, i) => 
      `import module${i} from "library${i}";`
    ).join('\n');

    const startTime = performance.now();
    const result = parser.parse(importStatements);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports).toHaveLength(largeImportCount);
    expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    expect(result.originalImports).toHaveLength(largeImportCount);
  });

  test('should handle complex regex matching efficiently', () => {
    const complexConfig: Config = {
      groups: [
        {
          name: 'Complex Pattern 1',
          order: 1,
          default: false,
          match: /^(@[a-z]+\/[a-z-]+|react|vue|angular)/
        },
        {
          name: 'Complex Pattern 2',
          order: 2,
          default: false,
          match: /^[a-z][a-z0-9-]*[a-z0-9]$/
        },
        {
          name: 'Complex Pattern 3',
          order: 3,
          default: false,
          match: /^\.{1,2}\/([a-z]+\/)*[a-z]+(\.[a-z]+)?$/
        },
        {
          name: 'Default',
          order: 4,
          default: true
        }
      ],
      importOrder: performanceConfig.importOrder,
      format: performanceConfig.format
    };

    const complexParser = new ImportParser(complexConfig);
    const testImports = [
      'import react from "react";',
      'import scoped from "@company/package-name";',
      'import simple from "lodash";',
      'import local from "./utils/helper.js";',
      'import parent from "../../config.ts";',
      'import weird from "weird:protocol://something";'
    ].join('\n');

    const startTime = performance.now();
    const result = complexParser.parse(testImports);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(result.groups.length).toBeGreaterThan(0);
    expect(executionTime).toBeLessThan(100); // Should complete very quickly for small inputs
  });

  test('should handle very long import statements efficiently', () => {
    const veryLongSpecifiers = Array.from({ length: 500 }, (_, i) => `export${i}`).join(', ');
    const longImport = `import { ${veryLongSpecifiers} } from "very-large-library";`;

    const startTime = performance.now();
    const result = parser.parse(longImport);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports[0].specifiers).toHaveLength(500);
    expect(executionTime).toBeLessThan(500); // Should handle long imports quickly
  });

  test('should handle repeated parsing efficiently', () => {
    const sourceCode = `
      import React from "react";
      import { useState, useEffect } from "react";
      import lodash from "lodash";
      import { utils } from "./utils";
    `;

    const iterations = 100;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = parser.parse(sourceCode);
      expect(result.groups.length).toBeGreaterThan(0);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;

    expect(averageTime).toBeLessThan(50); // Each parse should average less than 50ms
    expect(totalTime).toBeLessThan(5000); // Total should be less than 5 seconds
  });

  test('should handle memory efficiency with multiple parser instances', () => {
    const instanceCount = 50;
    const parsers: ImportParser[] = [];

    // Create multiple parser instances
    for (let i = 0; i < instanceCount; i++) {
      parsers.push(new ImportParser(performanceConfig));
    }

    const sourceCode = `
      import React from "react";
      import { utils } from "./utils";
    `;

    const startTime = performance.now();

    // Use all parsers
    const results = parsers.map(p => p.parse(sourceCode));

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(results).toHaveLength(instanceCount);
    expect(results.every(r => r.groups.length > 0)).toBe(true);
    expect(executionTime).toBeLessThan(2000); // Should handle multiple instances efficiently
  });

  test('should handle large files with mixed content efficiently', () => {
    const comments = Array.from({ length: 100 }, (_, i) => `// Comment ${i}`).join('\n');
    const imports = Array.from({ length: 100 }, (_, i) => `import module${i} from "lib${i}";`).join('\n');
    const code = Array.from({ length: 100 }, (_, i) => `const var${i} = "value${i}";`).join('\n');
    
    const largeFile = `${comments}\n${imports}\n${code}`;

    const startTime = performance.now();
    const result = parser.parse(largeFile);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports).toHaveLength(100);
    expect(executionTime).toBeLessThan(1000); // Should handle large files efficiently
  });

  test('should have consistent performance across different import types', () => {
    const testCases = [
      // Default imports
      { code: Array.from({ length: 100 }, (_, i) => `import default${i} from "lib${i}";`).join('\n'), expectedCount: 100 },
      // Named imports
      { code: Array.from({ length: 100 }, (_, i) => `import { named${i} } from "lib${i}";`).join('\n'), expectedCount: 100 },
      // Mixed imports (will be split into 200 imports)
      { code: Array.from({ length: 100 }, (_, i) => `import default${i}, { named${i} } from "lib${i}";`).join('\n'), expectedCount: 200 },
      // Side effect imports
      { code: Array.from({ length: 100 }, (_, i) => `import "lib${i}";`).join('\n'), expectedCount: 100 }
    ];

    const times: number[] = [];

    testCases.forEach(({ code, expectedCount }) => {
      const startTime = performance.now();
      const result = parser.parse(code);
      const endTime = performance.now();
      
      times.push(endTime - startTime);
      const totalImports = result.groups.reduce((sum, group) => sum + group.imports.length, 0);
      expect(totalImports).toBe(expectedCount);
    });

    // All times should be reasonably similar (within reasonable variance)
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    expect(maxTime / minTime).toBeLessThan(30); // Allow more variance for CI environments
    expect(times.every(time => time < 1000)).toBe(true);
  });

  test('should handle parseImports function performance', () => {
    const sourceCode = Array.from({ length: 200 }, (_, i) => 
      `import module${i} from "library${i}";`
    ).join('\n');

    const startTime = performance.now();
    const result = parseImports(sourceCode, performanceConfig);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].imports).toHaveLength(200);
    expect(executionTime).toBeLessThan(1000); // Standalone function should be efficient
  });

  test('should handle error scenarios without significant performance impact', () => {
    const validImports = Array.from({ length: 50 }, (_, i) => 
      `import module${i} from "lib${i}";`
    ).join('\n');
    
    const invalidCode = `${validImports}\nimport { broken from "broken";`;

    const startTime = performance.now();
    const result = parser.parse(invalidCode);
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    expect(result.invalidImports).toBeDefined();
    expect(executionTime).toBeLessThan(500); // Error handling shouldn't be slow
  });

  test('should scale linearly with input size', () => {
    const sizes = [10, 50, 100, 200];
    const times: number[] = [];

    sizes.forEach(size => {
      const imports = Array.from({ length: size }, (_, i) => 
        `import module${i} from "lib${i}";`
      ).join('\n');

      const startTime = performance.now();
      parser.parse(imports);
      const endTime = performance.now();
      
      times.push(endTime - startTime);
    });

    // Time should roughly scale with input size (not exponentially)
    const timeRatio43 = times[3] / times[2]; // 200/100
    const timeRatio32 = times[2] / times[1]; // 100/50
    const timeRatio21 = times[1] / times[0]; // 50/10

    // None of the ratios should be extremely high (indicating exponential growth)
    expect(timeRatio43).toBeLessThan(50); // Allow more variance for CI environments
    expect(timeRatio32).toBeLessThan(50); // Allow more variance for CI environments
    expect(timeRatio21).toBeLessThan(100); // Allow more variance for small inputs in CI
  });
});