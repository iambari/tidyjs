// src/parser.ts
import { parse } from '@typescript-eslint/parser';
import { TSESTree } from '@typescript-eslint/types';

// Import the main configuration type from your project's types
import { Config as ExtensionGlobalConfig } from './types'; // Adjust path if necessary, e.g., './types' if types.ts is in the same dir as parser.ts is used

// --- Types defining the parser's internal, processed configuration structure ---
// These types describe what the parser's algorithms expect to work with.
// They are derived from or similar to your original ParserConfig types.

export type ConfigImportGroup = {
  name: string;
  order: number;
  priority?: number; // Keep if used, Miscwise consider removal if not in ExtensionGlobalConfig.groups
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

export type ImportType = 'default' | 'named' | 'typeDefault' | 'typeNamed' | 'sideEffect';
export type ImportSource = string;
export type ImportSpecifier = string;

export type TypeOrder = {
  [key in ImportType]: number;
};

export type FormattingOptions = {
  quoteStyle?: 'single' | 'double';
  semicolons?: boolean;
  multilineIndentation?: number | 'tab';
};

export type SourcePatterns = {
  subfolderPattern?: RegExp;
};

// This type represents the fully processed configuration used internally by the parser.
type InternalProcessedConfig = {
  importGroups: ConfigImportGroup[];
  typeOrder: TypeOrder;
  patterns: SourcePatterns;
  formatting: FormattingOptions;
};

// --- Parser's own default behaviors and settings ---
// This provides the baseline for the parser's operation.
const DEFAULT_PARSER_SETTINGS: InternalProcessedConfig = {
  formatting: {
    quoteStyle: 'single',
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
  patterns: {
    // subfolderPattern will be derived from ExtensionGlobalConfig
  },
  importGroups: [], // Default to an empty array; will be populated from ExtensionGlobalConfig
};

// --- Exported types for parser results (these remain unchanged) ---
export type ParsedImport = {
  type: ImportType;
  source: ImportSource;
  specifiers: ImportSpecifier[];
  raw: string;
  groupName: string | null;
  isPriority: boolean;
  appSubfolder: string | null;
};

export type ImportGroup = {
  name: string;
  order: number;
  imports: ParsedImport[];
};

export type InvalidImport = {
  raw: string;
  error: string;
};

export type ParserResult = {
  groups: ImportGroup[];
  originalImports: string[];
  subFolders: string[];
  invalidImports?: InvalidImport[];
};


// --- ImportParser Class ---
export class ImportParser {
  private internalConfig: InternalProcessedConfig;
  private ast!: TSESTree.Program;
  private sourceCode: string = '';
  private invalidImports: InvalidImport[] = [];

  constructor(extensionConfig: ExtensionGlobalConfig) {
    // 1. Transform and set importGroups
    const importGroups: ConfigImportGroup[] = extensionConfig.groups.map((g): ConfigImportGroup => {
      // The `priority` field is not in `ExtensionGlobalConfig.groups`.
      // If `priority` is essential, it should be added to `ExtensionGlobalConfig.groups`
      // or handled here (e.g., default to 0 or a specific value).
      // For now, it will be undefined.
      if (g.isDefault) {
        return {
          name: g.name,
          order: g.order,
          isDefault: true,
          match: g.match,
        };
      } else if (g.match) {
        return {
          name: g.name,
          order: g.order,
          isDefault: false,
          match: g.match,
        };
      } else {
        return {
          name: g.name,
          order: g.order,
          isDefault: true,
        };
      }
    });

    // 2. Transform and set typeOrder
    // ExtensionGlobalConfig.importOrder: { default, named, typeOnly, sideEffect }
    // Parser's TypeOrder: { default, named, typeDefault, typeNamed, sideEffect }
    const typeOrder: TypeOrder = {
      ...DEFAULT_PARSER_SETTINGS.typeOrder, // Start with parser's specific defaults
      default: extensionConfig.importOrder?.default ?? DEFAULT_PARSER_SETTINGS.typeOrder.default,
      named: extensionConfig.importOrder?.named ?? DEFAULT_PARSER_SETTINGS.typeOrder.named,
      sideEffect: extensionConfig.importOrder?.sideEffect ?? DEFAULT_PARSER_SETTINGS.typeOrder.sideEffect,
    };
    // If typeOnly is provided in extensionConfig, use it for both typeDefault and typeNamed
    if (extensionConfig.importOrder?.typeOnly !== undefined) {
      typeOrder.typeDefault = extensionConfig.importOrder.typeOnly;
      typeOrder.typeNamed = extensionConfig.importOrder.typeOnly;
    }

    // 3. Transform and set patterns
    const patterns: SourcePatterns = {
      ...DEFAULT_PARSER_SETTINGS.patterns,
      subfolderPattern: extensionConfig.patterns?.appModules,
    };

    // 4. Transform and set formatting options
    // ExtensionGlobalConfig.format: { onSave, indent, removeUnused, singleQuote, bracketSpacing }
    // Parser's FormattingOptions: { quoteStyle, semicolons, multilineIndentation }
    const formatting: FormattingOptions = {
      ...DEFAULT_PARSER_SETTINGS.formatting, // Start with parser's defaults
    };
    if (extensionConfig.format?.singleQuote !== undefined) {
      formatting.quoteStyle = extensionConfig.format.singleQuote ? 'single' : 'double';
    }
    if (extensionConfig.format?.indent !== undefined) {
      formatting.multilineIndentation = extensionConfig.format.indent;
    }
    // `semicolons` is part of parser's default formatting. If you want it configurable
    // via ExtensionGlobalConfig.format, you'd add a field there and map it here.
    // Similarly for `bracketSpacing` from ExtensionGlobalConfig.format if needed by parser.

    this.internalConfig = {
      importGroups,
      typeOrder,
      patterns,
      formatting,
    };
    this.sourceCode = ''; // Initialized
  }

  // All internal methods will now use `this.internalConfig` instead of `this.config`
  // For example:
  // private determineGroup(source: string): { groupName: string | null; isPriority: boolean } {
  //   for (const group of this.internalConfig.importGroups) {
  //     // ... logic using group.priority (if you decide to keep/map it)
  //   }
  // }
  //
  // private organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
  //   // ...
  //   if (this.internalConfig.typeOrder) { // check existence if it can be optional
  //     group.imports.sort((a, b) => {
  //       const typeOrderA = this.internalConfig.typeOrder[a.type] ?? Infinity; // or some Misc default
  //       const typeOrderB = this.internalConfig.typeOrder[b.type] ?? Infinity;
  //   // ...
  // }

  public parse(sourceCode: string): ParserResult {
    this.sourceCode = sourceCode;
    this.invalidImports = [];

    try {
      this.ast = parse(sourceCode, {
        ecmaVersion: 2020,
        sourceType: 'module',
      });

      const imports = this.extractImports();
      const groups = this.organizeImportsIntoGroups(imports);
      const subFolders = this.extractSubfolders(imports);

      return {
        groups,
        originalImports: imports.map((imp) => imp.raw),
        subFolders,
        invalidImports: this.invalidImports.length > 0 ? this.invalidImports : undefined,
      };
    } catch (error) {
      this.invalidImports.push({
        raw: sourceCode,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors du parsing',
      });

      return {
        groups: [],
        originalImports: [],
        subFolders: [],
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
      if (node.type === 'ImportDeclaration') {
        try {
          const importNode = node as TSESTree.ImportDeclaration;
          const source = importNode.source.value as string;
          
          let type: ImportType = 'named';
          const specifiers: string[] = [];
          
          if (importNode.specifiers.length === 0) {
            type = 'sideEffect';
          } else {
            for (const specifierNode of importNode.specifiers) { // Renamed to avoid conflict
              if (specifierNode.type === 'ImportDefaultSpecifier') {
                type = 'default';
                specifiers.push(specifierNode.local.name);
              } else if (specifierNode.type === 'ImportSpecifier') {
                type = 'named';
                const importedName = specifierNode.imported
                  ? (specifierNode.imported as TSESTree.Identifier).name
                  : specifierNode.local.name;
                specifiers.push(importedName);
              } else if (specifierNode.type === 'ImportNamespaceSpecifier') {
                type = 'default'; // Often treated as a default import for grouping
                specifiers.push(`* as ${specifierNode.local.name}`);
              }
            }
          }

          const { groupName, isPriority } = this.determineGroup(source);
          const appSubfolder = this.extractAppSubfolder(source);
          const raw = this.sourceCode.substring(importNode.range?.[0] || 0, importNode.range?.[1] || 0);

          imports.push({
            type,
            source,
            specifiers,
            raw,
            groupName,
            isPriority,
            appSubfolder,
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
    for (const group of this.internalConfig.importGroups) { // Use internalConfig
      const isPriority = !!group.priority; // Assuming priority is part of ConfigImportGroup now
      if (group.isDefault === true) {
        if (!group.match || group.match.test(source)) {
          return { 
            groupName: group.name, 
            isPriority: isPriority
          };
        }
      } else if (group.match.test(source)) {
        return { 
          groupName: group.name, 
          isPriority: isPriority
        };
      }
    }
    return { groupName: null, isPriority: false };
  }

  private extractAppSubfolder(source: string): string | null {
    const subfolderPattern = this.internalConfig.patterns?.subfolderPattern; // Use internalConfig
    if (!subfolderPattern) {
      return null;
    }
    const match = source.match(subfolderPattern);
    return (match && match[1]) ? match[1] : null;
  }

  private organizeImportsIntoGroups(imports: ParsedImport[]): ImportGroup[] {
    const groupMap = new Map<string, ImportGroup>();
    let configuredDefaultGroupName: string | null = null;

    // 1. Initialize all configured groups from internalConfig and identify any group marked as default.
    for (const configGroup of this.internalConfig.importGroups) {
        groupMap.set(configGroup.name, {
            name: configGroup.name,
            order: configGroup.order,
            imports: [],
        });
        if (configGroup.isDefault) {
            // if (configuredDefaultGroupName && configuredDefaultGroupName !== configGroup.name) {
                // console.warn(`Multiple import groups configured as default. Using "${configGroup.name}".`);
            // }
            configuredDefaultGroupName = configGroup.name;
        }
    }

    // 2. Determine the name of the group to use for uncategorized imports.
    const UNCONFIGURED_DEFAULT_FALLBACK_NAME = 'Default';
    let effectiveDefaultGroupName: string;

    if (configuredDefaultGroupName) {
        effectiveDefaultGroupName = configuredDefaultGroupName;
    } else {
        effectiveDefaultGroupName = UNCONFIGURED_DEFAULT_FALLBACK_NAME;
        if (!groupMap.has(effectiveDefaultGroupName)) {
            let fallbackDefaultOrder = 999;
            if (groupMap.size > 0) {
                const maxOrder = Math.max(0, ...Array.from(groupMap.values(), g => g.order));
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

    // 3. Assign imports to their respective groups.
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
        // else {
            // console.error(`Error: Could not assign import "${imp.raw}" to any group.`);
        // }
    }

    for (const group of groupMap.values()) {
      if (this.internalConfig.typeOrder) { // Use internalConfig
        group.imports.sort((a, b) => {
          const typeOrderA = this.internalConfig.typeOrder[a.type] ?? Infinity; 
          const typeOrderB = this.internalConfig.typeOrder[b.type] ?? Infinity;
          
          if (typeOrderA !== typeOrderB) {
            return typeOrderA - typeOrderB;
          }
          return a.source.localeCompare(b.source);
        });
      }
    }

    return Array.from(groupMap.values())
      .filter(group => group.imports.length > 0)
      .sort((a, b) => a.order - b.order);
  }

  private extractSubfolders(imports: ParsedImport[]): string[] {
    const subFolders = new Set<string>();
    for (const imp of imports) {
      if (imp.appSubfolder) {
        subFolders.add(imp.appSubfolder);
      }
    }
    return Array.from(subFolders).sort();
  }
}

// The exported function now expects ExtensionGlobalConfig
export function parseImports(
  sourceCode: string,
  config: ExtensionGlobalConfig // Changed
): ParserResult {
  const parser = new ImportParser(config);
  return parser.parse(sourceCode);
}

// The type `ParserConfig` that was previously exported might no longer be needed externally.
// If it was used elsewhere to define the shape of config for this parser, that usage
// will need to be updated to use `ExtensionGlobalConfig` or a relevant subset.