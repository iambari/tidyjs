import * as ts from 'typescript';
import { adaptParserOutput, parseImports } from './parser';
import type { FormattedImport, FormatterConfig, FormattedImportGroup, ImportNameWithComment } from './types';
import { configManager } from './utils/config';
import { logDebug } from './utils/log';
import { alignFromKeyword, formatSimpleImport, getFromIndex, isCommentLine, isEmptyLine, isSectionComment, sortImportNamesByLength } from './utils/misc';

// Cache pour la memoization des calculs de longueur
const lengthMemoCache = new Map<string, number>();

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

function alignImportsInGroup(
    importLines: string[], 
    config: FormatterConfig
): string[] {
    // Optimisation: Calculer les indices "from" en une seule passe
    const fromIndices = new Map<string, number>();
    let maxWidth = 0;
    
    for (const line of importLines) {
        const isMultiline = line.includes('\n');
        const fromIndex = getFromIndex(line, isMultiline);
        
        if (fromIndex > 0) {
            fromIndices.set(line, fromIndex);
            maxWidth = Math.max(maxWidth, fromIndex);
        }
    }

    // Aligner tous les "from" du groupe en ajoutant l'espacement configuré
    return importLines.map((line) => {
        const fromIndex = fromIndices.get(line);
        if (fromIndex !== undefined) {
            return alignFromKeyword(line, fromIndex, maxWidth, config.alignmentSpacing);
        }
        return line;
    });
}

function alignImportsBySection(
    formattedGroups: FormattedImportGroup[],
    config: FormatterConfig = configManager.getFormatterConfig()
): string[] {
    const resultLines: string[] = [];
    const seenGroups = new Set<string>();

    for (const group of formattedGroups) {
        const { groupName, importLines } = group;
        
        // Si ce groupe a déjà été traité, ignorer son commentaire
        if (seenGroups.has(groupName)) {
            logDebug(`Groupe dupliqué ignoré: ${groupName}`);
            continue;
        }
        
        seenGroups.add(groupName);
        
        // Ajouter le commentaire de groupe normalisé
        resultLines.push(`// ${groupName}`);

        // Aligner les imports au sein du groupe
        const alignedImports = alignImportsInGroup(importLines, config);

        // Ajouter les imports alignés
        resultLines.push(...alignedImports);

        // Ajouter une ligne vide après chaque groupe
        resultLines.push('');
    }

    // Nettoyage des lignes vides et commentaires dupliqués
    return cleanUpLines(resultLines);
}

function removeCommentsFromImports(text: string, config: FormatterConfig): string {
    return text.split('\n').map(line => {
        // Don't remove section comments
        if (isSectionComment(line, config)) {
            return line;
        }
        
        // Remove all inline comments in named imports
        if (line.trim().includes('{') || line.trim().includes('}') || 
            line.trim().match(/^[a-zA-Z0-9_]+,?$/) || 
            (line.trim().match(/^\s*[a-zA-Z0-9_]+\s*(,|$)/) !== null)) {
            
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                const cleanedLine = line.substring(0, commentIndex).trimRight();
                // Only return non-empty lines after comment removal
                return cleanedLine.trim() ? cleanedLine : '';
            }
        }
        
        // Only remove standalone comments if they're not to the right of an import
        if (config.regexPatterns.anyComment.test(line) && 
            !line.includes('import') && 
            !line.trim().match(/[a-zA-Z0-9_]+\s*\/\//)) {
            return '';
        }
        return line;
    }).join('\n');
}

function getMemoizedLength(importItem: FormattedImport): number {
    // Créer une clé unique basée sur les propriétés de l'import
    const cacheKey = `${importItem.moduleName}_${importItem.isDefaultImport}_${importItem.hasNamedImports}_${importItem.importNames.join(',')}`;
    
    if (lengthMemoCache.has(cacheKey)) {
        return lengthMemoCache.get(cacheKey)!;
    }
    
    const length = calculateEffectiveLengthForSorting(importItem);
    lengthMemoCache.set(cacheKey, length);
    return length;
}

