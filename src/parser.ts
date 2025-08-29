// Other
import { parse } from '@typescript-eslint/parser';
import { TSESTree } from '@typescript-eslint/types';

// Utils
import { GroupMatcher } from './utils/group-matcher';
import { logDebug } from './utils/log';

// Types
import { Config as ExtensionGlobalConfig } from './types';

export type ConfigImportGroup = {
    name: string;
    order: number;
    priority?: number;
    sortOrder?: 'alphabetic' | string[];
} & (
    | {
          default: true;
          match?: RegExp;
      }
    | {
          default?: false;
          match: RegExp;
      }
);

export enum ImportType {
    DEFAULT = 'default',
    NAMED = 'named',
    TYPE_DEFAULT = 'typeDefault',
    TYPE_NAMED = 'typeNamed',
    SIDE_EFFECT = 'sideEffect',
}
export type ImportSource = string;
export type ImportSpecifier = string | { imported: string; local: string };

export type TypeOrder = Record<ImportType, number>;

export interface FormattingOptions {
    quoteStyle?: 'single' | 'double';
    semicolons?: boolean;
    multilineIndentation?: number | 'tab';
}

interface InternalProcessedConfig {
    importGroups: ConfigImportGroup[];
    typeOrder: TypeOrder;
    formatting: FormattingOptions;
}

const DEFAULT_PARSER_SETTINGS: InternalProcessedConfig = {
    formatting: {
        quoteStyle: 'single',
        semicolons: true,
        multilineIndentation: 2,
    },
    typeOrder: {
        [ImportType.SIDE_EFFECT]: 0,
        [ImportType.DEFAULT]: 1,
        [ImportType.NAMED]: 2,
        [ImportType.TYPE_DEFAULT]: 3,
        [ImportType.TYPE_NAMED]: 4,
    },
    importGroups: [],
};

export interface ParsedImport {
    type: ImportType;
    source: ImportSource;
    specifiers: ImportSpecifier[];
    defaultImport?: string;
    raw: string;
    groupName: string | null;
    isPriority: boolean;
    sourceIndex: number;
    originalSource?: ImportSource; // Keep track of original source for grouping
}

export interface ImportGroup {
    name: string;
    order: number;
    imports: ParsedImport[];
}

export interface InvalidImport {
    raw: string;
    error: string;
}

export interface ParserResult {
    groups: ImportGroup[];
    originalImports: string[];
    invalidImports?: InvalidImport[];
    importRange?: { start: number; end: number };
}

export class ImportParser {
    private internalConfig: InternalProcessedConfig;
    private ast!: TSESTree.Program;
    private sourceCode = '';
    private invalidImports: InvalidImport[] = [];
    private groupMatcher: GroupMatcher;

    constructor(extensionConfig: ExtensionGlobalConfig) {
        // Initialize GroupMatcher with the groups configuration
        this.groupMatcher = new GroupMatcher(extensionConfig.groups);

        const importGroups: ConfigImportGroup[] = extensionConfig.groups.map((g): ConfigImportGroup => {
            if (g.default) {
                return {
                    name: g.name,
                    order: g.order,
                    default: true,
                    match: g.match,
                    priority: g.priority,
                    sortOrder: g.sortOrder,
                };
            } else if (g.match) {
                return {
                    name: g.name,
                    order: g.order,
                    default: false,
                    match: g.match,
                    priority: g.priority,
                    sortOrder: g.sortOrder,
                };
            } else {
                return {
                    name: g.name,
                    order: g.order,
                    default: true,
                    priority: g.priority,
                    sortOrder: g.sortOrder,
                };
            }
        });

        const typeOrder: TypeOrder = {
            ...DEFAULT_PARSER_SETTINGS.typeOrder,
            default: extensionConfig.importOrder?.default ?? DEFAULT_PARSER_SETTINGS.typeOrder.default,
            named: extensionConfig.importOrder?.named ?? DEFAULT_PARSER_SETTINGS.typeOrder.named,
            sideEffect: extensionConfig.importOrder?.sideEffect ?? DEFAULT_PARSER_SETTINGS.typeOrder.sideEffect,
        };

        if (extensionConfig.importOrder?.typeOnly !== undefined) {
            typeOrder.typeDefault = extensionConfig.importOrder.typeOnly;
            typeOrder.typeNamed = extensionConfig.importOrder.typeOnly;
        }

        const formatting: FormattingOptions = {
            ...DEFAULT_PARSER_SETTINGS.formatting,
        };
        if (extensionConfig.format?.singleQuote !== undefined) {
            formatting.quoteStyle = extensionConfig.format.singleQuote ? 'single' : 'double';
        }
        if (extensionConfig.format?.indent !== undefined) {
            formatting.multilineIndentation = extensionConfig.format.indent;
        }

        this.internalConfig = {
            importGroups,
            typeOrder,
            formatting,
        };
        this.sourceCode = '';
    }

