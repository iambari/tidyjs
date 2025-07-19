import { Uri } from 'vscode';
import { PathMapping } from './path-resolver';
import { logDebug } from './log';

/**
 * Smart Vite alias detector that handles complex patterns
 */
export function detectViteAliases(configPath: string, configContent: string): PathMapping[] {
    const mappings: PathMapping[] = [];
    
    // Strategy 1: Find where resolvedAliases is used (in alias: { ...resolvedAliases })
    const spreadPattern = /alias\s*:\s*\{[^}]*\.\.\.resolvedAliases[^}]*\}/s;
    const spreadMatch = configContent.match(spreadPattern);
    
    if (spreadMatch) {
        logDebug('Found ...resolvedAliases pattern, searching for its definition');
        
        // Now find where resolvedAliases is defined
        // It could be a variable, function return, or imported
        const patterns = [
            // const resolvedAliases = { ... }
            /const\s+resolvedAliases\s*=\s*(\{[\s\S]*?\n\})/m,
            // function getResolveAliases() { return { ... } }
            /function\s+(?:getResolveAliases|resolvedAliases)[^{]*\{[\s\S]*?return\s+(\{[\s\S]*?\n\s*\})/m,
            // Direct object with aliases
            /resolvedAliases\s*=\s*(\{[\s\S]*?\n\})/m
        ];
        
        for (const pattern of patterns) {
            const match = configContent.match(pattern);
            if (match && match[1]) {
                const aliasBlock = match[1];
                logDebug('Found alias block:', aliasBlock.substring(0, 300) + '...');
                
                // Extract each alias
                const aliasPattern = /['"]?([@\w\-/]+)['"]?\s*:\s*path\.resolve\s*\([^,)]+(?:,\s*['"]([^'"]+)['"]\s*)?\)/g;
                let aliasMatch;
                
                while ((aliasMatch = aliasPattern.exec(aliasBlock)) !== null) {
                    const [, alias, relativePath] = aliasMatch;
                    
                    // Skip non-alias entries
                    if (!alias.startsWith('@') && !alias.includes('/')) {
                        continue;
                    }
                    
                    const configUri = Uri.file(configPath);
                    const configDir = Uri.joinPath(configUri, '..');
                    
                    // Handle different path.resolve patterns
                    let resolvedPath = relativePath;
                    if (!resolvedPath) {
                        // Try to guess based on alias name
                        resolvedPath = 'src/' + alias;
                    }
                    
                    const absolutePath = Uri.joinPath(configDir, resolvedPath).fsPath;
                    
                    mappings.push({
                        pattern: alias + '/*',
                        paths: [absolutePath + '/*']
                    });
                    
                    logDebug(`Added alias: ${alias} -> ${resolvedPath}`);
                }
                
                if (mappings.length > 0) {
                    break;
                }
            }
        }
    }
    
    // Strategy 2: If no aliases found, look for them directly in the resolve.alias block
    if (mappings.length === 0) {
        // Find the alias block even with ...resolvedAliases
        const aliasBlockPattern = /alias\s*:\s*\{([^}]+)\}/s;
        const blockMatch = configContent.match(aliasBlockPattern);
        
        if (blockMatch) {
            const block = blockMatch[1];
            
            // Look for inline aliases that aren't from resolvedAliases
            const inlineAliasPattern = /['"]?([@\w\-/]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
            let match;
            
            while ((match = inlineAliasPattern.exec(block)) !== null) {
                const [, alias, path] = match;
                
                // Skip entries that look like package names
                if (!alias.startsWith('@') || path.includes('node_modules') || !path.includes('/')) {
                    continue;
                }
                
                const configUri = Uri.file(configPath);
                const configDir = Uri.joinPath(configUri, '..');
                const absolutePath = Uri.joinPath(configDir, path).fsPath;
                
                mappings.push({
                    pattern: alias + '/*',
                    paths: [absolutePath + '/*']
                });
            }
        }
    }
    
    // Strategy 3: Fallback - look for common patterns anywhere in file
    if (mappings.length === 0) {
        const commonAliases = ['@app', '@core', '@library', '@shared'];
        
        for (const alias of commonAliases) {
            // Search for the alias being defined anywhere
            const searchPattern = new RegExp(`['"]${alias}['"]\\s*:`, 'g');
            if (searchPattern.test(configContent)) {
                // Found it, assume standard structure
                const configUri = Uri.file(configPath);
                const configDir = Uri.joinPath(configUri, '..');
                const guessedPath = Uri.joinPath(configDir, 'src', alias).fsPath;
                
                mappings.push({
                    pattern: alias + '/*',
                    paths: [guessedPath + '/*']
                });
                
                logDebug(`Guessed alias path: ${alias} -> src/${alias}`);
            }
        }
    }
    
    return mappings;
}