function calculateEffectiveLengthForSorting(importItem: FormattedImport): number {
    // Import par défaut sans imports nommés
    if (importItem.isDefaultImport && !importItem.hasNamedImports) {
        return importItem.importNames[0].length;
    }
    
    // Imports nommés sans import par défaut
    if (!importItem.isDefaultImport && importItem.hasNamedImports) {
        const namedImports = importItem.importNames;
        if (namedImports.length > 0) {
            // Optimisation: Éviter de mapper puis de prendre le max
            let maxLength = 0;
            for (const name of namedImports) {
                maxLength = Math.max(maxLength, name.length);
            }
            return maxLength;
        }
    }
    
    // Import par défaut avec imports nommés
    if (importItem.isDefaultImport && importItem.hasNamedImports) {
        const namedImports = importItem.importNames.slice(1);
        if (namedImports.length > 0) {
            // Optimisation: Éviter de mapper puis de prendre le max
            let maxLength = importItem.importNames[0].length;
            for (const name of namedImports) {
                maxLength = Math.max(maxLength, name.length);
            }
            return maxLength;
        }
        return importItem.importNames[0].length;
    }
    
    // Cas par défaut
    return 0;
}

const getEffectiveLengthForSorting = getMemoizedLength;

function formatDefaultImport(defaultName: string, moduleName: string, isTypeImport: boolean): string {
    return isTypeImport 
        ? `import type ${defaultName} from '${moduleName}';`
        : `import ${defaultName} from '${moduleName}';`;
}

function formatNamedImports(
    namedImports: (string | ImportNameWithComment)[], 
    moduleName: string, 
    isTypeImport: boolean
): string {
    const typePrefix = isTypeImport ? 'type ' : '';
    
    // Formatter les imports en supprimant les commentaires
    const formattedItems = namedImports.map(item => {
        if (typeof item === 'string') {
            // Handle inline comments more robustly
            const commentIndex = item.indexOf('//');
            if (commentIndex !== -1) {
                return item.substring(0, commentIndex).trim();
            }
            return item.trim();
        }
        // For ImportNameWithComment objects, just return the name
        return item.name.trim();
    });
    
    // Filter out any empty items that might have resulted from comment processing
    const cleanedItems = formattedItems.filter(item => item.trim() !== '');
    
    // Si aucun import n'est resté après nettoyage, gérer ce cas spécial
    if (cleanedItems.length === 0) {
        return `import ${typePrefix}{} from '${moduleName}';`;
    }
    
    if (cleanedItems.length === 1) {
        return `import ${typePrefix}{ ${cleanedItems[0]} } from '${moduleName}';`;
    } else {
        return `import ${typePrefix}{
    ${cleanedItems.join(',\n    ')}
} from '${moduleName}';`;
    }
}

function formatDefaultAndNamedImports(
    defaultName: string, 
    namedImports: (string | ImportNameWithComment)[], 
    moduleName: string, 
    isTypeImport: boolean
): string {
    const typePrefix = isTypeImport ? 'type ' : '';
    
    // Format default import
    const defaultImport = `import ${typePrefix}${defaultName} from '${moduleName}';`;
    
    // Format named imports, supprimer les commentaires
    const formattedItems = namedImports.map(item => {
        if (typeof item === 'string') {
            // Check if the item has an inline comment and remove it
            const commentIndex = item.indexOf('//');
            if (commentIndex !== -1) {
                return item.substring(0, commentIndex).trim();
            }
            return item;
        }
        // Ignorer le commentaire, ne garder que le nom
        return item.name;
    });
    
    // Format named imports as a separate statement
    let namedImport;
    if (formattedItems.length === 1) {
        namedImport = `import ${typePrefix}{ ${formattedItems[0]} } from '${moduleName}';`;
    } else {
        namedImport = `import ${typePrefix}{
    ${formattedItems.join(',\n    ')}
} from '${moduleName}';`;
    }
    
    // Return both imports as separate statements
    return `${defaultImport}\n${namedImport}`;
}

