import vscode from 'vscode';

const OUTPUT_CHANNEL = vscode.window.createOutputChannel('TidyJS');
const DEBUG_MODE = () => {
  const config = vscode.workspace.getConfiguration('tidyjs');
  return config.get('debug', false);
};

function formatDebugArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        return formatObject(arg);
      }
      return String(arg);
    })
    .join('\n');
}

function formatObject(obj: unknown): string {
  if (Array.isArray(obj)) {
    return formatArray(obj);
  }
  
  if (isConfigObject(obj)) {
    return formatConfigObject(obj as Record<string, unknown>);
  }
  
  const formatted = JSON.stringify(obj, (_key, value) => {
    if (value && typeof value === 'object' && value.constructor === RegExp) {
      return `RegExp(${value.toString()})`;
    }
    return value;
  }, 2);
  
  return formatted
    .split('\n')
    .map((line, index) => index === 0 ? line : `  ${line}`)
    .join('\n');
}

function isConfigObject(obj: unknown): boolean {
  return typeof obj === 'object' && 
         obj !== null && 
         'groups' in obj && 
         'importOrder' in obj && 
         'format' in obj;
}

function formatConfigObject(config: Record<string, unknown>): string {
  const summary = [
    `Debug: ${config.debug ? 'enabled' : 'disabled'}`,
    `Groups: ${Array.isArray(config.groups) ? config.groups.length : 0} configured`,
    `Import order: ${config.importOrder && typeof config.importOrder === 'object' ? Object.keys(config.importOrder).join(' → ') : 'none'}`,
    `Format: ${config.format && typeof config.format === 'object' && 'singleQuote' in config.format ? (config.format.singleQuote ? 'single quotes' : 'double quotes') : 'default'}, ${config.format && typeof config.format === 'object' && 'indent' in config.format ? config.format.indent || 2 : 2} spaces`,
    `Path resolution: ${config.pathResolution && typeof config.pathResolution === 'object' && 'enabled' in config.pathResolution ? (config.pathResolution.enabled ? 'enabled' : 'disabled') : 'disabled'}`,
    `Excluded folders: ${Array.isArray(config.excludedFolders) ? config.excludedFolders.length : 0} folders`
  ];
  
  if (Array.isArray(config.groups) && config.groups.length > 0) {
    summary.push('\nGroups:');
    config.groups.forEach((group: unknown, index: number) => {
      if (typeof group === 'object' && group !== null) {
        const groupObj = group as Record<string, unknown>;
        const pattern = groupObj.originalMatchString || (groupObj.match && typeof groupObj.match === 'object' && 'source' in groupObj.match ? groupObj.match.source : 'no pattern');
        summary.push(`  ${index + 1}. ${groupObj.name || 'unnamed'} (order: ${groupObj.order || 'none'}) → ${pattern}`);
      }
    });
  }
  
  if (Array.isArray(config.excludedFolders) && config.excludedFolders.length > 0) {
    summary.push('\nExcluded folders:');
    config.excludedFolders.forEach((folder: unknown, index: number) => {
      summary.push(`  ${index + 1}. ${String(folder)}`);
    });
  }
  
  return summary.join('\n');
}

function formatArray(arr: unknown[]): string {
  if (arr.length === 0) {
    return '[]';
  }
  
  const items = arr.map((item, index) => {
    if (typeof item === 'object' && item !== null) {
      const formatted = formatObject(item);
      return `  [${index}] ${formatted.replace(/\n/g, '\n      ')}`;
    }
    return `  [${index}] ${String(item)}`;
  });
  
  return '[\n' + items.join('\n') + '\n]';
}

export function logDebug(message: string, ...args: unknown[]): void {
  if (!DEBUG_MODE()) {
    return;
  }

  let formattedMessage = `[DEBUG] ${message}`;
  if (args.length > 0) {
    formattedMessage += '\n' + formatDebugArgs(args);
  }

  OUTPUT_CHANNEL.appendLine(formattedMessage);
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



