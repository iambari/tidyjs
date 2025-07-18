import vscode from 'vscode';

const OUTPUT_CHANNEL = vscode.window.createOutputChannel('TidyJS');
const DEBUG_MODE = () => {
  const config = vscode.workspace.getConfiguration('tidyjs');
  return config.get('debug', false);
};

export function logDebug(message: string, ...args: unknown[]): void {
  if (!DEBUG_MODE()) {
    return;
  }

  let formattedMessage = `[DEBUG] ${message}`;
  if (args.length > 0) {
    formattedMessage +=
      ' ' +
      args
        .map((arg) => {
          if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        })
        .join(' ');
  }

  OUTPUT_CHANNEL.appendLine(formattedMessage);
  // Removed OUTPUT_CHANNEL.show() - debug messages should not interrupt the user
}

export function logError(message: string, ...args: unknown[]): void {
  let formattedMessage = `[ERROR] ${message}`;

  if (args.length > 0) {
    formattedMessage +=
      ' ' +
      args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack}`;
          } else if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg);
          }
          return String(arg);
        })
        .join(' ');
  }

  OUTPUT_CHANNEL.appendLine(formattedMessage);
  // Show errors but don't steal focus from the user's current work
  OUTPUT_CHANNEL.show(true);
}

/**
 * Show the output channel for debugging purposes
 * This can be called manually when user wants to see logs
 */
export function showOutputChannel(): void {
  OUTPUT_CHANNEL.show();
}

/**
 * Clear all logs from the output channel
 */
export function clearLogs(): void {
  OUTPUT_CHANNEL.clear();
}

