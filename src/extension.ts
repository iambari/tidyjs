import { formatImports, findImportsWithBabel } from "./formatter";
import { ImportParser, ParserResult, InvalidImport } from "./parser";
import { Range, window, commands, workspace } from "vscode";
import type { ExtensionContext } from "vscode";
import { configManager } from "./utils/config";
import { logDebug, logError } from "./utils/log";
import { getUnusedImports, removeUnusedImports, showMessage } from "./utils/misc";

let parser = new ImportParser(configManager.getParserConfig());

let isFormatting = false;
let formattingQueue: Array<() => void> = [];
let documentVersions = new WeakMap<import("vscode").TextDocument, number>();

/**
 * Enhanced debouncer with queue management
 */
function createEnhancedDebouncer<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (!isFormatting) {
        func(...args);
      } else {
        formattingQueue.push(() => func(...args));
      }
    }, delay);
  };
}

/**
 * Process the formatting queue
 */
function processFormattingQueue(): void {
  if (formattingQueue.length > 0 && !isFormatting) {
    const nextTask = formattingQueue.shift();
    if (nextTask) {
      nextTask();
    }
  }
}

/**
 * Check if document is in a stable state for formatting
 */
function isDocumentStableForFormatting(document: import("vscode").TextDocument): boolean {
  if (document.isDirty && document.isUntitled) {
    return false;
  }

  const lastVersion = documentVersions.get(document) || 0;
  const currentVersion = document.version;

  if (currentVersion === lastVersion) {
    return true;
  }

  documentVersions.set(document, currentVersion);

  if (currentVersion - lastVersion > 1) {
    logDebug("Document version changed rapidly, waiting for stability");
    return false;
  }

  return true;
}

/**
 * Wait for document to be stable
 */
async function waitForDocumentStability(document: import("vscode").TextDocument, maxWait: number = 500): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (isDocumentStableForFormatting(document)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  logDebug("Document stability timeout reached");
  return false;
}

/**
 * Commande de test pour déboguer la validation de configuration
 */