    public parse(sourceCode: string, missingModules?: Set<string>, unusedImports?: string[], fileName?: string): ParserResult {
        this.sourceCode = sourceCode;
        this.invalidImports = [];

        logDebug('Parser.parse called with source length:', sourceCode.length, 'fileName:', fileName);

        // Determine if JSX should be enabled based on file extension
        const shouldEnableJSX = fileName ? /\.(jsx|tsx)$/.test(fileName) : true;
        logDebug('JSX enabled:', shouldEnableJSX);

        try {
            this.ast = parse(sourceCode, {
                ecmaVersion: 'latest',
                sourceType: 'module',
                jsx: shouldEnableJSX,
                errorOnUnknownASTType: false,
                errorOnTypeScriptSyntacticAndSemanticIssues: false,
                loc: true,
                range: true,
            });

            // Extract all imports first
            const allImports = this.extractAllImports();
            logDebug('Extracted imports:', allImports.length);

            // Apply filters to produce clean AST
            const filteredImports = this.applyFilters(allImports, missingModules, unusedImports);
            logDebug('Filtered imports:', filteredImports.length);

            // Organize the clean imports into groups
            const groups = this.organizeImportsIntoGroups(filteredImports);
            logDebug('Organized groups:', groups.length);

            // Calculate import range based on filtered imports
            const importRange = this.calculateFilteredImportRange(filteredImports);

            return {
                groups,
                originalImports: filteredImports.map((imp) => imp.raw),
                invalidImports: this.invalidImports.length > 0 ? this.invalidImports : undefined,
                importRange,
            };
        } catch (error) {
            logDebug('Parser error:', error);
            logDebug('Error details:', {
                message: error instanceof Error ? error.message : 'Unknown',
                stack: error instanceof Error ? error.stack : undefined,
                type: typeof error,
            });
            
            this.invalidImports.push({
                raw: sourceCode,
                error: error instanceof Error ? `Syntax error during parsing: ${error.message}` : 'Unknown parsing error',
            });

            return {
                groups: [],
                originalImports: [],
                invalidImports: this.invalidImports,
            };
        }
    }

