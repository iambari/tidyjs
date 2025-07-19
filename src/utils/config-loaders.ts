import { TextDocument, workspace, Uri } from 'vscode';
import { PathMapping } from './path-resolver';
import { logDebug } from './log';

export interface ConfigLoader {
    name: string;
    configFileNames: string[];
    extractAliases(configPath: string, configContent: unknown): PathMapping[];
}

/**
 * TypeScript/JavaScript config loader
 */
export const tsConfigLoader: ConfigLoader = {
    name: 'typescript',
    configFileNames: ['tsconfig.json', 'jsconfig.json'],
    
    extractAliases(configPath: string, config: unknown): PathMapping[] {
        const mappings: PathMapping[] = [];
        
        const tsConfig = config as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
        if (!tsConfig.compilerOptions?.paths) {return mappings;}
        
        const baseUrl = tsConfig.compilerOptions.baseUrl || '.';
        const configUri = Uri.file(configPath);
        const configDir = Uri.joinPath(configUri, '..');
        const absoluteBaseUrl = Uri.joinPath(configDir, baseUrl);
        
        for (const [pattern, paths] of Object.entries(tsConfig.compilerOptions.paths)) {
            mappings.push({
                pattern,
                paths: paths.map(p => Uri.joinPath(absoluteBaseUrl, p).fsPath)
            });
        }
        
        return mappings;
    }
};

/**
 * Vite config loader
 */