function formatImportItem(
    importItem: FormattedImport,
    statements: string[]
): void {
    const {
        moduleName,
        importNames,
        isTypeImport,
        isDefaultImport,
        hasNamedImports,
    } = importItem;

    // Si aucun nom d'import, c'est un import de module simple (side-effect import)
    if (importNames.length === 0) {
        statements.push(formatSimpleImport(moduleName));
        return;
    }

    // Filtrer et trier les imports nommés
    const namedImports = hasNamedImports
        ? importNames.filter((_, index) => (isDefaultImport ? index > 0 : true))
        : [];

    // Import par défaut uniquement (including type default imports)
    if (isDefaultImport && namedImports.length === 0) {
        statements.push(formatDefaultImport(importNames[0], moduleName, isTypeImport));
        return;
    }

    // Tri par longueur des noms d'import (du plus court au plus long)
    const sortedNamedImports = sortImportNamesByLength(namedImports);

    // Import par défaut ET imports nommés
    if (isDefaultImport && namedImports.length > 0) {
        statements.push(formatDefaultAndNamedImports(
            importNames[0], 
            sortedNamedImports, 
            moduleName, 
            isTypeImport
        ));
    }
    // Uniquement des imports nommés
    else if (namedImports.length > 0) {
        statements.push(formatNamedImports(sortedNamedImports, moduleName, isTypeImport));
    }
}

function sortImportsInGroup(imports: FormattedImport[]): FormattedImport[] {
    return imports.sort((a, b) => {
        // First sort side-effect imports to the top
        const aIsSideEffect = a.importNames.length === 0;
        const bIsSideEffect = b.importNames.length === 0;
        
        if (aIsSideEffect && !bIsSideEffect) return -1;
        if (!aIsSideEffect && bIsSideEffect) return 1;
        
        // Order: default > named > type default > type named
        const aIsReact = a.moduleName === 'react';
        const bIsReact = b.moduleName === 'react';
        
        // Handle React imports first
        if (aIsReact && !bIsReact) return -1;
        if (!aIsReact && bIsReact) return 1;
        
        if (aIsReact && bIsReact) {
            // 1. Default imports (non-type)
            if (a.isDefaultImport && !a.isTypeImport && (!b.isDefaultImport || b.isTypeImport)) return -1;
            if (b.isDefaultImport && !b.isTypeImport && (!a.isDefaultImport || a.isTypeImport)) return 1;
            
            // 2. Named imports (non-type)
            if (!a.isDefaultImport && !a.isTypeImport && (b.isDefaultImport || b.isTypeImport)) return -1;
            if (!b.isDefaultImport && !b.isTypeImport && (a.isDefaultImport || a.isTypeImport)) return 1;
            
            // 3. Type default imports
            if (a.isDefaultImport && a.isTypeImport && (!b.isDefaultImport || !b.isTypeImport)) return -1;
            if (b.isDefaultImport && b.isTypeImport && (!a.isDefaultImport || !a.isTypeImport)) return 1;
            
            // 4. Type named imports
            if (!a.isDefaultImport && a.isTypeImport && b.isDefaultImport) return -1;
            if (!b.isDefaultImport && b.isTypeImport && a.isDefaultImport) return 1;
        }
        
        // For non-React modules, sort by module name
        if (a.moduleName !== b.moduleName) {
            return a.moduleName.localeCompare(b.moduleName);
        }
        
        // Within the same module type, sort by type (non-type first)
        if (a.isTypeImport !== b.isTypeImport) {
            return a.isTypeImport ? 1 : -1;
        }
        
        // Sort by effective length for imports of the same type
        const aLength = getEffectiveLengthForSorting(a);
        const bLength = getEffectiveLengthForSorting(b);
        return bLength - aLength;
    });
}

