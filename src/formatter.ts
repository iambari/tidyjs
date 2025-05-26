import traverse          from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { ImportDeclaration } from '@babel/types';
const babelTraverse = typeof traverse === 'function' ? traverse : (traverse as any).default;
import {
    Config,
    FormattedImportGroup
}                        from './types';
import { parse }         from '@babel/parser';
import { parse as parseTypeScript } from '@typescript-eslint/parser';
import { TSESTree } from '@typescript-eslint/types';
import { logDebug } from './utils/log';
import {
    logError,
    isEmptyLine,
    showMessage
}                   from './utils/misc';
import type { ParsedImport, ParserResult } from './parser';

const fromKeywordRegex = /\bfrom\b/;
const multilineCommentStartRegex = /\/\*/;
const multilineCommentEndRegex = /\*\//;

function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
  if (fromIndex <= 0 || !fromKeywordRegex.test(line) || maxFromIndex <= 0) {
    return line;
  }
  if (fromIndex >= line.length) {
    return line;
  }

  const prefix = line.substring(0, fromIndex);
  const suffix = line.substring(fromIndex);
  const targetPadding = Math.max(maxFromIndex, prefix.length);
  const paddedPrefix = prefix.padEnd(targetPadding);
  const result = paddedPrefix + suffix;
  if (/\d\s*[a-zA-Z_$]/.test(result) && !/\d\s+[a-zA-Z_$]/.test(result)) {
    return result.replace(/(\d)(\s*)([a-zA-Z_$])/g, '$1 $3');
  }

  return result;
}

function alignMultilineFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
  const lines = line.split('\n');
  if (lines.length < 2) {
    return line;
  }

  const lastLineIndex = lines.length - 1;
  const lastLine = lines[lastLineIndex];

  const fromMatch = lastLine.match(fromKeywordRegex);
  if (!fromMatch || fromMatch.index === undefined) {
    return line;
  }

  const closeBraceIndex = lastLine.indexOf('}');
  if (closeBraceIndex === -1) return line;

  const beforeContent = lastLine.substring(0, closeBraceIndex + 1);
  const exactSpaces = maxFromIndex - (closeBraceIndex + 1);
  const fromAndAfter = lastLine.substring(fromMatch.index);

  const newLastLine = beforeContent + ' '.repeat(exactSpaces) + fromAndAfter;
  lines[lastLineIndex] = newLastLine;

  return lines.join('\n');
}

function alignImportsInGroup(importLines: string[]): string[] {
  if (importLines.length === 0) {
    return importLines;
  }

  interface LineInfo {
    fromIndex: number;
    isMultiline: boolean;
    idealFromPosition: number;
  }

  const lineInfos: LineInfo[] = new Array(importLines.length);
  let globalMaxFromPosition = 0;

  for (let i = 0; i < importLines.length; i++) {
    const line = importLines[i];
    const info: LineInfo = {
      fromIndex: -1,
      isMultiline: false,
      idealFromPosition: 0,
    };

    if (line.includes('\n')) {
      info.isMultiline = true;
      const lines = line.split('\n');
      const { maxLength, maxIndex } = lines.slice(1, -1).reduce(
        (acc, curr, idx) => {
          const len = curr.trim().replace(/,$/, '').trim().length;
          if (len > acc.maxLength) {
            return { maxLength: len, maxIndex: idx };
          }
          return acc;
        },
        { maxLength: 0, maxIndex: -1 }
      );

      info.idealFromPosition = 4 + maxLength + (maxIndex !== lines.length - 3 && maxIndex !== -1 ? 2 : 1);
      const lastLine = lines[lines.length - 1];
      const fromMatch = lastLine.match(fromKeywordRegex);
      info.fromIndex = fromMatch && fromMatch.index !== undefined ? fromMatch.index : -1;
    } else {
      const fromMatch = line.match(fromKeywordRegex);
      if (fromMatch && fromMatch.index !== undefined) {
        info.fromIndex = fromMatch.index;
        info.idealFromPosition = line.substring(0, fromMatch.index).trim().length + 1;
      }
    }

    globalMaxFromPosition = Math.max(globalMaxFromPosition, info.idealFromPosition);
    lineInfos[i] = info;
  }

  return importLines.map((line, i) => {
    const info = lineInfos[i];
    if (info.fromIndex === -1) return line;

    return info.isMultiline ? alignMultilineFromKeyword(line, info.fromIndex, globalMaxFromPosition) : alignFromKeyword(line, info.fromIndex, globalMaxFromPosition);
  });
}

