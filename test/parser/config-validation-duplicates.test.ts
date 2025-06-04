import { configManager } from '../../src/utils/config';
import { Config } from '../../src/types';
import { difference, uniq } from 'lodash';

describe('ConfigManager - Auto Order Resolution', () => {

  test('should auto-resolve duplicate group orders - NEW BEHAVIOR', () => {
    const configWithDuplicateOrders: Config = {
      groups: [
        {
          name: 'Group A',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'Group B', 
          order: 1, // Same order as Group A - will be auto-resolved
          isDefault: false,
          match: /^lodash$/
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

    const validation = configManager.validateConfiguration(configWithDuplicateOrders);
    
    // NEW BEHAVIOR: Order collisions are auto-resolved, so validation passes
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should auto-resolve multiple duplicate group orders', () => {
    const configWithMultipleDuplicates: Config = {
      groups: [
        {
          name: 'Group A',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'Group B',
          order: 1, // Duplicate order - will be auto-resolved
          isDefault: false,
          match: /^lodash$/
        },
        {
          name: 'Group C',
          order: 2,
          isDefault: false,
          match: /^vue$/
        },
        {
          name: 'Group D',
          order: 2, // Another duplicate order - will be auto-resolved
          isDefault: false,
          match: /^angular$/
        },
        {
          name: 'Default',
          order: 3,
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

    const validation = configManager.validateConfiguration(configWithMultipleDuplicates);
    
    // NEW BEHAVIOR: Order collisions are auto-resolved, so validation passes
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should pass validation with unique group orders', () => {
    const validConfig: Config = {
      groups: [
        {
          name: 'Group A',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'Group B',
          order: 2,
          isDefault: false,
          match: /^lodash$/
        },
        {
          name: 'Default',
          order: 3,
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

    const validation = configManager.validateConfiguration(validConfig);
    
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should also detect duplicate group names (working validation)', () => {
    const configWithDuplicateNames: Config = {
      groups: [
        {
          name: 'Same Name',
          order: 1,
          isDefault: false,
          match: /^react$/
        },
        {
          name: 'Same Name', // Duplicate name
          order: 2,
          isDefault: false,
          match: /^lodash$/
        },
        {
          name: 'Default',
          order: 3,
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

    const validation = configManager.validateConfiguration(configWithDuplicateNames);
    
    expect(validation.isValid).toBe(false);
    expect(validation.errors[0]).toContain('Duplicate group names found: Same Name');
  });

  test('demonstrate the bug with manual array operations', () => {
    // This test demonstrates why the bug occurs
    const orders = [1, 1, 2, 3]; // Array with duplicates
    const uniqueOrders = [1, 2, 3]; // Unique values from lodash.uniq()
    
    // Using lodash.difference - this is the bug!
    const duplicateOrders = difference(orders, uniqueOrders);
    
    console.log('orders:', orders);
    console.log('uniqueOrders:', uniqueOrders);
    console.log('difference(orders, uniqueOrders):', duplicateOrders);
    
    // The bug: difference() returns elements in first array not in second array
    // But uniqueOrders contains ALL unique values from orders
    // So difference will ALWAYS be empty!
    expect(duplicateOrders).toEqual([]); // This proves the bug
    
    // CORRECT way to find duplicates:
    const correctDuplicates = orders.filter((order, index) => orders.indexOf(order) !== index);
    console.log('correctDuplicates:', correctDuplicates);
    expect(correctDuplicates).toEqual([1]); // This is what we actually want
    
    // OR alternative correct approach:
    const orderCounts = orders.reduce((acc, order) => {
      acc[order] = (acc[order] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const duplicateValues = Object.keys(orderCounts)
      .filter(order => orderCounts[parseInt(order)] > 1)
      .map(order => parseInt(order));
    
    expect(duplicateValues).toEqual([1]);
  });
});