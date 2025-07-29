export interface Config {
  debug?: boolean;

  groups: {
    name: string;
    order: number;
    default?: boolean;
    match?: RegExp;
    priority?: number;
    sortOrder?: 'alphabetic' | string[];
  }[];

  importOrder: {
    default: number;
    named: number;
    typeOnly: number;
    sideEffect: number;
  };

  format?: {
    indent?: number;
    removeUnusedImports?: boolean;
    removeMissingModules?: boolean;
    singleQuote?: boolean;
    bracketSpacing?: boolean;
  };

  pathResolution?: {
    enabled?: boolean;
    mode?: 'relative' | 'absolute';
    preferredAliases?: string[];
  };

  excludedFolders?: string[];
}

export interface ImportGroupFile {
  name: string;
  order?: number;
  default?: boolean;
  // @deprecated Use 'default' instead
  isDefault?: boolean;
  match?: string;
  priority?: number;
  sortOrder?: 'alphabetic' | string[];
}

export interface TidyJSConfigFile {
  $schema?: string;
  extends?: string;
  groups?: ImportGroupFile[];
  importOrder?: {
    default?: number;
    named?: number;
    typeOnly?: number;
    sideEffect?: number;
  };
  format?: {
    indent?: number;
    removeUnusedImports?: boolean;
    removeMissingModules?: boolean;
    singleQuote?: boolean;
    bracketSpacing?: boolean;
  };
  pathResolution?: {
    enabled?: boolean;
    mode?: 'relative' | 'absolute';
    preferredAliases?: string[];
  };
  excludedFolders?: string[];
}

export interface ConfigSource {
  type: 'vscode' | 'file';
  path: string;
  config: Partial<Config>;
}

export interface FormattedImportGroup {
  groupName: string;
  commentLine: string;
  importLines: string[];
}