function cleanUpLines(lines: string[]): string[] {
  const result: string[] = [];
  const seenGroupComments = new Set<string>();
  let consecutiveEmptyLines = 0;
  let inMultilineComment = false;
  
  const handleGroupComment = (line: string, normalizedLine: string): boolean => {
    if (normalizedLine.startsWith('// ')) {
      const groupName = normalizedLine.substring(3).trim();
      if (!seenGroupComments.has(groupName)) {
        seenGroupComments.add(groupName);
        result.push(line);
      }
      return true;
    }
    return false;
  };

  const isInlineMultilineComment = (normalizedLine: string): boolean => {
    return multilineCommentStartRegex.test(normalizedLine) && multilineCommentEndRegex.test(normalizedLine);
  };

  for (const line of lines) {
    const normalizedLine = line.trim();

    if (normalizedLine.startsWith('//')) {
      handleGroupComment(line, normalizedLine);
      continue;
    }

    if (multilineCommentStartRegex.test(normalizedLine)) {
      inMultilineComment = true;
      if (isInlineMultilineComment(normalizedLine)) {
        inMultilineComment = false;
        continue;
      }
    }

    if (inMultilineComment) {
      if (multilineCommentEndRegex.test(normalizedLine)) {
        inMultilineComment = false;
      }
      continue;
    }

    if (isEmptyLine(line)) {
      if (consecutiveEmptyLines < 1) {
        result.push(line);
        consecutiveEmptyLines++;
      }
    } else {
      result.push(line);
      consecutiveEmptyLines = 0;
    }
  }

  while (result.length > 0 && isEmptyLine(result[result.length - 1])) {
    result.pop();
  }

  if (result.length === 0 || !isEmptyLine(result[result.length - 1])) {
    result.push('');
  }

  return result;
}

function formatImportLine(importItem: ParsedImport): string {
  const { type, source, specifiers, defaultImport } = importItem;

  if (type === 'sideEffect' || specifiers.length === 0) {
    return `import '${source}';`;
  }

  if (type === 'default' && specifiers.length === 1) {
    return `import ${specifiers[0]} from '${source}';`;
  }

  if (type === 'typeDefault' && specifiers.length === 1) {
    return `import type ${specifiers[0]} from '${source}';`;
  }
  if (type === 'mixed') {
    if (defaultImport && specifiers.length > 0) {
      const specifiersStr = specifiers.length === 1
        ? specifiers[0]
        : `\n    ${specifiers.join(',\n    ')}\n`;
      
      if (specifiers.length === 1) {
        return `import ${defaultImport}, { ${specifiersStr} } from '${source}';`;
      } else {
        return `import ${defaultImport}, {${specifiersStr}} from '${source}';`;
      }
    } else if (defaultImport) {
      return `import ${defaultImport} from '${source}';`;
    }
  }

  if ((type === 'named' || type === 'typeNamed') && specifiers.length === 1) {
    const typePrefix = type === 'typeNamed' ? 'type ' : '';
    return `import ${typePrefix}{ ${specifiers[0]} } from '${source}';`;
  }

  if ((type === 'named' || type === 'typeNamed') && specifiers.length > 1) {
    const typePrefix = type === 'typeNamed' ? 'type ' : '';
    const specifiersSet = new Set(specifiers);
    const sortedSpecifiers = Array.from(specifiersSet).sort((a, b) => a.length - b.length);

    const parts = [`import ${typePrefix}{`, `    ${sortedSpecifiers.join(',\n    ')}`, `} from '${source}';`];
    return parts.join('\n');
  }

  const typePrefix = type === 'typeNamed' ? 'type ' : '';
  const specifiersStr = specifiers.join(', ');
  return `import ${typePrefix}{ ${specifiersStr} } from '${source}';`;
}

function extractGroupName(source: string, groupName: string): string {
  if (groupName === 'Misc' || groupName === 'DS' || groupName === 'Utils') {
    return groupName;
  }

  const match = source.match(/@[a-zA-Z]+(?:\/[a-zA-Z]+)?/);
  return match ? match[0] : groupName;
}

