// Misc
import { formatImports } from './formatter';
import {
    ImportParser,
    ParserResult,
    InvalidImport
}                        from './parser';

// VSCode
import {
    Range,
    window,
    commands,
    TextEdit,
    workspace,
    languages,
    CancellationTokenSource
}                                  from 'vscode';
import type {
    TextDocument,
    ExtensionContext,
    FormattingOptions,
    CancellationToken,
    DocumentFormattingEditProvider
}                                  from 'vscode';

// Utils
import { configManager }    from './utils/config';
import { diagnosticsCache } from './utils/diagnostics-cache';
import {
    logDebug,
    logError
}                           from './utils/log';
import {
    showMessage,
    analyzeImports
}                           from './utils/misc';
import { perfMonitor }      from './utils/performance';

let parser: ImportParser | null = null;
let lastConfigString = '';

/**
 * TidyJS Document Formatting Provider
 */
class TidyJSFormattingProvider implements DocumentFormattingEditProvider {
  async provideDocumentFormattingEdits(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken
  ): Promise<TextEdit[] | undefined> {
    try {
      // Vérifier si le document est dans un dossier exclu
      if (isDocumentInExcludedFolder(document)) {
        logDebug("Formatting skipped: document is in excluded folder");
        return undefined;
      }

      // Vérifier si l'extension est activée et configurée correctement
      if (!ensureExtensionEnabled()) {
        return undefined;
      }

      // Vérifier si nous pouvons formater ce document
      if (!canFormatDocument(document)) {
        logDebug("Formatting skipped: document cannot be formatted");
        return undefined;
      }

      const documentText = document.getText();

      // Vérification de sécurité pour éviter de formater des logs
      // Supprimer cette vérification car elle est trop restrictive et empêche le formatage
      // de fichiers légitimes qui pourraient contenir ces chaînes dans leur code

      if (!parser) {
        logError('Parser not initialized');
        return undefined;
      }

      perfMonitor.clear();
      perfMonitor.start('total_format_operation');

      // Pre-filter imports if removal features are enabled
      let missingModules: Set<string> | undefined;
      let unusedImportsList: string[] | undefined;

      if (configManager.getConfig().format?.removeUnusedImports || configManager.getConfig().format?.removeMissingModules) {
        try {
          const config = perfMonitor.measureSync('config_getConfig', () => configManager.getConfig());
          
          const diagnostics = perfMonitor.measureSync(
            'get_diagnostics',
            () => diagnosticsCache.getDiagnostics(document.uri),
            { uri: document.uri.toString() }
          );

          // Parse once to get initial import info for filtering
          const initialParserResult = perfMonitor.measureSync(
            'initial_parser_parse',
            () => parser!.parse(documentText) as ParserResult,
            { documentLength: documentText.length }
          );

          // Single analysis call that gets everything we need
          const analysis = perfMonitor.measureSync(
            'analyze_imports',
            () => analyzeImports(document.uri, initialParserResult, diagnostics),
            { 
              removeUnused: config.format?.removeUnusedImports,
              removeMissing: config.format?.removeMissingModules 
            }
          );

          /*
          * Logic for filtering:
          * 
          * 1. removeUnusedImports only: Remove ALL unused imports regardless of module status
          * 2. removeMissingModules only: Remove entire import statements from missing modules
          * 3. Both enabled: Remove ALL unused imports + entire imports from missing modules
          * 
          * The parser handles this in two ways:
          * - missingModules: Skip entire import statements from these modules
          * - unusedImportsList: Skip individual import specifiers
          */

          if (config.format?.removeUnusedImports) {
            // Remove all unused imports (includes those from missing modules)
            unusedImportsList = analysis.unusedImports;
          }
          
          if (config.format?.removeMissingModules) {
            // Remove entire imports from missing modules
            missingModules = analysis.missingModules;
            
            // If removeUnusedImports is NOT enabled, we still need to remove
            // unused imports from missing modules to avoid keeping dead code
            if (!config.format?.removeUnusedImports) {
              unusedImportsList = Array.from(analysis.unusedFromMissing);
            }
          }
          
          logDebug('Pre-filtering results:', {
            config: {
              removeUnusedImports: config.format?.removeUnusedImports,
              removeMissingModules: config.format?.removeMissingModules,
            },
            analysis: {
              totalUnusedImports: analysis.unusedImports.length,
              missingModules: Array.from(analysis.missingModules),
              unusedFromMissing: Array.from(analysis.unusedFromMissing),
            },
            filtering: {
              unusedImportsList: unusedImportsList || [],
              missingModules: missingModules ? Array.from(missingModules) : [],
            }
          });
        } catch (error) {
          logError("Error pre-filtering imports:", error instanceof Error ? error.message : String(error));
        }
      }

      // Parser le document with pre-filtering
      const parserResult = perfMonitor.measureSync(
        'parser_parse',
        () => parser!.parse(documentText, missingModules, unusedImportsList) as ParserResult,
        { documentLength: documentText.length }
      );

      // Vérifier si des imports ont été trouvés
      if (!parserResult.importRange || parserResult.importRange.start === parserResult.importRange.end) {
        logDebug("No imports found in document");
        return undefined;
      }

      // Vérifier les imports invalides
      if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
        const errorMessages = parserResult.invalidImports.map((invalidImport) => {
          return formatImportError(invalidImport);
        });
        logError("Invalid imports found:", errorMessages.join("\n"));
        return undefined;
      }

      // Formater les imports
      const formattedDocument = await perfMonitor.measureAsync(
        'format_imports',
        () => formatImports(documentText, configManager.getConfig(), parserResult)
      );

      if (formattedDocument.error) {
        logError("Formatting error:", formattedDocument.error);
        return undefined;
      }

      // Si aucun changement n'est nécessaire
      if (formattedDocument.text === documentText) {
        logDebug("No changes needed for document");
        return undefined;
      }

      // Créer et retourner les éditions
      const fullRange = new Range(
        document.positionAt(0),
        document.positionAt(documentText.length)
      );

      const totalDuration = perfMonitor.end('total_format_operation');
      logDebug(`Document formatting completed in ${totalDuration.toFixed(2)}ms`);

      if (configManager.getConfig().debug) {
        perfMonitor.logSummary();
      }

      return [TextEdit.replace(fullRange, formattedDocument.text)];
    } catch (error) {
      logError("Error in provideDocumentFormattingEdits:", error);
      return undefined;
    } finally {
      diagnosticsCache.clear();
    }
  }
}

