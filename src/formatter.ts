import { FormatterConfig, FormattedImportGroup } from './types';
import { isEmptyLine, isCommentLine, logError, showMessage } from './utils/misc';
import { logDebug } from './utils/log';
import { ParsedImport, ParserResult } from 'tidyimport-parser';

function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
    if (fromIndex <= 0 || line.indexOf('from') === -1) {
        return line;
    }

    const beforeFrom = line.substring(0, fromIndex);
    const afterFrom = line.substring(fromIndex);
    
    const paddingSize = maxFromIndex - fromIndex;
    const padding = ' '.repeat(paddingSize);

    return beforeFrom + padding + afterFrom;
}

function alignMultilineFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
    const lines = line.split('\n');
    if (lines.length < 2) {
        return line;
    }
    
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];
    
    const fromIndexInLastLine = lastLine.indexOf('from');
    if (fromIndexInLastLine === -1) {
        return line;
    }
    
    const closeBraceIndex = lastLine.indexOf('}');
    if (closeBraceIndex === -1) return line;
    
    const beforeContent = lastLine.substring(0, closeBraceIndex + 1);
    const exactSpaces = maxFromIndex - (closeBraceIndex + 1);
    const fromAndAfter = lastLine.substring(fromIndexInLastLine);
    
    const newLastLine = beforeContent + ' '.repeat(exactSpaces) + fromAndAfter;
    lines[lastLineIndex] = newLastLine;
    
    return lines.join('\n');
}

function alignImportsInGroup(importLines: string[]): string[] {
    if (importLines.length === 0) {
        return importLines;
    }
    
    const fromIndices = new Map<string, number>();
    
    let globalMaxFromPosition = 0;
    
    for (const line of importLines) {
        if (line.includes('\n')) {
            const lines = line.split('\n');
            
            let longestSpecifier = 0;
            let longestSpecifierIndex = -1;
            
            for (let i = 1; i < lines.length - 1; i++) {
                const specifierLine = lines[i].trim();
                const specifierWithoutComma = specifierLine.replace(/,$/, '').trim();
                
                if (specifierWithoutComma.length > longestSpecifier) {
                    longestSpecifier = specifierWithoutComma.length;
                    longestSpecifierIndex = i;
                }
            }
            
            let idealFromPosition = 4 + longestSpecifier + 1;
            
            const lastSpecifierIndex = lines.length - 2;
            if (longestSpecifierIndex !== lastSpecifierIndex && longestSpecifierIndex !== -1) {
                idealFromPosition += 1;
            }
            
            globalMaxFromPosition = Math.max(globalMaxFromPosition, idealFromPosition);
            
            const lastLine = lines[lines.length - 1];
            const fromIndex = lastLine.indexOf('from');
            if (fromIndex !== -1) {
                fromIndices.set(line, fromIndex);
            }
        } else {
            const importParts = line.split('from');
            if (importParts.length === 2) {
                const beforeFrom = importParts[0].trim();
                const fromPosition = line.indexOf('from');
                fromIndices.set(line, fromPosition);
                globalMaxFromPosition = Math.max(globalMaxFromPosition, beforeFrom.length + 1);
            }
        }
    }
    
    return importLines.map(line => {
        const fromIndex = fromIndices.get(line);
        
        if (fromIndex === undefined) {
            return line;
        }
        
        if (!line.includes('\n')) {
            return alignFromKeyword(line, fromIndex, globalMaxFromPosition);
        } else {
            return alignMultilineFromKeyword(line, fromIndex, globalMaxFromPosition);
        }
    });
}

function cleanUpLines(lines: string[]): string[] {
    const cleanedLines: string[] = [];
    let previousLine = '';
    let consecutiveEmptyLines = 0;

    for (const currentLine of lines) {
        if (isCommentLine(currentLine) && previousLine === currentLine) {
            continue;
        }

        if (isEmptyLine(currentLine)) {
            consecutiveEmptyLines++;
            if (consecutiveEmptyLines > 1) {
                continue;
            }
        } else {
            consecutiveEmptyLines = 0;
        }

        cleanedLines.push(currentLine);
        previousLine = currentLine;
    }

    if (cleanedLines.length > 0 && isEmptyLine(cleanedLines[cleanedLines.length - 1])) {
        cleanedLines.pop();
    }

    cleanedLines.push('');
    cleanedLines.push('');

    return cleanedLines;
}

