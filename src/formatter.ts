// Misc
import {
    FormatterConfig,
    FormattedImportGroup
}                        from './types';

// Core
import {
    ParsedImport,
    ParserResult
}                 from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';
import {
    logError,
    isEmptyLine,
    showMessage
}                   from './utils/misc';

const fromKeywordRegex = /\bfrom\b/;
const multilineCommentStartRegex = /\/\*/;
const multilineCommentEndRegex = /\*\//;
const importStartRegex = /^import\s/;

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

    // Analyser tous les imports en une seule passe
    for (let i = 0; i < importLines.length; i++) {
        const line = importLines[i];
        const info: LineInfo = {
            fromIndex: -1,
            isMultiline: false,
            idealFromPosition: 0
        };

        if (line.includes('\n')) {
            info.isMultiline = true;
            const lines = line.split('\n');
            // Optimisation : Utiliser reduce au lieu d'une boucle for
            const { maxLength, maxIndex } = lines.slice(1, -1).reduce((acc, curr, idx) => {
                const len = curr.trim().replace(/,$/, '').trim().length;
                if (len > acc.maxLength) {
                    return { maxLength: len, maxIndex: idx };
                }
                return acc;
            }, { maxLength: 0, maxIndex: -1 });

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

    // Appliquer l'alignement en une seule passe
    return importLines.map((line, i) => {
        const info = lineInfos[i];
        if (info.fromIndex === -1) return line;
        
        return info.isMultiline ? 
            alignMultilineFromKeyword(line, info.fromIndex, globalMaxFromPosition) :
            alignFromKeyword(line, info.fromIndex, globalMaxFromPosition);
    });
}

function cleanUpLines(lines: string[]): string[] {
    const result: string[] = [];
    let consecutiveEmptyLines = 0;
    const seenGroupComments = new Set<string>();
    let inMultilineComment = false;
    
    for (const currentLine of lines) {
        const normalizedLine = currentLine.trim();
        
        if (multilineCommentStartRegex.test(normalizedLine)) {
            inMultilineComment = true;
        }
        
        if (inMultilineComment) {
            if (multilineCommentEndRegex.test(normalizedLine)) {
                inMultilineComment = false;
            }
            continue;
        }
        
        if (normalizedLine.startsWith('// ')) {
            const groupName = normalizedLine.substring(3).trim();
            
            if (!seenGroupComments.has(groupName)) {
                seenGroupComments.add(groupName);
                result.push(currentLine);
            }
            continue;
        }
        
        if (normalizedLine.startsWith('//')) {
            continue;
        }

        if (isEmptyLine(currentLine)) {
            if (consecutiveEmptyLines < 1) {
                result.push(currentLine);
                consecutiveEmptyLines++;
            }
        } else {
            result.push(currentLine);
            consecutiveEmptyLines = 0;
        }
    }

    // Supprimer la dernière ligne vide si elle existe
    while (result.length > 0 && isEmptyLine(result[result.length - 1])) {
        result.pop();
    }

    // Ajouter deux lignes vides à la fin
    result.push('');
    result.push('');

    return result;
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
        const specifiersSet = new Set(specifiers);
        const sortedSpecifiers = Array.from(specifiersSet).sort((a, b) => a.length - b.length);
        
        // Optimiser la construction de la chaîne avec array join
        const parts = [
            `import ${typePrefix}{`,
            `    ${sortedSpecifiers.join(',\n    ')}`,
            `} from '${source}';`
        ];
        return parts.join('\n');
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
        
        const dynamicImportTest = /import\(|await\s+import/;
        if (dynamicImportTest.test(currentImportText)) {
            throw new Error('Dynamic imports detected in the static imports section');
        }
        
        const currentLines = currentImportText.split('\n');
        const importsOnly: string[] = [];
        let inMultilineComment = false;
        
        for (const line of currentLines) {
            const trimmedLine = line.trim();
            
            if (multilineCommentStartRegex.test(trimmedLine)) {
                inMultilineComment = true;
            }
            
            if (inMultilineComment) {
                if (multilineCommentEndRegex.test(trimmedLine)) {
                    inMultilineComment = false;
                }
            }
            
            if (trimmedLine.startsWith('//')) {
                continue;
            }
            
            importsOnly.push(line);
        }
        
        // Optimisation : Utiliser un objet pour les groupes d'imports
        interface GroupedImports {
            [groupName: string]: {
                order: number;
                imports: ParsedImport[];
            };
        }

        const importsByGroup: GroupedImports = {};
        const typeOrder = config.typeOrder || {
            'default': 0,
            'named': 1,
            'typeDefault': 2,
            'typeNamed': 3,
            'sideEffect': 4
        };

        // Regrouper les imports en une seule passe
        parserResult.groups.forEach(group => {
            if (group.imports?.length) {
                importsByGroup[group.name] = {
                    order: group.order,
                    imports: group.imports
                };
            }
        });

        // Optimisation: Utiliser des Set et Array.from pour le tri
        const importGroupEntries = Array.from(Object.entries(importsByGroup));
        importGroupEntries.sort(([,a], [,b]) => a.order - b.order);
        
        const formattedGroups: FormattedImportGroup[] = [];
        
        // Trier et traiter les groupes
        for (const [groupName, { imports }] of importGroupEntries) {
            const groupResult: FormattedImportGroup = {
                groupName,
                commentLine: `// ${groupName}`,
                importLines: []
            };

            // Optimisation : Utiliser un objet pour regrouper les imports
            const importsByType: { [key: string]: ParsedImport[] } = {
                priority: [],
                default: [],
                named: [],
                typeDefault: [],
                typeNamed: [],
                sideEffect: []
            };

            // Optimisation : Set pour déduplication avec une fonction de hachage plus efficace
            const processedImportKeys = new Set<string>();
            const importKeyCache = new Map<ParsedImport, string>();

            // Regrouper les imports en une seule passe avec mise en cache des clés
            imports.forEach(importItem => {
                let importKey = importKeyCache.get(importItem);
                if (!importKey) {
                    importKey = `${importItem.type}:${importItem.source}:${importItem.specifiers.sort().join(',')}`;
                    importKeyCache.set(importItem, importKey);
                }
                
                if (!processedImportKeys.has(importKey)) {
                    processedImportKeys.add(importKey);
                    const targetArray = importItem.isPriority ? importsByType.priority : importsByType[importItem.type];
                    targetArray.push(importItem);
                }
            });
            
            // Optimisation : Utiliser un Map pour le tri par source
            const importTypeKeys = Object.keys(importsByType);
            for (const typeKey of importTypeKeys) {
                const imports = importsByType[typeKey];
                if (imports.length > 1) {
                    imports.sort((a, b) => a.source.localeCompare(b.source));
                }
            }

            // Traiter les imports prioritaires
            const priorityImportsByType = ['default', 'named', 'typeDefault', 'typeNamed', 'sideEffect']
                .reduce((acc: ParsedImport[], type) => {
                    acc.push(...importsByType.priority.filter(imp => imp.type === type));
                    return acc;
                }, []);

            // Ajouter les imports dans l'ordre défini
            groupResult.importLines.push(
                ...priorityImportsByType.map(formatImportLine),
                ...Object.keys(typeOrder)
                    .sort((a, b) => typeOrder[a as keyof typeof typeOrder] - typeOrder[b as keyof typeof typeOrder])
                    .flatMap(type => importsByType[type].map(formatImportLine))
            );
            
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
        throw error;
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
        
        if (multilineCommentStartRegex.test(line)) {
            inMultilineComment = true;
        }
        
        if (inMultilineComment) {
            if (multilineCommentEndRegex.test(line)) {
                inMultilineComment = false;
            }
            continue;
        }
        
        if (line === '' || line.startsWith('//')) {
            continue;
        }
        
        const lineWithoutComment = line.split('//')[0].trim();
        
        if (importStartRegex.test(lineWithoutComment)) {
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
    
    if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
        return {
            text: sourceText,
            error: parserResult.invalidImports[0].error
        };
    }

    try {
        const formattedText = formatImportsFromParser(sourceText, importRange, parserResult, config);
        return { text: formattedText };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showMessage.error(`An error occurred while formatting imports: ${errorMessage}`);
        logError(`An error occurred while formatting imports: ${errorMessage}`);
        throw new Error(errorMessage);
    }
}