    private extractAllImports(): ParsedImport[] {
        const imports: ParsedImport[] = [];
        const program = this.ast;

        if (!program || !program.body) {
            return imports;
        }

        for (const node of program.body) {
            if (node.type === 'ImportDeclaration') {
                try {
                    const importNode = node as TSESTree.ImportDeclaration;
                    const source = importNode.source.value as string;

                    // Extract raw text once for this import
                    const raw = this.sourceCode.substring(importNode.range?.[0] || 0, importNode.range?.[1] || 0);

                    // Check if this is a type-only import declaration using AST
                    const typeOnly = importNode.importKind === 'type';

                    if (importNode.specifiers.length === 0) {
                        // Side-effect import (no specifiers)
                        const { groupName, isPriority } = this.determineGroup(source);
                        imports.push({
                            type: ImportType.SIDE_EFFECT,
                            source,
                            specifiers: [],
                            defaultImport: undefined,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });

                        continue;
                    }

                    // Separate specifiers by type (value vs type) and by kind (default vs named vs namespace)
                    const valueSpecifiers: ImportSpecifier[] = [];
                    const typeSpecifiers: ImportSpecifier[] = [];
                    let defaultImport: string | undefined;
                    let typeDefaultImport: string | undefined;
                    let namespaceSpecifier: string | undefined;
                    let typeNamespaceSpecifier: string | undefined;

                    for (const specifierNode of importNode.specifiers) {
                        if (specifierNode.type === 'ImportDefaultSpecifier') {
                            const localName = specifierNode.local.name;

                            if (typeOnly) {
                                typeDefaultImport = localName;
                            } else {
                                defaultImport = localName;
                            }
                        } else if (specifierNode.type === 'ImportSpecifier') {
                            // Only ImportSpecifier has importKind property for individual type specifiers
                            const isTypeSpecifier = (specifierNode as TSESTree.ImportSpecifier).importKind === 'type' || typeOnly;
                            const importedName = specifierNode.imported
                                ? (specifierNode.imported as TSESTree.Identifier).name
                                : specifierNode.local.name;
                            const localName = specifierNode.local.name;

                            const specifier = importedName !== localName ? { imported: importedName, local: localName } : importedName;

                            if (isTypeSpecifier) {
                                typeSpecifiers.push(specifier);
                            } else {
                                valueSpecifiers.push(specifier);
                            }
                        } else if (specifierNode.type === 'ImportNamespaceSpecifier') {
                            const localName = specifierNode.local.name;

                            const namespaceSpec = `* as ${localName}`;
                            if (typeOnly) {
                                typeNamespaceSpecifier = namespaceSpec;
                            } else {
                                namespaceSpecifier = namespaceSpec;
                            }
                        }
                    }

                    const { groupName, isPriority } = this.determineGroup(source);

                    // Create separate imports for different types and kinds

                    // Regular default import
                    if (defaultImport) {
                        imports.push({
                            type: ImportType.DEFAULT,
                            source,
                            specifiers: [defaultImport],
                            defaultImport,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });
                    }

                    // Type default import
                    if (typeDefaultImport) {
                        imports.push({
                            type: ImportType.TYPE_DEFAULT,
                            source,
                            specifiers: [typeDefaultImport],
                            defaultImport: typeDefaultImport,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });
                    }

                    // Regular named imports
                    if (valueSpecifiers.length > 0) {
                        imports.push({
                            type: ImportType.NAMED,
                            source,
                            specifiers: valueSpecifiers,
                            defaultImport: undefined,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });
                    }

                    // Type named imports
                    if (typeSpecifiers.length > 0) {
                        imports.push({
                            type: ImportType.TYPE_NAMED,
                            source,
                            specifiers: typeSpecifiers,
                            defaultImport: undefined,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });
                    }

                    // Regular namespace import
                    if (namespaceSpecifier) {
                        imports.push({
                            type: ImportType.DEFAULT, // namespace imports are treated as default
                            source,
                            specifiers: [namespaceSpecifier],
                            defaultImport: undefined,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });
                    }

                    // Type namespace import
                    if (typeNamespaceSpecifier) {
                        imports.push({
                            type: ImportType.TYPE_DEFAULT, // type namespace imports are treated as type default
                            source,
                            specifiers: [typeNamespaceSpecifier],
                            defaultImport: undefined,
                            raw,
                            groupName,
                            isPriority,
                            sourceIndex: imports.length,
                        });
                    }
                } catch (error) {
                    const raw = this.sourceCode.substring(node.range?.[0] || 0, node.range?.[1] || 0);
                    this.invalidImports.push({
                        raw,
                        error: error instanceof Error ? error.message : "Erreur lors du parsing de l'import",
                    });
                }
            }
        }

        return imports;
    }

    private applyFilters(allImports: ParsedImport[], missingModules?: Set<string>, unusedImports?: string[]): ParsedImport[] {
        if (!missingModules && !unusedImports) {
            return allImports;
        }

        const filteredImports: ParsedImport[] = [];

        for (const importItem of allImports) {
            // Skip entire imports from missing modules
            if (missingModules?.has(importItem.source)) {
                continue;
            }

            // Filter individual specifiers based on unused imports
            if (unusedImports && unusedImports.length > 0) {
                const filteredSpecifiers: ImportSpecifier[] = [];
                let filteredDefaultImport: string | undefined;

                // Filter default import
                if (importItem.defaultImport && !unusedImports.includes(importItem.defaultImport)) {
                    filteredDefaultImport = importItem.defaultImport;
                }

                // Filter specifiers
                for (const specifier of importItem.specifiers) {
                    const localName = typeof specifier === 'string' ? specifier : specifier.local;

                    // For namespace imports (like * as Utils), check the namespace name
                    if (typeof specifier === 'string' && specifier.startsWith('* as ')) {
                        const namespaceName = specifier.substring(5); // Remove '* as '
                        if (!unusedImports.includes(namespaceName)) {
                            filteredSpecifiers.push(specifier);
                        }
                    } else if (!unusedImports.includes(localName)) {
                        filteredSpecifiers.push(specifier);
                    }
                }

                // Only keep import if it has remaining specifiers or default import
                if (filteredSpecifiers.length > 0 || filteredDefaultImport) {
                    filteredImports.push({
                        ...importItem,
                        specifiers: filteredSpecifiers,
                        defaultImport: filteredDefaultImport,
                    });
                }
            } else {
                // No unused imports filtering, keep the import as-is
                filteredImports.push(importItem);
            }
        }

        return filteredImports;
    }

