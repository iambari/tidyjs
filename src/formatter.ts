// Misc
import { Config, FormattedImportGroup } from './types';

// Parser
import { ParsedImport, ParserResult } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';
import { logError, isEmptyLine, showMessage } from './utils/misc';

const fromKeywordRegex = /\bfrom\b/;
const multilineCommentStartRegex = /\/\*/;
const multilineCommentEndRegex = /\*\//;

function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
  if (fromIndex <= 0 || !fromKeywordRegex.test(line)) {
    return line;
  }

  const prefix = line.substring(0, fromIndex);
  const suffix = line.substring(fromIndex);

  return prefix.padEnd(maxFromIndex) + suffix;
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
  const { type, source, specifiers } = importItem;

  if (type === 'sideEffect' || specifiers.length === 0) {
    return `import '${source}';`;
  }

  if (type === 'default' && specifiers.length === 1) {
    return `import ${specifiers[0]} from '${source}';`;
  }

  if (type === 'typeDefault' && specifiers.length === 1) {
    return `import type ${specifiers[0]} from '${source}';`;
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
        return type === 'typeNamed' || type === 'typeDefault' ? 'typeOnly' : type;
      };

      const compareImports = (a: ParsedImport, b: ParsedImport): number => {
        const typeA = resolveTypeKey(a.type);
        const typeB = resolveTypeKey(b.type);

        const typeCompare = importOrder[typeA] - importOrder[typeB];
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

    return sourceText.substring(0, importRange.start) + formattedText + sourceText.substring(importRange.end);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logDebug(`Error while formatting imports: ${errorMessage}`);
    throw error;
  }
}

function findImportsRange(text: string) {
  let startLine = -1;
  let endLine = -1;
  let inMultilineImport = false;
  let inMultilineComment = false;
  let foundNonImportCode = false;
  let foundDynamicImport = false;
  let dynamicImportLine = -1;

  const dynamicImportRegex = /\bimport\s*\(|\bawait\s+import/;
  if (dynamicImportRegex.test(text)) {
    return null;
  }

  const lineStartPositions = [0];
  let currentLine = 0;

  let i = 0;
  let lineStart = 0;
  let inLineComment = false;

  const maxLinesToCheck = 100;

  while (i < text.length && currentLine < maxLinesToCheck) {
    const char = text[i];
    const nextChar = text[i + 1] || '';

    if (char === '\n') {
      inLineComment = false;

      lineStart = i + 1;
      currentLine++;
      lineStartPositions.push(lineStart);
      i++;
      continue;
    }

    if (i === lineStart && /\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '/' && nextChar === '/' && !inMultilineComment && !inLineComment) {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (inLineComment) {
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*' && !inMultilineComment) {
      inMultilineComment = true;
      i += 2;
      continue;
    }

    if (inMultilineComment) {
      if (char === '*' && nextChar === '/') {
        inMultilineComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (i === lineStart || (i > lineStart && /\s/.test(text.substring(lineStart, i).trim()))) {
      if (text.substring(i, i + 6) === 'import' && (text[i + 6] === ' ' || text[i + 6] === '\t' || text[i + 6] === '(')) {
        if (text[i + 6] === '(') {
          foundDynamicImport = true;
          dynamicImportLine = currentLine + 1;

          if (startLine !== -1) {
            logDebug(`Dynamic import found at line ${dynamicImportLine} in the middle of static imports`);
            return null;
          }

          return null;
        }

        if (startLine === -1) {
          startLine = currentLine;
        }

        if (foundNonImportCode) {
          logDebug(`Non-import code found before an import at line ${currentLine + 1}`);
          return null;
        }

        let j = i;
        let bracesCount = 0;
        let foundOpenBrace = false;

        while (j < text.length) {
          const c = text[j];

          if (c === '{') {
            foundOpenBrace = true;
            bracesCount++;
          } else if (c === '}') {
            bracesCount--;
          } else if (c === ';') {
            if (!foundOpenBrace || bracesCount === 0) {
              endLine = currentLine;
              inMultilineImport = false;
              break;
            }
          } else if (c === '\n') {
            if (foundOpenBrace && bracesCount > 0) {
              inMultilineImport = true;
            }
            break;
          }

          j++;
        }

        i = j + 1;
        continue;
      }
    }

    const restOfLine = text.substring(i).split('\n')[0].trim();
    if (restOfLine && !restOfLine.startsWith('export') && !inMultilineImport) {
      if (startLine !== -1 && !foundNonImportCode) {
        foundNonImportCode = true;
        break;
      }

      foundNonImportCode = true;
    }

    i++;
  }

  if (foundDynamicImport && startLine !== -1) {
    logDebug(`Mix of dynamic imports (line ${dynamicImportLine}) and static imports (starting line ${startLine + 1})`);
    return null;
  }

  if (startLine === -1) {
    if (foundDynamicImport) {
      return null;
    }
    return { start: 0, end: 0 };
  }

  while (startLine > 0) {
    const prevLineStart = lineStartPositions[startLine - 1];
    const prevLineEnd = lineStartPositions[startLine] - 1;
    const prevLine = text.substring(prevLineStart, prevLineEnd).trim();

    if (prevLine === '' || prevLine.startsWith('//') || prevLine.includes('/*')) {
      startLine--;
    } else {
      break;
    }
  }

  const finalStartPos = lineStartPositions[startLine];
  const finalEndPos = endLine >= 0 ? lineStartPositions[endLine + 1] || text.length : lineStartPositions[startLine + 1] || text.length;

  let additionalEndPos = finalEndPos;
  let pos = finalEndPos;

  while (pos < text.length) {
    if (text[pos] === '\n') {
      const lineStart = pos + 1;
      const nextLineBreak = text.indexOf('\n', lineStart);
      const lineEnd = nextLineBreak !== -1 ? nextLineBreak : text.length;
      const line = text.substring(lineStart, lineEnd);

      if (line.trim() === '') {
        additionalEndPos = lineEnd + 1;
        pos = lineEnd + 1;
      } else {
        break;
      }
    } else if (/\s/.test(text[pos])) {
      pos++;
    } else {
      break;
    }
  }

  return {
    start: finalStartPos,
    end: additionalEndPos,
  };
}

function formatImports(sourceText: string, config: Config, parserResult?: ParserResult): { text: string; error?: string } {
  const importRange = findImportsRange(sourceText);

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

export function needsFormatting(sourceText: string, config: Config, parserResult?: ParserResult): boolean {
  const importRange = findImportsRange(sourceText);
  if (!importRange || importRange.start === importRange.end) return false;

  if (!parserResult) return false;

  try {
    const formatted = formatImportsFromParser(sourceText, importRange, parserResult, config);
    return formatted !== sourceText;
  } catch {
    return false;
  }
}

export { cleanUpLines, formatImports, findImportsRange, formatImportsFromParser };
