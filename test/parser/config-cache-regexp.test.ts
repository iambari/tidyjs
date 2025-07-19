import { ConfigCache } from '../../src/utils/config-cache';
import { Config } from '../../src/types';

describe('ConfigCache - RegExp Serialization Bug', () => {
  let configCache: ConfigCache;

  beforeEach(() => {
    configCache = new ConfigCache();
  });

  test('demonstrate RegExp serialization bug with JSON.stringify', () => {
    // This test demonstrates the core issue
    const regexPattern = /^react$/;
    const anotherPattern = /^lodash$/;
    
    console.log('Original RegExp:', regexPattern);
    console.log('JSON.stringify(RegExp):', JSON.stringify(regexPattern));
    console.log('Serialized as:', JSON.stringify({ pattern: regexPattern }));
    
    // The bug: JSON.stringify turns RegExp into empty objects
    expect(JSON.stringify(regexPattern)).toBe('{}');
    expect(JSON.stringify({ pattern: regexPattern })).toBe('{"pattern":{}}');
    
    // Different RegExp patterns serialize to the same empty object
    expect(JSON.stringify(regexPattern)).toBe(JSON.stringify(anotherPattern));
    
    // This proves the cache key will be identical for different RegExp patterns!
  });

  test('should correctly detect config changes when RegExp patterns change - BUG FIXED', () => {
    const baseConfig: Config = {
      groups: [
        {
          name: 'React',
          order: 1,
          isDefault: false,
          match: /^react$/ // First pattern
        },
        {
          name: 'Default',
          order: 2,
          isDefault: true
        }
      ],
      importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 0
      }
    };

    const modifiedConfig: Config = {
      groups: [
        {
          name: 'React',
          order: 1,
          isDefault: false,
          match: /^vue$/ // Different pattern - should invalidate cache!
        },
        {
          name: 'Default',
          order: 2,
          isDefault: true
        }
      ],
      importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 0
      }
    };

    let loadCallCount = 0;
    let validateCallCount = 0;

    const mockLoad = () => {
      loadCallCount++;
      return loadCallCount === 1 ? baseConfig : modifiedConfig;
    };

    const mockValidate = () => {
      validateCallCount++;
      return { isValid: true, errors: [] };
    };

    // First call - should load and validate
    const result1 = configCache.getConfig(mockLoad, mockValidate);
    expect(loadCallCount).toBe(1);
    expect(validateCallCount).toBe(1);
    expect(result1.config.groups[0].match?.source).toBe('^react$');

    // Second call with different RegExp - should detect change but WON'T due to bug
    const result2 = configCache.getConfig(mockLoad, mockValidate);
    
    // BUG FIXED: Cache now properly detects RegExp changes
    expect(loadCallCount).toBe(2); // ✅ Load is called (it always loads)
    expect(validateCallCount).toBe(2); // ✅ Fixed - validation called again because cache detects change
    expect(result2.config.groups[0].match?.source).toBe('^vue$'); // ✅ Fixed - returns correct new pattern
  });

  test('should properly cache when non-RegExp config changes', () => {
    const baseConfig: Config = {
      groups: [
        {
          name: 'React',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'Default',
          order: 2,
          isDefault: true
        }
      ],
      importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 0
      }
    };

    const modifiedConfig: Config = {
      groups: [
        {
          name: 'React',
          order: 1,
          isDefault: false,
          match: /^react$/ // Same pattern
        },
        {
          name: 'Default',
          order: 3, // Different order - should invalidate cache
          isDefault: true
        }
      ],
      importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 0
      }
    };

    let loadCallCount = 0;
    let validateCallCount = 0;

    const mockLoad = () => {
      loadCallCount++;
      return loadCallCount === 1 ? baseConfig : modifiedConfig;
    };

    const mockValidate = () => {
      validateCallCount++;
      return { isValid: true, errors: [] };
    };

    // First call
    const result1 = configCache.getConfig(mockLoad, mockValidate);
    expect(loadCallCount).toBe(1);
    expect(validateCallCount).toBe(1);
    expect(result1.config.groups[1].order).toBe(2);

    // Second call with different non-RegExp config - should properly detect change
    const result2 = configCache.getConfig(mockLoad, mockValidate);
    expect(loadCallCount).toBe(2);
    expect(validateCallCount).toBe(2); // Should properly invalidate cache
    expect(result2.config.groups[1].order).toBe(3);
  });

  test('should use cache when config is truly identical', () => {
    const config: Config = {
      groups: [
        {
          name: 'React',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'Default',
          order: 2,
          isDefault: true
        }
      ],
      importOrder: {
        default: 1,
        named: 2,
        typeOnly: 3,
        sideEffect: 0
      }
    };

    let loadCallCount = 0;
    let validateCallCount = 0;

    const mockLoad = () => {
      loadCallCount++;
      return config; // Always return same config
    };

    const mockValidate = () => {
      validateCallCount++;
      return { isValid: true, errors: [] };
    };

    // First call
    configCache.getConfig(mockLoad, mockValidate);
    expect(loadCallCount).toBe(1);
    expect(validateCallCount).toBe(1);

    // Second call with identical config - should use cache
    configCache.getConfig(mockLoad, mockValidate);
    expect(loadCallCount).toBe(2); // Load is always called
    expect(validateCallCount).toBe(1); // Validation should be cached
  });

  test('demonstrate correct RegExp serialization approach', () => {
    const config1 = {
      groups: [{ match: /^react$/ }]
    };

    const config2 = {
      groups: [{ match: /^vue$/ }]
    };

    // Current broken approach
    const brokenSerialization1 = JSON.stringify(config1);
    const brokenSerialization2 = JSON.stringify(config2);
    
    console.log('Broken serialization 1:', brokenSerialization1);
    console.log('Broken serialization 2:', brokenSerialization2);
    expect(brokenSerialization1).toBe(brokenSerialization2); // They're identical!

    // Correct approach - custom serialization
    const correctSerialization = (obj: any): string => {
      return JSON.stringify(obj, (key, value) => {
        if (value instanceof RegExp) {
          return `__REGEXP__${value.source}__FLAGS__${value.flags}`;
        }
        return value;
      });
    };

    const correctSerialization1 = correctSerialization(config1);
    const correctSerialization2 = correctSerialization(config2);
    
    console.log('Correct serialization 1:', correctSerialization1);
    console.log('Correct serialization 2:', correctSerialization2);
    expect(correctSerialization1).not.toBe(correctSerialization2); // Now they're different!
  });
});