    public determineGroup(source: string): { groupName: string | null; isPriority: boolean } {
        // Use cached GroupMatcher for O(1) lookups after first match
        const groupName = this.groupMatcher.getGroup(source);

        // Find the group to get its priority setting
        const group = this.internalConfig.importGroups.find((g) => g.name === groupName);
        const isPriority = group ? !!group.priority : false;

        return { groupName, isPriority };
    }

    private consolidateImportsBySource(imports: ParsedImport[]): ParsedImport[] {
        const importsBySource = new Map<
            string,
            {
                default?: ParsedImport;
                named?: ParsedImport;
                namespace?: ParsedImport;
                sideEffect?: ParsedImport;
                typeDefault?: ParsedImport;
                typeNamed?: ParsedImport;
                typeNamespace?: ParsedImport;
            }
        >();

        // Group imports by source
        for (const imp of imports) {
            const sourceImports = importsBySource.get(imp.source) || {};

            if (imp.type === ImportType.DEFAULT && imp.defaultImport) {
                sourceImports.default = imp;
            } else if (imp.type === ImportType.DEFAULT && imp.specifiers.some((s) => typeof s === 'string' && s.startsWith('* as'))) {
                sourceImports.namespace = imp;
            } else if (imp.type === ImportType.NAMED) {
                if (sourceImports.named) {
                    // Merge specifiers for named imports from same source
                    const specMap = new Map<string, ImportSpecifier>();

                    // Add existing specifiers
                    sourceImports.named.specifiers.forEach((spec) => {
                        if (typeof spec === 'string') {
                            specMap.set(spec, spec);
                        } else {
                            specMap.set(spec.local, spec);
                        }
                    });

                    // Add new specifiers
                    imp.specifiers.forEach((spec) => {
                        if (typeof spec === 'string') {
                            specMap.set(spec, spec);
                        } else {
                            specMap.set(spec.local, spec);
                        }
                    });

                    sourceImports.named.specifiers = Array.from(specMap.values()).sort((a, b) => {
                        const aStr = typeof a === 'string' ? a : a.local;
                        const bStr = typeof b === 'string' ? b : b.local;
                        return aStr.localeCompare(bStr);
                    });
                } else {
                    sourceImports.named = imp;
                }
            } else if (imp.type === ImportType.TYPE_NAMED) {
                if (sourceImports.typeNamed) {
                    // Merge specifiers for type named imports from same source
                    const specMap = new Map<string, ImportSpecifier>();

                    // Add existing specifiers
                    sourceImports.typeNamed.specifiers.forEach((spec) => {
                        if (typeof spec === 'string') {
                            specMap.set(spec, spec);
                        } else {
                            specMap.set(spec.local, spec);
                        }
                    });

                    // Add new specifiers
                    imp.specifiers.forEach((spec) => {
                        if (typeof spec === 'string') {
                            specMap.set(spec, spec);
                        } else {
                            specMap.set(spec.local, spec);
                        }
                    });

                    sourceImports.typeNamed.specifiers = Array.from(specMap.values()).sort((a, b) => {
                        const aStr = typeof a === 'string' ? a : a.local;
                        const bStr = typeof b === 'string' ? b : b.local;
                        return aStr.localeCompare(bStr);
                    });
                } else {
                    sourceImports.typeNamed = imp;
                }
            } else if (imp.type === ImportType.SIDE_EFFECT) {
                sourceImports.sideEffect = imp;
            } else if (imp.type === ImportType.TYPE_DEFAULT && imp.defaultImport) {
                sourceImports.typeDefault = imp;
            } else if (imp.type === ImportType.TYPE_DEFAULT && imp.specifiers.some((s) => typeof s === 'string' && s.startsWith('* as'))) {
                sourceImports.typeNamespace = imp;
            }

            importsBySource.set(imp.source, sourceImports);
        }

        // Convert back to array - keep separate import types
        const consolidated: ParsedImport[] = [];
        for (const [, sourceImports] of importsBySource) {
            if (sourceImports.sideEffect) {
                consolidated.push(sourceImports.sideEffect);
            }
            if (sourceImports.default) {
                consolidated.push(sourceImports.default);
            }
            if (sourceImports.named) {
                consolidated.push(sourceImports.named);
            }
            if (sourceImports.namespace) {
                consolidated.push(sourceImports.namespace);
            }
            if (sourceImports.typeDefault) {
                consolidated.push(sourceImports.typeDefault);
            }
            if (sourceImports.typeNamed) {
                consolidated.push(sourceImports.typeNamed);
            }
            if (sourceImports.typeNamespace) {
                consolidated.push(sourceImports.typeNamespace);
            }
        }

        return consolidated;
    }

