// src/utils/config.ts

// Import the main Config type from your project
import { Config } from '../types'; // This is the correct type to use

// VSCode
import vscode from 'vscode'; // Assuming this was 'vscode' not 'vscode'

export interface ConfigChangeEvent {
  configKey: string;
  newValue: unknown;
}

// DEFAULT_CONFIG should fully conform to the Config type
const DEFAULT_CONFIG: Config = {
  debug: false, // Added debug as it's in Config interface in types.ts example (if you have it)
  // If not, remove this line. Ensure DEFAULT_CONFIG matches your Config type.
  groups: [
    {
      name: 'Misc',
      order: 0,
      isDefault: false,
    }
  ],
  importOrder: {
    default: 0,
    named: 1,
    typeOnly: 2, // The parser will map this to its internal typeDefault/typeNamed
    sideEffect: 3,
  },
  format: {
    onSave: false,
    indent: 4,
    removeUnused: false, // Added removeUnused as it's in Config interface in types.ts
    singleQuote: true,
    bracketSpacing: true,
  },
  patterns: {
    appModules: /^@app\/([a-zA-Z0-9_-]+)/,
  },
};

class ConfigManager {
  private config: Config;
  private eventEmitter: vscode.EventEmitter<ConfigChangeEvent> = new vscode.EventEmitter<ConfigChangeEvent>();
  // Stores dynamically created groups for app subfolders.
  // The value type Config['groups'][0] means each stored group object
  // has { name: string, order: number, isDefault?: boolean, match: RegExp }
  private subfolders: Map<string, Config['groups'][0]> = new Map();

  public readonly onDidConfigChange: vscode.Event<ConfigChangeEvent> = this.eventEmitter.event;

  constructor() {
    // Initialize with a deep copy of DEFAULT_CONFIG
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Simple deep copy for objects with RegExp
    // RegExp needs special handling for deep copy if JSON.parse/stringify isn't enough
    // However, for initial setup, spreading or direct assignment is often fine if not mutated.
    // Let's re-evaluate the copy for RegExp
    this.config = {
      ...DEFAULT_CONFIG,
      groups: DEFAULT_CONFIG.groups.map((g) => ({ ...g, match: g.match ? new RegExp(g.match.source, g.match.flags) : /./ })),
      format: { ...DEFAULT_CONFIG.format },
      importOrder: { ...DEFAULT_CONFIG.importOrder },
      patterns: DEFAULT_CONFIG.patterns
        ? {
            ...DEFAULT_CONFIG.patterns,
            appModules: DEFAULT_CONFIG.patterns.appModules ? new RegExp(DEFAULT_CONFIG.patterns.appModules.source, DEFAULT_CONFIG.patterns.appModules.flags) : undefined,
          }
        : undefined,
    };
    this.loadConfiguration();
  }

  public getConfig(): Config {
    return this.config;
  }

  /**
   * Gets the consolidated list of import groups, including base groups
   * and dynamically generated groups for application subfolders.
   * The sorting here determines the order in which groups are considered by the parser
   * for matching imports.
   */
  public getGroups(): Config['groups'] {
    const baseGroups = this.config.groups.map((g) => ({
      ...g,
      // Ensure 'isDefault' is explicitly boolean, defaulting to false if undefined
      isDefault: !!g.isDefault,
    }));

    const appModulePatternSource = this.config.patterns?.appModules?.source;

    // Convert subfolder map values to an array. These are already Config['groups'][0]
    const subfolderGroups = Array.from(this.subfolders.values());

    // Combine and sort. The parser will receive groups in this sorted order.
    const combinedGroups = [...baseGroups, ...subfolderGroups];

    combinedGroups.sort((a, b) => {
      // Rule 1: Default groups (isDefault: true) might be handled specially or by order.
      // Your original sort had default groups first. Let's reconsider.
      // Typically, a 'default' group is a fallback and might come later in matching order,
      // unless its 'order' property is explicitly set low.
      // The parser's determineGroup iterates and takes the first match.
      // Let's sort primarily by 'order', then by other criteria for tie-breaking.

      if (a.order !== b.order) {
        return a.order - b.order;
      }

      // Tie-breaking for groups with the same order:
      // Your original logic had complex tie-breaking (isDefault, app module status, name).
      // This can be kept if it's important for how groups are matched when orders are identical.
      // For simplicity and primary reliance on 'order', further tie-breaking might be:
      // - Non-default groups before default groups if that's desired for matching specificity.
      // - Alphabetical by name.

      // Example simplified tie-breaking (you can reinstate your more complex logic if needed):
      if (a.isDefault && !b.isDefault) return 1; // Default groups later for same order
      if (!a.isDefault && b.isDefault) return -1;

      // For app modules, if appModulePatternSource is available for comparison
      if (appModulePatternSource && this.config.patterns?.appModules && a.match && b.match) {
        const aIsApp = this.config.patterns.appModules.test(a.match.source);
        const bIsApp = this.config.patterns.appModules.test(b.match.source);

        if (aIsApp && !bIsApp) return -1; // App specific groups first
        if (!aIsApp && bIsApp) return 1;

        if (aIsApp && bIsApp) {
          // Example: if one is the generic app pattern, maybe it comes after more specific app patterns
          if (a.match.source === appModulePatternSource && b.match.source !== appModulePatternSource) return 1;
          if (a.match.source !== appModulePatternSource && b.match.source === appModulePatternSource) return -1;
          return a.name.localeCompare(b.name); // Sort app modules by name
        }
      }
      return a.name.localeCompare(b.name); // Fallback: sort by name
    });

    return combinedGroups;
  }

