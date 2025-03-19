import { window, workspace, commands, Range } from 'vscode';
import type { ExtensionContext } from 'vscode';
import { formatImports } from './formatter';
import { ImportParser, ParserResult } from 'tidyimport-parser';
import { configManager } from './utils/config';
import { logDebug, logError } from './utils/log';
import { showMessage } from './utils/misc';

let parser = new ImportParser(configManager.getParserConfig());

export function activate(context: ExtensionContext): void {
  configManager.loadConfiguration();

  workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tidyimport')) {
      configManager.loadConfiguration();
      parser = new ImportParser(configManager.getParserConfig());
    }
  });

  configManager.getFormatterConfig();

  const formatImportsCommand = commands.registerCommand(
    'extension.formatImports',
    async () => {
      const editor = window.activeTextEditor;
      if (!editor) {
        showMessage.warning('No active editor found');
        return;
      }

      const document = editor.document;
      const documentText = document.getText();

      try {
        const parserResult = parser.parse(documentText) as ParserResult;
        console.log(`[Parser] ${JSON.stringify(parserResult, null, 2)}`);
        logDebug('Parser result:', JSON.stringify(parserResult, null, 2));
        
        const formattedDocument = formatImports(
          documentText, 
          configManager.getFormatterConfig(), 
          parserResult
        );

        if (formattedDocument.error) {
          showMessage.error(formattedDocument.error);
          return;
        }

        if (formattedDocument.text !== documentText) {
          const fullDocumentRange = new Range(
            document.positionAt(0),
            document.positionAt(documentText.length)
          );

          await editor.edit((editBuilder) => {
            editBuilder.replace(fullDocumentRange, formattedDocument.text);
          }).then((success) => {
            if (success) {
              logDebug('Successfully formatted imports in document');
              showMessage.info('Imports formatted successfully!');
            } else {
              showMessage.warning('Failed to format imports in document');
            }
          });
        } else {
          logDebug('No changes needed for the document');
        }
      } catch (error) {
        logError('Error:', error);
        const errorMessage = String(error);
        showMessage.error(`Error formatting imports: ${errorMessage}`);
      }
    }
  );

  context.subscriptions.push(formatImportsCommand);
}
