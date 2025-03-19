import { FormatterConfig, FormattedImportGroup } from './types';
import { isEmptyLine, isCommentLine } from './utils/misc';
import { logDebug } from './utils/log';
import { ParsedImport, ParserResult } from 'tidyimport-parser';

/**
 * Aligne le mot-clé 'from' dans un import sur une ligne
 */
function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
    if (fromIndex <= 0 || line.indexOf('from') === -1) {
        return line;
    }

    const beforeFrom = line.substring(0, fromIndex);
    const afterFrom = line.substring(fromIndex);
    
    // Calculer l'espacement nécessaire pour aligner exactement avec maxFromIndex
    const paddingSize = maxFromIndex - fromIndex;
    const padding = ' '.repeat(paddingSize);

    return beforeFrom + padding + afterFrom;
}

/**
 * Aligne le mot-clé 'from' dans un import multiligne
 */
function alignMultilineFromKeyword(line: string, fromIndex: number, maxFromIndex: number): string {
    const lines = line.split('\n');
    if (lines.length < 2) {
        return line;
    }
    
    // La dernière ligne contient le mot-clé 'from'
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];
    
    const fromIndexInLastLine = lastLine.indexOf('from');
    if (fromIndexInLastLine === -1) {
        return line;
    }
    
    // Calculer l'espacement nécessaire pour un alignement parfait
    const paddingSize = maxFromIndex - fromIndexInLastLine;
    const newLastLine = lastLine.substring(0, fromIndexInLastLine) + ' '.repeat(paddingSize) + lastLine.substring(fromIndexInLastLine);
    
    // Remplacer la dernière ligne par la version alignée
    lines[lastLineIndex] = newLastLine;
    
    return lines.join('\n');
}

/**
 * Nettoie les lignes pour éviter les commentaires dupliqués et les lignes vides consécutives
 */
