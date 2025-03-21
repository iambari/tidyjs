// VSCode
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
export function isSectionComment(line: string, config: { regexPatterns: { sectionComment: RegExp } }): boolean {
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
 * Type pour représenter un import nommé qui peut avoir un commentaire
 */
export interface NamedImportWithComment {
    name: string;
    comment?: string;
}

/**
 * Trie les noms d'import par longueur (du plus court au plus long)
 * @param namedImports Liste des imports nommés à trier
 * @returns Liste triée des noms d'imports
 */
export function sortImportNamesByLength(
    namedImports: (string | NamedImportWithComment)[]
): string[] {
    return namedImports
        .map(item => (typeof item === 'string' ? item : item.name))
        .sort((a, b) => a.length - b.length);
}

/**
 * Fonction de log de debug
 * @param args Les arguments à logger
 */
export function logDebug(...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Fonction de log d'erreur
 * @param args Les arguments à logger
 */
export function logError(...args: unknown[]): void {
    console.error('[ERROR]', ...args);
}


/**
 * Fonctions d'affichage de messages dans l'interface de VSCode
 * Permet d'utiliser showMessage.info(), showMessage.error() ou showMessage.warning()
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
