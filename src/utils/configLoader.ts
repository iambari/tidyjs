import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Config, TidyJSConfigFile, ImportGroupFile, ConfigSource } from '../types';
import { logDebug as debugLog } from './log';
import { configManager } from './config';

const CONFIG_FILE_NAMES = ['.tidyjsrc', 'tidyjs.json'];

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ConfigLoader {
    private static configCache = new Map<string, ConfigSource | null>();
    private static fileWatcher: vscode.FileSystemWatcher | undefined;

    static initialize(context: vscode.ExtensionContext): void {
        const pattern = `**/{${CONFIG_FILE_NAMES.join(',')}}`;
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        this.fileWatcher.onDidCreate(() => this.clearCache());
        this.fileWatcher.onDidChange(() => {
            debugLog('Config file changed, clearing all caches');
            this.clearCache();
            // Also clear ConfigManager document cache
            configManager.clearDocumentCache();
        });
        this.fileWatcher.onDidDelete(() => this.clearCache());
        
        context.subscriptions.push(this.fileWatcher);
        
        debugLog('ConfigLoader initialized with file watcher');
    }

    static clearCache(): void {
        this.configCache.clear();
        debugLog('ConfigLoader cache cleared');
    }

    static async findNearestConfigFile(documentUri: vscode.Uri): Promise<string | null> {
        const filePath = documentUri.fsPath;
        let currentDir = path.dirname(filePath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        const rootDir = workspaceFolder ? workspaceFolder.uri.fsPath : path.parse(currentDir).root;

        debugLog(`Searching for config file starting from: ${currentDir}`);

        while (currentDir && currentDir !== path.dirname(currentDir)) {
            for (const configFileName of CONFIG_FILE_NAMES) {
                const configPath = path.join(currentDir, configFileName);
                try {
                    await fs.promises.access(configPath, fs.constants.R_OK);
                    debugLog(`Found config file: ${configPath}`);
                    return configPath;
                } catch {
                    // File doesn't exist or isn't readable, continue searching
                }
            }

            if (currentDir === rootDir) {
                break;
            }

            currentDir = path.dirname(currentDir);
        }

        debugLog('No config file found');
        return null;
    }

    static async loadConfigFile(configPath: string): Promise<TidyJSConfigFile | null> {
        try {
            const content = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(content) as TidyJSConfigFile;
            
            debugLog(`Loaded config from ${configPath}`);
            
            // Handle extends property
            if (config.extends) {
                const baseConfigPath = path.resolve(path.dirname(configPath), config.extends);
                const baseConfig = await this.loadConfigFile(baseConfigPath);
                if (baseConfig) {
                    return this.mergeConfigs(baseConfig, config);
                }
            }
            
            return config;
        } catch (error) {
            debugLog(`Failed to load config file ${configPath}: ${error}`);
            return null;
        }
    }

    static mergeConfigs(base: TidyJSConfigFile, override: TidyJSConfigFile): TidyJSConfigFile {
        return {
            ...base,
            ...override,
            importOrder: {
                ...base.importOrder,
                ...override.importOrder,
            },
            format: {
                ...base.format,
                ...override.format,
            },
            pathResolution: {
                ...base.pathResolution,
                ...override.pathResolution,
            },
            groups: override.groups || base.groups,
            excludedFolders: override.excludedFolders || base.excludedFolders,
        };
    }

    static convertFileConfigToConfig(fileConfig: TidyJSConfigFile): Partial<Config> {
        const config: Partial<Config> = {
            // Don't include debug from file config - it should only come from VS Code settings
            excludedFolders: fileConfig.excludedFolders,
        };

        if (fileConfig.groups) {
            config.groups = fileConfig.groups.map((group: ImportGroupFile) => {
                // Check for deprecated isDefault property in file config
                if (group.isDefault !== undefined) {
                    console.warn(`DEPRECATION WARNING: Group "${group.name}" in config file uses deprecated property "isDefault". Please use "default" instead. The "isDefault" property will be removed in a future version.`);
                    
                    // If both are specified, default takes precedence
                    if (group.default === undefined) {
                        debugLog(`Auto-migrating "isDefault" to "default" for group "${group.name}" in config file`);
                    } else {
                        console.warn(`Group "${group.name}" in config file has both "isDefault" and "default" properties. Using "default" value and ignoring "isDefault".`);
                    }
                }

                return {
                    ...group,
                    order: group.order ?? 999,
                    default: group.default !== undefined ? group.default : group.isDefault, // Fallback to isDefault if default is not set
                    match: group.match ? new RegExp(group.match) : undefined,
                };
            });
        }

        if (fileConfig.importOrder) {
            config.importOrder = {
                default: fileConfig.importOrder.default ?? 1,
                named: fileConfig.importOrder.named ?? 2,
                typeOnly: fileConfig.importOrder.typeOnly ?? 3,
                sideEffect: fileConfig.importOrder.sideEffect ?? 0,
            };
        }

        if (fileConfig.format) {
            config.format = fileConfig.format;
        }

        if (fileConfig.pathResolution) {
            config.pathResolution = fileConfig.pathResolution;
        }

        return config;
    }

    static async getConfigForDocument(documentUri: vscode.Uri): Promise<ConfigSource[]> {
        const sources: ConfigSource[] = [];

        debugLog(`ConfigLoader.getConfigForDocument called for: ${documentUri.fsPath}`);

        // 1. Try to find a config file
        const configPath = await this.findNearestConfigFile(documentUri);
        debugLog(`Nearest config file search result: ${configPath || 'none found'}`);
        
        if (configPath) {
            const cachedConfig = this.configCache.get(configPath);
            if (cachedConfig !== undefined) {
                debugLog(`Using cached config for ${configPath}`);
                if (cachedConfig) {
                    sources.push(cachedConfig);
                }
            } else {
                debugLog(`Loading fresh config from ${configPath}`);
                const fileConfig = await this.loadConfigFile(configPath);
                if (fileConfig) {
                    const config = this.convertFileConfigToConfig(fileConfig);
                    debugLog(`Loaded config from file:`, fileConfig);
                    debugLog(`Converted config:`, config);
                    const source: ConfigSource = {
                        type: 'file',
                        path: configPath,
                        config,
                    };
                    this.configCache.set(configPath, source);
                    sources.push(source);
                } else {
                    this.configCache.set(configPath, null);
                }
            }
        }

        // 2. Get VS Code workspace folder configuration
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        if (workspaceFolder) {
            const workspaceConfig = vscode.workspace.getConfiguration('tidyjs', documentUri);
            const vsCodeConfig = this.extractVSCodeConfig(workspaceConfig);
            
            if (Object.keys(vsCodeConfig).length > 0) {
                sources.push({
                    type: 'vscode',
                    path: workspaceFolder.uri.fsPath,
                    config: vsCodeConfig,
                });
            }
        }

        // 3. Get global VS Code configuration
        const globalConfig = vscode.workspace.getConfiguration('tidyjs');
        const globalVSCodeConfig = this.extractVSCodeConfig(globalConfig);
        
        if (Object.keys(globalVSCodeConfig).length > 0) {
            sources.push({
                type: 'vscode',
                path: 'global',
                config: globalVSCodeConfig,
            });
        }

        return sources;
    }

    private static extractVSCodeConfig(workspaceConfig: vscode.WorkspaceConfiguration): Partial<Config> {
        const config: Partial<Config> = {};

        if (workspaceConfig.has('debug')) {
            config.debug = workspaceConfig.get('debug');
        }

        if (workspaceConfig.has('groups')) {
            const groups = workspaceConfig.get<{
                name: string;
                order?: number;
                default?: boolean;
                match?: string;
                priority?: number;
                sortOrder?: 'alphabetic' | string[];
            }[]>('groups');
            if (groups) {
                config.groups = groups.map(group => ({
                    ...group,
                    order: group.order ?? 999,
                    match: group.match ? new RegExp(group.match) : undefined,
                }));
            }
        }

        if (workspaceConfig.has('importOrder')) {
            config.importOrder = workspaceConfig.get('importOrder');
        }

        if (workspaceConfig.has('format')) {
            config.format = workspaceConfig.get('format');
        }

        if (workspaceConfig.has('pathResolution')) {
            config.pathResolution = workspaceConfig.get('pathResolution');
        }

        if (workspaceConfig.has('excludedFolders')) {
            config.excludedFolders = workspaceConfig.get('excludedFolders');
        }

        return config;
    }
}
