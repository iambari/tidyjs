import { window } from 'vscode';

/**
 * Vérifie si une ligne est vide (ne contient que des espaces)
 */
export function isEmptyLine(line: string): boolean {
    return line.trim() === '';
}

/**
 * Vérifie si une ligne est un commentaire
 */
export function isCommentLine(line: string): boolean {
    return line.trim().startsWith('//');
}

/**
 * Vérifie si une ligne est un commentaire de section
 */
export function isSectionComment(line: string, config: any): boolean {
    return config.regexPatterns.sectionComment.test(line);
}

/**
 * Formatte un import simple (side-effect)
 */
export function formatSimpleImport(moduleName: string): string {
    return `import '${moduleName}';`;
}

/**
 * Aligne le mot-clé 'from' dans une ligne d'import
 */
export function alignFromKeyword(
    line: string,
    fromIndex: number,
    maxFromIndex: number,
    spacingConfig: number = 1
): string {
    if (fromIndex <= 0 || line.indexOf('from') === -1) {
        return line;
    }

    const beforeFrom = line.substring(0, fromIndex);
    const afterFrom = line.substring(fromIndex);
    const paddingSize = maxFromIndex - fromIndex + spacingConfig;
    const padding = ' '.repeat(paddingSize);

    return beforeFrom + padding + afterFrom;
}

/**
 * Trouve l'index du mot-clé 'from' dans une ligne d'import
 */
export function getFromIndex(line: string, isMultiline: boolean): number {
    if (isMultiline) {
        // Pour les imports multilignes, chercher 'from' sur la dernière ligne
        const lines = line.split('\n');
        const lastLine = lines[lines.length - 1];
        const fromIndex = lastLine.indexOf('from');
        if (fromIndex !== -1) {
            // Calculer l'index global en ajoutant la longueur des lignes précédentes
            return lines.slice(0, lines.length - 1).join('\n').length + fromIndex + 1;
        }
        return -1;
    }

    // Pour les imports simples, trouver directement l'index
    return line.indexOf('from');
}

/**
 * Trie les noms d'import par longueur (du plus court au plus long)
 */
export function sortImportNamesByLength(
    namedImports: (string | { name: string; comment?: string })[]
): string[] {
    return namedImports
        .map(item => (typeof item === 'string' ? item : item.name))
        .sort((a, b) => a.length - b.length);
}

/**
 * Fonction de log de debug
 */
export function logDebug(...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Fonction de log d'erreur
 */
export function logError(...args: any[]): void {
    console.error('[ERROR]', ...args);
}


/**
 * Fonction d'affichage d'un message showInformationMessage ou showErrorMessage (I want to use it like showMessage.error or showMessage.info)
 */
/**
 * Fonction d'affichage d'un message showInformationMessage ou showErrorMessage (I want to use it like showMessage.error or showMessage.info)
 */
export const showMessage = {
    /**
     * Affiche un message d'information
     * @param message Le message à afficher
     * @param items Les options à afficher (optionnel)
     */
    info: (message: string, ...items: string[]) => {
        return window.showInformationMessage(message, ...items);
    },

    /**
     * Affiche un message d'erreur
     * @param message Le message à afficher
     * @param items Les options à afficher (optionnel)
     */
    error: (message: string, ...items: string[]) => {
        return window.showErrorMessage(message, ...items);
    },

    /**
     * Affiche un message d'avertissement
     * @param message Le message à afficher
     * @param items Les options à afficher (optionnel)
     */
    warning: (message: string, ...items: string[]) => {
        return window.showWarningMessage(message, ...items);
    }
};