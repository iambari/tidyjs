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
      });

      const imports = this.extractImports();
      const groups = this.organizeImportsIntoGroups(imports);

      return {
        groups,
        originalImports: imports.map((imp) => imp.raw),
        invalidImports: this.invalidImports.length > 0 ? this.invalidImports : undefined,
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

  private organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
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

    for (const imp of imports) {
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
          // Use source order as tie-breaker instead of alphabetical
          return a.sourceIndex - b.sourceIndex;
        });
      }
    }

    return Array.from(groupMap.values())
      .filter((group) => group.imports.length > 0)
      .sort((a, b) => a.order - b.order);
  }
}