/**
 * Simple check if document can be formatted
 */
function canFormatDocument(document: import("vscode").TextDocument): boolean {
  // Permettre le formatage de tous les documents
  return true;
}

/**
 * Commande de test pour déboguer la validation de configuration
 */
async function testConfigurationValidation(): Promise<void> {
  try {
    const config = configManager.getConfig();
    const validation = configManager.validateCurrentConfiguration();
    const isValid = validation.isValid;
    const errors = validation.errors;

    const defaultGroups = config.groups.filter((group) => group.isDefault === true);

    let detailMessage = "=== DEBUG CONFIGURATION VALIDATION ===\n\n";
    detailMessage += `Configuration valid: ${isValid ? "✅" : "❌"}\n`;
    detailMessage += `Validation errors: ${errors.length}\n\n`;

    if (errors.length > 0) {
      detailMessage += "ERRORS:\n";
      errors.forEach((error, index) => {
        detailMessage += `  ${index + 1}. ${error}\n`;
      });
      detailMessage += "\n";
    }

    detailMessage += "GROUPS ANALYSIS:\n";
    detailMessage += `Total groups: ${config.groups.length}\n`;
    detailMessage += `Groups marked as default: ${defaultGroups.length}\n\n`;

    detailMessage += "GROUPS DETAILS:\n";
    config.groups.forEach((group, index) => {
      detailMessage += `  ${index + 1}. "${group.name}"\n`;
      detailMessage += `     - Order: ${group.order}\n`;
      detailMessage += `     - isDefault: ${group.isDefault}\n`;
      detailMessage += `     - Match: ${group.match ? group.match.source : "undefined"}\n\n`;
    });

    if (defaultGroups.length > 1) {
      detailMessage += "❌ PROBLEM DETECTED:\n";
      detailMessage += "Multiple groups marked as default:\n";
      defaultGroups.forEach((group) => {
        detailMessage += `  - "${group.name}" (order: ${group.order})\n`;
      });
      detailMessage += "Only ONE group should have isDefault: true\n\n";
    } else if (defaultGroups.length === 0) {
      detailMessage += "❌ PROBLEM DETECTED:\n";
      detailMessage += "No group marked as default. At least one group must be the default.\n\n";
    } else {
      detailMessage += "✅ DEFAULT GROUP OK:\n";
      detailMessage += `  - "${defaultGroups[0].name}" is correctly marked as default\n\n`;
    }


    const doc = await workspace.openTextDocument({
      content: detailMessage,
      language: "plaintext",
    });
    await window.showTextDocument(doc);

    if (defaultGroups.length > 1) {
      const groupNames = defaultGroups.map((g) => `"${g.name}"`).join(", ");
      showMessage.error(`❌ Configuration Invalid: Multiple default groups found: ${groupNames}`);
    } else if (isValid) {
      showMessage.info("✅ Configuration is valid!");
    } else {
      showMessage.error(`❌ Configuration is invalid: ${errors.join(", ")}`);
    }
  } catch (error) {
    logError("Error in test configuration validation:", error);
    showMessage.error(`Test failed: ${error}`);
  }
}



