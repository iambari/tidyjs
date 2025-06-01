import { Config } from '../types';
import vscode from 'vscode';
import { logDebug, logError } from './log';
import { cloneDeepWith, difference, uniq } from 'lodash';

export interface ConfigChangeEvent {
  configKey: string;
  newValue: unknown;
  isValid: boolean;
  errors?: string[];
}

const DEFAULT_CONFIG: Config = {
  debug: false,
  groups: [
    {
      name: 'Misc',
      order: 0,
      isDefault: true,
    }
  ],
  importOrder: {
    default: 0,
    named: 1,
    typeOnly: 2,
    sideEffect: 3,
  },
  format: {
    onSave: false,
    indent: 4,
    removeUnusedImports: false,
    removeMissingModules: false,
    singleQuote: true,
    bracketSpacing: true,
  },
  excludedFolders: [],
};

class ConfigManager {
  private config: Config;
  private eventEmitter: vscode.EventEmitter<ConfigChangeEvent> = new vscode.EventEmitter<ConfigChangeEvent>();
  private subfolders = new Map<string, Config['groups'][0]>();
  private validationErrors: string[] = [];
  private isValid = true;

  public readonly onDidConfigChange: vscode.Event<ConfigChangeEvent> = this.eventEmitter.event;

  constructor() {
    this.config = this.deepCloneConfig(DEFAULT_CONFIG);
    this.loadConfiguration();
    this.performInitialValidation();
  }

  /**
   * Performs initial validation after configuration loading
   * Sets internal validation state and logs errors if configuration is invalid
   */
  private performInitialValidation(): void {
    const validation = this.validateConfiguration(this.config);
    this.isValid = validation.isValid;
    this.validationErrors = validation.errors;
    
    if (!validation.isValid) {
      logError('Configuration validation failed:', validation.errors);
    }
  }

  /**
   * Deep clones a configuration object, properly handling RegExp objects
   * Ensures that RegExp patterns are recreated with correct source and flags
   * @param config The configuration object to clone
   * @returns A deep copy of the configuration with properly cloned RegExp objects
   */
  private deepCloneConfig(config: Config): Config {
    return cloneDeepWith(config, (value) => {
      if (value instanceof RegExp) {
        return new RegExp(value.source, value.flags);
      }
      return undefined;
    });
  }

  /**
   * Validates the configuration and returns validation errors
   * Checks for:
   * - Exactly one default group
   * - No duplicate group orders
   * - No duplicate group names
   * @param config The configuration to validate
   * @returns Object containing validation status and error messages
   */
  private validateConfiguration(config: Config): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const defaultGroups = config.groups.filter(group => group.isDefault === true);
    
    if (defaultGroups.length === 0) {
      errors.push('No group is marked as default. At least one group must be the default.');
    } else if (defaultGroups.length > 1) {
      const groupNames = defaultGroups.map(g => `"${g.name}"`).join(', ');
      errors.push(`Multiple groups are marked as default: ${groupNames}. Only one group can be the default.`);
    }
    const orders = config.groups.map(g => g.order);
    const uniqueOrders = uniq(orders);
    const duplicateOrders = difference(orders, uniqueOrders);
    if (duplicateOrders.length > 0) {
      const uniqueDuplicates = uniq(duplicateOrders);
      errors.push(`Duplicate group orders found: ${uniqueDuplicates.join(', ')}. Each group should have a unique order.`);
    }
    const names = config.groups.map(g => g.name);
    const uniqueNames = uniq(names);
    const duplicateNames = difference(names, uniqueNames);
    if (duplicateNames.length > 0) {
      const uniqueDuplicateNames = uniq(duplicateNames);
      errors.push(`Duplicate group names found: ${uniqueDuplicateNames.join(', ')}. Each group must have a unique name.`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }


  /**
   * Gets the current configuration
   * Returns the base configuration without dynamic subfolder groups
   * @returns The current configuration object
   * @example
   * ```typescript
   * const config = configManager.getConfig();
   * console.log(config.debug); // false
   * console.log(config.groups.length); // Number of base groups
   * ```
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * Checks if the current configuration is valid
   * Configuration is considered invalid if it has validation errors like
   * duplicate group names, multiple default groups, or duplicate orders
   * @returns True if the configuration is valid, false otherwise
   * @example
   * ```typescript
   * if (!configManager.isConfigurationValid()) {
   *   const errors = configManager.getValidationErrors();
   *   console.error('Config errors:', errors);
   * }
   * ```
   */
  public isConfigurationValid(): boolean {
    return this.isValid;
  }

  /**
   * Gets the validation errors for the current configuration
   * Returns detailed error messages about configuration issues
   * @returns Array of validation error messages (empty if valid)
   * @example
   * ```typescript
   * const errors = configManager.getValidationErrors();
   * if (errors.length > 0) {
   *   errors.forEach(error => console.error(error));
   * }
   * ```
   */
  public getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  /**
   * Gets all groups including dynamically generated subfolder groups
   * Combines base configuration groups with registered app subfolder groups
   * Groups are sorted by order, then by default status, then by name
   * @returns Array of all groups sorted by order and name
   * @example
   * ```typescript
   * const groups = configManager.getGroups();
   * // groups might include: [External, Internal, @app/auth, @app/utils, Misc]
   * groups.forEach(group => {
   *   console.log(`${group.name}: order ${group.order}, default: ${group.isDefault}`);
   * });
   * ```
   */
  public getGroups(): Config['groups'] {
    const baseGroups = this.config.groups.map(g => ({
      ...g,
      isDefault: !!g.isDefault,
    }));

    const subfolderGroups = Array.from(this.subfolders.values());
    const combinedGroups = [...baseGroups, ...subfolderGroups];

    combinedGroups.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      if (a.isDefault && !b.isDefault) {return 1;}
      if (!a.isDefault && b.isDefault) {return -1;}

      return a.name.localeCompare(b.name);
    });

