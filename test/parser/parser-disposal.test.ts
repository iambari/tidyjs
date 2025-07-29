import { ImportParser } from '../../src/parser';
import * as logUtils from '../../src/utils/log';

// Mock the log utils
jest.mock('../../src/utils/log', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

describe('Parser Disposal and Resource Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Parser Disposal', () => {
    it('should dispose parser and clean up GroupMatcher cache', () => {
      const config = {
        groups: [
          { name: 'React', order: 0, match: /^react/, default: false },
          { name: 'Default', order: 1, default: true }
        ],
        importOrder: {
          default: 0,
          named: 1,
          typeOnly: 2,
          sideEffect: 3
        }
      };

      const parser = new ImportParser(config);
      
      // Use the parser to populate cache
      const sourceCode = `
        import React from 'react';
        import { useState } from 'react';
        import axios from 'axios';
      `;
      
      parser.parse(sourceCode);
      
      // Verify cache has entries
      const groupMatcher = parser.getGroupMatcher();
      const initialStats = groupMatcher.getCacheStats();
      expect(initialStats.size).toBeGreaterThan(0);

      // Dispose parser
      parser.dispose();

      // Verify cache is cleared
      const finalStats = groupMatcher.getCacheStats();
      expect(finalStats.size).toBe(0);
      expect(finalStats.hits).toBe(0);
      expect(finalStats.misses).toBe(0);

      expect(logUtils.logDebug).toHaveBeenCalledWith('GroupMatcher disposed');
    });

    it('should allow accessing GroupMatcher for cache management', () => {
      const config = {
        groups: [
          { name: 'Default', order: 0, default: true }
        ],
        importOrder: {
          default: 0,
          named: 1,
          typeOnly: 2,
          sideEffect: 3
        }
      };

      const parser = new ImportParser(config);
      const groupMatcher = parser.getGroupMatcher();
      
      expect(groupMatcher).toBeDefined();
      expect(typeof groupMatcher.getCacheStats).toBe('function');
      expect(typeof groupMatcher.clearCache).toBe('function');
      expect(typeof groupMatcher.dispose).toBe('function');
    });

    it('should handle multiple dispose calls safely', () => {
      const config = {
        groups: [
          { name: 'Default', order: 0, default: true }
        ],
        importOrder: {
          default: 0,
          named: 1,
          typeOnly: 2,
          sideEffect: 3
        }
      };

      const parser = new ImportParser(config);
      
      // Parse some code to populate cache
      parser.parse('import test from "test";');
      
      // Multiple dispose calls should not throw
      expect(() => {
        parser.dispose();
        parser.dispose();
        parser.dispose();
      }).not.toThrow();

      // Cache should remain empty
      const stats = parser.getGroupMatcher().getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should prevent unbounded cache growth with many unique imports', () => {
      const config = {
        groups: [
          { name: 'Default', order: 0, default: true }
        ],
        importOrder: {
          default: 0,
          named: 1,
          typeOnly: 2,
          sideEffect: 3
        }
      };

      const parser = new ImportParser(config);
      const groupMatcher = parser.getGroupMatcher();
      const maxSize = groupMatcher.getCacheStats().maxSize;

      // Generate source code with many unique imports (simulating large codebase)
      const imports = [];
      for (let i = 0; i < maxSize + 100; i++) {
        imports.push(`import pkg${i} from 'package-${i}';`);
      }
      
      const sourceCode = imports.join('\n');
      
      // Parse the large file
      parser.parse(sourceCode);
      
      // Cache should be limited
      const stats = groupMatcher.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(maxSize);
      
      // Should have triggered eviction
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('GroupMatcher cache evicted')
      );
    });

    it('should simulate extension lifecycle with configuration changes', () => {
      // Simulate extension lifecycle with configuration changes
      const createParser = (configVersion: number) => {
        return new ImportParser({
          groups: [
            { name: `Config${configVersion}`, order: 0, default: true }
          ],
          importOrder: {
            default: 0,
            named: 1,
            typeOnly: 2,
            sideEffect: 3
          }
        });
      };

      const sampleCode = `
        import React from 'react';
        import { useState } from 'react';
        import axios from 'axios';
      `;

      // Simulate multiple configuration changes
      for (let i = 1; i <= 5; i++) {
        const parser = createParser(i);
        
        // Use parser
        parser.parse(sampleCode);
        
        // Verify cache has entries
        const stats = parser.getGroupMatcher().getCacheStats();
        expect(stats.size).toBeGreaterThan(0);
        
        // Dispose (simulating configuration change)
        parser.dispose();
        
        // Verify cleanup
        const finalStats = parser.getGroupMatcher().getCacheStats();
        expect(finalStats.size).toBe(0);
      }

      // Should have logged disposal for each parser
      const disposalCalls = (logUtils.logDebug as jest.Mock).mock.calls.filter(
        call => call[0] === 'GroupMatcher disposed'
      );
      expect(disposalCalls).toHaveLength(5);
    });

    it('should handle parser recreation scenario properly', () => {
      const config1 = {
        groups: [
          { name: 'Old', order: 0, default: true }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const config2 = {
        groups: [
          { name: 'New', order: 0, default: true }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      // Create first parser
      const parser1 = new ImportParser(config1);
      parser1.parse('import test from "test";');
      
      const stats1 = parser1.getGroupMatcher().getCacheStats();
      expect(stats1.size).toBe(1);

      // Dispose old parser (simulating config change)
      parser1.dispose();
      
      // Create new parser
      const parser2 = new ImportParser(config2);
      parser2.parse('import test from "test";');

      // Both parsers should work independently
      const finalStats1 = parser1.getGroupMatcher().getCacheStats();
      const stats2 = parser2.getGroupMatcher().getCacheStats();
      
      expect(finalStats1.size).toBe(0); // Old parser cleared
      expect(stats2.size).toBe(1);      // New parser working

      // Clean up
      parser2.dispose();
    });
  });

  describe('Cache Statistics Monitoring', () => {
    it('should track cache performance across parsing sessions', () => {
      const config = {
        groups: [
          { name: 'React', order: 0, match: /^react/, default: false },
          { name: 'External', order: 1, match: /^[a-z]/, default: false },
          { name: 'Default', order: 2, default: true }
        ],
        importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 }
      };

      const parser = new ImportParser(config);
      const groupMatcher = parser.getGroupMatcher();

      // First parsing session
      parser.parse(`
        import React from 'react';
        import axios from 'axios';
        import { utils } from './utils';
      `);

      const stats1 = groupMatcher.getCacheStats();
      expect(stats1.misses).toBe(3); // All new imports
      expect(stats1.hits).toBe(0);

      // Second parsing session with repeated imports
      parser.parse(`
        import React from 'react';        // cache hit
        import { useState } from 'react';  // cache hit for 'react'
        import lodash from 'lodash';       // cache miss
      `);

      const stats2 = groupMatcher.getCacheStats();
      expect(stats2.hits).toBeGreaterThan(stats1.hits);
      expect(stats2.misses).toBeGreaterThan(stats1.misses);
      expect(stats2.hitRate).toBeGreaterThan(0);

      // Log cache statistics
      groupMatcher.logCacheStats();
      
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringMatching(/GroupMatcher cache stats:/)
      );
    });
  });
});