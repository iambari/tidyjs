import { parse } from "@typescript-eslint/parser";
import { TSESTree } from "@typescript-eslint/types";

import { Config as ExtensionGlobalConfig } from "./types";

export type ConfigImportGroup = {
  name: string;
  order: number;
  priority?: number;
} & (
  | {
      isDefault: true;
      match?: RegExp;
    }
  | {
      isDefault?: false;
      match: RegExp;
    }
);

export type ImportType = "default" | "named" | "typeDefault" | "typeNamed" | "sideEffect";
export type ImportSource = string;
export type ImportSpecifier = string;

export type TypeOrder = Record<ImportType, number>;

export interface FormattingOptions {
  quoteStyle?: "single" | "double";
  semicolons?: boolean;
  multilineIndentation?: number | "tab";
}

interface InternalProcessedConfig {
  importGroups: ConfigImportGroup[];
  typeOrder: TypeOrder;
  formatting: FormattingOptions;
}

const DEFAULT_PARSER_SETTINGS: InternalProcessedConfig = {
  formatting: {
    quoteStyle: "single",
    semicolons: true,
    multilineIndentation: 2,
  },
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4,
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
  private sourceCode = "";
  private invalidImports: InvalidImport[] = [];

  constructor(extensionConfig: ExtensionGlobalConfig) {
    const importGroups: ConfigImportGroup[] = extensionConfig.groups.map((g): ConfigImportGroup => {
      if (g.isDefault) {
        return {
          name: g.name,
          order: g.order,
          isDefault: true,
          match: g.match,
          priority: g.priority,
        };
      } else if (g.match) {
        return {
          name: g.name,
          order: g.order,
          isDefault: false,
          match: g.match,
          priority: g.priority,
        };
      } else {
        return {
          name: g.name,
          order: g.order,
          isDefault: true,
          priority: g.priority,
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
      formatting.quoteStyle = extensionConfig.format.singleQuote ? "single" : "double";
    }
    if (extensionConfig.format?.indent !== undefined) {
      formatting.multilineIndentation = extensionConfig.format.indent;
    }

    this.internalConfig = {
      importGroups,
      typeOrder,
      formatting,
    };
    this.sourceCode = "";
  }

  public parse(sourceCode: string): ParserResult {
    this.sourceCode = sourceCode;
    this.invalidImports = [];

    try {
      this.ast = parse(sourceCode, {
        ecmaVersion: 2020,
        sourceType: "module",
        jsx: true,
        errorOnUnknownASTType: false,
        errorOnTypeScriptSyntacticAndSemanticIssues: false,
      });

      const imports = this.extractImports();
      const groups = this.organizeImportsIntoGroups(imports);
      const importRange = this.calculateImportRange();

      return {
        groups,
        originalImports: imports.map((imp) => imp.raw),
        invalidImports: this.invalidImports.length > 0 ? this.invalidImports : undefined,
        importRange,
      };
    } catch (error) {
      this.invalidImports.push({
        raw: sourceCode,
        error: error instanceof Error ? `Syntax error during parsing: ${error.message}` : "Unknown parsing error",
      });

      return {
        groups: [],
        originalImports: [],
        invalidImports: this.invalidImports,
      };
    }
  }

  private extractImports(): ParsedImport[] {
    const imports: ParsedImport[] = [];
    const program = this.ast;

    if (!program || !program.body) {
      return imports;
    }

    for (const node of program.body) {
      if (node.type === "ImportDeclaration") {
        try {
          const importNode = node as TSESTree.ImportDeclaration;
          const source = importNode.source.value as string;

          let type: ImportType = "named";
          const specifiers: string[] = [];
          let defaultImport: string | undefined;
          let hasDefault = false;
          let hasNamed = false;
          let hasNamespace = false;

          if (importNode.specifiers.length === 0) {
            // Check if this is an empty named import like import {} from "module"
            const raw = this.sourceCode.substring(importNode.range?.[0] || 0, importNode.range?.[1] || 0);
            if (raw.includes('{}')) {
              type = "named";
            } else {
              type = "sideEffect";
            }
          } else {
            for (const specifierNode of importNode.specifiers) {
              if (specifierNode.type === "ImportDefaultSpecifier") {
                hasDefault = true;
                defaultImport = specifierNode.local.name;
              } else if (specifierNode.type === "ImportSpecifier") {
                hasNamed = true;
                const importedName = specifierNode.imported ? (specifierNode.imported as TSESTree.Identifier).name : specifierNode.local.name;
                specifiers.push(importedName);
              } else if (specifierNode.type === "ImportNamespaceSpecifier") {
                hasNamespace = true;
                specifiers.push(`* as ${specifierNode.local.name}`);
              }
            }

            if (hasDefault && (hasNamed || hasNamespace)) {
              // Split mixed imports into separate default and named imports
              const { groupName, isPriority } = this.determineGroup(source);
              const raw = this.sourceCode.substring(importNode.range?.[0] || 0, importNode.range?.[1] || 0);
              
              // Create default import
              imports.push({
                type: "default",
                source,
                specifiers: [defaultImport!],
                defaultImport,
                raw,
                groupName,
                isPriority,
                sourceIndex: imports.length,
              });
              
              // Create named/namespace import
              if (hasNamed) {
                imports.push({
                  type: "named",
                  source,
                  specifiers,
                  defaultImport: undefined,
                  raw,
                  groupName,
                  isPriority,
                  sourceIndex: imports.length,
                });
              }
              
              if (hasNamespace) {
                imports.push({
                  type: "default", // namespace imports are treated as default
                  source,
                  specifiers,
                  defaultImport: undefined,
                  raw,
                  groupName,
                  isPriority,
                  sourceIndex: imports.length,
                });
              }
              
              continue; // Skip the normal processing below
            } else if (hasDefault) {
              type = "default";
              if (defaultImport) {
                specifiers.push(defaultImport);
              }
            } else if (hasNamespace) {
              type = "default";
            } else if (hasNamed) {
              type = "named";
            }
          }

          const { groupName, isPriority } = this.determineGroup(source);
          const raw = this.sourceCode.substring(importNode.range?.[0] || 0, importNode.range?.[1] || 0);

          imports.push({
            type,
            source,
            specifiers,
            defaultImport,
            raw,
            groupName,
            isPriority,
            sourceIndex: imports.length,
          });
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

  private determineGroup(source: string): { groupName: string | null; isPriority: boolean } {
    for (const group of this.internalConfig.importGroups) {
      const isPriority = !!group.priority;

      if (group.isDefault !== true && group.match && group.match.test(source)) {
        return {
          groupName: group.name,
          isPriority: isPriority,
        };
      }
    }

    let defaultGroup: { groupName: string; isPriority: boolean } | null = null;
    for (const group of this.internalConfig.importGroups) {
      if (group.isDefault === true) {
        defaultGroup = {
          groupName: group.name,
          isPriority: !!group.priority,
        };

        if (group.match && group.match.test(source)) {
          return defaultGroup;
        }
      }
    }

    return defaultGroup || { groupName: null, isPriority: false };
  }

  private consolidateImportsBySource(imports: ParsedImport[]): ParsedImport[] {
    const importsBySource = new Map<string, { 
      default?: ParsedImport; 
      named?: ParsedImport; 
      namespace?: ParsedImport;
      sideEffect?: ParsedImport;
      typeDefault?: ParsedImport;
      typeNamed?: ParsedImport;
    }>();
    
    // Group imports by source
    for (const imp of imports) {
      const sourceImports = importsBySource.get(imp.source) || {};
      
      if (imp.type === 'default' && imp.defaultImport) {
        sourceImports.default = imp;
      } else if (imp.type === 'named') {
        if (sourceImports.named) {
          // Merge specifiers for named imports from same source
          const existingSpecifiers = new Set(sourceImports.named.specifiers);
          imp.specifiers.forEach(spec => existingSpecifiers.add(spec));
          sourceImports.named.specifiers = Array.from(existingSpecifiers).sort();
        } else {
          sourceImports.named = imp;
        }
      } else if (imp.type === 'typeNamed') {
        if (sourceImports.typeNamed) {
          // Merge specifiers for type named imports from same source
          const existingSpecifiers = new Set(sourceImports.typeNamed.specifiers);
          imp.specifiers.forEach(spec => existingSpecifiers.add(spec));
          sourceImports.typeNamed.specifiers = Array.from(existingSpecifiers).sort();
        } else {
          sourceImports.typeNamed = imp;
        }
      } else if (imp.type === 'default' && imp.specifiers.some(s => s.startsWith('* as'))) {
        sourceImports.namespace = imp;
      } else if (imp.type === 'sideEffect') {
        sourceImports.sideEffect = imp;
      } else if (imp.type === 'typeDefault') {
        sourceImports.typeDefault = imp;
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
      if (sourceImports.namespace && !sourceImports.default) {
        consolidated.push(sourceImports.namespace);
      }
      if (sourceImports.typeDefault) {
        consolidated.push(sourceImports.typeDefault);
      }
      if (sourceImports.typeNamed) {
        consolidated.push(sourceImports.typeNamed);
      }
    }
    
    return consolidated;
  }

  private organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
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
      if (configGroup.isDefault === true) {
        configuredDefaultGroupName = configGroup.name;
      }
    }

    const UNCONFIGURED_DEFAULT_FALLBACK_NAME = "Misc";
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
          // Sort alphabetically by source within same type
          return a.source.localeCompare(b.source);
        });
      }
    }

    return Array.from(groupMap.values())
      .filter((group) => group.imports.length > 0)
      .sort((a, b) => a.order - b.order);
  }

  private calculateImportRange(): { start: number; end: number } | undefined {
    const program = this.ast;
    
    if (!program || !program.body) {
      return undefined;
    }

    let firstImportStart: number | undefined;
    let lastImportEnd: number | undefined;

    for (const node of program.body) {
      if (node.type === "ImportDeclaration" && node.range) {
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

    let startLineIndex = importLineIndex;
    let inMultilineComment = false;
    
    // Check if we're in the middle of a multiline comment at the import line
    for (let i = 0; i < importLineIndex; i++) {
      const line = lines[i];
      if (line.includes('/*') && !line.includes('*/')) {
        inMultilineComment = true;
      } else if (line.includes('*/')) {
        inMultilineComment = false;
      }
    }
    
    // Walk backwards to include all comments and empty lines
    for (let i = importLineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      if (line.includes('*/')) {
        inMultilineComment = true;
        startLineIndex = i;
      } else if (line.includes('/*')) {
        inMultilineComment = false;
        startLineIndex = i;
      } else if (inMultilineComment) {
        startLineIndex = i;
      } else if (line === '' || line.startsWith('//')) {
        startLineIndex = i;
      } else {
        // Stop if we hit non-comment, non-empty content
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
}

// Helper function for backwards compatibility
export function parseImports(sourceCode: string, config: ExtensionGlobalConfig): ParserResult {
  const parser = new ImportParser(config);
  return parser.parse(sourceCode);
}