function groupImportsOptimized(
    imports: FormattedImport[]
): Map<string, FormattedImport[]> {
    const groupedImports = new Map<string, Map<string, FormattedImport>>();

    // Map spéciale pour suivre les imports de type par module
    const typeImportsByModule = new Map<string, Set<string>>();
    // Maps to track default type imports separately
    const defaultTypeImportsByModule = new Map<string, string>();

    // Ne pas séparer les types dans un groupe à part
    for (const importItem of imports) {
        const groupName = importItem.group.name;

        if (!groupedImports.has(groupName)) {
            groupedImports.set(groupName, new Map<string, FormattedImport>());
        }

        const moduleMap = groupedImports.get(groupName)!;
        const { moduleName } = importItem;

        // Cas spécial pour les imports de type
        if (importItem.isTypeImport) {
            if (importItem.isDefaultImport) {
                // Handle default type imports separately
                const defaultTypeKey = `${moduleName}_DEFAULT_TYPE_`;
                defaultTypeImportsByModule.set(moduleName, importItem.importNames[0]);
                
                // Create or update the default type import
                moduleMap.set(defaultTypeKey, {
                    ...importItem,
                    importNames: [importItem.importNames[0]],
                    isTypeImport: true,
                    isDefaultImport: true,
                    hasNamedImports: false
                });
                
                // If there are additional named imports beyond the default, handle them separately
                if (importItem.importNames.length > 1 && importItem.hasNamedImports) {
                    const namedTypesKey = `${moduleName}_NAMED_TYPE_`;
                    const namedTypeImports = importItem.importNames.slice(1);
                    
                    // Create or update named type imports
                    if (moduleMap.has(namedTypesKey)) {
                        const existing = moduleMap.get(namedTypesKey)!;
                        existing.importNames = [...existing.importNames, ...namedTypeImports];
                    } else {
                        moduleMap.set(namedTypesKey, {
                            ...importItem,
                            importNames: namedTypeImports,
                            isTypeImport: true,
                            isDefaultImport: false,
                            hasNamedImports: true
                        });
                    }
                }
            } else {
                // Handle named type imports (non-default)
                // Clé pour les imports de type nommés
                const namedTypeKey = `${moduleName}_NAMED_TYPE_`;

                // Garder trace des noms de type pour ce module
                if (!typeImportsByModule.has(moduleName)) {
                    typeImportsByModule.set(moduleName, new Set<string>());
                }

                // Ajouter les noms de type à l'ensemble
                const typeNames = typeImportsByModule.get(moduleName)!;
                importItem.importNames.forEach(name => typeNames.add(name));

                // Si un import de type pour ce module existe déjà, le mettre à jour
                if (moduleMap.has(namedTypeKey)) {
                    const existingTypeImport = moduleMap.get(namedTypeKey)!;
                    existingTypeImport.importNames = Array.from(typeNames);
                } else {
                    // Sinon, créer un nouvel import de type
                    moduleMap.set(namedTypeKey, {
                        ...importItem,
                        importNames: Array.from(typeNames),
                        isTypeImport: true,
                        isDefaultImport: false,
                        hasNamedImports: true
                    });
                }
            }
            continue;
        }

        // Cas standard pour les imports non-type
        const mapKey = importItem.isDefaultImport ?
            `${moduleName}_DEFAULT_` :
            `${moduleName}_NAMED_`;

        if (moduleMap.has(mapKey)) {
            const existingImport = moduleMap.get(mapKey)!;

            // S'assurer que tous les noms sont bien conservés
            const mergedNames = new Set<string>([...existingImport.importNames]);
            for (const name of importItem.importNames) {
                mergedNames.add(name);
            }

            existingImport.importNames = Array.from(mergedNames);

            // Recalculer hasNamedImports en fonction du nombre d'imports après la fusion
            const namedImportCount = existingImport.isDefaultImport ?
                existingImport.importNames.length - 1 :
                existingImport.importNames.length;

            existingImport.hasNamedImports = namedImportCount > 0;

        } else {
            if (importItem.isDefaultImport) {
                const namedImportCount = importItem.importNames.length - 1;
                const correctedItem = {
                    ...importItem,
                    hasNamedImports: namedImportCount > 0
                };
                moduleMap.set(mapKey, correctedItem);
            } else {
                moduleMap.set(mapKey, { ...importItem });
            }
        }
    }

    const result = new Map<string, FormattedImport[]>();
    for (const [groupName, moduleMap] of groupedImports.entries()) {
        if (moduleMap.size > 0) {
            result.set(groupName, Array.from(moduleMap.values()));
        }
    }

    return result;
}


