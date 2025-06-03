export interface Config {
  debug?: boolean;

  groups: {
    name: string;
    order: number;
    isDefault?: boolean;
    match?: RegExp;
    priority?: number;
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

  excludedFolders?: string[];
}

export interface FormattedImportGroup {
  groupName: string;
  commentLine: string;
  importLines: string[];
}
