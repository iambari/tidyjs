// Misc
import { formatImports } from './formatter';
import { ImportParser, ParserResult, InvalidImport, ParsedImport, ImportSource } from './parser';

// VSCode
import { Range, window, commands, TextEdit, workspace, languages, CancellationTokenSource } from 'vscode';
import type { TextDocument, ExtensionContext, FormattingOptions, CancellationToken, DocumentFormattingEditProvider } from 'vscode';

// Utils
import { configManager } from './utils/config';
import { diagnosticsCache } from './utils/diagnostics-cache';
import { logDebug, logError } from './utils/log';
import { showMessage, analyzeImports } from './utils/misc';
import { perfMonitor } from './utils/performance';
import { PathResolver } from './utils/path-resolver';

let parser: ImportParser | null = null;
let lastConfigString = '';

/**
 * TidyJS Document Formatting Provider
 */
class TidyJSFormattingProvider implements DocumentFormattingEditProvider {
    async provideDocumentFormattingEdits(
        document: TextDocument,
        _options: FormattingOptions,
        _token: CancellationToken
    ): Promise<TextEdit[] | undefined> {
        try {
            // Vérifier si le document est dans un dossier exclu
            if (isDocumentInExcludedFolder(document)) {
                logDebug('Formatting skipped: document is in excluded folder');
                return undefined;
            }

            // Vérifier si l'extension est activée et configurée correctement
            if (!ensureExtensionEnabled()) {
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

            // Prepare filtering parameters for parser
            let missingModules: Set<string> | undefined;
            let unusedImportsList: string[] | undefined;

            const currentConfig = configManager.getConfig();
            
            logDebug('Current configuration:', {
                removeUnusedImports: currentConfig.format?.removeUnusedImports,
                removeMissingModules: currentConfig.format?.removeMissingModules,
                formatDefined: currentConfig.format !== undefined,
            });
            
            if (currentConfig.format?.removeUnusedImports === true || currentConfig.format?.removeMissingModules === true) {
                try {

                    const diagnostics = perfMonitor.measureSync('get_diagnostics', () => diagnosticsCache.getDiagnostics(document.uri), {
                        uri: document.uri.toString(),
                    });

                    // Parse once to get initial import info for filtering
                    const initialParserResult = perfMonitor.measureSync('initial_parser_parse', () => parser!.parse(documentText) as ParserResult, {
                        documentLength: documentText.length,
                    });

                    // Single analysis call that gets everything we need
                    const analysis = perfMonitor.measureSync(
                        'analyze_imports',
                        () => analyzeImports(document.uri, initialParserResult, diagnostics),
                        {
                            removeUnused: currentConfig.format?.removeUnusedImports,
                            removeMissing: currentConfig.format?.removeMissingModules,
                        }
                    );

                    // Prepare filtering parameters based on configuration
                    if (currentConfig.format?.removeUnusedImports === true) {
                        unusedImportsList = analysis.unusedImports;
                    }
                    
                    if (currentConfig.format?.removeMissingModules === true) {
                        missingModules = analysis.missingModules;
                        
                        // If removeUnusedImports is NOT enabled, still remove unused imports from missing modules
                        if (currentConfig.format?.removeUnusedImports !== true) {
                            unusedImportsList = Array.from(analysis.unusedFromMissing);
                        }
                    }

                    logDebug('Filtering parameters prepared:', {
                        config: {
                            removeUnusedImports: currentConfig.format?.removeUnusedImports,
                            removeMissingModules: currentConfig.format?.removeMissingModules,
                        },
                        filtering: {
                            unusedImportsList: unusedImportsList || [],
                            missingModules: missingModules ? Array.from(missingModules) : [],
                        },
                    });
                } catch (error) {
                    logError('Error preparing import filters:', error instanceof Error ? error.message : String(error));
                }
            } else {
                logDebug('Skipping import analysis - both removeUnusedImports and removeMissingModules are false');
            }
            
            // Final safety check - ensure we don't pass filtering parameters when options are disabled
            if (currentConfig.format?.removeMissingModules !== true) {
                missingModules = undefined;
            }
            if (currentConfig.format?.removeUnusedImports !== true && currentConfig.format?.removeMissingModules !== true) {
                unusedImportsList = undefined;
            }
            
            logDebug('Final filtering parameters:', {
                missingModulesSet: missingModules !== undefined,
                unusedImportsCount: unusedImportsList?.length || 0,
            });

            // Parse document with filtering - parser now handles all filtering logic
            let parserResult = perfMonitor.measureSync(
                'parser_parse',
                () => parser!.parse(documentText, missingModules, unusedImportsList) as ParserResult,
                { documentLength: documentText.length }
            );

            // Check if parser returned any processable imports
            if (!parserResult.importRange && parserResult.groups.length === 0) {
                logDebug('No imports to process in document');
                return undefined;
            }
            
            // Apply path resolution if enabled
            if (currentConfig.pathResolution?.enabled) {
                try {
                    const pathResolver = new PathResolver({
                        mode: currentConfig.pathResolution.mode || 'relative',
                        preferredAliases: currentConfig.pathResolution.preferredAliases || []
                    });
                    
                    logDebug('Applying path resolution with mode:', currentConfig.pathResolution.mode);
                    
                    // If converting relative to absolute, we need to resolve paths BEFORE grouping
                    // to ensure correct group assignment
                    if (currentConfig.pathResolution.mode === 'absolute') {
                        // We need to re-parse with path resolution
                        const enhancedParserResult = await enhanceParserResultWithResolvedPaths(
                            parserResult,
                            pathResolver,
                            document,
                            parser!
                        );
                        
                        if (enhancedParserResult) {
                            parserResult = enhancedParserResult;
                        }
                    } else {
                        // For absolute to relative, we can convert after grouping
                        let totalImports = 0;
                        let convertedImports = 0;
                        
                        // Convert paths in all import groups - create new groups with converted imports
                        const convertedGroups = await Promise.all(
                            parserResult.groups.map(async group => ({
                                ...group,
                                imports: await Promise.all(
                                    group.imports.map(async importInfo => {
                                        totalImports++;
                                        const resolvedPath = await pathResolver.convertImportPath(
                                            importInfo.source,
                                            document
                                        );
                                        
                                        if (resolvedPath && resolvedPath !== importInfo.source) {
                                            logDebug(`Path resolved: ${importInfo.source} -> ${resolvedPath}`);
                                            convertedImports++;
                                            // Return a new import object with the converted path
                                            return {
                                                ...importInfo,
                                                source: resolvedPath as ImportSource
                                            };
                                        }
                                        
                                        // Return unchanged import
                                        return importInfo;
                                    })
                                )
                            }))
                        );
                        
                        // Update parserResult with converted groups
                        parserResult = {
                            ...parserResult,
                            groups: convertedGroups
                        };
                        
                        logDebug(`Path resolution summary: ${convertedImports}/${totalImports} imports converted`);
                    }
                } catch (error) {
                    logError('Error during path resolution:', error);
                    // Continue without path resolution on error
                }
            }

            // Vérifier les imports invalides
            if (parserResult.invalidImports && parserResult.invalidImports.length > 0) {
                const errorMessages = parserResult.invalidImports.map((invalidImport) => {
                    return formatImportError(invalidImport);
                });
                logError('Invalid imports found:', errorMessages.join('\n'));
                return undefined;
            }

            // Debug: Log the imports before formatting
            if (currentConfig.pathResolution?.enabled) {
                logDebug('Imports before formatting:');
                parserResult.groups.forEach(group => {
                    group.imports.forEach(imp => {
                        logDebug(`  ${group.name}: ${imp.source}`);
                    });
                });
            }
            
            // Formater les imports
            const formattedDocument = await perfMonitor.measureAsync('format_imports', () =>
                formatImports(documentText, configManager.getConfig(), parserResult)
            );

            if (formattedDocument.error) {
                logError('Formatting error:', formattedDocument.error);
                return undefined;
            }


            // Créer et retourner les éditions
            const fullRange = new Range(document.positionAt(0), document.positionAt(documentText.length));

            const totalDuration = perfMonitor.end('total_format_operation');
            logDebug(`Document formatting completed in ${totalDuration.toFixed(2)}ms`);

            if (configManager.getConfig().debug) {
                perfMonitor.logSummary();
            }

            return [TextEdit.replace(fullRange, formattedDocument.text)];
        } catch (error) {
            logError('Error in provideDocumentFormattingEdits:', error);
            return undefined;
        } finally {
            diagnosticsCache.clear();
        }
    }
}

/**
 * Check if the current document is in an excluded folder
 */
function isDocumentInExcludedFolder(document: import('vscode').TextDocument): boolean {
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

    return excludedFolders.some((excludedFolder) => {
        const normalizedExcludedPath = excludedFolder.replace(/[/\\]/g, '/');
        const normalizedDocumentPath = relativePath.replace(/[/\\]/g, '/');

        return normalizedDocumentPath.startsWith(normalizedExcludedPath + '/') || normalizedDocumentPath === normalizedExcludedPath;
    });
}

/**
 * Vérifie que l'extension est activée avant d'exécuter une commande
 */
function ensureExtensionEnabled(): boolean {
    const validation = configManager.validateCurrentConfiguration();

    if (!validation.isValid) {
        showMessage.error(
            `TidyJS extension is disabled due to configuration errors:\n${validation.errors.join(
                '\n'
            )}\n\nPlease fix your configuration to use the extension.`
        );
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
            logError('Error initializing parser:', error);
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
            showMessage.error(
                `TidyJS extension disabled due to configuration errors:\n${validation.errors.join(
                    '\n'
                )}\n\nPlease fix your configuration to use the extension.`
            );
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
            { language: 'javascriptreact', scheme: 'file' },
        ];

        const formattingProvider = languages.registerDocumentFormattingEditProvider(documentSelector, new TidyJSFormattingProvider());

        const formatCommand = commands.registerCommand('extension.format', async () => {
            if (!ensureExtensionEnabled()) {
                return;
            }

            const editor = window.activeTextEditor;
            if (!editor) {
                showMessage.warning('No active editor found');
                return;
            }

            // Forcer l'utilisation de TidyJS comme formatter pour cette exécution
            // en appelant directement notre provider
            const provider = new TidyJSFormattingProvider();
            const tokenSource = new CancellationTokenSource();
            try {
                const edits = await provider.provideDocumentFormattingEdits(
                    editor.document,
                    { tabSize: 2, insertSpaces: true },
                    tokenSource.token
                );

                if (edits && edits.length > 0) {
                    await editor.edit((editBuilder) => {
                        edits.forEach((edit) => {
                            editBuilder.replace(edit.range, edit.newText);
                        });
                    });
                    logDebug('Imports formatted successfully via command!');
                } else {
                    logDebug('No formatting changes needed');
                }
            } finally {
                tokenSource.dispose();
            }
        });

        // Listen for configuration changes to invalidate parser cache
        const configChangeDisposable = workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('tidyjs')) {
                logDebug('TidyJS configuration changed, parser will be recreated on next use');
                // Force parser recreation on next use by clearing the config string
                lastConfigString = '';
            }
        });
        
        context.subscriptions.push(formatCommand, formattingProvider, configChangeDisposable);

        logDebug('Extension activated successfully with config:', JSON.stringify(configManager.getConfig(), null, 2));

        if (validation.isValid) {
            logDebug('TidyJS extension is ready to use as a Document Formatting Provider!');
        }
    } catch (error) {
        logError('Error activating extension:', error);
        showMessage.error(`TidyJS extension activation failed: ${error}`);
    }
}

