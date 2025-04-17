export interface Config {
  groups: Array<{
    name: string;
    order: number;
    isDefault?: boolean;
    match: RegExp;
  }>;

  importOrder: {
    default: number;
    named: number;
    typeOnly: number;
    sideEffect: number;
  };

  format: {
    onSave: boolean;
    indent?: number;
    singleQuote?: boolean;
    bracketSpacing?: boolean;
  };

  patterns?: {
    appModules?: RegExp;
  };
}

export interface FormattedImportGroup {
  groupName: string;
  commentLine: string;
  importLines: string[];
}
