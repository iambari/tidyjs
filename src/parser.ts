import * as ts from 'typescript';
import { FormattedImport, ImportGroup } from './types';

// Interface pour représenter la structure de sortie du nouveau parser
export interface ImportParserResult {
  groups: {
    name: string;
    order: number;
    imports: {
      type: string;
      source: string;
      specifiers: string[];
      raw: string;
      groupName: string;
      isPriority: boolean;
      appSubfolder?: string;
    }[];
  }[];
  originalImports: string[];
  invalidImports: {
    raw: string;
    error: string;
  }[];
}

/**
 * Adapte la sortie du nouveau parser à la structure attendue par le formateur
 */
export function parseImports(
  _importNodes: ts.ImportDeclaration[],
  _sourceFile: ts.SourceFile,
  _importGroups: ImportGroup[]
): FormattedImport[] {
  // Cette fonction n'est plus utilisée directement avec les nœuds TypeScript
  // Elle est maintenant un adaptateur pour le nouveau parser
  throw new Error('Cette fonction ne devrait plus être appelée directement');
}

/**
 * Nettoie les commentaires en ligne d'un import
 */
function cleanInlineComments(importStatement: string): string {
  // Vérification rapide - si l'import est déjà une chaîne simple, le retourner tel quel
  if (!importStatement.includes('\n') && importStatement.includes('from') && importStatement.endsWith(';')) {
    return importStatement;
  }

  // Cas spécial pour les imports de module (side effect)
  if (importStatement.trim().startsWith('import ') && 
      !importStatement.includes('from') && 
      importStatement.trim().endsWith(';')) {
    return importStatement;
  }

  // Diviser l'import en lignes
  const lines = importStatement.split('\n');
  
  // Pour les imports multilignes, utiliser les originaux plutôt que de les nettoyer
  // si on détecte des commentaires en ligne dans un import avec accolades
  if (lines.length > 1 && importStatement.includes('{') && importStatement.includes('}') && 
      lines.some(line => line.includes('//'))) {
    // Vérifier que c'est un statement valide
    const trimmedImport = importStatement.trim();
    if (trimmedImport.startsWith('import ') && 
        trimmedImport.includes(' from ') && 
        trimmedImport.endsWith(';')) {
      return importStatement;
    }
  }
  
  // Nettoyer chaque ligne individuellement
  const cleanedLines = lines.map(line => {
    // Si la ligne contient un commentaire en ligne
    if (line.includes('//')) {
      // Si c'est une ligne d'accolade ou de fermeture, la garder telle quelle
      if (line.trim().startsWith('{') || line.trim().startsWith('}')) {
        return line;
      }
      // Si c'est une ligne avec un import nommé
      if (line.includes(',')) {
        // Garder la virgule et supprimer le commentaire
        return line.replace(/\/\/.*$/, '').trim();
      }
      // Sinon, supprimer le commentaire et les espaces après
      return line.replace(/\/\/.*$/, '').trim();
    }
    return line;
  });

  // Rejoindre les lignes en préservant les sauts de ligne
  const result = cleanedLines.join('\n');

  // Validation adaptée aux différents types d'imports
  const trimmedResult = result.trim();
  
  // Import de module (side effect)
  if (trimmedResult.startsWith('import ') && 
      trimmedResult.includes('\'') && 
      !trimmedResult.includes('from') && 
      trimmedResult.endsWith(';')) {
    return result;
  }
  
  // Import par défaut sans imports nommés
  if (trimmedResult.startsWith('import ') && 
      !trimmedResult.includes('{') && 
      trimmedResult.includes(' from ') && 
      trimmedResult.endsWith(';')) {
    return result;
  }
  
  // Import nommé
  if (trimmedResult.startsWith('import ') && 
      trimmedResult.includes('{') && 
      trimmedResult.includes('}') && 
      trimmedResult.includes(' from ') && 
      trimmedResult.endsWith(';')) {
    return result;
  }
  
  // Import de type
  if (trimmedResult.startsWith('import type ') && 
      trimmedResult.includes(' from ') && 
      trimmedResult.endsWith(';')) {
    return result;
  }

  throw new Error('Import section contains incomplete import statements: ' + trimmedResult);
}