/**
 * Check if the current document is in an excluded folder
 */
function isDocumentInExcludedFolder(document: import("vscode").TextDocument): boolean {
  const config = configManager.getConfig();
  const excludedFolders = config.excludedFolders;
  
  if (!excludedFolders || excludedFolders.length === 0) {
    return false;
  }

  // const documentPath = document.uri.fsPath; // Non utilisé
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
  
  if (!workspaceFolder) {
    return false;
  }

  const relativePath = workspace.asRelativePath(document.uri, false);
  
  return excludedFolders.some(excludedFolder => {
    const normalizedExcludedPath = excludedFolder.replace(/[/\\]/g, '/');
    const normalizedDocumentPath = relativePath.replace(/[/\\]/g, '/');
    
    return normalizedDocumentPath.startsWith(normalizedExcludedPath + '/') || 
           normalizedDocumentPath === normalizedExcludedPath;
  });
}



/**
 * Vérifie que l'extension est activée avant d'exécuter une commande
 */
function ensureExtensionEnabled(): boolean {
  const validation = configManager.validateCurrentConfiguration();
  
  if (!validation.isValid) {
    showMessage.error(`TidyJS extension is disabled due to configuration errors:\n${validation.errors.join("\n")}\n\nPlease fix your configuration to use the extension.`);
    return false;
  }
  
  // Check if configuration has changed
  const config = configManager.getParserConfig();
  const configString = JSON.stringify(config);
  const configChanged = configString !== lastConfigString;
  
  // Create or recreate parser if needed
  if (!parser || configChanged) {
    try {
      // Dispose of old parser to clean up cache
      if (parser) {
        logDebug('Disposing old parser instance');
        parser.dispose();
      }
      
      logDebug(configChanged ? 'Configuration changed, recreating parser' : 'Creating new parser instance');
      parser = new ImportParser(config);
      lastConfigString = configString;
    } catch (error) {
      logError("Error initializing parser:", error);
      showMessage.error(`Error initializing parser: ${error}`);
      return false;
    }
  }
  
  return true;
}

