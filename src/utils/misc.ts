// Misc
import {
    ImportType,
    ParserResult
}                           from '../parser';
import { diagnosticsCache } from './diagnostics-cache';
import { logDebug }         from './log';

// VSCode
import {
    Uri,
    window,
    languages,
    DiagnosticSeverity
}                      from 'vscode';

const UNUSED_IMPORT_CODES = ['unused-import', 'import-not-used', '6192', '6133'];
const MODULE_NOT_FOUND_CODES = ['2307', '2318']; // Cannot find module

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
 * Récupère les imports de modules inexistants ET non utilisés à partir des diagnostics
 * @param uri URI du document actuel
 * @param parserResult Résultat du parser d'imports
 * @param diagnostics Diagnostics pré-récupérés (optionnel)
 * @returns Un objet avec les modules manquants et les variables non utilisées associées
 */
export function getMissingAndUnusedImports(uri: Uri, parserResult: ParserResult, diagnostics?: ReturnType<typeof diagnosticsCache.getDiagnostics>): { missingModules: Set<string>, unusedFromMissing: Set<string> } {
  try {
    // Quick safety check - if these VS Code APIs are not available, return empty sets
    if (!languages || typeof languages.getDiagnostics !== 'function') {
      return { missingModules: new Set(), unusedFromMissing: new Set() };
    }
    
    const cachedDiagnostics = diagnostics || diagnosticsCache.getDiagnostics(uri);
    const missingModules = new Set<string>();
    const unusedVariables = new Set<string>();

    if (!cachedDiagnostics || cachedDiagnostics.length === 0) {
      return { missingModules: new Set(), unusedFromMissing: new Set() };
    }

    const editor = window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
    if (!editor) {
      return { missingModules: new Set(), unusedFromMissing: new Set() };
    }

    // First pass: collect missing modules
    for (const diagnostic of cachedDiagnostics) {
      if (diagnostic.severity === DiagnosticSeverity.Error && 
          MODULE_NOT_FOUND_CODES.includes(String(diagnostic.code))) {
        const message = diagnostic.message;
        const moduleMatch = message.match(/Cannot find module ['"]([^'"]+)['"]/);
        
        if (moduleMatch && moduleMatch[1]) {
          missingModules.add(moduleMatch[1]);
        }
      }
    }

    // Second pass: collect unused variables
    for (const diagnostic of cachedDiagnostics) {
      if ((diagnostic.severity === DiagnosticSeverity.Warning || 
           diagnostic.severity === DiagnosticSeverity.Hint) &&
          UNUSED_IMPORT_CODES.includes(String(diagnostic.code))) {
        try {
          // Extract variable name from message instead of range
          // because the range might cover the entire import line
          const match = diagnostic.message.match(/'([^']+)' is declared but its value is never read/);
          if (match && match[1]) {
            unusedVariables.add(match[1]);
            logDebug(`Unused variable detected: ${match[1]}`);
          }
        } catch (error) {
          // Skip if we can't parse the message
        }
      }
    }

    // Find which unused variables come from missing modules
    const unusedFromMissing = new Set<string>();
    
    logDebug('Missing modules:', Array.from(missingModules));
    logDebug('Unused variables:', Array.from(unusedVariables));
    
    for (const group of parserResult.groups) {
      for (const imp of group.imports) {
        // Check if this import is from a missing module
        if (missingModules.has(imp.source)) {
          logDebug(`Import from missing module ${imp.source}:`, imp.specifiers);
          // Check each specifier to see if it's also unused
          for (const specifier of imp.specifiers) {
            const specName = typeof specifier === 'string' ? specifier : specifier.local;
            if (unusedVariables.has(specName)) {
              unusedFromMissing.add(specName);
              logDebug(`  - ${specName} is unused and from missing module`);
            }
          }
          // Check default import too
          if (imp.defaultImport && unusedVariables.has(imp.defaultImport)) {
            unusedFromMissing.add(imp.defaultImport);
            logDebug(`  - Default import ${imp.defaultImport} is unused and from missing module`);
          }
        }
      }
    }

    return { missingModules, unusedFromMissing };
  } catch (error) {
    console.warn('Error getting missing and unused imports:', error);
    return { missingModules: new Set(), unusedFromMissing: new Set() };
  }
}

/**
 * Récupère les imports non utilisés à partir des diagnostics
 * @param uri URI du document actuel
 * @param parserResult Résultat du parser d'imports
 * @param includeMissingModules Si true, inclut aussi les imports de modules inexistants
 * @param diagnostics Diagnostics pré-récupérés (optionnel)
 * @returns Un tableau des noms d'imports non utilisés
 */