/**
 * Adapte la sortie du nouveau parser à la structure attendue par le formateur
 */
export function adaptParserOutput(
  parserOutput: ImportParserResult,
  importGroups: ImportGroup[]
): FormattedImport[] {
  // Vérifier s'il y a des imports invalides
  if (parserOutput.invalidImports && parserOutput.invalidImports.length > 0) {
    // Au lieu de lancer une erreur, on log les imports invalides
    console.warn(`Imports invalides détectés : ${parserOutput.invalidImports.map(imp => imp.error).join(', ')}`);
    // On peut aussi logger les imports invalides eux-mêmes
    for (const invalidImport of parserOutput.invalidImports) {
      console.warn(`Import invalide: ${invalidImport.raw}`);
    }
  }

  const formattedImports: FormattedImport[] = [];
  const typeImportsByModule = new Map<string, Set<string>>();

  // Parcourir tous les groupes d'imports
  for (const group of parserOutput.groups) {
    // Trouver le groupe correspondant dans la configuration ou créer un nouveau groupe
    const matchingGroup = importGroups.find(g => g.name === group.name) || 
                          { name: group.name, regex: new RegExp(`^${group.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), order: 999 };

    // Parcourir tous les imports du groupe
    for (const importItem of group.imports) {
      try {
        // Déterminer le type d'import
        const isDefaultImport = importItem.type === 'default';
        const isNamedImport = importItem.type === 'named';
        const isTypeImport = importItem.type === 'typeDefault' || importItem.type === 'typeNamed';
        const isSideEffect = importItem.type === 'sideEffect';

        // Gérer les imports de type
        if (isTypeImport) {
          if (!typeImportsByModule.has(importItem.source)) {
            typeImportsByModule.set(importItem.source, new Set());
          }
          const typeNames = typeImportsByModule.get(importItem.source)!;
          importItem.specifiers.forEach(name => typeNames.add(name));
          continue;
        }

        // Créer l'objet FormattedImport pour les imports non-type
        const formattedImport: FormattedImport = {
          statement: cleanInlineComments(importItem.raw),
          group: matchingGroup,
          moduleName: importItem.source,
          importNames: importItem.specifiers,
          isTypeImport: false,
          isDefaultImport,
          hasNamedImports: isNamedImport || (isDefaultImport && importItem.specifiers.length > 1)
        };

        // Si c'est un import de module (side effect), s'assurer que hasNamedImports est false
        if (isSideEffect) {
          formattedImport.isDefaultImport = false;
          formattedImport.hasNamedImports = false;
        }

        formattedImports.push(formattedImport);
      } catch (error) {
        // Si un import spécifique échoue, on le log et on continue
        console.warn(`Erreur lors du traitement de l'import: ${importItem.raw}`, error);
      }
    }
  }

  // Ajouter les imports de type fusionnés
  for (const [moduleName, typeNames] of typeImportsByModule.entries()) {
    try {
      const typeNamesArray = Array.from(typeNames);
      const formattedImport: FormattedImport = {
        statement: `import type { ${typeNamesArray.join(', ')} } from '${moduleName}';`,
        group: formattedImports.find(i => i.moduleName === moduleName)?.group || 
              { name: 'Misc', regex: /.*/, order: 999 },
        moduleName,
        importNames: typeNamesArray,
        isTypeImport: true,
        isDefaultImport: false,
        hasNamedImports: true
      };

      formattedImports.push(formattedImport);
    } catch (error) {
      console.warn(`Erreur lors du traitement des imports de type pour le module: ${moduleName}`, error);
    }
  }

  return formattedImports;
}
