import { workspace, Uri, TextDocument } from 'vscode';
import { UnifiedConfigLoader } from './config-loaders';
import { logDebug } from './log';

export interface PathMapping {
    pattern: string;
    paths: string[];
}

export interface TsConfig {
    compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
    };
}

export interface PathResolverConfig {
    mode: 'relative' | 'absolute';
    preferredAliases?: string[];
}

export class PathResolver {
    private configCache = new Map<string, { mappings: PathMapping[]; configType: string }>();
    private unifiedLoader = new UnifiedConfigLoader();

    constructor(private config: PathResolverConfig) {}

    /**
     * Load path mappings from any supported config file
     */
    private async loadPathMappings(document: TextDocument): Promise<PathMapping[]> {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {return [];}

        const cacheKey = workspaceFolder.uri.toString();
        if (this.configCache.has(cacheKey)) {
            return this.configCache.get(cacheKey)!.mappings;
        }

        const result = await this.unifiedLoader.loadAliases(document);
        if (result) {
            this.configCache.set(cacheKey, {
                mappings: result.mappings,
                configType: result.configType
            });
            
            // Sort by specificity (more specific patterns first)
            result.mappings.sort((a, b) => {
                const aSpecificity = a.pattern.split('*').length - 1;
                const bSpecificity = b.pattern.split('*').length - 1;
                if (aSpecificity !== bSpecificity) {
                    return aSpecificity - bSpecificity;
                }
                return b.pattern.length - a.pattern.length;
            });
            
            logDebug(`Loaded ${result.mappings.length} path mappings from ${result.configType}: ${result.mappings.map(m => m.pattern).join(', ')}`);
            
            return result.mappings;
        }

        return [];
    }

    /**
     * Convert an import path based on the configured mode
     */
    public async convertImportPath(
        importPath: string,
        document: TextDocument
    ): Promise<string | null> {
        // Skip external modules
        if (!importPath.startsWith('.') && !importPath.startsWith('@') && !importPath.startsWith('~')) {
            return null;
        }

        const mappings = await this.loadPathMappings(document);
        if (mappings.length === 0) {
            logDebug(`No path mappings found for ${importPath}`);
            return null;
        }

        if (this.config.mode === 'absolute') {
            return this.convertToAbsolute(importPath, document, mappings);
        } else {
            return this.convertToRelative(importPath, document, mappings);
        }
    }

    /**
     * Convert relative or aliased path to absolute (with alias)
     */
    private convertToAbsolute(
        importPath: string,
        document: TextDocument,
        mappings: PathMapping[]
    ): string | null {
        // If it's already using an alias, keep it
        for (const mapping of mappings) {
            if (this.matchesPattern(importPath, mapping.pattern)) {
                return null; // Already absolute with alias
            }
        }

        // If it's a relative path, try to convert to alias
        if (importPath.startsWith('.')) {
            const documentDir = Uri.joinPath(document.uri, '..');
            const absoluteUri = Uri.joinPath(documentDir, importPath);
            const absolutePath = absoluteUri.fsPath;
            
            // Try to match against path mappings
            for (const mapping of mappings) {
                for (const mappedPath of mapping.paths) {
                    const mappedPattern = mappedPath.replace(/\*/g, '(.*)');
                    const regex = new RegExp(`^${mappedPattern}$`);
                    const match = absolutePath.match(regex);
                    
                    if (match) {
                        // Found a matching alias
                        const aliasPath = mapping.pattern.replace(/\*/g, match[1] || '');
                        return aliasPath;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Convert absolute (aliased) path to relative
     */
    private convertToRelative(
        importPath: string,
        document: TextDocument,
        mappings: PathMapping[]
    ): string | null {
        
        // Check if it's using an alias
        for (const mapping of mappings) {
            if (this.matchesPattern(importPath, mapping.pattern)) {
                logDebug(`Import ${importPath} matches pattern ${mapping.pattern}`);
                
                // Resolve the alias to an absolute path
                const resolvedPath = this.resolveAliasToPath(importPath, mapping);
                if (resolvedPath) {
                    // Convert to relative path
                    const documentDir = Uri.joinPath(document.uri, '..');
                    const resolvedUri = Uri.file(resolvedPath);
                    
                    // Calculate relative path
                    let relativePath = this.getRelativePath(documentDir, resolvedUri);
                    
                    // Ensure it starts with ./ or ../
                    if (!relativePath.startsWith('.')) {
                        relativePath = './' + relativePath;
                    }
                    
                    return relativePath;
                }
            }
        }

        return null;
    }

    /**
     * Check if an import path matches a pattern
     */
    private matchesPattern(importPath: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(importPath);
    }

    /**
     * Resolve an aliased import to an absolute file path
     */
    private resolveAliasToPath(importPath: string, mapping: PathMapping): string | null {
        const pattern = mapping.pattern;
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '(.*)');
        const regex = new RegExp(`^${regexPattern}$`);
        const match = importPath.match(regex);

        if (match && mapping.paths.length > 0) {
            // Use the first path mapping
            const resolvedPath = mapping.paths[0].replace(/\*/g, match[1] || '');
            
            
            // Remove file extensions for TypeScript/JavaScript imports
            // Import paths should not include .ts, .tsx, .js, .jsx extensions
            const pathWithoutExt = resolvedPath.replace(/\.(tsx?|jsx?)$/, '');
            
            return pathWithoutExt;
        }

        return null;
    }

    /**
     * Calculate relative path between two URIs
     */
    private getRelativePath(fromUri: Uri, toUri: Uri): string {
        const fromParts = fromUri.fsPath.split(/[/\\]/).filter(p => p.length > 0);
        const toParts = toUri.fsPath.split(/[/\\]/).filter(p => p.length > 0);
        
        // Find common base
        let commonLength = 0;
        for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
            if (fromParts[i] === toParts[i]) {
                commonLength++;
            } else {
                break;
            }
        }
        
        // Build relative path
        const upCount = fromParts.length - commonLength;
        const downPath = toParts.slice(commonLength);
        
        const parts: string[] = [];
        for (let i = 0; i < upCount; i++) {
            parts.push('..');
        }
        parts.push(...downPath);
        
        const result = parts.join('/') || '.';
        
        return result;
    }

    /**
     * Clear caches
     */
    public clearCache(): void {
        this.configCache.clear();
    }
    
    /**
     * Get information about the loaded config
     */
    public getConfigInfo(document: TextDocument): { type: string; path: string } | null {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {return null;}
        
        const cacheKey = workspaceFolder.uri.toString();
        const cached = this.configCache.get(cacheKey);
        
        if (cached) {
            return {
                type: cached.configType,
                path: 'cached'
            };
        }
        
        return null;
    }
}