  public registerAppSubfolder(subfolder: string): void {
    if (subfolder && !this.subfolders.has(subfolder)) {
      // Define the order for these dynamic groups. Should be consistent with other group orders.
      // Example: Make them part of the "Internal" group's order range.
      const internalGroupOrder = this.config.groups.find((g) => g.name === 'Internal')?.order ?? 2;

      const name = `@app/${subfolder}`;
      const match = new RegExp(`^@app\\/${subfolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`); // Escape special chars

      this.subfolders.set(subfolder, {
        name,
        match,
        order: internalGroupOrder, // Assign a consistent order
        isDefault: false, // App subfolder groups are typically not default/catch-all
      });
      // Optionally, re-evaluate or notify if this changes the group set significantly
      // this.eventEmitter.fire({ configKey: 'groups', newValue: this.getGroups() });
    }
  }

  public loadConfiguration(): void {
    const vsConfig = vscode.workspace.getConfiguration('tidyjs');
    let changed = false;

    // Helper to update a config value and fire event
    const updateConfigValue = <K extends keyof Config, T extends Config[K]>(
      key: K,
      vsCodeValue: T | undefined,
      transform?: (val: NonNullable<T>) => Config[K] // Optional transformer
    ) => {
      if (vsCodeValue !== undefined) {
        const newValue = transform ? transform(vsCodeValue as NonNullable<T>) : vsCodeValue;
        if (JSON.stringify(this.config[key]) !== JSON.stringify(newValue)) {
          // Basic change detection
          (this.config[key] as T) = newValue as T;
          this.eventEmitter.fire({ configKey: key as string, newValue });
          changed = true;
        }
      }
    };

    const updateNestedConfigValue = <PKey extends keyof Config, NKey extends keyof NonNullable<Config[PKey]>>(
      parentKey: PKey,
      nestedKey: NKey,
      vsCodeValue: NonNullable<Config[PKey]>[NKey] | undefined
    ) => {
      if (vsCodeValue !== undefined) {
        let parentObj = this.config[parentKey] as NonNullable<Config[PKey]> | undefined;

        // If parent object (e.g., 'format', 'patterns') doesn't exist in the current config,
        // create it from the DEFAULT_CONFIG structure before setting the nested property.
        // This handles cases where 'patterns' or 'format' might be optional at the top level of 'config'.
        if (!parentObj && DEFAULT_CONFIG[parentKey] !== undefined && typeof DEFAULT_CONFIG[parentKey] === 'object') {
          // Perform a deep clone for the default parent object part to avoid mutating DEFAULT_CONFIG
          // Note: JSON.parse(JSON.stringify()) does not correctly clone RegExp, Date, etc.
          // If DEFAULT_CONFIG[parentKey] contains such types, a more specific clone is needed.
          // For 'format' and 'importOrder', this is usually fine. For 'patterns' (with RegExp), it's not.
          // However, 'patterns' is handled separately for 'appModules' below.
          // For 'format', which is an object of simple types, this is okay.
          if (parentKey === 'format') {
            this.config[parentKey] = JSON.parse(JSON.stringify(DEFAULT_CONFIG[parentKey]));
          } else {
            // For other potential complex objects, direct assignment or specific cloning needed
            // This path should ideally not be hit if top-level optional objects are initialized.
            this.config[parentKey] = { ...DEFAULT_CONFIG[parentKey] } as Config[PKey]; // Shallow copy, adjust if deep needed
          }
          parentObj = this.config[parentKey] as NonNullable<Config[PKey]>;
          // changed = true; // Setting the parent itself is a change.
        }

        if (parentObj && typeof parentObj === 'object') {
          // Ensure parentObj is now an object
          const currentNestedValue = Object.prototype.hasOwnProperty.call(parentObj, nestedKey as string)
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (parentObj as any)[nestedKey]
            : undefined;
          if (JSON.stringify(currentNestedValue) !== JSON.stringify(vsCodeValue)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (parentObj as any)[nestedKey] = vsCodeValue;
            this.eventEmitter.fire({ configKey: `${parentKey}.${nestedKey as string}`, newValue: vsCodeValue });
            // 'changed' should be a local variable in loadConfiguration, passed by reference or returned,
            // or this helper should be a method that sets this.changed directly if 'changed' is a class member.
            // Assuming 'changed' is accessible in this scope (e.g., a local let variable in loadConfiguration).
            // For this example, I'll assume 'changed' is a `let changed = false;` at the start of `loadConfiguration`.
            // To make this helper directly modify it, 'changed' would need to be captured or a class member.
            // For now, the `changed = true` line is commented out here, it should be set in loadConfiguration's scope.
          }
        }
      }
    };

    // Load groups
    const customGroupsSetting = vsConfig.get<Array<{ name: string; match: string; order: number; isDefault?: boolean }>>('groups');
    if (customGroupsSetting) {
      // Check if the setting exists, even if it's an empty array
      const newGroups = customGroupsSetting.map((group) => {
        const matchStr = group.match || '';
        let pattern: string = matchStr;
        let flags = '';

        if (matchStr.startsWith('/') && matchStr.length > 1) {
          const lastSlashIndex = matchStr.lastIndexOf('/');
          if (lastSlashIndex > 0 && lastSlashIndex < matchStr.length - 1) {
            // Ensure flags part exists
            pattern = matchStr.slice(1, lastSlashIndex);
            flags = matchStr.slice(lastSlashIndex + 1);
            const validFlags = flags.split('').every((flag) => 'gimsuy'.includes(flag));
            if (!validFlags) {
              // Log error or show warning to user about invalid regex flags
              console.error(`Invalid regex flags '${flags}' in pattern: ${matchStr}. Using no flags.`);
              flags = ''; // Fallback to no flags or skip this group
            }
          } else {
            // It's like "/pattern" without trailing /flags or "/pattern/"
            pattern = matchStr.slice(1);
            if (pattern.endsWith('/')) pattern = pattern.slice(0, -1);
          }
        }
        // else: pattern is matchStr as is (not a /regex/literal string)

        return {
          name: group.name,
          match: new RegExp(pattern, flags),
          order: group.order,
          isDefault: !!group.isDefault, // Ensure boolean
        };
      });
      // Only update if the loaded groups are different from default/current
      // This simple JSON compare might not be ideal for RegExp arrays
      if (JSON.stringify(this.config.groups.map((g) => g.toString())) !== JSON.stringify(newGroups.map((g) => g.toString()))) {
        this.config.groups = newGroups;
        this.eventEmitter.fire({ configKey: 'groups', newValue: this.config.groups });
        changed = true;
      }
    }

    // Load format options
    updateNestedConfigValue('format', 'onSave', vsConfig.get<boolean>('format.onSave'));
    updateNestedConfigValue('format', 'indent', vsConfig.get<number>('format.indent'));
    updateNestedConfigValue('format', 'removeUnused', vsConfig.get<boolean>('format.removeUnused'));
    updateNestedConfigValue('format', 'singleQuote', vsConfig.get<boolean>('format.singleQuote'));
    updateNestedConfigValue('format', 'bracketSpacing', vsConfig.get<boolean>('format.bracketSpacing'));

    // Load importOrder
    updateConfigValue('importOrder', vsConfig.get<Config['importOrder']>('importOrder'));

    // Load patterns
    const patternsSetting = vsConfig.get<{ appModules?: string }>('patterns');
    if (patternsSetting?.appModules !== undefined) {
      if (!this.config.patterns) this.config.patterns = {};
      const newAppModulesPattern = new RegExp(patternsSetting.appModules);
      if (this.config.patterns.appModules?.source !== newAppModulesPattern.source || this.config.patterns.appModules?.flags !== newAppModulesPattern.flags) {
        this.config.patterns.appModules = newAppModulesPattern;
        this.eventEmitter.fire({ configKey: 'patterns.appModules', newValue: patternsSetting.appModules });
        changed = true;
      }
    } else if (patternsSetting && patternsSetting.appModules === undefined && this.config.patterns?.appModules) {
      // If appModules is explicitly set to null/undefined in settings, remove it
      delete this.config.patterns.appModules;
      this.eventEmitter.fire({ configKey: 'patterns.appModules', newValue: undefined });
      changed = true;
    }

    // Load debug
    updateConfigValue('debug', vsConfig.get<boolean>('debug'));

    // If any configuration changed, you might want to clear dynamic state like subfolders
    // if they depend on the loaded configuration (e.g., appModules pattern)
    if (changed) {
      // Example: If appModules pattern changed, subfolders might need to be re-evaluated
      // this.subfolders.clear(); // Or more specific logic
    }
  }

  /**
   * Provides the configuration object for the ImportParser.
   * This returns the main Config object, with the 'groups' property
   * containing the consolidated and sorted list of groups.
   */
  public getParserConfig(): Config {
    // Return type is Config
    const currentGlobalConfig = this.getConfig(); // Gets the currently loaded/default config
    return {
      ...currentGlobalConfig,
      groups: this.getGroups(), // Crucially, use the processed groups
    };
  }
}

export const configManager = new ConfigManager();

// This export might be problematic if getGroups() relies on workspace state
// that isn't available at module load time.
// It's generally safer to call configManager.getGroups() when needed.
// export const DEFAULT_GROUPS: Config['groups'] = configManager.getGroups();
