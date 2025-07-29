import { configManager } from '../../src/utils/config';
import * as vscode from 'vscode';

describe('Sort order validation in configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid sortOrder configurations', () => {
    it('should accept "alphabetic" as valid sortOrder', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'External', match: '^[^@]', order: 0, sortOrder: 'alphabetic' },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should accept array of strings as valid sortOrder', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { 
                name: 'External', 
                match: '^[^@]', 
                order: 0, 
                sortOrder: ['react', 'react-*', 'lodash', 'axios'] 
              },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should accept groups without sortOrder (undefined)', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'External', match: '^[^@]', order: 0 }, // No sortOrder
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should accept complex sortOrder arrays with wildcards', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { 
                name: 'Complex', 
                match: '^@app', 
                order: 0, 
                sortOrder: ['@app/components', '@app/components/*', '@app/utils', '@app/utils/*', '*test*'] 
              },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Invalid sortOrder configurations', () => {
    it('should reject invalid sortOrder type (number)', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Invalid', match: '^[^@]', order: 0, sortOrder: 123 },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "Invalid"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('must be \'alphabetic\' or an array of strings'))).toBe(true);
    });

    it('should reject invalid sortOrder type (object)', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Invalid', match: '^[^@]', order: 0, sortOrder: { type: 'custom' } },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "Invalid"'))).toBe(true);
    });

    it('should reject empty sortOrder array', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'EmptyArray', match: '^[^@]', order: 0, sortOrder: [] },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "EmptyArray"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('array cannot be empty'))).toBe(true);
    });

    it('should reject sortOrder array with non-string items', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'MixedTypes', match: '^[^@]', order: 0, sortOrder: ['react', 123, 'lodash'] },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "MixedTypes"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('all array items must be strings'))).toBe(true);
    });

    it('should reject sortOrder array with duplicate patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Duplicates', match: '^[^@]', order: 0, sortOrder: ['react', 'lodash', 'react'] },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "Duplicates"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('duplicate patterns found'))).toBe(true);
    });

    it('should reject invalid string value (not "alphabetic")', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'InvalidString', match: '^[^@]', order: 0, sortOrder: 'invalid-sort-type' },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "InvalidString"'))).toBe(true);
    });
  });

  describe('Multiple sortOrder validation errors', () => {
    it('should detect multiple sortOrder validation errors across groups', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Invalid1', match: '^[^@]', order: 0, sortOrder: 123 },
              { name: 'Invalid2', match: '^@app', order: 1, sortOrder: [] },
              { name: 'Invalid3', match: '^lodash', order: 2, sortOrder: ['react', 123, 'lodash'] },
              { name: 'Default', order: 3, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(3);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "Invalid1"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "Invalid2"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "Invalid3"'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle null sortOrder', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'NullSort', match: '^[^@]', order: 0, sortOrder: null },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid sortOrder in group "NullSort"'))).toBe(true);
    });

    it('should handle array with empty strings', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'EmptyStrings', match: '^[^@]', order: 0, sortOrder: ['react', '', 'lodash'] },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(true); // Empty strings are valid strings
      expect(validation.errors).toHaveLength(0);
    });
  });
});