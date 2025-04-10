// Misc
import { Config } from '../types';
// VSCode
import vscode from 'vscode';

export interface ConfigChangeEvent {
  configKey: string;
  newValue: unknown;
}

const DEFAULT_CONFIG: Config = {
  groups: [
    { 
      name: 'React',
      order: 0,
      isDefault: false,
      match: /^(react|react-.*|next|next-.*)$/
    },
    {
      name: 'External',
      order: 1,
      isDefault: false,
      match: /^(?!@app|@test).*$/
    },
    {
      name: 'Internal',
      order: 2,
      isDefault: true,
      match: /^@app/
    }
  ],
  importOrder: {
    default: 0,
    named: 1,
    typeOnly: 2,
    sideEffect: 3
  },
  format: {
    onSave: false,
    indent: 4,
    singleQuote: true,
    bracketSpacing: true
  },
  patterns: {
    appModules: /^@app\/([a-zA-Z0-9_-]+)/,
  }
};

class ConfigManager {
  private config: Config;
  private eventEmitter: vscode.EventEmitter<ConfigChangeEvent> = new vscode.EventEmitter<ConfigChangeEvent>();
  private subfolders: Map<string, Config['groups'][0]> = new Map();

  public readonly onDidConfigChange: vscode.Event<ConfigChangeEvent> = this.eventEmitter.event;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfiguration();
  }

  public getConfig(): Config {
    return this.config;
  }

  public getGroups(): Config['groups'] {
    const baseGroups = [...this.config.groups];
    const subfolderGroups = Array.from(this.subfolders.values());

    const sortedGroups = [...baseGroups, ...subfolderGroups].sort((a, b) => {
      // Groupe par défaut toujours en premier
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;

      const aIsApp = a.name.startsWith('@app');
      const bIsApp = b.name.startsWith('@app');

      if (aIsApp && !bIsApp) return -1;
      if (!aIsApp && bIsApp) return 1;

      // Tri des sous-dossiers @app
      if (aIsApp && bIsApp) {
        if (a.name === '@app') return 1;
        if (b.name === '@app') return -1;
        return a.name.localeCompare(b.name);
      }

      // Tri par ordre pour tous les autres groupes
      return a.order - b.order;
    });

    return sortedGroups;
  }

  public registerAppSubfolder(subfolder: string): void {
    if (subfolder && !this.subfolders.has(subfolder)) {
      const order = 2;
      const name = `@app/${subfolder}`;
      const match = new RegExp(`^@app\\/${subfolder}`);

      this.subfolders.set(subfolder, {
        name,
        match,
        order,
        isDefault: false
      });
    }
  }

  public loadConfiguration(): void {
    const vsConfig = vscode.workspace.getConfiguration('tidyjs');

    const customGroups = vsConfig.get<Array<{ name: string; match: string; order: number; isDefault?: boolean }>>('groups');
    if (customGroups && customGroups.length > 0) {
      this.config.groups = customGroups.map((group) => {
        const matchStr = group.match || '';
        let pattern: string;
        let flags = '';

        if (matchStr && matchStr.startsWith('/') && matchStr.length > 2) {
          const lastSlashIndex = matchStr.lastIndexOf('/');
          if (lastSlashIndex > 0) {
            pattern = matchStr.slice(1, lastSlashIndex);
            flags = matchStr.slice(lastSlashIndex + 1);

            const validFlags = flags.split('').every(flag => 'gimsuy'.includes(flag));
            if (!validFlags) {
              throw new Error(`Invalid regex flags in pattern: ${matchStr}. Valid flags are: g, i, m, s, u, y`);
            }
          } else {
            pattern = matchStr;
          }
        } else {
          pattern = matchStr;
        }

        return {
          name: group.name,
          match: new RegExp(pattern, flags),
          order: group.order,
          isDefault: group.isDefault || false,
        };
      });
      this.eventEmitter.fire({ configKey: 'groups', newValue: this.config.groups });
    }

    const format = vsConfig.get<Config['format']>('format');
    if (format) {
      this.config.format = { ...this.config.format, ...format };
      this.eventEmitter.fire({ configKey: 'format', newValue: format });
    }

    const importOrder = vsConfig.get<Config['importOrder']>('importOrder');
    if (importOrder) {
      this.config.importOrder = importOrder;
      this.eventEmitter.fire({ configKey: 'importOrder', newValue: importOrder });
    }

    const patterns = vsConfig.get<Config['patterns']>('patterns');
    if (patterns) {
      this.config.patterns = { ...this.config.patterns, ...patterns };
      this.eventEmitter.fire({ configKey: 'patterns', newValue: patterns });
    }
  }

  public getFormatOnSave(): boolean {
    return this.config.format.onSave;
  }

  /**
   * Convertit la configuration au format du parser
   */
  public getParserConfig() {
    return {
      importOrder: this.config.importOrder,
      patterns: {
        subfolderPattern: this.config.patterns?.appModules
      },
      importGroups: this.getGroups().map(group => ({
        name: group.name,
        order: group.order,
        isDefault: group.isDefault || false,
        match: group.match
      }))
    };
  }
}

export const configManager = new ConfigManager();

export const DEFAULT_GROUPS: Config['groups'] = configManager.getGroups();
