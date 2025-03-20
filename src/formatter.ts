import { FormatterConfig, FormattedImportGroup } from './types';
import { isEmptyLine, logError, showMessage } from './utils/misc';
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
    let consecutiveEmptyLines = 0;
    const seenGroupComments = new Set<string>();
    let inMultilineComment = false;

    for (const currentLine of lines) {
        const normalizedLine = currentLine.trim();
        
        if (normalizedLine.includes('/*')) {
            inMultilineComment = true;
        }
        
        if (inMultilineComment) {
            if (normalizedLine.includes('*/')) {
                inMultilineComment = false;
            }
            continue;
        }
        
        if (normalizedLine.startsWith('// ')) {
            const groupName = normalizedLine.substring(3).trim();
            
            if (seenGroupComments.has(groupName)) {
                continue;
            }
            
            seenGroupComments.add(groupName);
        }
        else if (normalizedLine.startsWith('//')) {
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
        const sortedSpecifiers = [...specifiers].sort((a, b) => a.length - b.length);
        return `import ${typePrefix}{\n    ${sortedSpecifiers.join(',\n    ')}\n} from '${source}';`;
    }

    return raw;
}

export function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult,
    config: FormatterConfig,
): string {
    if (importRange.start === importRange.end || !parserResult.groups.length) {
        return sourceText;
    }

    try {
        const currentImportText = sourceText.substring(importRange.start, importRange.end);
        
        if (currentImportText.includes('import(') ||
            /await\s+import/.test(currentImportText)) {
            throw new Error('Dynamic imports detected in the static imports section');
        }
        
        const currentLines = currentImportText.split('\n');
        const importsOnly: string[] = [];
        let inMultilineComment = false;
        
        for (const line of currentLines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.includes('/*')) {
                inMultilineComment = true;
            }
            
            if (inMultilineComment) {
                if (trimmedLine.includes('*/')) {
                    inMultilineComment = false;
                }
            }
            
            if (trimmedLine.startsWith('//')) {
                continue;
            }
            
            importsOnly.push(line);
        }
        
        const importsByGroupName = new Map<string, ParsedImport[]>();
        
        const sortedGroups = [...parserResult.groups].sort((a, b) => a.order - b.order);
        
        for (const group of sortedGroups) {
            if (group.imports && group.imports.length) {
                importsByGroupName.set(group.name, [...group.imports]);
            }
        }
        
        const formattedGroups: FormattedImportGroup[] = [];
        
        for (const [groupName, imports] of importsByGroupName.entries()) {
            if (!imports.length) continue;
            
            const groupResult: FormattedImportGroup = {
                groupName: groupName,
                commentLine: `// ${groupName}`,
                importLines: []
            };
            
            // Définir l'ordre des types d'imports
            const typeOrder = config.typeOrder || {
                'default': 0,
                'named': 1,
                'typeDefault': 2,
                'typeNamed': 3,
                'sideEffect': 4
            };
            
            // Regrouper les imports par type
            const defaultImports: ParsedImport[] = [];
            const namedImports: ParsedImport[] = [];
            const typeDefaultImports: ParsedImport[] = [];
            const typeNamedImports: ParsedImport[] = [];
            const sideEffectImports: ParsedImport[] = [];
            
            // Traitement spécial pour les imports prioritaires
            const priorityImports: ParsedImport[] = [];
            
            // Regrouper les imports par type et source pour éviter les doublons
            const processedImportKeys = new Set<string>();
            
            for (const importItem of imports) {
                const importKey = `${importItem.type}:${importItem.source}:${importItem.specifiers.sort().join(',')}`;
                
                if (processedImportKeys.has(importKey)) {
                    continue;
                }
                
                processedImportKeys.add(importKey);
                
                if (importItem.isPriority) {
                    priorityImports.push(importItem);
                } else {
                    switch (importItem.type) {
                        case 'default':
                            defaultImports.push(importItem);
                            break;
                        case 'named':
                            namedImports.push(importItem);
                            break;
                        case 'typeDefault':
                            typeDefaultImports.push(importItem);
                            break;
                        case 'typeNamed':
                            typeNamedImports.push(importItem);
                            break;
                        case 'sideEffect':
                            sideEffectImports.push(importItem);
                            break;
                    }
                }
            }
            
            // Trier les imports par source au sein de chaque groupe
            const sortBySource = (a: ParsedImport, b: ParsedImport) => a.source.localeCompare(b.source);
            
            defaultImports.sort(sortBySource);
            namedImports.sort(sortBySource);
            typeDefaultImports.sort(sortBySource);
            typeNamedImports.sort(sortBySource);
            sideEffectImports.sort(sortBySource);
            
            // Forcer l'ordre des imports prioritaires selon leur type
            const priorityDefaultImports = priorityImports.filter(imp => imp.type === 'default');
            const priorityNamedImports = priorityImports.filter(imp => imp.type === 'named');
            const priorityTypeDefaultImports = priorityImports.filter(imp => imp.type === 'typeDefault');
            const priorityTypeNamedImports = priorityImports.filter(imp => imp.type === 'typeNamed');
            const prioritySideEffectImports = priorityImports.filter(imp => imp.type === 'sideEffect');
            
            const orderedPriorityImports = [
                ...priorityDefaultImports,
                ...priorityNamedImports,
                ...priorityTypeDefaultImports,
                ...priorityTypeNamedImports,
                ...prioritySideEffectImports
            ];
            
            // Combiner tous les imports dans l'ordre défini par config.typeOrder
            const orderedOtherImports: ParsedImport[] = [];
            
            // Ajouter les imports dans l'ordre défini dans config.typeOrder
            for (const type of Object.keys(typeOrder).sort((a, b) => typeOrder[a as keyof typeof typeOrder] - typeOrder[b as keyof typeof typeOrder])) {
                switch (type) {
                    case 'default':
                        orderedOtherImports.push(...defaultImports);
                        break;
                    case 'named':
                        orderedOtherImports.push(...namedImports);
                        break;
                    case 'typeDefault':
                        orderedOtherImports.push(...typeDefaultImports);
                        break;
                    case 'typeNamed':
                        orderedOtherImports.push(...typeNamedImports);
                        break;
                    case 'sideEffect':
                        orderedOtherImports.push(...sideEffectImports);
                        break;
                }
            }
            
            // Ajouter d'abord les imports prioritaires triés
            for (const importItem of orderedPriorityImports) {
                const formattedImport = formatImportLine(importItem);
                groupResult.importLines.push(formattedImport);
            }
            
            // Puis ajouter les autres imports
            for (const importItem of orderedOtherImports) {
                const formattedImport = formatImportLine(importItem);
                groupResult.importLines.push(formattedImport);
            }
            
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
        
        return (
            sourceText.substring(0, importRange.start) +
            formattedText +
            sourceText.substring(importRange.end)
        );
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug(`Error while formatting imports: ${errorMessage}`);
        return sourceText;
    }
}

