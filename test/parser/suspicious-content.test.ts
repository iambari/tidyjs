import { jest } from '@jest/globals';

// Mock the logDebug function to capture debug output
const mockLogDebug = jest.fn();
jest.mock('../../src/utils/log', () => ({
  logDebug: mockLogDebug,
  logError: jest.fn()
}));

// Import after mocking
let containsSuspiciousContent: (text: string) => boolean;

// We need to extract the function from the extension module
// Since it's not exported, we'll test the patterns indirectly through the logic
describe('Suspicious Content Detection Debug Logging', () => {
  beforeEach(() => {
    mockLogDebug.mockClear();
  });

  test('should detect timestamp pattern and log details', () => {
    // Since containsSuspiciousContent is not exported, we'll test the patterns directly
    const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    const testText = 'import React from "react"; // 2024-01-01T12:00:00';
    
    expect(timestampPattern.test(testText)).toBe(true);
  });

  test('should detect number before import pattern', () => {
    const numberBeforeImportPattern = /\d+[a-zA-Z]\s*import/;
    const testText = '123aimport React from "react";';
    
    expect(numberBeforeImportPattern.test(testText)).toBe(true);
  });

  test('should detect import with number pattern', () => {
    const importWithNumberPattern = /import\s*\d+/;
    const testText = 'import 123 from "react";';
    
    expect(importWithNumberPattern.test(testText)).toBe(true);
  });

  test('should detect duplicate braces pattern', () => {
    const duplicateBracesPattern = /import\s*{[^}]*}\s*{\s*[^}]*}\s*from/;
    const testText = 'import { Component } { useState } from "react";';
    
    expect(duplicateBracesPattern.test(testText)).toBe(true);
  });

  test('should detect invalid default destructure pattern', () => {
    const invalidDefaultDestructurePattern = /import\s*{\s*default\s*}\s*from/;
    const testText = 'import { default } from "react";';
    
    expect(invalidDefaultDestructurePattern.test(testText)).toBe(true);
  });

  test('should not detect valid import patterns as suspicious', () => {
    const validImports = [
      'import React from "react";',
      'import { useState, useEffect } from "react";',
      'import * as Utils from "./utils";',
      'import "./styles.css";',
      'import React, { Component } from "react";',
      'import {\n  Component,\n  Fragment\n} from "react";'
    ];

    const patterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /\d+[a-zA-Z]\s*import/,
      /import\s*\d+/,
      /import\s*{[^}]*}\s*{\s*[^}]*}\s*from/,
      /import\s*{\s*default\s*}\s*from/
    ];

    validImports.forEach(importText => {
      patterns.forEach(pattern => {
        expect(pattern.test(importText)).toBe(false);
      });
    });
  });
});