function formatImportsFromParser(sourceText: string, importRange: { start: number; end: number }, parserResult: ParserResult, config: Config): string {
  if (importRange.start === importRange.end || !parserResult.groups.length) {
    return sourceText;
  }

  try {
    const currentImportText = sourceText.substring(importRange.start, importRange.end);

    const dynamicImportTest = /import\(|await\s+import/;
    if (dynamicImportTest.test(currentImportText)) {
      throw new Error('Dynamic imports detected in the static imports section');
    }

    const sectionCommentRegex = /^\s*\/\/\s*[A-Za-z@]+.*$/;

    const currentLines = currentImportText.split('\n');
    const importsOnly: string[] = [];
    let inMultilineComment = false;

    for (const line of currentLines) {
      const trimmedLine = line.trim();

      const startCommentIndex = trimmedLine.indexOf('/*');
      const endCommentIndex = trimmedLine.indexOf('*/');
      const importIndex = trimmedLine.indexOf('import');

      if (startCommentIndex !== -1 && endCommentIndex !== -1 && importIndex !== -1) {
        if (importIndex > endCommentIndex) {
          importsOnly.push(line.substring(line.indexOf('import')));
          continue;
        }
      }

      if (startCommentIndex !== -1) {
        inMultilineComment = true;
        if (endCommentIndex !== -1) {
          inMultilineComment = false;
          continue;
        }
      }

      if (inMultilineComment) {
        if (endCommentIndex !== -1) {
          inMultilineComment = false;
        }
        continue;
      }

      if (trimmedLine.startsWith('//')) {
        if (!sectionCommentRegex.test(line)) {
          continue;
        }
        importsOnly.push(line);
        continue;
      }

      importsOnly.push(line);
    }

    interface GroupedImports {
      [groupName: string]: {
        order: number;
        imports: ParsedImport[];
      };
    }

    const importsByGroup: GroupedImports = {};
    const importOrder = config.importOrder || {
      default: 0,
      named: 1,
      typeOnly: 2,
      sideEffect: 3,
    };

    parserResult.groups.forEach((group) => {
      if (group.imports?.length) {
        importsByGroup[group.name] = {
          order: group.order,
          imports: group.imports,
        };
      }
    });

    const importGroupEntries = Array.from(Object.entries(importsByGroup));
    importGroupEntries.sort(([, a], [, b]) => a.order - b.order);

    const formattedGroups: FormattedImportGroup[] = [];

    for (const [groupName, { imports }] of importGroupEntries) {
      const formattedGroupName = groupName.startsWith('@') ? groupName : extractGroupName(imports[0]?.source || '', groupName);
      const groupResult: FormattedImportGroup = {
        groupName,
        commentLine: `// ${formattedGroupName}`,
        importLines: [],
      };

      const importsByType = new Map<string, ParsedImport[]>();

      Object.keys(importOrder).forEach((type) => {
        importsByType.set(type, []);
      });

      for (const importItem of imports) {
        const typeArray = importsByType.get(importItem.type) || [];
        typeArray.push(importItem);
        importsByType.set(importItem.type, typeArray);
      }

      const resolveTypeKey = (type: string) => {
        if (type === 'typeNamed' || type === 'typeDefault') return 'typeOnly';
        if (type === 'mixed') return 'default'; // Treat mixed imports like default imports
        return type;
      };

      const compareImports = (a: ParsedImport, b: ParsedImport): number => {
        const typeA = resolveTypeKey(a.type);
        const typeB = resolveTypeKey(b.type);

        const typeCompare = (importOrder[typeA as keyof typeof importOrder] ?? 0) - (importOrder[typeB as keyof typeof importOrder] ?? 0);
        if (typeCompare !== 0) return typeCompare;

        const isReactA = a.source.toLowerCase() === 'react';
        const isReactB = b.source.toLowerCase() === 'react';
        if (isReactA && !isReactB) return -1;
        if (!isReactA && isReactB) return 1;

        const sourceCompare = a.source.localeCompare(b.source);
        if (sourceCompare !== 0) return sourceCompare;

        if ((a.type === 'named' || a.type === 'typeNamed') && (b.type === 'named' || b.type === 'typeNamed') && a.specifiers.length > 1 && b.specifiers.length > 1) {
          return a.specifiers[0].length - b.specifiers[0].length;
        }

        return 0;
      };

      const orderedImports = [...imports].sort(compareImports);

      groupResult.importLines.push(...orderedImports.map(formatImportLine));

      if (groupResult.importLines.length > 0) {
        formattedGroups.push(groupResult);
      }
    }

    const formattedLines: string[] = [];
    const processedGroupNames = new Set<string>();

    for (const group of formattedGroups) {
      if (!processedGroupNames.has(group.groupName)) {
        formattedLines.push(group.commentLine);
        processedGroupNames.add(group.groupName);
      }

      const alignedImports = alignImportsInGroup(group.importLines);
      formattedLines.push(...alignedImports);

      formattedLines.push('');
    }

    const cleanedLines = cleanUpLines(formattedLines);
    const formattedText = cleanedLines.join('\n');

    const nextChar = sourceText[importRange.end];
    const needsExtraNewline = nextChar && nextChar !== '\n';

    const suffix = sourceText.substring(importRange.end);
    const paddedSuffix = needsExtraNewline ? '\n' + suffix : suffix;

    return sourceText.substring(0, importRange.start) + formattedText + paddedSuffix;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logDebug(`Error while formatting imports: ${errorMessage}`);
    throw error;
  }
}

/**
 * Enhanced findImportsWithTypeScriptParser using @typescript-eslint/parser for better accuracy
 */
async function findImportsWithTypeScriptParser(sourceText: string): Promise<{ start: number; end: number; error?: string } | null> {
  try {
    if (!sourceText || typeof sourceText !== 'string') {
      return { start: 0, end: 0 };
    }
    if (sourceText.trim().length === 0) {
      return { start: 0, end: 0 };
    }

    let ast: TSESTree.Program;
    try {
      ast = parseTypeScript(sourceText, {
        ecmaVersion: 2020,
        sourceType: 'module',
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });
    } catch (parseError) {
      const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
      logError('TypeScript parser failed:', parseError);
      
      // Fallback to basic validation
      return validateImportSectionBasic(sourceText);
    }

    let firstImportStart = -1;
    let lastImportEnd = -1;
    let hasImports = false;
    const importPositions: Array<{ start: number; end: number }> = [];

    // Extract import declarations using TypeScript AST
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        hasImports = true;
        
        const startPos = node.range?.[0] ?? -1;
        const endPos = node.range?.[1] ?? -1;
        
        if (startPos >= 0 && endPos >= 0 && startPos < sourceText.length && endPos <= sourceText.length && startPos < endPos) {
          const importText = sourceText.substring(startPos, endPos);
          if (importText.includes('import')) {
            importPositions.push({ start: startPos, end: endPos });
            
            if (firstImportStart === -1 || startPos < firstImportStart) {
              firstImportStart = startPos;
            }
            if (lastImportEnd === -1 || endPos > lastImportEnd) {
              lastImportEnd = endPos;
            }
          }
        }
      }
    }

    if (!hasImports || firstImportStart === -1 || lastImportEnd === -1 || importPositions.length === 0) {
      return { start: 0, end: 0 };
    }

    // Validate the detected import section
    const detectedImportSection = sourceText.substring(firstImportStart, lastImportEnd);
    if (!detectedImportSection.includes('import')) {
      logDebug('No import keyword found in detected range, returning empty range');
      return { start: 0, end: 0 };
    }

    let adjustedStartPosition = findActualImportStart(sourceText, firstImportStart);
    adjustedStartPosition = Math.max(0, adjustedStartPosition);
    
    if (adjustedStartPosition >= lastImportEnd || adjustedStartPosition >= sourceText.length) {
      logDebug('Invalid range detected, falling back to original positions');
      adjustedStartPosition = firstImportStart;
    }

    logDebug('Successfully detected import range with TypeScript parser:', {
      start: adjustedStartPosition,
      end: lastImportEnd,
      length: lastImportEnd - adjustedStartPosition,
      importsCount: importPositions.length
    });

    return {
      start: adjustedStartPosition,
      end: lastImportEnd,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('Error in findImportsWithTypeScriptParser:', error);
    
    // Fallback to basic validation
    return validateImportSectionBasic(sourceText);
  }
}