function formatImportLine(importItem: ParsedImport): string {
    const { type, source, specifiers, raw } = importItem;

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
        const sortedSpecifiers = [...specifiers].sort((a, b) => a.localeCompare(b));
        return `import ${typePrefix}{\n    ${sortedSpecifiers.join(',\n    ')}\n} from '${source}';`;
    }

    return raw;
}

function groupImportsByModuleAndType(imports: ParsedImport[]): Map<string, Map<string, ParsedImport>> {
    const groupedByModule = new Map<string, Map<string, ParsedImport>>();
    
    for (const importItem of imports) {
        if (!groupedByModule.has(importItem.source)) {
            groupedByModule.set(importItem.source, new Map<string, ParsedImport>());
        }
        
        const moduleImports = groupedByModule.get(importItem.source)!;
        
        if (!moduleImports.has(importItem.type)) {
            moduleImports.set(importItem.type, { ...importItem, specifiers: [...importItem.specifiers] });
        } else {
            const existingImport = moduleImports.get(importItem.type)!;
            const mergedSpecifiers = new Set([...existingImport.specifiers, ...importItem.specifiers]);
            existingImport.specifiers = Array.from(mergedSpecifiers);
        }
    }
    
    return groupedByModule;
}

export function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult,
): string {
    if (importRange.start === importRange.end || !parserResult.groups.length) {
        return sourceText;
    }

    try {
        const formattedGroups: FormattedImportGroup[] = [];
        
        const currentImportText = sourceText.substring(importRange.start, importRange.end);
        
        if (currentImportText.includes('import(') || 
            currentImportText.includes('React.lazy') ||
            /await\s+import/.test(currentImportText)) {
            throw new Error("Des imports dynamiques ont été détectés dans la section d'imports statiques");
        }
        
        const sortedGroups = [...parserResult.groups].sort((a, b) => a.order - b.order);
        
        for (const group of sortedGroups) {
            if (!group.imports.length) continue;
            
            const groupResult: FormattedImportGroup = {
                groupName: group.name,
                commentLine: `// ${group.name}`,
                importLines: []
            };
            
            const sortedImports = [...group.imports].sort((a, b) => {
                if (a.isPriority && !b.isPriority) return -1;
                if (!a.isPriority && b.isPriority) return 1;
                
                if (a.source !== b.source) {
                    return a.source.localeCompare(b.source);
                }
                
                const typeOrder = {
                    'sideEffect': 0,
                    'default': 1,
                    'named': 2,
                    'typeDefault': 3,
                    'typeNamed': 4
                };
                
                return (typeOrder[a.type as keyof typeof typeOrder] || 999) - 
                       (typeOrder[b.type as keyof typeof typeOrder] || 999);
            });
            
            const groupedImports = groupImportsByModuleAndType(sortedImports);
            
            for (const [_, moduleImports] of groupedImports) {
                const moduleImportsArray = Array.from(moduleImports.values());
                
                moduleImportsArray.sort((a, b) => {
                    const typeOrder = {
                        'sideEffect': 0,
                        'default': 1,
                        'named': 2,
                        'typeDefault': 3,
                        'typeNamed': 4
                    };
                    
                    return (typeOrder[a.type as keyof typeof typeOrder] || 999) - 
                           (typeOrder[b.type as keyof typeof typeOrder] || 999);
                });
                
                for (const importItem of moduleImportsArray) {
                    const formattedImport = formatImportLine(importItem);
                    groupResult.importLines.push(formattedImport);
                }
            }
            
            formattedGroups.push(groupResult);
        }
        
        const formattedLines: string[] = [];
        
        for (const group of formattedGroups) {
            formattedLines.push(group.commentLine);
            
            const alignedImports = alignImportsInGroup(group.importLines);
            formattedLines.push(...alignedImports);
            
            formattedLines.push('');
        }
        
        const cleanedLines = cleanUpLines(formattedLines);
        const formattedText = cleanedLines.join('\n');
        
        return (
            sourceText.substring(0, importRange.start) +
            formattedText +
            sourceText.substring(importRange.end)
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug(`Erreur lors du formatage des imports: ${errorMessage}`);
        return sourceText;
    }
}

function findImportsRange(text: string): { start: number; end: number } | null {
    const lines = text.split('\n');
    let startLine = -1;
    let endLine = -1;
    let inMultilineImport = false;
    let foundNonImportCode = false;
    let foundDynamicImport = false;
    let dynamicImportLine = -1;
    
    const dynamicImportRegex = /(?:await\s+)?import\s*\(|React\.lazy\s*\(\s*\(\s*\)\s*=>\s*import/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineWithoutComment = line.split('//')[0].trim();
        
        if (line === '' || line.startsWith('//')) {
            continue;
        }
        
        if (lineWithoutComment.startsWith('import ')) {
            if (startLine === -1) {
                startLine = i;
            }
            
            if (foundNonImportCode) {
                logDebug(`Code non-import trouvé avant un import à la ligne ${i+1}`);
                return null;
            }
            
            if (lineWithoutComment.includes('{') && !lineWithoutComment.includes('}') && !lineWithoutComment.endsWith(';')) {
                inMultilineImport = true;
            } else if (lineWithoutComment.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        else if (inMultilineImport) {
            if (lineWithoutComment.includes('}') && lineWithoutComment.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        else if (dynamicImportRegex.test(lineWithoutComment)) {
            foundDynamicImport = true;
            dynamicImportLine = i + 1;
            
            if (startLine !== -1) {
                logDebug(`Import dynamique trouvé à la ligne ${i+1} au milieu des imports statiques`);
                return null;
            }
            
            foundNonImportCode = true;
        }
        else if (lineWithoutComment && !lineWithoutComment.startsWith('export')) {
            if (startLine !== -1 && !foundNonImportCode) {
                foundNonImportCode = true;
                break;
            }
            
            foundNonImportCode = true;
        }
    }
    
    if (foundDynamicImport && startLine !== -1) {
        logDebug(`Mélange d'imports dynamiques (ligne ${dynamicImportLine}) et statiques (commençant ligne ${startLine+1})`);
        return null;
    }
    
    if (startLine === -1) {
        return { start: 0, end: 0 };
    }
    
    const startPos = lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0);
    const endPos = lines.slice(0, endLine + 1).join('\n').length;
    
    const remainingText = text.substring(endPos);
    const remainingLines = remainingText.split('\n');
    let additionalLines = 0;
    
    for (const line of remainingLines) {
        if (line.trim() === '') {
            additionalLines += line.length + 1;
        } else {
            break;
        }
    }
    
    return { 
        start: startPos, 
        end: endPos + additionalLines 
    };
}

export function formatImports(
    sourceText: string, 
    config: FormatterConfig,
    parserResult?: ParserResult
): { text: string; error?: string } {
    const importRange = findImportsRange(sourceText);
    
    if (importRange === null) {
        return {
            text: sourceText,
            error: 'Dynamic imports or non-import code was detected among static imports.'
        };
    }
    
    if (importRange.start === importRange.end) {
        return { text: sourceText };
    }
    
    if (!parserResult) {
        logDebug('Aucun résultat de parser fourni, impossible de formater les imports');
        return { text: sourceText };
    }
    
    try {
        const formattedText = formatImportsFromParser(sourceText, importRange, parserResult);
        return { text: formattedText };
    } catch (error: unknown) {
        const errorMessage = (error as Error).message;
        showMessage.error(`Une erreur est survenue lors du formatage des imports: ${errorMessage}`);
        logError(`Une erreur est survenue lors du formatage des imports: ${errorMessage}`);
        return { text: sourceText, error: errorMessage };
    }
}