function generateFormattedImportsOptimized(
    groupedImports: Map<string, FormattedImport[]>,
    config: FormatterConfig = configManager.getFormatterConfig()
): string {
    // Ordre défini des groupes d'imports
    const configGroups = [...config.importGroups]
        .sort((a, b) => a.order - b.order)
        .map((group) => group.name);

    const preferredOrderMap: Map<string, number> = new Map();
    configGroups.forEach((name, index) => {
        preferredOrderMap.set(name, index);
    });

    // Trier les groupes selon l'ordre défini
    const groups = Array.from(groupedImports.entries()).sort((a, b) => {
        const indexA = preferredOrderMap.has(a[0])
            ? preferredOrderMap.get(a[0])!
            : Infinity;
        const indexB = preferredOrderMap.has(b[0])
            ? preferredOrderMap.get(b[0])!
            : Infinity;

        // Si les deux groupes sont dans l'ordre préféré
        if (indexA !== Infinity && indexB !== Infinity) {
            return indexA - indexB;
        }

        // Si seulement un groupe est dans l'ordre préféré
        if (indexA !== Infinity) {
            return -1;
        }
        if (indexB !== Infinity) {
            return 1;
        }

        // Fallback sur l'ordre des groupes dans la configuration
        const groupA = config.importGroups.find((g) => g.name === a[0]);
        const groupB = config.importGroups.find((g) => g.name === b[0]);
        return (groupA?.order ?? 999) - (groupB?.order ?? 999);
    });

    const formattedGroups: FormattedImportGroup[] = [];

    for (const [groupName, imports] of groups) {
        if (imports.length === 0) {
            continue;
        }

        const groupResult: FormattedImportGroup = {
            groupName,
            commentLine: `// ${groupName}`,
            importLines: [],
        };

        const sortedImports = sortImportsInGroup(imports);

        for (const importItem of sortedImports) {
            const formattedLines: string[] = [];
            formatImportItem(importItem, formattedLines);
            groupResult.importLines.push(...formattedLines);
        }

        formattedGroups.push(groupResult);
    }

    // Utiliser la fonction d'alignement par section avec la configuration
    const alignedLines = alignImportsBySection(formattedGroups, config);

    return alignedLines.join('\n');
}

