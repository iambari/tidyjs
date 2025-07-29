import { configManager } from '../../src/utils/config';
import * as vscode from 'vscode';

describe('Regex validation in configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Invalid regex patterns', () => {
    it('should detect invalid regex patterns in group configuration', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Valid', match: '^react', order: 0 },
              { name: 'Invalid', match: '[unclosed', order: 1 },
              { name: 'Default', order: 2, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "Invalid"'))).toBe(true);
    });

    it('should detect invalid regex flags', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'InvalidFlags', match: '/^react/xyz', order: 0 },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "InvalidFlags"'))).toBe(true);
    });

    it('should detect empty regex patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Empty', match: '', order: 0 },
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "Empty"'))).toBe(true);
    });
  });

  describe('Valid regex patterns', () => {
    it('should accept valid regex patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'React', match: '^react', order: 0 },
              { name: 'Utils', match: '/^@\\/utils/i', order: 1 },
              { name: 'Lodash', match: '^lodash', order: 2 },
              { name: 'Default', order: 3, default: true }
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

    it('should accept groups without match patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'NoMatch', order: 0 },
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

  describe('Complex regex patterns', () => {
    it('should handle complex but valid regex patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Complex1', match: '^@app\\/(components|utils|hooks)\\/', order: 0 },
              { name: 'Complex2', match: '/^(?!.*\\.test\\.).*\\.(ts|tsx)$/i', order: 1 },
              { name: 'Default', order: 2, default: true }
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

    it('should reject malformed complex patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Malformed', match: '^@app\\/(components|utils|hooks\\/', order: 0 }, // Missing closing parenthesis
              { name: 'Default', order: 1, default: true }
            ];
          }
          return undefined;
        })
      };

      jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(mockConfiguration as any);

      const validation = configManager.validateCurrentConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "Malformed"'))).toBe(true);
    });
  });

  describe('Multiple validation errors', () => {
    it('should detect multiple regex validation errors', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'Invalid1', match: '[unclosed', order: 0 },
              { name: 'Invalid2', match: '(unclosed', order: 1 },
              { name: 'Invalid3', match: '/pattern/xyz', order: 2 }, // Invalid flags
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
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "Invalid1"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "Invalid2"'))).toBe(true);
      expect(validation.errors.some(error => error.includes('Invalid regex pattern in group "Invalid3"'))).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined match patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'NoMatch', match: undefined, order: 0 },
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

    it('should handle null match patterns', () => {
      const mockConfiguration = {
        get: jest.fn((key: string) => {
          if (key === 'groups') {
            return [
              { name: 'NullMatch', match: null, order: 0 },
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
});