async function testConfigurationValidation(): Promise<void> {
  try {
    const config = configManager.getConfig();
    const isValid = configManager.isConfigurationValid();
    const errors = configManager.getValidationErrors();

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

    detailMessage += "=== MANUAL VALIDATION TEST ===\n";
    const manualValidation = validateConfigurationManual(config);
    detailMessage += `Manual validation result: ${manualValidation.isValid ? "✅" : "❌"}\n`;
    if (!manualValidation.isValid) {
      detailMessage += "Manual validation errors:\n";
      manualValidation.errors.forEach((error, index) => {
        detailMessage += `  ${index + 1}. ${error}\n`;
      });
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
 * Validation manuelle pour comparaison
 */
function validateConfigurationManual(config: ReturnType<typeof configManager.getConfig>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const defaultGroups = config.groups.filter((group) => {
    logDebug(`Checking group "${group.name}": isDefault = ${group.isDefault} (type: ${typeof group.isDefault})`);
    return group.isDefault === true;
  });

  logDebug(
    `Found ${defaultGroups.length} default groups:`,
    defaultGroups.map((g) => g.name)
  );

  if (defaultGroups.length === 0) {
    errors.push("No group is marked as default. At least one group must be the default.");
  } else if (defaultGroups.length > 1) {
    const groupNames = defaultGroups.map((g) => `"${g.name}"`).join(", ");
    errors.push(`Multiple groups are marked as default: ${groupNames}. Only one group can be the default.`);
  }

  const orders = config.groups.map((g) => g.order);
  const duplicateOrders = orders.filter((order, index) => orders.indexOf(order) !== index);
  if (duplicateOrders.length > 0) {
    const uniqueDuplicates = [...new Set(duplicateOrders)];
    errors.push(`Duplicate group orders found: ${uniqueDuplicates.join(", ")}. Each group should have a unique order.`);
  }

  const names = config.groups.map((g) => g.name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    const uniqueDuplicateNames = [...new Set(duplicateNames)];
    errors.push(`Duplicate group names found: ${uniqueDuplicateNames.join(", ")}. Each group must have a unique name.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Enhanced document update with better error handling and state management
 */
async function applyDocumentUpdate(
  document: import("vscode").TextDocument,
  parserResult: ParserResult,
  formatterConfig: ReturnType<typeof configManager.getConfig>,
  source: string = "unknown"
): Promise<boolean> {
  const editor = window.activeTextEditor;
  if (!editor || editor.document !== document) {
    logDebug(`Document update skipped: editor mismatch (${source})`);
    return false;
  }

  const isStable = await waitForDocumentStability(document, 300);
  if (!isStable) {
    logDebug(`Document update skipped: document not stable (${source})`);
    return false;
  }

  if (document.isDirty && document.isUntitled) {
    logDebug(`Document update skipped: document is dirty and untitled (${source})`);
    return false;
  }

  const documentText = document.getText();

  if (containsSuspiciousContent(documentText)) {
    logDebug(`Document update skipped: suspicious content detected (${source})`);
    return false;
  }

  try {
    const formattedDocument = await formatImports(documentText, formatterConfig, parserResult);

    logDebug(`Formatted document result (${source}):`, {
      hasError: !!formattedDocument.error,
      textChanged: formattedDocument.text !== documentText,
      originalLength: documentText.length,
      formattedLength: formattedDocument.text.length,
    });

    if (formattedDocument.error) {
      showMessage.error(formattedDocument.error);
      return false;
    }

    if (formattedDocument.text !== documentText) {
      const fullDocumentRange = new Range(document.positionAt(0), document.positionAt(documentText.length));

      return await editor
        .edit((editBuilder) => {
          editBuilder.replace(fullDocumentRange, formattedDocument.text);
        })
        .then((success) => {
          if (success) {
            logDebug(`Successfully updated document (${source})`);

            documentVersions.set(document, document.version + 1);
          } else {
            showMessage.warning(`Failed to update document (${source})`);
          }
          return success;
        });
    }

    logDebug(`No changes needed for document (${source})`);
    return true;
  } catch (error) {
    logError(`Error applying document update (${source}):`, error);
    const errorMessage = String(error);
    showMessage.error(`Error updating document: ${errorMessage}`);
    return false;
  }
}

/**
 * Check for suspicious content that might indicate parsing issues
 */
function containsSuspiciousContent(text: string): boolean {
  const suspiciousPatterns = [/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, /\d+[a-zA-Z]\s*import/, /import\s*\d+/, /import\s*{[^}]*}\s*{/, /import\s*{\s*default\s*}\s*from/];

  return suspiciousPatterns.some((pattern) => pattern.test(text));
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

  const documentPath = document.uri.fsPath;
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
 * Enhanced import formatting command with better concurrency control
 */
async function formatImportsCommand(source: string = "manual"): Promise<void> {
  if (isFormatting) {
    logDebug(`Skipping ${source} format operation - already formatting`);

    formattingQueue.push(() => formatImportsCommand(source));
    return;
  }

  if (!configManager.isConfigurationValid()) {
    const errors = configManager.getValidationErrors();
    showMessage.error(`Cannot format imports: Invalid configuration.\n${errors.join("\n")}`);
    return;
  }

  const editor = window.activeTextEditor;
  if (!editor) {
    showMessage.warning("No active editor found");
    processFormattingQueue();
    return;
  }

  const document = editor.document;

  if (isDocumentInExcludedFolder(document)) {
    logDebug(`Format operation skipped: document is in excluded folder (${source})`);
    if (source === "manual") {
      logDebug("Import formatting is disabled for this folder");
    }
    processFormattingQueue();
    return;
  }

  const isStable = await waitForDocumentStability(document, 500);
  if (!isStable) {
    logDebug(`Format operation skipped: document not stable (${source})`);
    processFormattingQueue();
    return;
  }

  const documentText = document.getText();

  if (containsSuspiciousContent(documentText)) {
    logDebug(`Format operation skipped: suspicious content detected (${source})`);
    processFormattingQueue();
    return;
  }

  isFormatting = true;
  logDebug(`Starting ${source} format operation`);

  try {
    const importRange = await findImportsWithBabel(documentText);

    if (importRange?.error) {
      showMessage.error(importRange.error);
      logError("Error analyzing imports:", importRange.error);
      return;
    }

    if (!importRange || importRange.start === importRange.end) {
      if (source === "manual") {
        showMessage.info("No imports found in document");
      }
      return;
    }

    const importsText = documentText.substring(importRange.start, importRange.end);
    logDebug(`Found imports from position ${importRange.start} to ${importRange.end}`);
    logDebug(`Imports text length: ${importsText.length}`);

    if (containsSuspiciousContent(importsText)) {
      logError("Suspicious content detected in imports section, aborting format");
      showMessage.error("Format aborted: Invalid content detected in imports section");
      return;
    }

    let parserResult = parser.parse(importsText) as ParserResult;
    logDebug("Parser result:", JSON.stringify(parserResult, null, 2));

    if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
      const errorMessages = parserResult.invalidImports.map((invalidImport) => {
        return formatImportError(invalidImport);
      });

      showMessage.error(`Invalid import syntax: ${errorMessages[0]}`);
      logError("Invalid imports found:", errorMessages.join("\n"));
      return;
    }

    if (configManager.getConfig().format.removeUnused) {
      const unusedImports = getUnusedImports(document.uri, parserResult);
      logDebug("Unused imports:", unusedImports);
      if (unusedImports.length > 0) {
        parserResult = removeUnusedImports(parserResult, unusedImports);
      }
    }

    const success = await applyDocumentUpdate(document, parserResult, configManager.getConfig(), source);

    if (success) {
      if (source === "manual") {
        logDebug("Imports formatted successfully!");
      }
    }
  } catch (error) {
    logError(`Error formatting imports (${source}):`, error);
    const errorMessage = String(error);
    showMessage.error(`Error formatting imports: ${errorMessage}`);
  } finally {
    isFormatting = false;
    logDebug(`Finished ${source} format operation`);

    setTimeout(() => processFormattingQueue(), 100);
  }
}

/**
 * Enhanced debounced versions with longer delays to prevent rapid execution
 */
const debouncedFormatImportsCommand = createEnhancedDebouncer(() => formatImportsCommand("manual"), 600);
const debouncedFormatOnSaveCommand = createEnhancedDebouncer(() => formatImportsCommand("auto-save"), 800);

/**
 * Gère la mise à jour de la configuration
 */
function handleConfigurationChange(config: ReturnType<typeof configManager.getConfig>, isValid: boolean, errors?: string[]): void {
  logDebug("Configuration change detected. Valid:", isValid);

  if (isValid) {
    try {
      parser = new ImportParser(configManager.getParserConfig());
      showMessage.info("TidyJS configuration updated successfully");
      logDebug("Parser reinitialized with new configuration");
    } catch (error) {
      logError("Error reinitializing parser:", error);
      showMessage.error(`Error updating parser: ${error}`);
    }
  } else {
    const errorMessage = errors ? errors.join("\n") : "Unknown configuration error";
    showMessage.error(`TidyJS configuration is invalid:\n${errorMessage}`);
    logError("Invalid configuration:", errors);
  }
}

/**
 * Vérifie que la configuration est valide avant d'exécuter une commande
 */
function ensureValidConfiguration(): boolean {
  if (!configManager.isConfigurationValid()) {
    const errors = configManager.getValidationErrors();
    showMessage.error(`Cannot proceed: Invalid TidyJS configuration.\n${errors.join("\n")}\nPlease fix your settings.`);
    return false;
  }
  return true;
}

export function activate(context: ExtensionContext): void {
  try {
    configManager.loadConfiguration();

    if (!configManager.isConfigurationValid()) {
      const errors = configManager.getValidationErrors();
      showMessage.warning(`TidyJS configuration issues detected:\n${errors.join("\n")}`);
    }

    const vscodeConfigChangeDisposable = workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("tidyjs")) {
        logDebug("VS Code configuration changed, reloading...");
        configManager.loadConfiguration();
      }
    });

    const configChangeDisposable = configManager.onConfigChange(handleConfigurationChange);

    const formatCommand = commands.registerCommand("extension.format", async () => {
      if (!ensureValidConfiguration()) {
        return;
      }
      debouncedFormatImportsCommand();
    });

    const handleFormatOnSave = (document: import("vscode").TextDocument) => {
      if (configManager.getConfig().format.onSave) {
        if (isDocumentInExcludedFolder(document)) {
          logDebug("Format on save skipped: document is in excluded folder");
          return;
        }
        
        const editor = window.activeTextEditor;
        if (editor && editor.document === document) {
          if (ensureValidConfiguration()) {
            setTimeout(() => {
              if (!isFormatting) {
                debouncedFormatOnSaveCommand();
              }
            }, 200);
          } else {
            showMessage.warning("Format on save skipped due to invalid configuration.");
          }
        }
      }
    };

    const formatOnSaveDisposable = workspace.onDidSaveTextDocument(handleFormatOnSave);

    const testCommand = commands.registerCommand("tidyjs.testValidation", testConfigurationValidation);

    context.subscriptions.push(testCommand, vscodeConfigChangeDisposable, configChangeDisposable, formatCommand, formatOnSaveDisposable);

    logDebug("Extension activated successfully with config:", JSON.stringify(configManager.getConfig(), null, 2));

    if (configManager.isConfigurationValid()) {
      logDebug("TidyJS extension is ready to use!");
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