    public organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
        // First consolidate imports from the same source
        const consolidatedImports = this.consolidateImportsBySource(imports);

        const groupMap = new Map<string, ImportGroup>();
        let configuredDefaultGroupName: string | null = null;

        for (const configGroup of this.internalConfig.importGroups) {
            groupMap.set(configGroup.name, {
                name: configGroup.name,
                order: configGroup.order,
                imports: [],
            });
            if (configGroup.default === true) {
                configuredDefaultGroupName = configGroup.name;
            }
        }

        const UNCONFIGURED_DEFAULT_FALLBACK_NAME = 'Other';
        let effectiveDefaultGroupName: string;

        if (configuredDefaultGroupName) {
            effectiveDefaultGroupName = configuredDefaultGroupName;
        } else {
            effectiveDefaultGroupName = UNCONFIGURED_DEFAULT_FALLBACK_NAME;

            if (!groupMap.has(effectiveDefaultGroupName)) {
                let fallbackDefaultOrder = 999;
                if (groupMap.size > 0) {
                    const maxOrder = Math.max(0, ...Array.from(groupMap.values(), (g) => g.order));
                    if (maxOrder >= fallbackDefaultOrder) {
                        fallbackDefaultOrder = maxOrder + 1;
                    }
                }
                groupMap.set(effectiveDefaultGroupName, {
                    name: effectiveDefaultGroupName,
                    order: fallbackDefaultOrder,
                    imports: [],
                });
            }
        }

        const defaultGroupForUncategorized = groupMap.get(effectiveDefaultGroupName)!;

        for (const imp of consolidatedImports) {
            let targetGroup: ImportGroup | undefined;

            if (imp.groupName && groupMap.has(imp.groupName)) {
                targetGroup = groupMap.get(imp.groupName);
            } else {
                targetGroup = defaultGroupForUncategorized;
            }

            if (targetGroup) {
                targetGroup.imports.push(imp);
            }
        }

        for (const group of groupMap.values()) {
            if (this.internalConfig.typeOrder) {
                group.imports.sort((a, b) => {
                    const typeOrderA = this.internalConfig.typeOrder[a.type] ?? Infinity;
                    const typeOrderB = this.internalConfig.typeOrder[b.type] ?? Infinity;

                    if (typeOrderA !== typeOrderB) {
                        return typeOrderA - typeOrderB;
                    }

                    // Apply custom sort order within same type
                    const groupConfig = this.internalConfig.importGroups.find((g) => g.name === group.name);
                    if (groupConfig?.sortOrder) {
                        return this.sortImportsByCustomOrder(a, b, groupConfig.sortOrder);
                    }

                    // Default: sort alphabetically by source within same type
                    return a.source.localeCompare(b.source);
                });
            }
        }

        return Array.from(groupMap.values())
            .filter((group) => group.imports.length > 0)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Sorts imports based on custom sort order configuration
     * Supports alphabetic sorting or custom array with wildcard patterns
     * @param a First import to compare
     * @param b Second import to compare
     * @param sortOrder Sort configuration ('alphabetic' or array of patterns)
     * @returns Comparison result for sorting
     */
    private sortImportsByCustomOrder(a: ParsedImport, b: ParsedImport, sortOrder: 'alphabetic' | string[]): number {
        if (sortOrder === 'alphabetic') {
            return a.source.localeCompare(b.source);
        }

        // Custom order with patterns
        const getPatternIndex = (source: string): number => {
            for (let i = 0; i < sortOrder.length; i++) {
                const pattern = sortOrder[i];
                if (this.matchesPattern(source, pattern)) {
                    return i;
                }
            }
            return Infinity; // Not found in custom order, will be sorted alphabetically at the end
        };

        const indexA = getPatternIndex(a.source);
        const indexB = getPatternIndex(b.source);

        if (indexA !== indexB) {
            return indexA - indexB;
        }

        // Same pattern index or both not found, sort alphabetically
        return a.source.localeCompare(b.source);
    }