/**
 * Fallback function for basic import section validation
 */
function validateImportSectionBasic(sourceText: string): { start: number; end: number; error?: string } | null {
  try {
    const lines = sourceText.split('\n');
    let firstImportLine = -1;
    let lastImportLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') && (line.includes('from ') || line.includes("'") || line.includes('"'))) {
        if (firstImportLine === -1) {
          firstImportLine = i;
        }
        lastImportLine = i;
      }
    }
    
    if (firstImportLine === -1 || lastImportLine === -1) {
      return { start: 0, end: 0 };
    }
    
    let start = 0;
    for (let i = 0; i < firstImportLine; i++) {
      start += lines[i].length + 1;
    }
    
    let end = start;
    for (let i = firstImportLine; i <= lastImportLine; i++) {
      end += lines[i].length + 1;
    }
    
    return { start, end: end - 1 };
  } catch (error) {
    return {
      start: 0,
      end: 0,
      error: 'Failed to analyze import section'
    };
  }
}

/**
 * Enhanced findImportsWithBabel with better error detection and handling
 */
async function findImportsWithBabel(sourceText: string): Promise<{ start: number; end: number; error?: string } | null> {
  // Try TypeScript parser first for better accuracy
  const tsResult = await findImportsWithTypeScriptParser(sourceText);
  if (tsResult && !tsResult.error) {
    return tsResult;
  }

  try {
    if (!sourceText || typeof sourceText !== 'string') {
      return { start: 0, end: 0 };
    }
    if (sourceText.trim().length === 0) {
      return { start: 0, end: 0 };
    }

    // Simplified validation - only check for truly problematic patterns
    const criticalIssues = [
      {
        check: () => sourceText.includes('import { default }'),
        message: 'Invalid default import without variable name'
      },
      {
        check: () => /import\s*{\s*,/.test(sourceText),
        message: 'Leading comma in import destructuring'
      },
      {
        check: () => /import\s*{[^}]*,\s*}/.test(sourceText),
        message: 'Trailing comma in import destructuring'
      }
    ];

    for (const { check, message } of criticalIssues) {
      if (check()) {
        logError(`Critical parsing issue detected: ${message}`);
        return {
          start: 0,
          end: 0,
          error: `Syntax error: ${message}`,
        };
      }
    }

    let ast;
    try {
      ast = parse(sourceText, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
        errorRecovery: true,
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        strictMode: false,
      });
    } catch (parseError) {
      const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
      logError('Babel parsing failed:', parseError);
      let specificError = 'Parse error: Unable to parse the file.';
      
      if (parseMessage.includes('Unexpected token')) {
        specificError = 'Syntax error: Unexpected token. Check for missing semicolons, quotes, or brackets in your imports.';
      } else if (parseMessage.includes('Invalid left-hand side')) {
        specificError = 'Syntax error: Invalid import statement structure.';
      } else if (parseMessage.includes('Unexpected end of input')) {
        specificError = 'Syntax error: Incomplete import statement found.';
      } else if (parseMessage.includes('Identifier directly after number')) {
        specificError = 'Syntax error: Invalid identifier after number. This often indicates corrupted content.';
      } else if (parseMessage.includes('Identifier expected')) {
        specificError = 'Syntax error: Missing identifier in import statement.';
      }
      
      return {
        start: 0,
        end: 0,
        error: specificError,
      };
    }

    let firstImportStart = -1;
    let lastImportEnd = -1;
    let hasImports = false;
    const importPositions: Array<{ start: number; end: number }> = [];

    try {
      babelTraverse(ast, {
        ImportDeclaration(path: NodePath<ImportDeclaration>) {
          if (!path || !path.node || !path.node.source || typeof path.node.source.value !== 'string') {
            logDebug('Skipping invalid import declaration node');
            return;
          }

          hasImports = true;

          let startPos = -1;
          let endPos = -1;
          if (path.node.start !== undefined && path.node.start !== null && 
              path.node.end !== undefined && path.node.end !== null) {
            startPos = path.node.start;
            endPos = path.node.end;
          } 
          else if (path.node.loc) {
            startPos = getPositionFromLine(sourceText, path.node.loc.start.line, path.node.loc.start.column);
            endPos = getPositionFromLine(sourceText, path.node.loc.end.line, path.node.loc.end.column);
          }
          if (startPos >= 0 && endPos >= 0 && 
              startPos < sourceText.length && 
              endPos <= sourceText.length && 
              startPos < endPos) {
            const importText = sourceText.substring(startPos, endPos);
            if (importText.includes('import') && (importText.includes('from') || importText.includes("'") || importText.includes('"'))) {
              importPositions.push({ start: startPos, end: endPos });
              
              if (firstImportStart === -1 || startPos < firstImportStart) {
                firstImportStart = startPos;
              }

              if (lastImportEnd === -1 || endPos > lastImportEnd) {
                lastImportEnd = endPos;
              }
            } else {
              logDebug('Skipping invalid import position:', { startPos, endPos, importText: importText.substring(0, 50) });
            }
          } else {
            logDebug('Invalid import position detected:', { startPos, endPos, sourceLength: sourceText.length });
          }
        },
      });
    } catch (traverseError) {
      const traverseMessage = traverseError instanceof Error ? traverseError.message : String(traverseError);
      logError('Error during AST traversal:', traverseError);
      return {
        start: 0,
        end: 0,
        error: `AST traversal error: ${traverseMessage}`,
      };
    }

    if (!hasImports || firstImportStart === -1 || lastImportEnd === -1 || importPositions.length === 0) {
      return { start: 0, end: 0 };
    }
    const detectedImportSection = sourceText.substring(firstImportStart, lastImportEnd);
    if (!detectedImportSection.includes('import')) {
      logDebug('No import keyword found in detected range, returning empty range');
      return { start: 0, end: 0 };
    }
    let adjustedStartPosition = findActualImportStart(sourceText, firstImportStart);
    adjustedStartPosition = Math.max(0, adjustedStartPosition);
    if (adjustedStartPosition >= lastImportEnd || adjustedStartPosition >= sourceText.length) {
      logDebug('Invalid range detected, falling back to original positions');
      adjustedStartPosition = firstImportStart;
    }
    const finalImportSection = sourceText.substring(adjustedStartPosition, lastImportEnd);
    if (!isValidImportSection(finalImportSection)) {
      return {
        start: 0,
        end: 0,
        error: 'Detected import section contains invalid syntax',
      };
    }

    logDebug('Successfully detected import range:', {
      start: adjustedStartPosition,
      end: lastImportEnd,
      length: lastImportEnd - adjustedStartPosition,
      importsCount: importPositions.length
    });

    return {
      start: adjustedStartPosition,
      end: lastImportEnd,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('Error in findImportsWithBabel:', error);
    let specificError = 'Import analysis error: Unable to parse the file.';
    
    if (errorMessage.includes('Unexpected token')) {
      specificError = 'Syntax error: Unexpected token found. Please check for missing semicolons, quotes, or brackets in your imports.';
    } else if (errorMessage.includes('Invalid left-hand side')) {
      specificError = 'Syntax error: Invalid import statement structure.';
    } else if (errorMessage.includes('Unexpected end of input')) {
      specificError = 'Syntax error: Incomplete import statement found.';
    } else if (errorMessage.includes('Identifier directly after number')) {
      specificError = 'Syntax error: Invalid identifier after number. This may indicate corrupted file content or timestamps in the code.';
    } else if (errorMessage.includes('Cannot parse')) {
      specificError = `Parse error: ${errorMessage}`;
    } else if (errorMessage.length > 0 && errorMessage !== 'undefined') {
      specificError = `Import analysis error: ${errorMessage}`;
    }
    
    return {
      start: 0,
      end: 0,
      error: specificError,
    };
  }
}