export function getUnusedImports(uri: Uri, parserResult: ParserResult, includeMissingModules = false, diagnostics?: ReturnType<typeof diagnosticsCache.getDiagnostics>): string[] {
  try {
    // Quick safety check - if these VS Code APIs are not available, return empty array
    if (!languages || typeof languages.getDiagnostics !== 'function') {
      return [];
    }
    
    const cachedDiagnostics = diagnostics || diagnosticsCache.getDiagnostics(uri);
    const unusedImports: string[] = [];

    if (!cachedDiagnostics) {
      return [];
    }

    // Collect all imported names (including default imports)
    const allImportedNames: string[] = [];
    
    for (const group of parserResult.groups) {
      for (const imp of group.imports) {
        // Add default imports
        if (imp.defaultImport) {
          allImportedNames.push(imp.defaultImport);
        }
        // Add named imports
        for (const spec of imp.specifiers) {
          const specName = typeof spec === 'string' ? spec : spec.local;
          allImportedNames.push(specName);
        }
      }
    }

    const editor = window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
    if (!editor) {
      return [];
    }

    const document = editor.document;

    // Get unused import specifiers
    const unusedDiagnostics = cachedDiagnostics.filter(diagnostic => {
      return (
        (diagnostic.severity === DiagnosticSeverity.Warning ||
         diagnostic.severity === DiagnosticSeverity.Hint) &&
        UNUSED_IMPORT_CODES.includes(String(diagnostic.code))
      );
    });

    for (const diagnostic of unusedDiagnostics) {
      try {
        // Try to extract the variable name from the diagnostic message
        const match = diagnostic.message.match(/'([^']+)' is declared but its value is never read/);
        if (match && match[1]) {
          const unusedName = match[1];
          // Check if this name is in our imported names
          if (allImportedNames.includes(unusedName)) {
            unusedImports.push(unusedName);
            logDebug(`Found unused import: ${unusedName}`);
          }
        } else {
          // Fallback: try to get text from diagnostic range
          const text = document.getText(diagnostic.range).trim();
          if (text && allImportedNames.includes(text)) {
            unusedImports.push(text);
            logDebug(`Found unused import from range: ${text}`);
          }
        }
      } catch (error) {
        // Skip this diagnostic if there's an error processing it
        logDebug(`Error processing diagnostic: ${error}`);
        continue;
      }
    }

    // Optionally include imports from missing modules that are also unused
    if (includeMissingModules) {
      try {
        const { missingModules, unusedFromMissing } = getMissingAndUnusedImports(uri, parserResult, cachedDiagnostics);
        
        logDebug('Missing modules detected:', Array.from(missingModules));
        logDebug('Unused imports from missing modules:', Array.from(unusedFromMissing));
        
        // Add all the unused imports from missing modules
        unusedFromMissing.forEach(unusedImport => {
          unusedImports.push(unusedImport);
        });
        
        // Also check if ALL imports from a missing module are unused
        // If so, we can remove the entire import statement
        for (const group of parserResult.groups) {
          for (const imp of group.imports) {
            if (missingModules.has(imp.source)) {
              // Check if ALL specifiers from this import are unused
              const allSpecifiersUnused = imp.specifiers.every(spec => {
                const specName = typeof spec === 'string' ? spec : spec.local;
                return unusedFromMissing.has(specName);
              });
              const defaultUnusedOrMissing = !imp.defaultImport || unusedFromMissing.has(imp.defaultImport);
              
              if (allSpecifiersUnused && defaultUnusedOrMissing) {
                // All imports from this module are unused, so we can remove them all
                imp.specifiers.forEach(spec => {
                  const specName = typeof spec === 'string' ? spec : spec.local;
                  if (!unusedImports.includes(specName)) {
                    unusedImports.push(specName);
                  }
                });
                if (imp.defaultImport && !unusedImports.includes(imp.defaultImport)) {
                  unusedImports.push(imp.defaultImport);
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error getting missing module imports:', error);
        // Continue without missing modules if there's an error
      }
    }

    const finalUnusedImports = [...new Set(unusedImports)]; // Remove duplicates
    logDebug('Final unused imports to remove:', finalUnusedImports);
    return finalUnusedImports;
  } catch (error) {
    console.warn('Error getting unused imports:', error);
    return [];
  }
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
    
    updatedGroup.imports = group.imports.map(importItem => {
      // Create a copy of the import item
      const updatedImport = { ...importItem };
      
      // Filter out unused specifiers
      if (updatedImport.specifiers && updatedImport.specifiers.length) {
        updatedImport.specifiers = updatedImport.specifiers.filter(
          specifier => {
            const specName = typeof specifier === 'string' ? specifier : specifier.local;
            return !unusedImports.includes(specName);
          }
        );
      }
      
      // Check if default import is unused
      if (updatedImport.defaultImport && unusedImports.includes(updatedImport.defaultImport)) {
        updatedImport.defaultImport = undefined;
        // For default imports, remove the specifier that contains the default import name
        updatedImport.specifiers = updatedImport.specifiers.filter(
          specifier => {
            const specName = typeof specifier === 'string' ? specifier : specifier.local;
            return !unusedImports.includes(specName);
          }
        );
      }
      
      return updatedImport;
    }).filter(importItem => {
      // Remove the entire import if:
      // 1. No specifiers left AND no default import
      // 2. It's a side-effect import (no specifiers, no default) - keep these always
      if (importItem.type === ImportType.SIDE_EFFECT) {
        return true; // Always keep side-effect imports
      }
      
      const hasSpecifiers = importItem.specifiers && importItem.specifiers.length > 0;
      const hasDefault = importItem.defaultImport;
      
      return hasSpecifiers || hasDefault;
    });
    
    return updatedGroup;
  }).filter(group => group.imports.length > 0); // Remove empty groups
  
  return updatedResult;
}