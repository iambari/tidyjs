import { parse as parseTypeScript } from '@typescript-eslint/parser';
import { TSESTree } from '@typescript-eslint/types';

describe('TypeScript Parser for Import Detection', () => {
  describe('Valid import scenarios', () => {
    test('should parse basic named import', () => {
      const code = "import { Component } from 'react';";
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0].type).toBe('ImportDeclaration');
      }).not.toThrow();
    });

    test('should parse default import', () => {
      const code = "import React from 'react';";
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ImportDeclaration');
      const importDecl = ast.body[0] as TSESTree.ImportDeclaration;
      expect(importDecl.specifiers).toHaveLength(1);
      expect(importDecl.specifiers[0].type).toBe('ImportDefaultSpecifier');
    });

    test('should parse mixed import (default + named)', () => {
      const code = "import React, { useState } from 'react';";
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ImportDeclaration');
      const importDecl = ast.body[0] as TSESTree.ImportDeclaration;
      expect(importDecl.specifiers).toHaveLength(2);
      expect(importDecl.specifiers[0].type).toBe('ImportDefaultSpecifier');
      expect(importDecl.specifiers[1].type).toBe('ImportSpecifier');
    });

    test('should parse side effect import', () => {
      const code = "import './styles.css';";
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ImportDeclaration');
      const importDecl = ast.body[0] as TSESTree.ImportDeclaration;
      expect(importDecl.specifiers).toHaveLength(0);
    });

    test('should parse namespace import', () => {
      const code = "import * as Utils from './utils';";
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ImportDeclaration');
      const importDecl = ast.body[0] as TSESTree.ImportDeclaration;
      expect(importDecl.specifiers).toHaveLength(1);
      expect(importDecl.specifiers[0].type).toBe('ImportNamespaceSpecifier');
    });

    test('should parse imports with numbers in package names', () => {
      const code = "import React18 from 'react18';";
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0].type).toBe('ImportDeclaration');
      }).not.toThrow();
    });

    test('should parse imports with 2fa in module names', () => {
      const code = "import { Auth2fa } from '@auth/2fa';";
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0].type).toBe('ImportDeclaration');
      }).not.toThrow();
    });

    test('should handle multiple imports correctly', () => {
      const code = `
        import React from 'react';
        import { Component } from 'react';
        import * as Utils from './utils';
        import './styles.css';
      `;
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(4);
      ast.body.forEach(node => {
        expect(node.type).toBe('ImportDeclaration');
      });
    });
  });

  describe('Invalid import scenarios', () => {
    test('should throw on invalid default import syntax', () => {
      const code = "import { default } from 'react';";
      
      expect(() => {
        parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
      }).toThrow();
    });

    test('should throw on leading comma in destructuring', () => {
      const code = "import { , Component } from 'react';";
      
      expect(() => {
        parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
      }).toThrow();
    });

    test('should throw on unbalanced braces', () => {
      const code = "import { Component from 'react';";
      
      expect(() => {
        parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
      }).toThrow();
    });

    test('should throw on incomplete import', () => {
      const code = "import { Component } from";
      
      expect(() => {
        parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
      }).toThrow();
    });

    test('should throw on missing quotes', () => {
      const code = "import { Component } from react;";
      
      expect(() => {
        parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
      }).toThrow();
    });
  });

  describe('Edge cases that were problematic with regex patterns', () => {
    test('should not reject legitimate numbers in identifiers', () => {
      const code = "import { version2024 } from './config';";
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0].type).toBe('ImportDeclaration');
      }).not.toThrow();
    });

    test('should not reject date-like strings in module paths', () => {
      const code = "import { api } from './2024-01-01-api-client';";
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0].type).toBe('ImportDeclaration');
      }).not.toThrow();
    });

    test('should not reject numbers followed by letters in module names', () => {
      const code = "import lodash4 from 'lodash4';";
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(1);
        expect(ast.body[0].type).toBe('ImportDeclaration');
      }).not.toThrow();
    });

    test('should handle complex import scenarios', () => {
      const code = `
        import React18, { 
          useState, 
          useEffect,
          version2024 
        } from 'react18';
        import { Auth2fa } from '@auth/2fa-module';
        import * as Utils2024 from './utils-2024-01-01';
      `;
      
      expect(() => {
        const ast = parseTypeScript(code, {
          ecmaVersion: 2020,
          sourceType: 'module',
          jsx: true,
          errorOnUnknownASTType: false,
          errorOnTypeScriptSyntacticAndSemanticIssues: false,
        });
        
        expect(ast.body).toHaveLength(3);
        ast.body.forEach(node => {
          expect(node.type).toBe('ImportDeclaration');
        });
      }).not.toThrow();
    });
  });

  describe('TypeScript specific imports', () => {
    test('should parse type-only imports', () => {
      const code = "import type { ComponentProps } from 'react';";
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ImportDeclaration');
      const importDecl = ast.body[0] as TSESTree.ImportDeclaration;
      expect(importDecl.importKind).toBe('type');
    });

    test('should parse mixed type and value imports', () => {
      const code = "import React, { type ComponentProps } from 'react';";
      
      const ast = parseTypeScript(code, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ImportDeclaration');
      const importDecl = ast.body[0] as TSESTree.ImportDeclaration;
      expect(importDecl.specifiers).toHaveLength(2);
    });
  });
});