function hasImportCharacteristics(line: string, config: FormatterConfig): boolean {
    const trimmedLine = line.trim();
    
    // Check for side-effect imports
    if (trimmedLine.match(/^import\s+['"].*['"];$/)) {
        return true;
    }
    
    // Vérifier explicitement que ce n'est pas une déclaration de type
    if (trimmedLine.match(config.regexPatterns.typeDeclaration)) {
        return false;
    }
    
    // Vérifier explicitement que ce n'est pas une déclaration d'interface ou de classe
    if (trimmedLine.match(config.regexPatterns.codeDeclaration)) {
        return false;
    }
    
    return trimmedLine.startsWith('import') || 
           config.regexPatterns.importFragment.test(trimmedLine) || 
           trimmedLine.includes('from') ||
           (trimmedLine.startsWith('{') && trimmedLine.includes('}')) ||
           trimmedLine.match(/^[A-Za-z0-9_]+,$/) !== null;
}

function findAllImportsRange(text: string, config: FormatterConfig = configManager.getFormatterConfig()): { start: number; end: number } {
    // Regex pour trouver les lignes d'import
    const importRegex = config.regexPatterns.importLine;
    
    // Regex pour trouver les commentaires de section d'imports
    const sectionCommentRegex = config.regexPatterns.sectionComment;

    // Regex pour trouver les lignes qui semblent être des fragments d'import
    const possibleImportFragmentRegex = config.regexPatterns.importFragment;

    let firstStart = text.length;
    let lastEnd = 0;
    let match;

    // Trouver tous les imports et commentaires de section
    while ((match = importRegex.exec(text)) !== null) {
        firstStart = Math.min(firstStart, match.index);
        lastEnd = Math.max(lastEnd, match.index + match[0].length);
    }
    
    // Chercher également les commentaires de section
    while ((match = sectionCommentRegex.exec(text)) !== null) {
        firstStart = Math.min(firstStart, match.index);
        lastEnd = Math.max(lastEnd, match.index + match[0].length);
    }

    // Si aucun import n'est trouvé, retourner une plage vide
    if (firstStart === text.length) {
        return { start: 0, end: 0 };
    }

    const lines = text.split('\n');
    let inImportSection = false;
    let importSectionFound = false; // Indicateur qu'au moins un import a été trouvé
    let currentPos = 0;
    let sectionStart = firstStart;
    let sectionEnd = lastEnd;
    let consecutiveNonImportLines = 0; // Compteur de lignes non-import consécutives
    const MAX_NON_IMPORT_LINES = 2; // Nombre maximum de lignes non-import consécutives autorisées

    // Rechercher les fragments d'imports orphelins et les commentaires de section
    const orphanedFragments: number[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLength = line.length + 1;
        const trimmedLine = line.trim();

        // Détection améliorée des non-imports
        const isTypeDeclaration = config.regexPatterns.typeDeclaration.test(trimmedLine);
        const isInterfaceOrClassDeclaration = config.regexPatterns.codeDeclaration.test(trimmedLine);

        const isImportLine = trimmedLine.startsWith('import');
        const isCommentLine = trimmedLine.startsWith('//');
        const isEmptyLine = trimmedLine === '';
        const isImportFragmentLine = possibleImportFragmentRegex.test(trimmedLine);
        const isJSDocComment = trimmedLine.startsWith('/*') || trimmedLine.startsWith('*') || trimmedLine.startsWith('*/');

        // Si on détecte clairement une déclaration de type, d'interface ou de classe, on s'arrête
        // car on est probablement sorti de la section d'imports
        if (isTypeDeclaration || isInterfaceOrClassDeclaration) {
            if (importSectionFound) {
                inImportSection = false;
                break;
            }
        }

        // Utilisation de la fonction hasImportCharacteristics pour la détection des fragments
        const isOrphanedFragment =
            !isImportLine &&
            !isCommentLine &&
            !isEmptyLine &&
            !isJSDocComment &&
            !isTypeDeclaration &&
            !isInterfaceOrClassDeclaration &&
            hasImportCharacteristics(line, config);

        if (isOrphanedFragment) {
            orphanedFragments.push(currentPos);
            sectionEnd = Math.max(sectionEnd, currentPos + lineLength);
        }

        // Si c'est un commentaire de section ou une ligne d'import, inclure dans la section
        if (isImportLine) {
            importSectionFound = true;
            inImportSection = true;
            consecutiveNonImportLines = 0;
            sectionStart = Math.min(sectionStart, currentPos);
            sectionEnd = Math.max(sectionEnd, currentPos + lineLength);
        } else if (isCommentLine && /(?:misc|ds|dossier|core|library|utils)/i.test(trimmedLine)) {
            inImportSection = true;
            consecutiveNonImportLines = 0;
            sectionStart = Math.min(sectionStart, currentPos);
            sectionEnd = Math.max(sectionEnd, currentPos + lineLength);
        } else if (
            inImportSection &&
            (isCommentLine || isEmptyLine || isImportFragmentLine || isJSDocComment)
        ) {
            // Les lignes de commentaires et lignes vides dans la section d'imports sont autorisées
            if (isEmptyLine) {
                consecutiveNonImportLines++;
            } else {
                consecutiveNonImportLines = 0;
            }
            sectionEnd = Math.max(sectionEnd, currentPos + lineLength);
        } else if (inImportSection && isOrphanedFragment) {
            consecutiveNonImportLines = 0;
            sectionEnd = Math.max(sectionEnd, currentPos + lineLength);
        } else if (inImportSection) {
            // Si nous sommes dans la section d'imports mais qu'on rencontre une ligne non-import
            // On vérifie les prochaines lignes pour voir s'il y a d'autres imports
            let nextImportFound = false;
            
            // Ne vérifier les prochaines lignes que si on n'a pas déjà trop de lignes non-import consécutives
            if (consecutiveNonImportLines < MAX_NON_IMPORT_LINES) {
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine.startsWith('import') || 
                        possibleImportFragmentRegex.test(nextLine) ||
                        (nextLine.startsWith('//') && /(?:misc|ds|dossier|core|library|utils)/i.test(nextLine))) {
                        nextImportFound = true;
                        break;
                    }
                }
            }

            if (nextImportFound) {
                // Si on trouve un autre import plus loin, on considère cette ligne comme faisant partie de la section
                consecutiveNonImportLines++;
                sectionEnd = Math.max(sectionEnd, currentPos + lineLength);
            } else if (importSectionFound) {
                // Si on a déjà trouvé au moins un import et qu'on a rencontré une ligne non-import
                // sans autre import à proximité, on considère que c'est la fin de la section
                inImportSection = false;
                break;
            }
        }

        // Si on accumule trop de lignes non-import consécutives, sortir de la section
        if (inImportSection && consecutiveNonImportLines > MAX_NON_IMPORT_LINES && importSectionFound) {
            inImportSection = false;
            break;
        }

        currentPos += lineLength;
    }

    // Ne pas inclure des sections de commentaires ou de fragments orphelins trop éloignées
    const MAX_DISTANCE = 100; // Distance maximale considérée comme "proche" de la section d'imports

    // Élagage des fragments orphelins qui sont trop éloignés de la section principale
    for (const fragmentPos of orphanedFragments) {
        if (Math.abs(fragmentPos - sectionEnd) <= MAX_DISTANCE) {
            // Vérifier que ce fragment est bien un fragment d'import et pas du code normal
            const fragmentText = text.substring(fragmentPos, Math.min(fragmentPos + 50, text.length));
            const lines = fragmentText.split('\n');
            let isValidImportFragment = false;

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (hasImportCharacteristics(line, config)) {
                    isValidImportFragment = true;
                    break;
                } else if (line.trim() !== '' && !line.trim().startsWith('//')) {
                    isValidImportFragment = false;
                    break;
                }
            }

            if (isValidImportFragment) {
                let fragmentEnd = fragmentPos;
                const fragmentLines = text.substring(fragmentPos, fragmentPos + 200).split('\n');
                let linePos = fragmentPos;

                for (const line of fragmentLines) {
                    if (!line || line.trim() === '') {
                        linePos += line.length + 1;
                        continue;
                    }
                    
                    if (hasImportCharacteristics(line, config) || line.trim().startsWith('//')) {
                        fragmentEnd = linePos + line.length + 1;
                    } else {
                        break;
                    }
                    
                    linePos += line.length + 1;
                }

                sectionEnd = Math.max(sectionEnd, fragmentEnd);
            }
        }
    }

    return { start: sectionStart, end: sectionEnd };
}

