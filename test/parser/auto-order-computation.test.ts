import { configManager } from '../../src/utils/config';
import * as logUtils from '../../src/utils/log';

// Mock the log utils
jest.mock('../../src/utils/log', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  showOutputChannel: jest.fn(),
  clearLogs: jest.fn(),
}));

describe('Auto Order Computation', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('computeAutoOrder', () => {
    // Access the private method for testing
    const computeAutoOrder = (configManager as any).computeAutoOrder.bind(configManager);

    it('should handle groups with no order conflicts', () => {
      const groups = [
        { name: 'react', order: 1, isDefault: false },
        { name: 'lodash', order: 2, isDefault: false },
        { name: 'utils', order: 3, isDefault: false },
      ];

      const result = computeAutoOrder(groups);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ name: 'react', order: 1 });
      expect(result[1]).toMatchObject({ name: 'lodash', order: 2 });
      expect(result[2]).toMatchObject({ name: 'utils', order: 3 });
    });

    it('should resolve order collisions by pushing conflicting groups to next available slot', () => {
      const groups = [
        { name: 'react', order: 3, isDefault: false },
        { name: 'utils', order: 3, isDefault: false }, // collision
        { name: 'services', order: 2, isDefault: false },
      ];

      const result = computeAutoOrder(groups);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ name: 'services', order: 2 });
      expect(result[1]).toMatchObject({ name: 'react', order: 3 });
      expect(result[2]).toMatchObject({ name: 'utils', order: 4 }); // pushed to next slot
    });

    it('should auto-assign orders to groups without explicit order', () => {
      const groups = [
        { name: 'react', order: 1, isDefault: false },
        { name: 'lodash', isDefault: false }, // no order
        { name: 'utils', order: 5, isDefault: false },
        { name: 'components', isDefault: false }, // no order
        { name: 'types', isDefault: false }, // no order
      ];

      const result = computeAutoOrder(groups);

      expect(result).toHaveLength(5);
      expect(result[0]).toMatchObject({ name: 'lodash', order: 0 }); // auto-assigned
      expect(result[1]).toMatchObject({ name: 'react', order: 1 });
      expect(result[2]).toMatchObject({ name: 'components', order: 2 }); // auto-assigned
      expect(result[3]).toMatchObject({ name: 'types', order: 3 }); // auto-assigned
      expect(result[4]).toMatchObject({ name: 'utils', order: 5 });
    });

    it('should handle mixed scenario with collisions and missing orders', () => {
      const groups = [
        { name: 'react', order: 3, isDefault: false },
        { name: 'lodash', isDefault: false }, // no order
        { name: 'utils', order: 3, isDefault: false }, // collision with react
        { name: 'components', isDefault: false }, // no order
        { name: 'types', isDefault: false }, // no order
        { name: 'services', order: 2, isDefault: false },
      ];

      const result = computeAutoOrder(groups);

      expect(result).toHaveLength(6);
      // Should be sorted by final order
      expect(result[0]).toMatchObject({ name: 'lodash', order: 0 }); // auto-assigned
      expect(result[1]).toMatchObject({ name: 'components', order: 1 }); // auto-assigned
      expect(result[2]).toMatchObject({ name: 'services', order: 2 });
      expect(result[3]).toMatchObject({ name: 'react', order: 3 });
      expect(result[4]).toMatchObject({ name: 'utils', order: 4 }); // collision resolved
      expect(result[5]).toMatchObject({ name: 'types', order: 5 }); // auto-assigned
    });

    it('should warn about high order values', () => {
      const groups = [
        { name: 'react', order: 1001, isDefault: false }, // high value
        { name: 'lodash', order: 2, isDefault: false },
      ];

      computeAutoOrder(groups);

      // Should log a warning for the high order value
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('High order value detected: 1001 for group "react"')
      );
    });

    it('should handle invalid order values by treating them as missing', () => {
      const groups = [
        { name: 'react', order: 1, isDefault: false },
        { name: 'lodash', order: -1, isDefault: false }, // invalid (negative)
        { name: 'utils', order: 1.5, isDefault: false }, // invalid (not integer)
        { name: 'components', order: 0, isDefault: false }, // valid (zero is allowed)
        { name: 'types', isDefault: false }, // missing
      ];

      const result = computeAutoOrder(groups);

      expect(result).toHaveLength(5);
      expect(result[0]).toMatchObject({ name: 'components', order: 0 }); // valid order 0
      expect(result[1]).toMatchObject({ name: 'react', order: 1 });
      // Invalid orders should be auto-assigned starting from next available
      expect(result[2]).toMatchObject({ name: 'lodash', order: 2 });
      expect(result[3]).toMatchObject({ name: 'utils', order: 3 });
      expect(result[4]).toMatchObject({ name: 'types', order: 4 });
    });

    it('should preserve other group properties', () => {
      const groups = [
        { 
          name: 'react', 
          order: 1, 
          isDefault: true, 
          match: /^react/,
          priority: 10 
        },
        { 
          name: 'lodash', 
          isDefault: false, 
          match: /^lodash/,
          priority: 5 
        },
      ];

      const result = computeAutoOrder(groups);

      expect(result[0]).toMatchObject({
        name: 'lodash',
        order: 0, // auto-assigned
        isDefault: false,
        match: /^lodash/,
        priority: 5
      });
      expect(result[1]).toMatchObject({
        name: 'react',
        order: 1,
        isDefault: true,
        match: /^react/,
        priority: 10
      });
    });

    it('should handle empty groups array', () => {
      const groups: any[] = [];
      const result = computeAutoOrder(groups);
      
      expect(result).toEqual([]);
    });

    it('should log collision adjustments', () => {
      const groups = [
        { name: 'react', order: 2, isDefault: false },
        { name: 'utils', order: 2, isDefault: false }, // collision
      ];

      computeAutoOrder(groups);

      // Should log the collision adjustment
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Group "utils" order adjusted from 2 to 3 due to collision')
      );
    });
  });
});