
export interface ImportGroup {
    name: string;
    regex: RegExp;
    order: number;
    isDefault?: boolean;
}

export type ImportType = 'default' | 'named' | 'typeDefault' | 'typeNamed' | 'sideEffect';
export type ImportSource = string;
export type ImportSpecifier = string;

export type TypeOrder = {
    [key in ImportType]: number;
};

export type SourcePatterns = {
    appSubfolderPattern?: RegExp;
};

export interface FormatterConfig {
    importGroups: ImportGroup[];
    formatOnSave: boolean;
    maxLineLength: number;
    defaultGroupName?: string;
    typeOrder?: TypeOrder;
    priorityImports?: RegExp[];
    regexPatterns: {
        sectionComment: RegExp;
        appSubfolderPattern: RegExp;
    };
}

export interface ParserConfig {
    importGroups: ImportGroup[];
    defaultGroupName?: string;
    typeOrder?: TypeOrder;
    patterns?: SourcePatterns;
    priorityImports?: RegExp[];
}


export interface FormattedImportGroup {
    groupName: string;
    commentLine: string;
    importLines: string[];
}


export interface ParsedImport {
    type: ImportType;
    source: ImportSource;
    specifiers: ImportSpecifier[];
    raw: string;
    groupName: string | null;
    isPriority: boolean;
    appSubfolder: string | null;
}


export interface InvalidImport {
    raw?: string;
    error: string;
    line?: number;
    column?: number;
}

export interface ParserResult {
    groups: ImportGroup[];
    originalImports: string[];
    appSubfolders: string[];
    invalidImports?: InvalidImport[];
}
