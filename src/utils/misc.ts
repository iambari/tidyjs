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