    return combinedGroups;
  }

  /**
   * Parses a RegExp string in format "/pattern/flags" or "pattern"
   * Handles both slash-delimited regex strings with flags and plain patterns
   * @param regexStr The regex string to parse
   * @returns Parsed RegExp object or undefined if parsing fails
   * @example
   * ```typescript
   * parseRegexString('/^@app\/(.*)/i') // Returns: /^@app\/(.*)/i
   * parseRegexString('^@app') // Returns: /^@app/
   * ```
   */
  private parseRegexString(regexStr: string): RegExp | undefined {
    if (!regexStr) {return undefined;}

    try {
      if (regexStr.startsWith('/') && regexStr.length > 1) {
        const lastSlashIndex = regexStr.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          const pattern = regexStr.slice(1, lastSlashIndex);
          const flags = regexStr.slice(lastSlashIndex + 1);
          const validFlags = /^[gimsuy]*$/.test(flags);
          if (!validFlags) {
            logError(`Invalid regex flags '${flags}' in pattern: ${regexStr}`);
            return new RegExp(pattern); // Utiliser sans flags
          }
          
          return new RegExp(pattern, flags);
        } else {
          return new RegExp(regexStr.slice(1));
        }
      } else {
        return new RegExp(regexStr);
      }
    } catch (error) {
      logError(`Error parsing regex "${regexStr}":`, error);
      return undefined;
    }
  }

  /**
   * Loads configuration from VS Code workspace settings
   * Reads all TidyJS settings from VS Code configuration and updates internal state
   * Validates the loaded configuration and fires change events if updates occur
   * Handles settings for groups, format options, import order, and excluded folders
   * @example
   * ```typescript
   * // Called automatically on startup and when settings change
   * configManager.loadConfiguration();
   * ```
   */
  public loadConfiguration(): void {
    const vsConfig = vscode.workspace.getConfiguration('tidyjs');
    let hasChanges = false;
    
    try {
      const newConfig = this.deepCloneConfig(this.config);
      const customGroupsSetting = vsConfig.get<{
        name: string;
        match?: string;
        order: number;
        isDefault?: boolean;
      }[]>('groups');

      if (customGroupsSetting !== undefined) {
        const newGroups = customGroupsSetting.map(group => {
          return {
            name: group.name,
            match: group.match ? this.parseRegexString(group.match) : undefined,
            order: group.order,
            isDefault: !!group.isDefault,
          };
        });
        logDebug('Current groups:', newConfig.groups);
        const compareWith = this.config.groups.length === 1 && this.config.groups[0].name === 'Misc' 
          ? DEFAULT_CONFIG.groups 
          : this.config.groups;

        if (JSON.stringify(this.groupsToComparable(compareWith)) !== 
            JSON.stringify(this.groupsToComparable(newGroups))) {
          newConfig.groups = newGroups;
          hasChanges = true;
          logDebug('Groups configuration changes detected');
        }
      }
      const formatSettings = {
        onSave: vsConfig.get<boolean>('format.onSave'),
        indent: vsConfig.get<number>('format.indent'),
        removeUnusedImports: vsConfig.get<boolean>('format.removeUnusedImports'),
        removeMissingModules: vsConfig.get<boolean>('format.removeMissingModules'),
        singleQuote: vsConfig.get<boolean>('format.singleQuote'),
        bracketSpacing: vsConfig.get<boolean>('format.bracketSpacing'),
      };

      for (const [key, value] of Object.entries(formatSettings)) {
        if (value !== undefined && newConfig.format[key as keyof typeof newConfig.format] !== value) {
          (newConfig.format as Record<string, unknown>)[key] = value;
          hasChanges = true;
        }
      }
      const importOrder = vsConfig.get<Config['importOrder']>('importOrder');
      if (importOrder && JSON.stringify(newConfig.importOrder) !== JSON.stringify(importOrder)) {
        newConfig.importOrder = { ...importOrder };
        hasChanges = true;
      }
      const debug = vsConfig.get<boolean>('debug');
      if (debug !== undefined && newConfig.debug !== debug) {
        newConfig.debug = debug;
        hasChanges = true;
      }
      const excludedFolders = vsConfig.get<string[]>('excludedFolders');
      if (excludedFolders !== undefined && JSON.stringify(newConfig.excludedFolders) !== JSON.stringify(excludedFolders)) {
        newConfig.excludedFolders = [...excludedFolders];
        hasChanges = true;
      }
      if (hasChanges) {
        this.applyConfigurationChanges(newConfig);
      } else {
        const validation = this.validateConfiguration(newConfig);
        if (!validation.isValid) {
          logError('Current configuration is invalid:', validation.errors);
          this.validationErrors = validation.errors;
          this.isValid = false;
          this.fireConfigChangeEvent('config', this.config, false, validation.errors);
        } else if (!this.isValid) {
          this.isValid = true;
          this.validationErrors = [];
          this.fireConfigChangeEvent('config', this.config, true);
        }
      }

    } catch (error) {
      logError('Error loading configuration:', error);
      this.validationErrors = [`Configuration loading error: ${error}`];
      this.isValid = false;
      this.fireConfigChangeEvent('config', this.config, false, this.validationErrors);
    }
  }

  /**
   * Converts groups to comparable format (for change detection)
   * Extracts only the comparable properties to detect configuration changes
   * @param groups The groups array to convert
   * @returns Array of comparable group objects
   */
  private groupsToComparable(groups: Config['groups']) {
    return groups.map(g => ({
      name: g.name,
      order: g.order,
      isDefault: g.isDefault,
      matchSource: g.match?.source,
      matchFlags: g.match?.flags,
    }));
  }

  /**
   * Applies configuration changes without auto-repair
   * Validates the new configuration and updates internal state if valid
   * Clears subfolder cache and fires change events
   * @param newConfig The new configuration to apply
   */
  private applyConfigurationChanges(newConfig: Config): void {
    const validation = this.validateConfiguration(newConfig);
    
    if (validation.isValid) {
      this.config = newConfig;
      this.validationErrors = [];
      this.isValid = true;
      this.clearSubfolders();
      this.fireConfigChangeEvent('config', this.config, true);
      logDebug('Configuration updated successfully');
    } else {
      logError('Invalid configuration detected:', validation.errors);
      this.validationErrors = validation.errors;
      this.isValid = false;
      this.fireConfigChangeEvent('config', this.config, false, validation.errors);
    }
  }

  /**
   * Clears the subfolder cache
   * Removes all registered app subfolder groups from memory
   */
  private clearSubfolders(): void {
    if (this.subfolders.size > 0) {
      this.subfolders.clear();
      logDebug('Cleared cached subfolders due to configuration change');
    }
  }

  /**
   * Fires a configuration change event
   * Notifies all subscribers about configuration changes with validation status
   * @param configKey The configuration key that changed
   * @param newValue The new configuration value
   * @param isValid Whether the new configuration is valid
   * @param errors Optional validation error messages
   */
  private fireConfigChangeEvent(configKey: string, newValue: unknown, isValid: boolean, errors?: string[]): void {
    this.eventEmitter.fire({
      configKey,
      newValue,
      isValid,
      errors,
    });
  }

  /**
   * Gets configuration optimized for the parser with all groups included
   * Returns the base configuration enhanced with all registered subfolder groups
   * This is the configuration that should be used by the import parser
   * @returns Configuration object with dynamic groups included
   * @example
   * ```typescript
   * const parserConfig = configManager.getParserConfig();
   * // parserConfig.groups includes both base groups and @app/* subfolders
   * const parser = new ImportParser(parserConfig);
   * ```
   */
  public getParserConfig(): Config {
    return {
      ...this.getConfig(),
      groups: this.getGroups(),
    };
  }

  /**
   * Forces a reload of the configuration from VS Code settings
   * Manually triggers configuration loading, useful when settings may have changed externally
   * @example
   * ```typescript
   * // Force reload after manual settings file changes
   * configManager.forceReload();
   * ```
   */
  public forceReload(): void {
    logDebug('Force reloading configuration...');
    this.loadConfiguration();
  }

  /**
   * Subscribes to configuration changes with validation
   * Registers a callback to be notified when configuration changes occur
   * The callback receives the new configuration, validation status, and any errors
   * @param callback Function called when configuration changes occur
   * @returns Disposable to unsubscribe from the event
   * @example
   * ```typescript
   * const disposable = configManager.onConfigChange((config, isValid, errors) => {
   *   if (!isValid) {
   *     console.error('Config validation failed:', errors);
   *   } else {
   *     console.log('Config updated successfully');
   *   }
   * });
   * // Later: disposable.dispose();
   * ```
   */
  public onConfigChange(callback: (config: Config, isValid: boolean, errors?: string[]) => void): vscode.Disposable {
    return this.onDidConfigChange(event => {
      if (event.configKey === 'config') {
        callback(this.getConfig(), event.isValid, event.errors);
      }
    });
  }
}

export const configManager = new ConfigManager();