import { ImportParserResult } from './parser';

export function formatImports(
    sourceText: string, 
    config: FormatterConfig = configManager.getFormatterConfig(),
    parserResult?: ImportParserResult
): string {
    config.importGroups = configManager.getImportGroups();
    config.alignmentSpacing = configManager.getAlignmentSpacing();

    const fullImportRange = findAllImportsRange(sourceText, config);

    if (fullImportRange.start === fullImportRange.end) {
        return sourceText;
    }

    const importSection = sourceText.substring(fullImportRange.start, fullImportRange.end);
    const lines = importSection.split('\n');
    let adjustedEnd = fullImportRange.end;

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        
        if (config.regexPatterns.typeDeclaration.test(line) ||
            config.regexPatterns.codeDeclaration.test(line)) {
            
            const lineStart = fullImportRange.start + 
                lines.slice(0, i).join('\n').length + 
                (i > 0 ? i : 0);
                
            adjustedEnd = lineStart;
            break;
        }
    }

    const importSectionText = sourceText.substring(
        fullImportRange.start,
        adjustedEnd
    );

    const validation = validateImportSection(importSectionText);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    let formattedImports;

    // Si nous avons un résultat du parser, l'utiliser
    if (parserResult) {
        formattedImports = adaptParserOutput(parserResult, config.importGroups);
    } else {
        // Sinon, utiliser l'ancien parser
        const cleanedImportText = removeCommentsFromImports(importSectionText, config);

        const sourceFile = ts.createSourceFile(
            'temp.ts',
            cleanedImportText,
            ts.ScriptTarget.Latest,
            true
        );

        const importNodes: ts.ImportDeclaration[] = [];
        
        function visit(node: ts.Node) : void {
            if (ts.isImportDeclaration(node)) {
                importNodes.push(node);
                
                if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                    const modulePath = node.moduleSpecifier.text;
                    const appSubfolderMatch = modulePath.match(config.regexPatterns.appSubfolderPattern);
                    
                    if (appSubfolderMatch?.[1]) {
                        const subfolder = appSubfolderMatch[1];
                        if (typeof configManager.registerAppSubfolder === 'function') {
                            configManager.registerAppSubfolder(subfolder);
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        }

        visit(sourceFile);

        if (importNodes.length === 0) {
            return sourceText;
        }

        config.importGroups = configManager.getImportGroups();
        formattedImports = parseImports(importNodes, sourceFile, config.importGroups);
    }
    const groupedImports = groupImportsOptimized(formattedImports);
    let formattedText = generateFormattedImportsOptimized(groupedImports, config);
    
    if (!formattedText.endsWith('\n\n')) {
        if (formattedText.endsWith('\n')) {
            formattedText += '\n';
        } else {
            formattedText += '\n\n';
        }
    }

    return (
        sourceText.substring(0, fullImportRange.start) +
        formattedText +
        sourceText.substring(adjustedEnd)
    );
}

function validateImportSection(text: string): { valid: boolean; message?: string } {
    // Edge case: empty text is valid
    if (!text.trim()) {
      return { valid: true };
    }
  
    try {
      // Create a temporary source file to parse the text
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        text,
        ts.ScriptTarget.Latest,
        true
      );
  
      // Track invalid statements
      const invalidNodes: { text: string; line: number }[] = [];
      
      // Find the line number for a node position
      const getLineNumber = (pos: number): number => text.substring(0, pos).split('\n').length;
  
      // Process each top-level statement
      sourceFile.statements.forEach(statement => {
        // Skip import declarations and export statements that re-export
        if (ts.isImportDeclaration(statement) || 
            (ts.isExportDeclaration(statement) && statement.moduleSpecifier)) {
          return;
        }
        
        // Allow export type ... from statements (re-exporting types)
        if (ts.isExportDeclaration(statement) && 
            statement.isTypeOnly && 
            statement.moduleSpecifier) {
          return;
        }
  
        // Only add if it's not inside a comment
        const fullText = statement.getFullText(sourceFile);
        const isComment = /^\s*\/\//.test(fullText) || /^\s*\/\*[\s\S]*?\*\/\s*$/.test(fullText);
  
        if (!isComment) {
          invalidNodes.push({
            text: statement.getText(sourceFile),
            line: getLineNumber(statement.getStart(sourceFile))
          });
        }
      });
  
      if (invalidNodes.length > 0) {
        const examples = invalidNodes
          .slice(0, 3)
          .map(n => `Line ${n.line}: "${n.text}"`)
          .join('\n');
          
        return {
          valid: false,
          message: `Found non-import code in import section:\n${examples}`
        };
      }
  
      // Vérification simplifiée des imports partiels/incomplets
      const lines = text.split('\n');
      let inMultilineImport = false;
      let braceCount = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Ignorer les lignes vides et les commentaires
        if (trimmedLine === '' || trimmedLine.startsWith('//') || 
            trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
          continue;
        }
        
        // Compter les accolades ouvrantes et fermantes
        if (trimmedLine.includes('{')) {
          inMultilineImport = true;
          braceCount += (trimmedLine.match(/{/g) || []).length;
        }
        
        if (trimmedLine.includes('}')) {
          braceCount -= (trimmedLine.match(/}/g) || []).length;
          if (braceCount === 0) {
            inMultilineImport = false;
          }
        }
        
        // Vérifier les imports incomplets (débute par import mais pas de point-virgule à la fin)
        if (trimmedLine.startsWith('import') && !inMultilineImport && !trimmedLine.endsWith(';')) {
          return {
            valid: false,
            message: `Import incomplet détecté: ${trimmedLine}`
          };
        }
      }
      
      // S'assurer que tous les imports multilignes sont bien fermés
      if (inMultilineImport || braceCount !== 0) {
        return {
          valid: false,
          message: 'Import section contains unclosed braces'
        };
      }
  
      return { valid: true };
    } catch {
      // Si l'analyse TypeScript échoue, faire un contrôle plus simple
      
      // Analyser chaque ligne pour détecter des fragments d'import valides
      const lines = text.split('\n');
      let validImportLines = 0;
      let totalNonEmptyLines = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        totalNonEmptyLines++;
        
        // Vérifier si la ligne semble être un fragment d'import valide
        if (trimmedLine.startsWith('import ') || 
            trimmedLine.startsWith('// ') || 
            trimmedLine.startsWith('{') || 
            trimmedLine.startsWith('}') || 
            trimmedLine.match(/^[a-zA-Z0-9_]+,?$/) || 
            trimmedLine.match(/^[a-zA-Z0-9_]+\s+as\s+[a-zA-Z0-9_]+,?$/) ||
            trimmedLine.match(/^[a-zA-Z0-9_]+\s+from\s+['"][^'"]+['"];?$/)) {
          validImportLines++;
        }
      }
      
      // Si au moins 80% des lignes non vides semblent être des imports valides, considérer la section comme valide
      if (totalNonEmptyLines > 0 && (validImportLines / totalNonEmptyLines) >= 0.8) {
        return { valid: true };
      }
      
      return {
        valid: false,
        message: 'Import section contains syntax errors'
      };
    }
  }