function cleanUpLines(lines: string[]): string[] {
    const cleanedLines: string[] = [];
    let previousLine = '';
    let consecutiveEmptyLines = 0;

    for (const currentLine of lines) {
        // Ne pas ajouter de commentaires identiques à la suite
        if (isCommentLine(currentLine) && previousLine === currentLine) {
            continue;
        }

        // Gérer les lignes vides
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

    // Supprimer la dernière ligne vide si elle existe
    if (cleanedLines.length > 0 && isEmptyLine(cleanedLines[cleanedLines.length - 1])) {
        cleanedLines.pop();
    }

    // Ajouter une ligne vide finale pour séparer les imports du reste du code
    cleanedLines.push('');

    return cleanedLines;
}

/**
 * Aligne tous les mots-clés 'from' dans un groupe d'imports en utilisant l'indice le plus à droite
 */
function alignImportsInGroup(importLines: string[]): string[] {
    if (importLines.length === 0) {
        return importLines;
    }
    
    // Calculer les indices "from" pour tous les imports
    const fromIndices = new Map<string, number>();
    let maxRightPosition = 0;
    
    for (const line of importLines) {
        let fromPosition;
        
        if (line.includes('\n')) {
            // Pour les imports multilignes
            const lines = line.split('\n');
            const lastLine = lines[lines.length - 1];
            const fromIndex = lastLine.indexOf('from');
            
            if (fromIndex !== -1) {
                // Calculer la position absolue du "from" dans la dernière ligne
                fromPosition = fromIndex;
            }
        } else {
            // Pour les imports sur une ligne
            fromPosition = line.indexOf('from');
        }
        
        if (fromPosition !== undefined && fromPosition > 0) {
            fromIndices.set(line, fromPosition);
            maxRightPosition = Math.max(maxRightPosition, fromPosition);
        }
    }
    
    // Aligner tous les imports sur la position la plus à droite
    return importLines.map(line => {
        const fromIndex = fromIndices.get(line);
        
        if (fromIndex === undefined) {
            return line;
        }
        
        if (!line.includes('\n')) {
            // Import sur une ligne
            return alignFromKeyword(line, fromIndex, maxRightPosition);
        } else {
            // Import multiligne
            return alignMultilineFromKeyword(line, fromIndex, maxRightPosition);
        }
    });
}

/**
 * Formate un import selon les règles de formatage (multiligne si plusieurs spécificateurs)
 */
function formatImportLine(importItem: ParsedImport): string {
    const { type, source, specifiers, raw } = importItem;

    // Pour les imports de type side-effect ou sans spécificateurs
    if (type === 'sideEffect' || specifiers.length === 0) {
        return `import '${source}';`;
    }

    // Pour les imports par défaut sans imports nommés
    if (type === 'default' && specifiers.length === 1) {
        return `import ${specifiers[0]} from '${source}';`;
    }

    // Pour les imports de type par défaut
    if (type === 'typeDefault' && specifiers.length === 1) {
        return `import type ${specifiers[0]} from '${source}';`;
    }

    // Pour les imports nommés avec un seul spécificateur
    if ((type === 'named' || type === 'typeNamed') && specifiers.length === 1) {
        const typePrefix = type === 'typeNamed' ? 'type ' : '';
        return `import ${typePrefix}{ ${specifiers[0]} } from '${source}';`;
    }

    // Pour les imports nommés avec plusieurs spécificateurs (toujours format multiligne)
    if ((type === 'named' || type === 'typeNamed') && specifiers.length > 1) {
        const typePrefix = type === 'typeNamed' ? 'type ' : '';
        // Trier les spécificateurs par ordre alphabétique pour plus de cohérence
        const sortedSpecifiers = [...specifiers].sort((a, b) => a.localeCompare(b));
        return `import ${typePrefix}{\n    ${sortedSpecifiers.join(',\n    ')}\n} from '${source}';`;
    }

    // Cas par défaut : retourner l'import brut
    return raw;
}

/**
 * Regroupe les imports par module et type
 */
function groupImportsByModuleAndType(imports: ParsedImport[]): Map<string, Map<string, ParsedImport>> {
    const groupedByModule = new Map<string, Map<string, ParsedImport>>();
    
    for (const importItem of imports) {
        // Créer un objet pour ce module s'il n'existe pas encore
        if (!groupedByModule.has(importItem.source)) {
            groupedByModule.set(importItem.source, new Map<string, ParsedImport>());
        }
        
        const moduleImports = groupedByModule.get(importItem.source)!;
        
        // Regrouper par type d'import (default, named, type, etc.)
        if (!moduleImports.has(importItem.type)) {
            moduleImports.set(importItem.type, { ...importItem, specifiers: [...importItem.specifiers] });
        } else {
            // Fusionner les spécificateurs pour les imports du même type
            const existingImport = moduleImports.get(importItem.type)!;
            const mergedSpecifiers = new Set([...existingImport.specifiers, ...importItem.specifiers]);
            existingImport.specifiers = Array.from(mergedSpecifiers);
        }
    }
    
    return groupedByModule;
}

/**
 * Formate les imports en respectant les groupes et l'ordre fournis par le parser
 */
export function formatImportsFromParser(
    sourceText: string,
    importRange: { start: number; end: number },
    parserResult: ParserResult,
): string {
    // Si aucun import trouvé, retourner le texte original
    if (importRange.start === importRange.end || !parserResult.groups.length) {
        return sourceText;
    }

    const formattedGroups: FormattedImportGroup[] = [];
    
    // Traiter chaque groupe d'imports (trier par ordre pour respecter la configuration)
    const sortedGroups = [...parserResult.groups].sort((a, b) => a.order - b.order);
    
    for (const group of sortedGroups) {
        if (!group.imports.length) continue;
        
        const groupResult: FormattedImportGroup = {
            groupName: group.name,
            commentLine: `// ${group.name}`,
            importLines: []
        };
        
        // Trier les imports dans le groupe: d'abord par isPriority, puis par module, puis par type
        const sortedImports = [...group.imports].sort((a, b) => {
            // 1. D'abord par isPriority (les imports prioritaires en premier)
            if (a.isPriority && !b.isPriority) return -1;
            if (!a.isPriority && b.isPriority) return 1;
            
            // 2. Ensuite par module (ordre alphabétique)
            if (a.source !== b.source) {
                return a.source.localeCompare(b.source);
            }
            
            // 3. Enfin par type
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
        
        // Regrouper les imports par module et type pour éviter les doublons
        const groupedImports = groupImportsByModuleAndType(sortedImports);
        
        // Formater les imports module par module
        for (const [_, moduleImports] of groupedImports) {
            const moduleImportsArray = Array.from(moduleImports.values());
            
            // Trier par type
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
            
            // Formater chaque import
            for (const importItem of moduleImportsArray) {
                const formattedImport = formatImportLine(importItem);
                groupResult.importLines.push(formattedImport);
            }
        }
        
        formattedGroups.push(groupResult);
    }
    
    // Générer le texte formaté
    const formattedLines: string[] = [];
    
    for (const group of formattedGroups) {
        // Ajouter le commentaire de groupe
        formattedLines.push(group.commentLine);
        
        // Aligner les imports dans le groupe avec un alignement parfait des 'from'
        const alignedImports = alignImportsInGroup(group.importLines);
        formattedLines.push(...alignedImports);
        
        // Ajouter une ligne vide après chaque groupe
        formattedLines.push('');
    }
    
    // Nettoyer les lignes (supprimer les lignes vides consécutives, etc.)
    const cleanedLines = cleanUpLines(formattedLines);
    const formattedText = cleanedLines.join('\n');
    
    // Remplacer la section d'imports dans le texte original
    return (
        sourceText.substring(0, importRange.start) +
        formattedText +
        sourceText.substring(importRange.end)
    );
}

/**
 * Trouve la plage des imports dans le texte source
 */
function findImportsRange(text: string): { start: number; end: number } {
    // Regex pour trouver les lignes d'import
    const importRegex = /^import\s+.+?;|^\/\/\s*[\w\s@/]+$/gm;

    let firstStart = text.length;
    let lastEnd = 0;
    let match;

    // Trouver tous les imports et commentaires de section
    while ((match = importRegex.exec(text)) !== null) {
        firstStart = Math.min(firstStart, match.index);
        lastEnd = Math.max(lastEnd, match.index + match[0].length);
    }

    // Si aucun import n'est trouvé, retourner une plage vide
    if (firstStart === text.length) {
        return { start: 0, end: 0 };
    }

    // Rechercher plus loin pour les imports multilignes
    const lines = text.split('\n');
    let startLine = -1;
    let endLine = -1;
    let inMultilineImport = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Détecter le début d'un import
        if (line.startsWith('import ')) {
            if (startLine === -1) {
                startLine = i;
            }
            
            // Vérifier si c'est un import multiligne
            if (line.includes('{') && !line.includes('}') && !line.endsWith(';')) {
                inMultilineImport = true;
            } else if (line.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        // Pour les lignes d'un import multiligne
        else if (inMultilineImport) {
            if (line.includes('}') && line.endsWith(';')) {
                endLine = i;
                inMultilineImport = false;
            }
        }
        // Pour les commentaires de section
        else if (line.startsWith('//')) {
            if (startLine === -1) {
                startLine = i;
            }
            endLine = i;
        }
        // Si on a déjà trouvé des imports et qu'on rencontre une ligne non-import
        else if (startLine !== -1 && !line.trim() && !inMultilineImport) {
            // Ne rien faire, ignorer les lignes vides
        }
        // Si on rencontre du code après avoir trouvé des imports
        else if (startLine !== -1 && line.trim() && !inMultilineImport) {
            break;
        }
    }
    
    // Calculer les positions de début et de fin
    if (startLine !== -1 && endLine !== -1) {
        const startPos = lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0);
        const endPos = lines.slice(0, endLine + 1).join('\n').length;
        
        // Ajuster en fonction de ce qu'on a trouvé précédemment
        firstStart = Math.min(firstStart, startPos);
        lastEnd = Math.max(lastEnd, endPos);
    }

    // Ajuster la fin pour inclure les lignes vides suivantes
    const remainingText = text.substring(lastEnd);
    const remainingLines = remainingText.split('\n');
    let additionalLines = 0;
    
    for (const line of remainingLines) {
        if (line.trim() === '') {
            additionalLines += line.length + 1; // +1 pour le saut de ligne
        } else {
            break;
        }
    }

    return { 
        start: firstStart, 
        end: lastEnd + additionalLines 
    };
}

/**
 * Point d'entrée principal pour le formatage des imports
 */
export function formatImports(
    sourceText: string, 
    config: FormatterConfig,
    parserResult?: ParserResult
): string {
    // Trouver la plage des imports dans le texte source
    const importRange = findImportsRange(sourceText);
    
    // Si aucun import n'est trouvé, retourner le texte original
    if (importRange.start === importRange.end) {
        return sourceText;
    }
    
    // Si aucun résultat de parser n'est fourni, retourner le texte original
    if (!parserResult) {
        logDebug('Aucun résultat de parser fourni, impossible de formater les imports');
        return sourceText;
    }
    
    // Formater les imports
    return formatImportsFromParser(sourceText, importRange, parserResult);
}