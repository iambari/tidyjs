// Misc
import {
    Config,
    FormattedImportGroup
}                        from './types';
import { logDebug } from './utils/log';
import {
    isEmptyLine,
    showMessage
}                   from './utils/misc';
import { logError }     from './utils/log';
import type { ParsedImport, ParserResult } from './parser';
import { ImportType } from './parser';

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
  
  // Check for invalid patterns like "123abc" or "123import" and fix them
  if (/\d[a-zA-Z_$]/.test(result)) {
    return result.replace(/(\d)([a-zA-Z_$])/g, '$1 $2');
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
  let newLastLine: string;
  
  if (closeBraceIndex === -1) {
    // No closing brace found - apply basic alignment from start of line
    const beforeFrom = lastLine.substring(0, fromMatch.index);
    const fromAndAfter = lastLine.substring(fromMatch.index);
    const exactSpaces = Math.max(1, maxFromIndex - beforeFrom.length);
    newLastLine = beforeFrom + ' '.repeat(exactSpaces) + fromAndAfter;
  } else {
    // Normal case with closing brace
    const beforeContent = lastLine.substring(0, closeBraceIndex + 1);
    const exactSpaces = Math.max(1, maxFromIndex - (closeBraceIndex + 1)); // Ensure at least 1 space
    const fromAndAfter = lastLine.substring(fromMatch.index);
    newLastLine = beforeContent + ' '.repeat(exactSpaces) + fromAndAfter;
  }
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
    if (info.fromIndex === -1) {return line;}

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
      if (isInlineMultilineComment(normalizedLine)) {
        // Don't skip the line, there might be code after the comment
        result.push(line);
        consecutiveEmptyLines = 0;
        continue;
      }
      inMultilineComment = true;
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

  if (type === ImportType.SIDE_EFFECT || specifiers.length === 0) {
    return `import '${source}';`;
  }

  if (type === ImportType.DEFAULT && specifiers.length === 1) {
    const spec = specifiers[0];
    const specStr = typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`;
    return `import ${specStr} from '${source}';`;
  }

  if (type === ImportType.TYPE_DEFAULT && specifiers.length === 1) {
    const spec = specifiers[0];
    const specStr = typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`;
    return `import type ${specStr} from '${source}';`;
  }

  if ((type === ImportType.NAMED || type === ImportType.TYPE_NAMED) && specifiers.length === 1) {
    const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
    const spec = specifiers[0];
    const specStr = typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`;
    return `import ${typePrefix}{ ${specStr} } from '${source}';`;
  }

  if ((type === ImportType.NAMED || type === ImportType.TYPE_NAMED) && specifiers.length > 1) {
    const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
    
    // Convert specifiers to strings for formatting
    const formattedSpecs = specifiers.map(spec => 
      typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`
    );
    
    // Remove duplicates and sort
    const specifiersSet = new Set(formattedSpecs);
    const sortedSpecifiers = Array.from(specifiersSet).sort((a, b) => a.length - b.length);

    const parts = [`import ${typePrefix}{`, `    ${sortedSpecifiers.join(',\n    ')}`, `} from '${source}';`];
    return parts.join('\n');
  }

  const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
  const formattedSpecs = specifiers.map(spec => 
    typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`
  );
  const specifiersStr = formattedSpecs.join(', ');
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

    type GroupedImports = Record<string, {
        order: number;
        imports: ParsedImport[];
      }>;

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
      // Imports are already consolidated by the parser
      const consolidatedImports = imports;
      
      const formattedGroupName = groupName.startsWith('@') ? groupName : extractGroupName(consolidatedImports[0]?.source || '', groupName);
      const groupResult: FormattedImportGroup = {
        groupName,
        commentLine: `// ${formattedGroupName}`,
        importLines: [],
      };

      const importsByType = new Map<string, ParsedImport[]>();

      Object.keys(importOrder).forEach((type) => {
        importsByType.set(type, []);
      });

      for (const importItem of consolidatedImports) {
        const typeArray = importsByType.get(importItem.type) || [];
        typeArray.push(importItem);
        importsByType.set(importItem.type, typeArray);
      }

      const resolveTypeKey = (type: ImportType) => {
        if (type === ImportType.TYPE_NAMED || type === ImportType.TYPE_DEFAULT) {return 'typeOnly';}
        return type;
      };

      const compareImports = (a: ParsedImport, b: ParsedImport): number => {
        const typeA = resolveTypeKey(a.type);
        const typeB = resolveTypeKey(b.type);

        const typeCompare = (importOrder[typeA as keyof typeof importOrder] ?? 0) - (importOrder[typeB as keyof typeof importOrder] ?? 0);
        if (typeCompare !== 0) {return typeCompare;}

        const isReactA = a.source.toLowerCase() === 'react';
        const isReactB = b.source.toLowerCase() === 'react';
        if (isReactA && !isReactB) {return -1;}
        if (!isReactA && isReactB) {return 1;}

        const sourceCompare = a.source.localeCompare(b.source);
        if (sourceCompare !== 0) {return sourceCompare;}

        if ((a.type === ImportType.NAMED || a.type === ImportType.TYPE_NAMED) && (b.type === ImportType.NAMED || b.type === ImportType.TYPE_NAMED) && a.specifiers.length > 1 && b.specifiers.length > 1) {
          const aFirstSpec = typeof a.specifiers[0] === 'string' ? a.specifiers[0] : a.specifiers[0].local;
          const bFirstSpec = typeof b.specifiers[0] === 'string' ? b.specifiers[0] : b.specifiers[0].local;
          return aFirstSpec.length - bFirstSpec.length;
        }

        return 0;
      };

      const orderedImports = [...consolidatedImports].sort(compareImports);

      groupResult.importLines.push(...orderedImports.map(formatImportLine));

      if (groupResult.importLines.length > 0) {
        formattedGroups.push(groupResult);
      }
    }

    const formattedLines: string[] = [];
    const processedGroupNames = new Set<string>();

    for (let groupIndex = 0; groupIndex < formattedGroups.length; groupIndex++) {
      const group = formattedGroups[groupIndex];
      
      // Add blank line before group (except for the first group)
      if (groupIndex > 0) {
        formattedLines.push('');
      }
      
      if (!processedGroupNames.has(group.groupName)) {
        formattedLines.push(group.commentLine);
        processedGroupNames.add(group.groupName);
      }

      const alignedImports = alignImportsInGroup(group.importLines);
      formattedLines.push(...alignedImports);
    }

    // Add exactly one empty line after all imports
    formattedLines.push('');

    const cleanedLines = cleanUpLines(formattedLines);
    const formattedText = cleanedLines.join('\n');

    // Handle the content after imports
    let suffix = sourceText.substring(importRange.end);
    
    // Remove any leading newlines from the suffix
    suffix = suffix.replace(/^\n*/, '');
    
    // Ensure exactly one newline between imports and following content
    // If there's content after imports, add a newline separator
    if (suffix.length > 0) {
      suffix = '\n' + suffix;
    } else {
      // If the file ends with imports, ensure there's still an empty line at the end
      suffix = '\n';
    }

    return sourceText.substring(0, importRange.start) + formattedText + suffix;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logDebug(`Error while formatting imports: ${errorMessage}`);
    throw error;
  }
}




async function formatImports(sourceText: string, config: Config, parserResult?: ParserResult): Promise<{ text: string; error?: string }> {
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

  const importRange = parserResult.importRange;
  if (!importRange || importRange.start === importRange.end) {
    return { text: sourceText };
  }

  try {
    const formattedText = formatImportsFromParser(sourceText, importRange, parserResult, config);

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

export { formatImports };