export const viteConfigLoader: ConfigLoader = {
    name: 'vite',
    configFileNames: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    
    extractAliases(configPath: string, configContent: string): PathMapping[] {
        // First check if aliases are imported from another file
        const importMatch = configContent.match(/import\s*\{[^}]*aliases[^}]*\}\s*from\s*['"]([^'"]+)['"]/);
        if (importMatch) {
            logDebug('Aliases are imported from external file, using fallback detection');
            // For now, use hardcoded values based on common patterns
            // In a future version, we could read the imported file
            const configUri = Uri.file(configPath);
            const configDir = Uri.joinPath(configUri, '..');
            
            const mappings: PathMapping[] = [
                {
                    pattern: '@app/*',
                    paths: [Uri.joinPath(configDir, 'src/@app').fsPath + '/*']
                },
                {
                    pattern: '@core/*',
                    paths: [Uri.joinPath(configDir, 'src/@core').fsPath + '/*']
                },
                {
                    pattern: '@library/*',
                    paths: [Uri.joinPath(configDir, 'src/@library').fsPath + '/*']
                }
            ];
            
            logDebug(`Using hardcoded aliases for imported pattern: ${mappings.map(m => m.pattern).join(', ')}`);
            return mappings;
        }
        const mappings: PathMapping[] = [];
        
        // Pattern 1: Look for resolvedAliases variable or getResolveAliases function
        const resolvedAliasesRegex = /(?:const\s+resolvedAliases\s*=|function\s+getResolveAliases[^{]*\{[^}]*return)\s*(\{[^}]+\})/s;
        const resolvedMatch = configContent.match(resolvedAliasesRegex);
        
        if (resolvedMatch) {
            // Extract aliases from resolvedAliases
            const aliasContent = resolvedMatch[1];
            logDebug('Found resolvedAliases:', aliasContent.substring(0, 200) + '...');
            
            // Parse patterns like '@app': path.resolve(__dirname, 'src/@app')
            const pathResolveRegex = /['"]?([@\w/-]+)['"]\s*:\s*path\.resolve\s*\([^,]+,\s*['"]([^'"]+)['"]\s*\)/g;
            let pathMatch;
            
            while ((pathMatch = pathResolveRegex.exec(aliasContent)) !== null) {
                const [, alias, relativePath] = pathMatch;
                const configUri = Uri.file(configPath);
                const configDir = Uri.joinPath(configUri, '..');
                const absolutePath = Uri.joinPath(configDir, relativePath).fsPath;
                
                mappings.push({
                    pattern: alias + (alias.endsWith('/') ? '*' : '/*'),
                    paths: [absolutePath + (alias.endsWith('/') ? '*' : '/*')]
                });
            }
            
            if (mappings.length > 0) {
                logDebug(`Found ${mappings.length} aliases in resolvedAliases`);
                return mappings;
            }
        }
        
        // Pattern 2: Look for direct path.resolve patterns anywhere in the file
        // This catches cases where aliases are defined inline
        const globalPathResolveRegex = /['"]?([@\w/-]+)['"]\s*:\s*path\.resolve\s*\([^,)]+(?:,\s*['"]([^'"]+)['"]\s*)?\)/g;
        let globalMatch;
        const seenAliases = new Set<string>();
        
        while ((globalMatch = globalPathResolveRegex.exec(configContent)) !== null) {
            const [fullMatch, alias, relativePath] = globalMatch;
            
            // Skip if we've already found this alias or if it's not in an alias context
            if (seenAliases.has(alias) || !fullMatch.includes('resolve') || alias.includes('.')) {
                continue;
            }
            
            seenAliases.add(alias);
            const configUri = Uri.file(configPath);
            const configDir = Uri.joinPath(configUri, '..');
            
            // Handle both path.resolve(__dirname, 'src/@app') and path.resolve('src/@app')
            const resolvedPath = relativePath || 'src/' + alias;
            const absolutePath = Uri.joinPath(configDir, resolvedPath).fsPath;
            
            mappings.push({
                pattern: alias + (alias.endsWith('/') ? '*' : '/*'),
                paths: [absolutePath + (alias.endsWith('/') ? '*' : '/*')]
            });
        }
        
        if (mappings.length > 0) {
            logDebug(`Found ${mappings.length} aliases using global path.resolve search`);
            return mappings;
        }
        
        // Pattern 3: Look specifically for common Yeap/monorepo patterns
        // Search for @app, @core, @library patterns directly
        const knownAliases = ['@app', '@core', '@library', '@shared', '@common'];
        for (const alias of knownAliases) {
            // Look for patterns like '@app': path.resolve(...) anywhere in file
            const aliasRegex = new RegExp(`['"]${alias.replace('@', '\\@')}['"]\\s*:\\s*(?:path\\.resolve\\s*\\([^)]+\\)|['"]([^'"]+)['"])`, 'g');
            const aliasMatch = configContent.match(aliasRegex);
            
            if (aliasMatch) {
                // Try to extract the path
                const pathMatch = aliasMatch[0].match(/path\.resolve\s*\([^,)]+(?:,\s*['"]([^'"]+)['"]\s*)?\)/);
                if (pathMatch && pathMatch[1]) {
                    const configUri = Uri.file(configPath);
                    const configDir = Uri.joinPath(configUri, '..');
                    const absolutePath = Uri.joinPath(configDir, pathMatch[1]).fsPath;
                    
                    mappings.push({
                        pattern: alias + '/*',
                        paths: [absolutePath + '/*']
                    });
                } else {
                    // Fallback: assume src/@app structure
                    const configUri = Uri.file(configPath);
                    const configDir = Uri.joinPath(configUri, '..');
                    const guessedPath = Uri.joinPath(configDir, 'src', alias).fsPath;
                    
                    mappings.push({
                        pattern: alias + '/*',
                        paths: [guessedPath + '/*']
                    });
                }
            }
        }
        
        if (mappings.length > 0) {
            logDebug(`Found ${mappings.length} known aliases`);
            return mappings;
        }
        
        // Try multiple patterns to extract resolve.alias
        // Pattern 4: resolve: { alias: { ... } }
        let aliasRegex = /resolve\s*:\s*\{[^}]*alias\s*:\s*(\{[^}]+\})/s;
        let match = configContent.match(aliasRegex);
        
        // Pattern 2: alias: { ... } at root level (common in some configs)
        if (!match) {
            aliasRegex = /alias\s*:\s*(\{[^}]+\})/s;
            match = configContent.match(aliasRegex);
        }
        
        // Pattern 3: Look for common alias patterns with path.resolve
        if (!match) {
            // Look for patterns like '@app': path.resolve(__dirname, './src/@app')
            const pathResolveRegex = /['"]?([@\w/-]+)['"]\s*:\s*path\.resolve\s*\([^)]+['"](\.?\/[^'"]+)['"]\s*\)/g;
            let pathMatch;
            while ((pathMatch = pathResolveRegex.exec(configContent)) !== null) {
                const [, alias, relativePath] = pathMatch;
                const configUri = Uri.file(configPath);
                const configDir = Uri.joinPath(configUri, '..');
                const absolutePath = Uri.joinPath(configDir, relativePath).fsPath;
                
                mappings.push({
                    pattern: alias + (alias.endsWith('/') ? '*' : '/*'),
                    paths: [absolutePath + (alias.endsWith('/') ? '*' : '/*')]
                });
            }
            
            if (mappings.length > 0) {
                logDebug(`Found ${mappings.length} aliases using path.resolve pattern`);
                return mappings;
            }
        }
        
        if (!match) {
            logDebug('No alias configuration found in Vite config');
            return mappings;
        }
        
        // Extract individual aliases
        const aliasContent = match[1];
        logDebug('Extracted alias content:', aliasContent.substring(0, 200) + '...');
        
        // Handle object notation: { '@': '/src', '@components': '/src/components' }
        const objectAliasRegex = /['"]?([@\w/-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
        let aliasMatch;
        
        while ((aliasMatch = objectAliasRegex.exec(aliasContent)) !== null) {
            const [, alias, targetPath] = aliasMatch;
            const configUri = Uri.file(configPath);
            const configDir = Uri.joinPath(configUri, '..');
            const absolutePath = Uri.joinPath(configDir, targetPath).fsPath;
            
            mappings.push({
                pattern: alias + (alias.endsWith('/') ? '*' : '/*'),
                paths: [absolutePath + (alias.endsWith('/') ? '*' : '/*')]
            });
        }
        
        logDebug(`Found ${mappings.length} aliases in Vite config`);
        
        // Handle array notation: [{ find: '@', replacement: '/src' }]
        const arrayAliasRegex = /find\s*:\s*['"]([^'"]+)['"]\s*,\s*replacement\s*:\s*['"]([^'"]+)['"]/g;
        
        while ((aliasMatch = arrayAliasRegex.exec(aliasContent)) !== null) {
            const [, find, replacement] = aliasMatch;
            const configUri = Uri.file(configPath);
            const configDir = Uri.joinPath(configUri, '..');
            const absolutePath = Uri.joinPath(configDir, replacement).fsPath;
            
            mappings.push({
                pattern: find + (find.endsWith('/') ? '*' : '/*'),
                paths: [absolutePath + (find.endsWith('/') ? '*' : '/*')]
            });
        }
        
        return mappings;
    }
};

/**
 * Webpack config loader
 */
export const webpackConfigLoader: ConfigLoader = {
    name: 'webpack',
    configFileNames: ['webpack.config.js', 'webpack.config.ts'],
    
    extractAliases(configPath: string, configContent: string): PathMapping[] {
        const mappings: PathMapping[] = [];
        
        // Extract resolve.alias from webpack config
        const aliasRegex = /resolve\s*:\s*{[^}]*alias\s*:\s*{([^}]+)}/s;
        const match = configContent.match(aliasRegex);
        
        if (!match) {return mappings;}
        
        const aliasContent = match[1];
        const aliasEntryRegex = /['"]?([@\w/-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
        let aliasMatch;
        
        while ((aliasMatch = aliasEntryRegex.exec(aliasContent)) !== null) {
            const [, alias, targetPath] = aliasMatch;
            const configUri = Uri.file(configPath);
            const configDir = Uri.joinPath(configUri, '..');
            const absolutePath = Uri.joinPath(configDir, targetPath).fsPath;
            
            mappings.push({
                pattern: alias + (alias.endsWith('$') ? '' : '/*'),
                paths: [absolutePath + (alias.endsWith('$') ? '' : '/*')]
            });
        }
        
        return mappings;
    }
};

/**
 * Unified config loader that tries multiple config systems
 */
export class UnifiedConfigLoader {
    private loaders: ConfigLoader[] = [
        tsConfigLoader,
        viteConfigLoader,
        webpackConfigLoader
    ];
    
    /**
     * Find and load aliases from any supported config file
     */
    async loadAliases(document: TextDocument): Promise<{
        mappings: PathMapping[];
        configType: string;
        configPath: string;
    } | null> {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {return null;}
        
        // Search for config files
        let currentUri = Uri.joinPath(document.uri, '..');
        const rootUri = workspaceFolder.uri;
        
        while (currentUri.fsPath.startsWith(rootUri.fsPath)) {
            for (const loader of this.loaders) {
                for (const configFileName of loader.configFileNames) {
                    const configUri = Uri.joinPath(currentUri, configFileName);
                    
                    try {
                        const contentBytes = await workspace.fs.readFile(configUri);
                        const content = Buffer.from(contentBytes).toString('utf-8');
                        
                        let mappings: PathMapping[];
                        
                        if (configFileName.endsWith('.json')) {
                            // Parse JSON config - remove comments and trailing commas
                            let jsonContent = content
                                .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
                                .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
                            
                            try {
                                const config = JSON.parse(jsonContent);
                                mappings = loader.extractAliases(configUri.fsPath, config);
                            } catch (parseError) {
                                // If parsing still fails, try more aggressive cleanup
                                jsonContent = jsonContent
                                    .split('\n')
                                    .map(line => line.trim())
                                    .filter(line => line && !line.startsWith('//'))
                                    .join('\n')
                                    .replace(/,(\s*[}\]])/g, '$1');
                                
                                try {
                                    const config = JSON.parse(jsonContent);
                                    mappings = loader.extractAliases(configUri.fsPath, config);
                                } catch {
                                    // Give up, config is too malformed
                                    throw parseError;
                                }
                            }
                        } else {
                            // For JS/TS configs, extract aliases from source
                            mappings = loader.extractAliases(configUri.fsPath, content);
                        }
                        
                        if (mappings.length > 0) {
                            logDebug(`Found ${loader.name} config at: ${configUri.fsPath}`);
                            return {
                                mappings,
                                configType: loader.name,
                                configPath: configUri.fsPath
                            };
                        }
                    } catch (error) {
                        // File doesn't exist or parse error, continue searching
                        if (error instanceof Error && 
                            !error.message.includes('EntryNotFound') && 
                            !error.message.includes('ENOENT')) {
                            logDebug(`Error parsing ${configUri.fsPath}:`, error.message);
                        }
                    }
                }
            }
            
            const parentUri = Uri.joinPath(currentUri, '..');
            if (parentUri.fsPath === currentUri.fsPath) {break;}
            currentUri = parentUri;
        }
        
        return null;
    }
    
    /**
     * Add support for a custom config loader
     */
    addLoader(loader: ConfigLoader): void {
        this.loaders.push(loader);
    }
}