// Misc
import { ImportType } from './parser';
import { maxBy, padEnd, dropRightWhile } from 'lodash';
import type { ParsedImport, ParserResult } from './parser';

// Utils
import { logDebug, logError } from './utils/log';
import { isEmptyLine, showMessage } from './utils/misc';

// Types
import { Config, FormattedImportGroup } from './types';

const fromKeywordRegex = /\bfrom\b/;
const multilineCommentStartRegex = /\/\*/;
const multilineCommentEndRegex = /\*\//;

function replaceImportLines(sourceText: string, importRange: { start: number; end: number }, formattedImports: string): string {
    const lines = sourceText.split('\n');

    // Find line numbers corresponding to importRange more precisely
    let startLine = 0;
    let endLine = 0;
    let currentPos = 0;

    for (let i = 0; i < lines.length; i++) {
        const lineEnd = currentPos + lines[i].length;

        // Find the first line that contains or starts after importRange.start
        if (currentPos <= importRange.start && importRange.start <= lineEnd) {
            startLine = i;
        }

        // Find the last line that contains or ends before importRange.end
        if (currentPos <= importRange.end && importRange.end <= lineEnd + 1) {
            // +1 to include newline
            endLine = i;
        }

        currentPos = lineEnd + 1; // +1 for the \n
    }

    // Replace complete lines - include all lines from startLine to endLine inclusive
    const beforeLines = lines.slice(0, startLine);
    const afterLines = lines.slice(endLine + 1);

    // Handle formatted imports
    let newImportLines: string[] = [];
    if (formattedImports.trim()) {
        newImportLines = formattedImports.split('\n');

        // The formatted imports should already end with exactly one empty line from the formatter
        // If there are following lines, we need to manage the spacing between them
        if (afterLines.length > 0) {
            // Remove any leading empty lines from afterLines to avoid double spacing
            while (afterLines.length > 0 && afterLines[0].trim() === '') {
                afterLines.shift();
            }
        } else {
            // File ends with imports - add an extra empty line for proper file ending
            newImportLines.push('');
        }
    } else {
        // No imports - ensure clean transition
        if (afterLines.length > 0) {
            // Remove excessive empty lines at the start of afterLines
            while (afterLines.length > 0 && afterLines[0].trim() === '') {
                afterLines.shift();
            }

            // If file doesn't start with imports, maintain spacing
            if (beforeLines.length > 0 && afterLines.length > 0) {
                // Check if we need a separator line
                const lastBeforeLine = beforeLines[beforeLines.length - 1];
                const firstAfterLine = afterLines[0];

                if (lastBeforeLine && lastBeforeLine.trim() !== '' && firstAfterLine && firstAfterLine.trim() !== '') {
                    newImportLines = [''];
                }
            }
        }
    }

    return [...beforeLines, ...newImportLines, ...afterLines].join('\n');
}

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
        const targetLength = Math.max(beforeFrom.length + 1, maxFromIndex);
        newLastLine = padEnd(beforeFrom, targetLength) + fromAndAfter;
    } else {
        // Normal case with closing brace
        const beforeContent = lastLine.substring(0, closeBraceIndex + 1);
        const fromAndAfter = lastLine.substring(fromMatch.index);
        const targetLength = Math.max(beforeContent.length + 1, maxFromIndex);
        newLastLine = padEnd(beforeContent, targetLength) + fromAndAfter;
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

    const lineInfos: LineInfo[] = importLines.map((line) => {
        const info: LineInfo = {
            fromIndex: -1,
            isMultiline: false,
            idealFromPosition: 0,
        };

        if (line.includes('\n')) {
            info.isMultiline = true;
            const lines = line.split('\n');
            const middleLines = lines.slice(1, -1);

            // Use maxBy to find the longest line instead of manual reduce
            const longestLine = maxBy(middleLines, (curr) => curr.trim().replace(/,$/, '').trim().length);

            const maxLength = longestLine ? longestLine.trim().replace(/,$/, '').trim().length : 0;
            const maxIndex = longestLine ? middleLines.indexOf(longestLine) : -1;

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

        return info;
    });

    // Use maxBy to find the maximum ideal position instead of manual Math.max
    const maxPositionInfo = maxBy(lineInfos, (info) => info.idealFromPosition);
    const globalMaxFromPosition = maxPositionInfo?.idealFromPosition || 0;

    return importLines.map((line, i) => {
        const info = lineInfos[i];
        if (info.fromIndex === -1) {
            return line;
        }

        return info.isMultiline
            ? alignMultilineFromKeyword(line, info.fromIndex, globalMaxFromPosition)
            : alignFromKeyword(line, info.fromIndex, globalMaxFromPosition);
    });
}

function cleanUpLines(lines: string[]): string[] {
    const processedLines: string[] = [];
    let consecutiveEmptyLines = 0;
    let inMultilineComment = false;

    const isInlineMultilineComment = (normalizedLine: string): boolean => {
        return multilineCommentStartRegex.test(normalizedLine) && multilineCommentEndRegex.test(normalizedLine);
    };

    for (const line of lines) {
        const normalizedLine = line.trim();

        if (normalizedLine.startsWith('//')) {
            processedLines.push(line);
            continue;
        }

        if (multilineCommentStartRegex.test(normalizedLine)) {
            if (isInlineMultilineComment(normalizedLine)) {
                // Don't skip the line, there might be code after the comment
                processedLines.push(line);
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
                processedLines.push(line);
                consecutiveEmptyLines++;
            }
        } else {
            processedLines.push(line);
            consecutiveEmptyLines = 0;
        }
    }

    // Remove trailing empty lines using dropRightWhile
    const withoutTrailingEmpty = dropRightWhile(processedLines, isEmptyLine);

    // Ensure exactly one empty line at the end
    if (withoutTrailingEmpty.length === 0 || !isEmptyLine(withoutTrailingEmpty[withoutTrailingEmpty.length - 1])) {
        withoutTrailingEmpty.push('');
    }

    return withoutTrailingEmpty;
}

function formatImportLine(importItem: ParsedImport): string {
    const { type, source, specifiers } = importItem;

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
        const formattedSpecs = specifiers.map((spec) => (typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`));

        // Remove duplicates and sort
        const specifiersSet = new Set(formattedSpecs);
        const sortedSpecifiers = Array.from(specifiersSet).sort((a, b) => a.length - b.length);

        const parts = [`import ${typePrefix}{`, `    ${sortedSpecifiers.join(',\n    ')}`, `} from '${source}';`];
        return parts.join('\n');
    }

    const typePrefix = type === ImportType.TYPE_NAMED ? 'type ' : '';
    const formattedSpecs = specifiers.map((spec) => (typeof spec === 'string' ? spec : `${spec.imported} as ${spec.local}`));
    const specifiersStr = formattedSpecs.join(', ');
    return `import ${typePrefix}{ ${specifiersStr} } from '${source}';`;
}

function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult
): string {
    if (importRange.start === importRange.end) {
        return sourceText;
    }

    // Check if parser filtered out all imports - if so, remove the import section
    const hasImports = parserResult.groups.some((group) => group.imports.length > 0);
    if (!hasImports) {
        logDebug('No imports remain after parser filtering, removing import section');
        return replaceImportLines(sourceText, importRange, '');
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

        type GroupedImports = Record<
            string,
            {
                order: number;
                imports: ParsedImport[];
            }
        >;

        const importsByGroup: GroupedImports = {};

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

            const formattedGroupName = groupName;
            const groupResult: FormattedImportGroup = {
                groupName,
                commentLine: `// ${formattedGroupName}`,
                importLines: [],
            };

            // Imports are already sorted by the parser
            const orderedImports = consolidatedImports;

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

        // Don't add empty line here - let cleanUpLines handle it
        // formattedLines.push('');

        const cleanedLines = cleanUpLines(formattedLines);
        const formattedText = cleanedLines.join('\n');

        return replaceImportLines(sourceText, importRange, formattedText);
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
        const formattedText = formatImportsFromParser(sourceText, importRange, parserResult);

        return { text: formattedText };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showMessage.error(`An error occurred while formatting imports: ${errorMessage}`);
        logError(`An error occurred while formatting imports: ${errorMessage}`);
        throw new Error(errorMessage);
    }
}

export { formatImports };