function findImportsRange(text: string): { start: number; end: number } | null {
    const lines = text.split('\n');
    let startLine = -1;
    let endLine = -1;
    let inMultilineImport = false;
    let inMultilineComment = false;
    let foundNonImportCode = false;
    let foundDynamicImport = false;
    let dynamicImportLine = -1;
    
    const dynamicImportRegex = /(?:await\s+)?import\s*\(/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('/*')) {
            inMultilineComment = true;
        }
        
        if (inMultilineComment) {
            if (line.includes('*/')) {
                inMultilineComment = false;
            }
            continue;
        }
        
        if (line === '' || line.startsWith('//')) {
            continue;
        }
        
        const lineWithoutComment = line.split('//')[0].trim();
        
        if (lineWithoutComment.startsWith('import ')) {
            if (startLine === -1) {
                startLine = i;
            }
            
            if (foundNonImportCode) {
                logDebug(`Non-import code found before an import at line ${i+1}`);
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
                logDebug(`Dynamic import found at line ${i+1} in the middle of static imports`);
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
        logDebug(`Mix of dynamic imports (line ${dynamicImportLine}) and static imports (starting line ${startLine+1})`);
        return null;
    }
    
    if (startLine === -1) {
        return { start: 0, end: 0 };
    }
    
    while (startLine > 0) {
        const prevLine = lines[startLine - 1].trim();
        if (prevLine === '' || prevLine.startsWith('//') || prevLine.includes('/*')) {
            startLine--;
        } else {
            break;
        }
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
        logDebug('No parser result provided, unable to format imports');
        return { text: sourceText };
    }
    
    try {
        const formattedText = formatImportsFromParser(sourceText, importRange, parserResult, config);
        return { text: formattedText };
    } catch (error: unknown) {
        const errorMessage = (error as Error).message;
        showMessage.error(`An error occurred while formatting imports: ${errorMessage}`);
        logError(`An error occurred while formatting imports: ${errorMessage}`);
        return { text: sourceText, error: errorMessage };
    }
}
