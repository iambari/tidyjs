import { GroupMatcher } from '../../src/utils/group-matcher';
import * as logUtils from '../../src/utils/log';

// Mock the log utils
jest.mock('../../src/utils/log', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

describe('GroupMatcher Cache Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LRU Cache Behavior', () => {
    it('should cache group matches for performance', () => {
      const groups = [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'External', order: 1, match: /^[a-z]/, default: false },
        { name: 'Default', order: 2, default: true }
      ];

      const matcher = new GroupMatcher(groups);

      // First call should be a cache miss
      const result1 = matcher.getGroup('react');
      expect(result1).toBe('React');

      // Second call should be a cache hit
      const result2 = matcher.getGroup('react');
      expect(result2).toBe('React');

      const stats = matcher.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should implement LRU behavior by moving accessed items to end', () => {
      const groups = [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'Vue', order: 1, match: /^vue/, default: false },
        { name: 'Default', order: 2, default: true }
      ];

      const matcher = new GroupMatcher(groups);

      // Fill cache with entries
      matcher.getGroup('react');        // Cache: [react]
      matcher.getGroup('vue');          // Cache: [react, vue] 
      matcher.getGroup('angular');      // Cache: [react, vue, angular]

      // Access react again - should move to end
      matcher.getGroup('react');        // Cache: [vue, angular, react]

      const stats = matcher.getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.hits).toBe(1); // Only react hit
      expect(stats.misses).toBe(3); // react, vue, angular misses
    });

    it('should enforce cache size limit with LRU eviction', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      // Get the max cache size from the implementation
      const maxSize = (matcher.getCacheStats().maxSize); // Should be 500
      
      // Fill cache beyond capacity
      for (let i = 0; i < maxSize + 50; i++) {
        matcher.getGroup(`package-${i}`);
      }

      const stats = matcher.getCacheStats();
      
      // Cache should be under the max size due to eviction
      expect(stats.size).toBeLessThanOrEqual(maxSize);
      expect(stats.size).toBeGreaterThan(maxSize * 0.75); // Should have evicted ~20%
      
      // Should have logged eviction
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('GroupMatcher cache evicted')
      );
    });

    it('should evict approximately 20% of entries when at capacity', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      const maxSize = matcher.getCacheStats().maxSize;
      
      // Fill cache to capacity
      for (let i = 0; i < maxSize; i++) {
        matcher.getGroup(`package-${i}`);
      }

      expect(matcher.getCacheStats().size).toBe(maxSize);

      // Add one more entry to trigger eviction
      matcher.getGroup('trigger-eviction');
      
      const finalStats = matcher.getCacheStats();
      const expectedMinSize = Math.floor(maxSize * 0.8); // 80% of original
      
      expect(finalStats.size).toBeGreaterThanOrEqual(expectedMinSize);
      expect(finalStats.size).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses accurately', () => {
      const groups = [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'Default', order: 1, default: true }
      ];

      const matcher = new GroupMatcher(groups);

      // Generate some cache activity
      matcher.getGroup('react');     // miss
      matcher.getGroup('vue');       // miss  
      matcher.getGroup('react');     // hit
      matcher.getGroup('angular');   // miss
      matcher.getGroup('vue');       // hit
      matcher.getGroup('react');     // hit

      const stats = matcher.getCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBe(0.5); // 3/6 = 50%
      expect(stats.size).toBe(3);
    });

    it('should calculate hit rate correctly', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);

      // No requests yet
      expect(matcher.getCacheStats().hitRate).toBe(0);

      // All misses
      matcher.getGroup('package1');
      matcher.getGroup('package2');
      expect(matcher.getCacheStats().hitRate).toBe(0);

      // Add some hits
      matcher.getGroup('package1'); // hit
      matcher.getGroup('package1'); // hit
      
      const stats = matcher.getCacheStats();
      expect(stats.hitRate).toBe(0.5); // 2 hits out of 4 total
    });

    it('should provide comprehensive cache statistics', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      matcher.getGroup('test');
      matcher.getGroup('test'); // hit

      const stats = matcher.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });
  });

  describe('Cache Management Operations', () => {
    it('should clear cache and reset statistics', () => {
      const groups = [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'Default', order: 1, default: true }
      ];

      const matcher = new GroupMatcher(groups);

      // Generate some cache activity
      matcher.getGroup('react');
      matcher.getGroup('vue');
      matcher.getGroup('react'); // hit

      expect(matcher.getCacheStats().size).toBe(2);
      expect(matcher.getCacheStats().hits).toBe(1);

      // Clear cache
      matcher.clearCache();

      const stats = matcher.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);

      expect(logUtils.logDebug).toHaveBeenCalledWith('GroupMatcher cache cleared');
    });

    it('should dispose properly and log statistics', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      matcher.getGroup('test');
      expect(matcher.getCacheStats().size).toBe(1);

      // Dispose should clear everything
      matcher.dispose();

      const stats = matcher.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      expect(logUtils.logDebug).toHaveBeenCalledWith('GroupMatcher disposed');
    });

    it('should log cache statistics when requested', () => {
      const groups = [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'Default', order: 1, default: true }
      ];

      const matcher = new GroupMatcher(groups);

      // Generate some activity for statistics
      matcher.getGroup('react');
      matcher.getGroup('vue');
      matcher.getGroup('react'); // hit

      matcher.logCacheStats();

      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringMatching(/GroupMatcher cache stats: size=\d+\/\d+, hitRate=\d+\.\d+%, hits=\d+, misses=\d+/)
      );
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle large number of unique imports efficiently', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      const maxSize = matcher.getCacheStats().maxSize;
      
      // Simulate a large codebase with many unique imports
      const uniqueImports: string[] = [];
      for (let i = 0; i < maxSize * 2; i++) {
        uniqueImports.push(`@company/package-${i}/module-${i % 10}`);
      }

      // Process all imports
      uniqueImports.forEach(importPath => {
        matcher.getGroup(importPath);
      });

      const stats = matcher.getCacheStats();
      
      // Cache should be limited and contain recent imports
      expect(stats.size).toBeLessThanOrEqual(maxSize);
      expect(stats.misses).toBe(uniqueImports.length); // All unique = all misses
      expect(stats.hits).toBe(0);
    });

    it('should maintain performance with repeated access patterns', () => {
      const groups = [
        { name: 'React', order: 0, match: /^react/, default: false },
        { name: 'Lodash', order: 1, match: /^lodash/, default: false },
        { name: 'Default', order: 2, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      // Simulate typical development pattern: accessing same imports repeatedly
      const commonImports = ['react', 'react-dom', 'lodash', '@app/utils', './component'];
      
      // Access patterns: 10 rounds of the same imports
      for (let round = 0; round < 10; round++) {
        commonImports.forEach(importPath => {
          matcher.getGroup(importPath);
        });
      }

      const stats = matcher.getCacheStats();
      
      // After first round, everything should be cache hits
      expect(stats.size).toBe(commonImports.length);
      expect(stats.misses).toBe(commonImports.length); // First round misses
      expect(stats.hits).toBe(commonImports.length * 9); // 9 subsequent rounds hits
      expect(stats.hitRate).toBeGreaterThan(0.8); // Should be ~90% hit rate
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty import sources', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      const result1 = matcher.getGroup('');
      const result2 = matcher.getGroup('');
      
      expect(result1).toBe('Default');
      expect(result2).toBe('Default');
      
      const stats = matcher.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
    });

    it('should handle very long import paths', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      const longPath = 'a'.repeat(1000) + '/' + 'b'.repeat(1000);
      
      const result1 = matcher.getGroup(longPath);
      const result2 = matcher.getGroup(longPath);
      
      expect(result1).toBe('Default');
      expect(result2).toBe('Default');
      
      const stats = matcher.getCacheStats();
      expect(stats.hits).toBe(1);
    });

    it('should handle special characters in import paths', () => {
      const groups = [
        { name: 'Default', order: 0, default: true }
      ];

      const matcher = new GroupMatcher(groups);
      
      const specialPaths = [
        '@scoped/package-name',
        './file with spaces.js',
        '../../../deep/relative/path',
        'package@version/module',
        'file.name.with.dots'
      ];

      specialPaths.forEach(path => {
        const result = matcher.getGroup(path);
        expect(result).toBe('Default');
      });

      expect(matcher.getCacheStats().size).toBe(specialPaths.length);
    });
  });
});