export interface Config {
  debug?: boolean;

  groups: {
    name: string;
    order: number;
    isDefault?: boolean;
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

export interface FormattedImportGroup {
  groupName: string;
  commentLine: string;
  importLines: string[];
}
