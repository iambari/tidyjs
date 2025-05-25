import { DiagnosticSeverity, languages, Uri, window } from 'vscode';
import { ParserResult } from '../parser';
const UNUSED_IMPORT_CODES = ['unused-import', 'import-not-used', '6192', '6133'];

/**
 * Vérifie si une ligne est vide (ne contient que des espaces)
 */
export function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}

/**
 * Vérifie si une ligne est un commentaire
 */
export function isCommentLine(line: string): boolean {
  return line.trim().startsWith('//');
}

/**
 * Vérifie si une ligne est un commentaire de section
 */
export function isSectionComment(line: string, config: { regexPatterns: { sectionComment: RegExp } }): boolean {
  return config.regexPatterns.sectionComment.test(line);
}

/**
 * Formatte un import simple (side-effect)
 */
export function formatSimpleImport(moduleName: string): string {
  return `import '${moduleName}';`;
}

/**
 * Aligne le mot-clé 'from' dans une ligne d'import
 */
export function alignFromKeyword(line: string, fromIndex: number, maxFromIndex: number, spacingConfig: number = 1): string {
  if (fromIndex <= 0 || line.indexOf('from') === -1) {
    return line;
  }

  const beforeFrom = line.substring(0, fromIndex);
  const afterFrom = line.substring(fromIndex);
  const paddingSize = maxFromIndex - fromIndex + spacingConfig;
  const padding = ' '.repeat(paddingSize);

  return beforeFrom + padding + afterFrom;
}

/**
 * Trouve l'index du mot-clé 'from' dans une ligne d'import
 */
export function getFromIndex(line: string, isMultiline: boolean): number {
  if (isMultiline) {
    const lines = line.split('\n');
    const lastLine = lines[lines.length - 1];
    const fromIndex = lastLine.indexOf('from');
    if (fromIndex !== -1) {
      return lines.slice(0, lines.length - 1).join('\n').length + fromIndex + 1;
    }
    return -1;
  }

  return line.indexOf('from');
}

/**
 * Type pour représenter un import nommé qui peut avoir un commentaire
 */
export interface NamedImportWithComment {
  name: string;
  comment?: string;
}

/**
 * Trie les noms d'import par longueur (du plus court au plus long)
 * @param namedImports Liste des imports nommés à trier
 * @returns Liste triée des noms d'imports
 */
export function sortImportNamesByLength(namedImports: (string | NamedImportWithComment)[]): string[] {
  return namedImports.map((item) => (typeof item === 'string' ? item : item.name)).sort((a, b) => a.length - b.length);
}

/**
 * Fonction de log d'erreur
 * @param args Les arguments à logger
 */
export function logError(...args: unknown[]): void {
  console.error('[ERROR]', ...args);
}

/**
 * Fonctions d'affichage de messages dans l'interface de VSCode
 * Permet d'utiliser showMessage.info(), showMessage.error() ou showMessage.warning()
 */
export const showMessage = {
  /**
   * Affiche un message d'information
   * @param message Le message à afficher
   * @param items Les options à afficher (optionnel)
   */
  info: (message: string, ...items: string[]) => {
    return window.showInformationMessage(message, ...items);
  },

  /**
   * Affiche un message d'erreur
   * @param message Le message à afficher
   * @param items Les options à afficher (optionnel)
   */
  error: (message: string, ...items: string[]) => {
    return window.showErrorMessage(message, ...items);
  },

  /**
   * Affiche un message d'avertissement
   * @param message Le message à afficher
   * @param items Les options à afficher (optionnel)
   */
  warning: (message: string, ...items: string[]) => {
    return window.showWarningMessage(message, ...items);
  },
};


/**
 * Récupère les imports non utilisés à partir des diagnostics
 * @param uri URI du document actuel
 * @returns Un tableau des noms d'imports non utilisés
 */
export function getUnusedImports(uri: Uri, parserResult: ParserResult): string[] {
  const diagnostics = languages.getDiagnostics(uri);
  const unusedImports: string[] = [];

  const allImportedSpecifiers = parserResult.groups.flatMap(group =>
    group.imports.flatMap(imp => imp.specifiers)
  );

  const editor = window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
  if (!editor) {
    return [];
  }

  const document = editor.document;

  const unusedDiagnostics = diagnostics.filter(diagnostic => {
    return (
      (diagnostic.severity === DiagnosticSeverity.Warning ||
       diagnostic.severity === DiagnosticSeverity.Hint) &&
      UNUSED_IMPORT_CODES.includes(String(diagnostic.code))
    );
  });

  for (const diagnostic of unusedDiagnostics) {
    const text = document.getText(diagnostic.range).trim();

    if (text && allImportedSpecifiers.includes(text)) {
      unusedImports.push(text);
    }
  }

  return unusedImports;
}

/**
 * Supprime les imports non utilisés du résultat du parser
 * @param parserResult Résultat du parser d'imports
 * @param unusedImports Liste des imports non utilisés
 * @returns Résultat du parser mis à jour
 */
export function removeUnusedImports(parserResult: ParserResult, unusedImports: string[]): ParserResult {
  if (!unusedImports.length) {
    return parserResult;
  }
  
  const updatedResult = { ...parserResult };
  
  updatedResult.groups = parserResult.groups.map(group => {
    const updatedGroup = { ...group };
    
    updatedGroup.imports = group.imports.filter(importItem => {
      const importName = importItem.source;
      
      if (unusedImports.includes(importName)) {
        return false;
      }
      
      if (importItem.specifiers && importItem.specifiers.length) {
        importItem.specifiers = importItem.specifiers.filter(
          specifier => !unusedImports.includes(specifier)
        );
        
        return importItem.specifiers.length > 0;
      }
      
      return true;
    });
    
    return updatedGroup;
  });
  
  return updatedResult;
}