/**
 * Enhanced validation for import sections using AST-based approach
 */
function isValidImportSection(importSection: string): boolean {
  if (!importSection || typeof importSection !== 'string') {
    return false;
  }

  const trimmed = importSection.trim();
  if (trimmed.length === 0) {
    return true; // Empty section is valid
  }

  const hasImportKeyword = /\bimport\b/.test(importSection);
  if (!hasImportKeyword) {
    return false;
  }

  // Try to parse with TypeScript parser for validation
  try {
    const ast = parseTypeScript(importSection, {
      ecmaVersion: 2020,
      sourceType: 'module',
      jsx: true,
      errorOnUnknownASTType: false,
      errorOnTypeScriptSyntacticAndSemanticIssues: false,
    });

    // Check if we have valid import declarations
    const hasValidImports = ast.body.some(node => node.type === 'ImportDeclaration');
    return hasValidImports;
  } catch (error) {
    // If TypeScript parser fails, fall back to basic validation
    logDebug('TypeScript validation failed, using basic validation');
  }

  // Basic syntax validation as fallback
  const criticalPatterns = [
    {
      pattern: /import\s*{\s*default\s*}\s*from/,
      description: 'invalid default import syntax'
    },
    {
      pattern: /import\s*{\s*,/,
      description: 'leading comma in import destructuring'
    },
    {
      pattern: /import\s*{[^}]*,\s*}\s*from/,
      description: 'trailing comma in import destructuring'
    }
  ];

  for (const { pattern, description } of criticalPatterns) {
    if (pattern.test(importSection)) {
      logError(`Invalid import section detected: ${description}`);
      return false;
    }
  }

  // Check for balanced braces and quotes
  const openBraces = (importSection.match(/{/g) || []).length;
  const closeBraces = (importSection.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    logError('Unbalanced braces in import section');
    return false;
  }

  const singleQuotes = (importSection.match(/'/g) || []).length;
  const doubleQuotes = (importSection.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
    logError('Unbalanced quotes in import section');
    return false;
  }

  return true;
}

/**
 * Finds the actual start of imports by including preceding comments
 */
function findActualImportStart(sourceText: string, firstImportStart: number): number {
  const lines = sourceText.split('\n');
  let currentPos = 0;
  let importLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = currentPos + lines[i].length;
    if (currentPos <= firstImportStart && firstImportStart <= lineEnd) {
      importLineIndex = i;
      break;
    }
    currentPos = lineEnd + 1; // +1 for the newline character
  }

  if (importLineIndex === -1) {
    return firstImportStart;
  }
  let startLineIndex = importLineIndex;
  for (let i = importLineIndex - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '' || 
        line.startsWith('//') || 
        line.includes('/*') || 
        line.includes('*/')) {
      startLineIndex = i;
    } else {
      break;
    }
  }
  let adjustedStart = 0;
  for (let i = 0; i < startLineIndex; i++) {
    adjustedStart += lines[i].length + 1; // +1 for newline
  }

  return adjustedStart;
}

/**
 * Convertit un numéro de ligne et colonne en position dans le texte.
 * @param text Texte source
 * @param line Numéro de ligne (1-indexed)
 * @param column Numéro de colonne (0-indexed, optionnel)
 * @returns Position dans le texte (0-indexed)
 */
function getPositionFromLine(text: string, line: number, column: number = 0): number {
  if (line <= 0) return 0;

  const lines = text.split('\n');
  let position = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    position += lines[i].length + 1; // +1 for newline character
  }
  if (line - 1 < lines.length) {
    const currentLine = lines[line - 1];
    const safeColumn = Math.min(column, currentLine.length);
    position += safeColumn;
  }

  return Math.max(0, Math.min(position, text.length));
}