function formatImportError(invalidImport: InvalidImport): string {
    if (!invalidImport || !invalidImport.error) {
        return 'Unknown import error';
    }

    const errorMessage = invalidImport.error;
    const importStatement = invalidImport.raw || '';
    const lineMatch = errorMessage.match(/\((\d+):(\d+)\)/);
    let formattedError = errorMessage;

    if (lineMatch && lineMatch.length >= 3) {
        const line = parseInt(lineMatch[1], 10);
        const column = parseInt(lineMatch[2], 10);

        const lines = importStatement.split('\n');

        if (line <= lines.length) {
            const problematicLine = lines[line - 1];
            const indicator = ' '.repeat(Math.max(0, column - 1)) + '^';
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
async function enhanceParserResultWithResolvedPaths(
    originalResult: ParserResult,
    pathResolver: PathResolver,
    document: TextDocument,
    parserInstance: ImportParser
): Promise<ParserResult | null> {
    try {
        // Extract all imports from groups
        const allImports: ParsedImport[] = [];
        for (const group of originalResult.groups) {
            allImports.push(...group.imports);
        }
        
        // Create temporary imports with resolved paths for grouping
        const tempImports: ParsedImport[] = [];
        const pathMapping = new Map<ParsedImport, string>(); // Track temp import -> original relative path
        let hasChanges = false;
        
        for (const importInfo of allImports) {
            if (importInfo.source.startsWith('.')) {
                const resolvedPath = await pathResolver.convertImportPath(
                    importInfo.source,
                    document
                );
                
                if (resolvedPath && resolvedPath !== importInfo.source) {
                    // Create temporary import with resolved path for grouping
                    // We need to recalculate the groupName based on the resolved path
                    const { groupName, isPriority } = parserInstance.determineGroup(resolvedPath);
                    const tempImport = {
                        ...importInfo,
                        source: resolvedPath as ImportSource,
                        groupName: groupName,
                        isPriority: isPriority
                    };
                    tempImports.push(tempImport);
                    pathMapping.set(tempImport, importInfo.source); // Store the original relative path
                    hasChanges = true;
                    logDebug(`Will regroup import: ${importInfo.source} -> ${resolvedPath} (group: ${groupName})`);
                } else {
                    tempImports.push(importInfo);
                }
            } else {
                tempImports.push(importInfo);
            }
        }
        
        if (!hasChanges) {
            return null; // No changes needed
        }
        
        // Re-organize imports with resolved paths for correct grouping
        const enhancedGroups = parserInstance.organizeImportsIntoGroups(tempImports);
        
        // Now update the imports in the groups to use the resolved absolute paths
        for (const group of enhancedGroups) {
            for (const importInfo of group.imports) {
                const originalRelativePath = pathMapping.get(importInfo);
                if (originalRelativePath) {
                    // Keep the resolved absolute path (importInfo.source already has it)
                    // The import was correctly grouped using the absolute path
                    logDebug(`Import correctly grouped: ${originalRelativePath} -> ${importInfo.source}`);
                }
            }
        }
        
        return {
            ...originalResult,
            groups: enhancedGroups
        };
    } catch (error) {
        logError('Error enhancing parser result:', error);
        return null;
    }
}

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
