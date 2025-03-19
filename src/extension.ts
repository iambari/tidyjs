import * as vscode from 'vscode';
import { formatImports } from './formatter';
import { ImportParser, ParserResult } from 'tidyimport-parser';
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';

// Initialiser le parser avec la configuration
const parser = new ImportParser({
  defaultGroupName: 'Misc',
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4
  },
  TypeOrder: {
    default: 0,
    named: 1,
    typeDefault: 2,
    typeNamed: 3,
    sideEffect: 4
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/
  },
  importGroups: configManager.getImportGroups().map(group => ({
    name: group.name,
    regex: group.regex,
    order: group.order,
    isDefault: group.name === 'Misc'
  }))
});

export function activate(context: vscode.ExtensionContext): void {
  configManager.loadConfiguration();

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tidyimport')) {
      configManager.loadConfiguration();
    }
  });

  // Récupérer la configuration pour le formatage
  configManager.getFormatterConfig();

  const formatImportsCommand = vscode.commands.registerCommand(
    'extension.formatImports',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
      }

      const document = editor.document;
      const documentText = document.getText();

      try {
        // Utiliser le parser pour analyser les imports
        const parserResult = parser.parse(documentText) as ParserResult;
        console.log(`[Parser] ${JSON.stringify(parserResult, null, 2)}`);
        logDebug('Parser result:', JSON.stringify(parserResult, null, 2));
        
        // Formater les imports en utilisant le résultat du parser
        const formattedDocument = formatImports(
          documentText, 
          configManager.getFormatterConfig(), 
          parserResult
        );

        if (formattedDocument !== documentText) {
          const fullDocumentRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );

          await editor.edit((editBuilder) => {
            editBuilder.replace(fullDocumentRange, formattedDocument);
          }).then((success) => {
            if (success) {
              logDebug('Successfully formatted imports in document');
              vscode.window.showInformationMessage('Imports formatted successfully!');
            } else {
              vscode.window.showErrorMessage('Failed to format imports in document');
            }
          });
        } else {
          logDebug('No changes needed for the document');
        }
      } catch (error) {
        logError('Error:', error);
        const errorMessage = String(error);
        vscode.window.showErrorMessage(`Error formatting imports: ${errorMessage}`);
      }
    }
  );

  context.subscriptions.push(formatImportsCommand);
}