async function formatImports(sourceText: string, config: Config, parserResult?: ParserResult): Promise<{ text: string; error?: string }> {
  const importRange = await findImportsWithBabel(sourceText);

  if (importRange === null) {
    return {
      text: sourceText,
      error: 'Dynamic imports or non-import code was detected among static imports.',
    };
  }

  if (importRange.start === importRange.end) {
    return { text: sourceText };
  }

  if (!parserResult) {
    logDebug('No parser result provided, unable to format imports');
    return { text: sourceText };
  }

  if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
    return {
      text: sourceText,
      error: parserResult.invalidImports[0].error,
    };
  }

  try {
    let formattedText = formatImportsFromParser(sourceText, importRange, parserResult, config);

    if (formattedText !== sourceText) {
      return { text: formattedText };
    }

    return { text: sourceText };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showMessage.error(`An error occurred while formatting imports: ${errorMessage}`);
    logError(`An error occurred while formatting imports: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

/**
 * Détermine si le code source a besoin d'être formaté au niveau des imports.
 * @param sourceText Code source à analyser
 * @param config Configuration pour le formatage
 * @param parserResult Résultat du parser (optionnel)
 * @returns Une promesse qui résout à true si le formatage est nécessaire, false sinon
 */
export async function needsFormatting(sourceText: string, config: Config, parserResult?: ParserResult): Promise<boolean> {
  const importRange = await findImportsWithBabel(sourceText);
  if (!importRange || importRange.start === importRange.end) return false;

  if (!parserResult) return false;

  try {
    const formatted = formatImportsFromParser(sourceText, importRange, parserResult, config);

    const originalImportsSection = sourceText.substring(importRange.start, importRange.end);

    const formattedImportRange = await findImportsWithBabel(formatted);
    if (!formattedImportRange) return false;

    const formattedImportsSection = formatted.substring(formattedImportRange.start, formattedImportRange.end);

    return originalImportsSection !== formattedImportsSection;
  } catch (error) {
    console.error('Error in needsFormatting:', error);
    return false;
  }
}

export { cleanUpLines, formatImports, findImportsWithBabel, formatImportsFromParser };