    /**
     * Checks if a source matches a pattern with wildcard support
     * Supports patterns like "react", "react-*", "@scope/*"
     * @param source Import source to match
     * @param pattern Pattern to match against (supports * wildcard)
     * @returns True if source matches pattern
     */
    private matchesPattern(source: string, pattern: string): boolean {
        if (pattern === source) {
            return true;
        }

        // Handle wildcard patterns
        if (pattern.includes('*')) {
            // Convert pattern to regex: "react-*" becomes "^react-.*$"
            const regexPattern = pattern
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
                .replace(/\\?\*/g, '.*'); // Convert * to .*

            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(source);
        }

        return false;
    }

    private calculateImportRange(): { start: number; end: number } | undefined {
        const program = this.ast;

        if (!program || !program.body) {
            return undefined;
        }

        let firstImportStart: number | undefined;
        let lastImportEnd: number | undefined;

        for (const node of program.body) {
            if (node.type === 'ImportDeclaration' && node.range) {
                const [start, end] = node.range;

                if (firstImportStart === undefined || start < firstImportStart) {
                    firstImportStart = start;
                }

                if (lastImportEnd === undefined || end > lastImportEnd) {
                    lastImportEnd = end;
                }
            }
        }

        if (firstImportStart !== undefined && lastImportEnd !== undefined) {
            // Include preceding comments and empty lines
            const adjustedStart = this.findActualImportStart(firstImportStart);
            return { start: adjustedStart, end: lastImportEnd };
        }

        return undefined;
    }

    private findActualImportStart(firstImportStart: number): number {
        const lines = this.sourceCode.split('\n');
        let currentPos = 0;
        let importLineIndex = -1;

        // Find which line contains the first import
        for (let i = 0; i < lines.length; i++) {
            const lineEnd = currentPos + lines[i].length;
            if (currentPos <= firstImportStart && firstImportStart <= lineEnd) {
                importLineIndex = i;
                break;
            }
            currentPos = lineEnd + 1; // +1 for the newline character
        }

        if (importLineIndex === -1) {
            return firstImportStart;
        }

        // Don't include file header comments or documentation blocks
        // Only include import-related comments (like // React imports)
        let startLineIndex = importLineIndex;
        
        // Look backwards from the first import
        for (let i = importLineIndex - 1; i >= 0; i--) {
            const line = lines[i].trim();
            
            if (line === '') {
                // Empty line - could be separation or just spacing
                continue;
            } else if (line.startsWith('//')) {
                // Single-line comment - likely an import group comment
                startLineIndex = i;
            } else if (line.includes('*/')) {
                // End of a multiline comment
                // Don't include multiline comments - they're usually file headers
                break;
            } else {
                // Any other content - stop here
                break;
            }
        }

        // Calculate position from start of line
        let adjustedStart = 0;
        for (let i = 0; i < startLineIndex; i++) {
            adjustedStart += lines[i].length + 1; // +1 for newline
        }

        return adjustedStart;
    }

    private calculateFilteredImportRange(filteredImports: ParsedImport[]): { start: number; end: number } | undefined {
        if (filteredImports.length === 0) {
            // If no imports remain after filtering, we still need to return the original range
            // so the formatter can remove the entire import section
            return this.calculateImportRange();
        }

        // Use the original import range since we're replacing the entire section
        return this.calculateImportRange();
    }

    /**
     * Get the GroupMatcher instance for cache management
     */
    getGroupMatcher(): GroupMatcher {
        return this.groupMatcher;
    }

    /**
     * Dispose of the parser and clean up resources
     */
    dispose(): void {
        this.groupMatcher.dispose();
        this.sourceCode = '';
        this.invalidImports = [];
    }

}

export function parseImports(sourceCode: string, config: ExtensionGlobalConfig, fileName?: string): ParserResult {
    const parser = new ImportParser(config);
    return parser.parse(sourceCode, undefined, undefined, fileName);
}
