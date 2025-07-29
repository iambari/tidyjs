import { configManager } from '../../src/utils/config';
import vscode from 'vscode';
import * as logUtils from '../../src/utils/log';

// Mock VS Code API
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  },
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn()
    }))
  }
}));

// Mock the log utils
jest.mock('../../src/utils/log', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
  showOutputChannel: jest.fn(),
  clearLogs: jest.fn(),
}));

describe('Config Auto Order Integration Tests', () => {
  const mockGetConfiguration = vscode.workspace.getConfiguration as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock configuration
    mockGetConfiguration.mockReturnValue({
      get: jest.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'debug':
            return false;
          case 'groups':
            return [
              {
                name: 'Other',
                order: 0,
                default: true
              }
            ];
          case 'format.indent':
            return 4;
          case 'format.removeUnusedImports':
            return false;
          case 'format.removeMissingModules':
            return false;
          case 'format.singleQuote':
            return true;
          case 'format.bracketSpacing':
            return true;
          case 'importOrder':
            return {
              default: 0,
              named: 1,
              typeOnly: 2,
              sideEffect: 3
            };
          case 'excludedFolders':
            return [];
          default:
            return defaultValue;
        }
      })
    });
  });

  describe('Real World Integration Scenarios', () => {
    it('should handle collision scenario from user configuration', () => {
      // Simulate user configuration with collisions
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'React', match: '^react', order: 3 },
              { name: 'Lodash', match: '^lodash' }, // no order - should get auto-assigned
              { name: 'Utils', match: '^@/utils', order: 3 }, // collision with React
              { name: 'Components', match: '^@/components' }, // no order
              { name: 'Types', match: '^@/types' }, // no order
              { name: 'Services', match: '^@/services', order: 2 },
              { name: 'Other', order: 0, default: true }
            ];
          }
          return defaultValue;
        })
      });

      const config = configManager.getConfig();

      // Verify auto-order resolution worked correctly
      const groups = config.groups;
      
      // Sort by order to check final arrangement
      groups.sort((a, b) => a.order - b.order);

      expect(groups).toHaveLength(7);
      
      // Expected final arrangement:
      expect(groups[0]).toMatchObject({ name: 'Other', order: 0, default: true });
      expect(groups[1]).toMatchObject({ name: 'Lodash', order: 1 }); // auto-assigned
      expect(groups[2]).toMatchObject({ name: 'Services', order: 2 }); // kept original
      expect(groups[3]).toMatchObject({ name: 'React', order: 3 }); // kept original
      expect(groups[4]).toMatchObject({ name: 'Utils', order: 4 }); // collision resolved (3→4)
      expect(groups[5]).toMatchObject({ name: 'Components', order: 5 }); // auto-assigned
      expect(groups[6]).toMatchObject({ name: 'Types', order: 6 }); // auto-assigned

      // Verify collision adjustment was logged
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Group "Utils" order adjusted from 3 to 4 due to collision')
      );
    });

    it('should handle complex scenario with multiple collisions and missing orders', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'First', order: 1 },
              { name: 'Second', order: 1 }, // collision
              { name: 'Third', order: 1 }, // collision
              { name: 'Fourth' }, // no order
              { name: 'Fifth', order: 5 },
              { name: 'Sixth' }, // no order
              { name: 'Seventh', order: 5 }, // collision with Fifth
              { name: 'Other', order: 0, default: true }
            ];
          }
          return defaultValue;
        })
      });

      const config = configManager.getConfig();
      const groups = config.groups.sort((a, b) => a.order - b.order);

      expect(groups).toHaveLength(8);
      
      // Expected resolution:
      expect(groups[0]).toMatchObject({ name: 'Other', order: 0 });
      expect(groups[1]).toMatchObject({ name: 'First', order: 1 }); // original
      expect(groups[2]).toMatchObject({ name: 'Second', order: 2 }); // collision resolved
      expect(groups[3]).toMatchObject({ name: 'Third', order: 3 }); // collision resolved
      expect(groups[4]).toMatchObject({ name: 'Fourth', order: 4 }); // auto-assigned
      expect(groups[5]).toMatchObject({ name: 'Fifth', order: 5 }); // original
      expect(groups[6]).toMatchObject({ name: 'Seventh', order: 6 }); // collision resolved (was 5→6)
      expect(groups[7]).toMatchObject({ name: 'Sixth', order: 7 }); // auto-assigned

      // Verify multiple collision adjustments were logged
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Group "Second" order adjusted from 1 to 2 due to collision')
      );
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Group "Third" order adjusted from 1 to 3 due to collision')
      );
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Group "Seventh" order adjusted from 5 to 6 due to collision')
      );
    });

    it('should handle invalid order values by treating them as missing', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'Valid', order: 2 },
              { name: 'Negative', order: -1 }, // invalid
              { name: 'Float', order: 1.5 }, // invalid
              { name: 'Zero', order: 0, default: true }, // valid (default group)
              { name: 'String', order: 'three' as any }, // invalid
              { name: 'Missing' }, // no order
              { name: 'HighValid', order: 1001 } // valid but high
            ];
          }
          return defaultValue;
        })
      });

      const config = configManager.getConfig();
      const groups = config.groups.sort((a, b) => a.order - b.order);

      expect(groups).toHaveLength(7);
      
      // Invalid orders should be auto-assigned
      expect(groups[0]).toMatchObject({ name: 'Zero', order: 0, default: true });
      expect(groups[1]).toMatchObject({ name: 'Negative', order: 1 }); // auto-assigned (invalid order)
      expect(groups[2]).toMatchObject({ name: 'Valid', order: 2 }); // kept original
      expect(groups[3]).toMatchObject({ name: 'Float', order: 3 }); // auto-assigned (invalid order)
      expect(groups[4]).toMatchObject({ name: 'String', order: 4 }); // auto-assigned (invalid order)
      expect(groups[5]).toMatchObject({ name: 'Missing', order: 5 }); // auto-assigned
      expect(groups[6]).toMatchObject({ name: 'HighValid', order: 1001 }); // kept original

      // Verify high order warning was logged
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('High order value detected: 1001 for group "HighValid"')
      );
    });

    it('should preserve RegExp patterns during auto-order processing', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'React', match: '^react', order: 2 },
              { name: 'Lodash', match: '/^lodash/i' }, // regex with flags
              { name: 'Utils', match: '^@/utils', order: 2 }, // collision
              { name: 'Other', order: 0, default: true }
            ];
          }
          return defaultValue;
        })
      });

      const config = configManager.getConfig();
      const groups = config.groups.sort((a, b) => a.order - b.order);

      // Verify RegExp patterns are preserved
      expect(groups.find(g => g.name === 'React')?.match).toEqual(/^react/);
      expect(groups.find(g => g.name === 'Lodash')?.match).toEqual(/^lodash/i);
      expect(groups.find(g => g.name === 'Utils')?.match).toEqual(/^@\/utils/);
      
      // Verify orders were processed correctly
      expect(groups[0]).toMatchObject({ name: 'Other', order: 0 });
      expect(groups[1]).toMatchObject({ name: 'Lodash', order: 1 }); // auto-assigned
      expect(groups[2]).toMatchObject({ name: 'React', order: 2 }); // original
      expect(groups[3]).toMatchObject({ name: 'Utils', order: 3 }); // collision resolved
    });

    it('should work with getGroups() method including subfolders', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'External', match: '^[^@]', order: 2 },
              { name: 'Internal', match: '^@/', order: 2 }, // collision
              { name: 'Other', order: 0, default: true }
            ];
          }
          return defaultValue;
        })
      });

      // Test the public API that would be used by the parser
      const groups = configManager.getGroups();
      
      // Should be sorted by order
      expect(groups[0]).toMatchObject({ name: 'Other', order: 0, default: true });
      expect(groups[1]).toMatchObject({ name: 'External', order: 2 }); // original
      expect(groups[2]).toMatchObject({ name: 'Internal', order: 3 }); // collision resolved

      // Verify collision was logged
      expect(logUtils.logDebug).toHaveBeenCalledWith(
        expect.stringContaining('Group "Internal" order adjusted from 2 to 3 due to collision')
      );
    });

    it('should validate configuration correctly after auto-order processing', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'A', order: 1 },
              { name: 'B', order: 1 }, // collision - will be resolved
              { name: 'Other', order: 0, default: true }
            ];
          }
          return defaultValue;
        })
      });

      const validation = configManager.validateCurrentConfiguration();
      
      // Should pass validation since order collisions are now auto-resolved
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should still detect duplicate group names (not auto-resolved)', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [
              { name: 'SameName', order: 1 },
              { name: 'SameName', order: 2 }, // duplicate name
              { name: 'Other', order: 0, default: true }
            ];
          }
          return defaultValue;
        })
      });

      const validation = configManager.validateCurrentConfiguration();
      
      // Should fail validation due to duplicate names
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Duplicate group names found: SameName');
    });

    it('should handle empty groups configuration gracefully', () => {
      mockGetConfiguration.mockReturnValue({
        get: jest.fn((key: string, defaultValue?: any) => {
          if (key === 'groups') {
            return [];
          }
          return defaultValue;
        })
      });

      const config = configManager.getConfig();
      
      // Should have empty groups array
      expect(config.groups).toHaveLength(0);
      
      // Validation should fail (no default group)
      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('No group is marked as default');
    });
  });
});