export function activate(context: ExtensionContext): void {
  try {
    // Validate configuration on startup
    const validation = configManager.validateCurrentConfiguration();
    
    if (validation.isValid) {
      const config = configManager.getParserConfig();
      parser = new ImportParser(config);
      lastConfigString = JSON.stringify(config);
      logDebug('Extension activated with valid configuration');
    } else {
      showMessage.error(`TidyJS extension disabled due to configuration errors:\n${validation.errors.join("\n")}\n\nPlease fix your configuration to use the extension.`);
      logError('Extension started with invalid configuration - commands disabled:', validation.errors);
      parser = null;
    }

    // Enregistrer TidyJS comme formatting provider pour TypeScript et JavaScript
    // Note: Nous pouvons utiliser des patterns glob négatifs dans le documentSelector
    // mais ils ne sont pas encore bien supportés par VS Code pour les formatters.
    // Pour l'instant, nous gardons la vérification manuelle dans provideDocumentFormattingEdits
    const documentSelector = [
      { language: 'typescript', scheme: 'file' },
      { language: 'typescriptreact', scheme: 'file' },
      { language: 'javascript', scheme: 'file' },
      { language: 'javascriptreact', scheme: 'file' }
    ];

    const formattingProvider = languages.registerDocumentFormattingEditProvider(
      documentSelector,
      new TidyJSFormattingProvider()
    );

    const formatCommand = commands.registerCommand("extension.format", async () => {
      if (!ensureExtensionEnabled()) {
        return;
      }
      
      const editor = window.activeTextEditor;
      if (!editor) {
        showMessage.warning("No active editor found");
        return;
      }

      // Forcer l'utilisation de TidyJS comme formatter pour cette exécution
      // en appelant directement notre provider
      const provider = new TidyJSFormattingProvider();
      const tokenSource = new CancellationTokenSource();
      try {
        const edits = await provider.provideDocumentFormattingEdits(
          editor.document,
          { tabSize: 2, insertSpaces: true }, // Options par défaut
          tokenSource.token
        );

        if (edits && edits.length > 0) {
          await editor.edit(editBuilder => {
            edits.forEach(edit => {
              editBuilder.replace(edit.range, edit.newText);
            });
          });
          logDebug("Imports formatted successfully via command!");
        } else {
          logDebug("No formatting changes needed");
        }
      } finally {
        tokenSource.dispose();
      }
    });

    const testCommand = commands.registerCommand("tidyjs.testValidation", testConfigurationValidation);
    
    // Listen for configuration changes to invalidate parser cache
    const configChangeDisposable = workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('tidyjs')) {
        logDebug('TidyJS configuration changed, parser will be recreated on next use');
        // Force parser recreation on next use by clearing the config string
        lastConfigString = '';
      }
    });

    context.subscriptions.push(testCommand, formatCommand, formattingProvider, configChangeDisposable);

    logDebug("Extension activated successfully with config:", JSON.stringify(configManager.getConfig(), null, 2));

    if (validation.isValid) {
      logDebug("TidyJS extension is ready to use as a Document Formatting Provider!");
    }
  } catch (error) {
    logError("Error activating extension:", error);
    showMessage.error(`TidyJS extension activation failed: ${error}`);
  }
}

function formatImportError(invalidImport: InvalidImport): string {
  if (!invalidImport || !invalidImport.error) {
    return "Unknown import error";
  }

  const errorMessage = invalidImport.error;
  const importStatement = invalidImport.raw || "";
  const lineMatch = errorMessage.match(/\((\d+):(\d+)\)/);
  let formattedError = errorMessage;

  if (lineMatch && lineMatch.length >= 3) {
    const line = parseInt(lineMatch[1], 10);
    const column = parseInt(lineMatch[2], 10);

    const lines = importStatement.split("\n");

    if (line <= lines.length) {
      const problematicLine = lines[line - 1];
      const indicator = " ".repeat(Math.max(0, column - 1)) + "^";
      formattedError = `${errorMessage}\nIn: ${problematicLine.trim()}\n${indicator}`;
    } else {
      formattedError = `${errorMessage}\nIn: ${importStatement.trim()}`;
    }
  }

  return formattedError;
}

/**
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  try {
    logDebug('Extension deactivating - cleaning up resources');
    
    // Dispose of parser to clean up cache
    if (parser) {
      parser.dispose();
      parser = null;
    }
    
    // Clear configuration cache
    lastConfigString = '';
    
    logDebug('Extension deactivated successfully');
  } catch (error) {
    logError('Error during extension deactivation:', error);
  }
}
