import { Config } from '../types';
import vscode from 'vscode';
import { logDebug, logError } from './log';
import { cloneDeepWith, difference, uniq } from 'lodash';
import { ConfigCache } from './config-cache';

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
    indent: 4,
    removeUnusedImports: false,
    removeMissingModules: false,
    singleQuote: true,
    bracketSpacing: true,
  },
  excludedFolders: [],
};

class ConfigManager {
  private subfolders = new Map<string, Config['groups'][0]>();
  private configCache = new ConfigCache();


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
   * Automatically computes and assigns orders to groups, handling collisions intelligently
   * Groups with explicit orders keep their values (unless there are collisions)
   * Groups without orders get auto-assigned the next available slot
   * @param groups The array of groups to process
   * @returns Array of groups with computed orders, sorted by order
   */
  private computeAutoOrder(groups: Config['groups']): Config['groups'] {
    const usedOrders = new Set<number>();
    const withOrders: Config['groups'] = [];
    const withoutOrders: Config['groups'] = [];

    // Separate groups with explicit orders from those without
    for (const grp of groups) {
      if (typeof grp.order === 'number' && Number.isInteger(grp.order) && grp.order >= 0) {
        // Warn about unreasonably high order values
        if (grp.order > 1000) {
          logDebug(`High order value detected: ${grp.order} for group "${grp.name}". Consider using lower values.`);
        }
        withOrders.push({ ...grp, originalOrder: grp.order } as Config['groups'][0] & { originalOrder: number });
      } else {
        withoutOrders.push({ ...grp });
      }
    }

    // Process groups with explicit orders, resolving collisions
    for (const item of withOrders) {
      const typedItem = item as Config['groups'][0] & { originalOrder: number };
      let desired = typedItem.originalOrder;

      // If desired order is already taken, find next available slot
      while (usedOrders.has(desired)) {
        desired++;
      }

      // Reserve this order and assign it
      usedOrders.add(desired);
      item.order = desired;

      // Log if we had to adjust the order due to collision
      if (desired !== typedItem.originalOrder) {
        logDebug(`Group "${item.name}" order adjusted from ${typedItem.originalOrder} to ${desired} due to collision.`);
      }
    }

    // Assign orders to groups without explicit orders
    let candidate = 0;
    for (const item of withoutOrders) {
      // Find next available order starting from 0
      while (usedOrders.has(candidate)) {
        candidate++;
      }
      
      usedOrders.add(candidate);
      item.order = candidate;
      candidate++;
    }

    // Combine and sort by order
    const allResolved = [...withOrders, ...withoutOrders];
    allResolved.sort((a, b) => a.order - b.order);

    return allResolved;
  }

  /**
   * Validates the configuration and returns validation errors
   * Checks for:
   * - Exactly one default group
   * - No duplicate group names (order collisions are now auto-resolved)
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

    // Check for duplicate group names
    const names = config.groups.map(g => g.name);
    const uniqueNames = uniq(names);
    if (names.length !== uniqueNames.length) {
      const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
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
   * Reads directly from VS Code settings each time to ensure synchronization
   * @returns The current configuration object
   * @example
   * ```typescript
   * const config = configManager.getConfig();
   * console.log(config.debug); // false
   * console.log(config.groups.length); // Number of base groups
   * ```
   */
  public getConfig(): Config {
    const { config } = this.configCache.getConfig(
      () => this.loadConfiguration(),
      (c) => this.validateConfiguration(c)
    );
    return config;
  }

  /**
   * Validates the current configuration
   * Reads configuration and checks for validation errors
   * @returns Validation result with status and errors
   * @example
   * ```typescript
   * const validation = configManager.validateCurrentConfiguration();
   * if (!validation.isValid) {
   *   console.error('Config errors:', validation.errors);
   * }
   * ```
   */
  public validateCurrentConfiguration(): { isValid: boolean; errors: string[] } {
    const { validation } = this.configCache.getConfig(
      () => this.loadConfiguration(),
      (c) => this.validateConfiguration(c)
    );
    return validation;
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
    const config = this.getConfig();
    const baseGroups = config.groups.map(g => ({
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
   * Reads all TidyJS settings from VS Code configuration and returns the config
   * @returns The loaded configuration
   */
  private loadConfiguration(): Config {
    const vsConfig = vscode.workspace.getConfiguration('tidyjs');
    
    try {
      const config = this.deepCloneConfig(DEFAULT_CONFIG);
      const customGroupsSetting = vsConfig.get<{
        name: string;
        match?: string;
        order: number;
        isDefault?: boolean;
      }[]>('groups');

      if (customGroupsSetting !== undefined) {
        const rawGroups = customGroupsSetting.map(group => {
          return {
            name: group.name,
            match: group.match ? this.parseRegexString(group.match) : undefined,
            order: group.order,
            isDefault: !!group.isDefault,
          };
        });
        
        // Apply auto-order computation to resolve collisions and assign missing orders
        config.groups = this.computeAutoOrder(rawGroups);
      }
      const formatSettings = {
        indent: vsConfig.get<number>('format.indent'),
        removeUnusedImports: vsConfig.get<boolean>('format.removeUnusedImports'),
        removeMissingModules: vsConfig.get<boolean>('format.removeMissingModules'),
        singleQuote: vsConfig.get<boolean>('format.singleQuote'),
        bracketSpacing: vsConfig.get<boolean>('format.bracketSpacing'),
      };

      for (const [key, value] of Object.entries(formatSettings)) {
        if (value !== undefined) {
          (config.format as Record<string, unknown>)[key] = value;
        }
      }
      const importOrder = vsConfig.get<Config['importOrder']>('importOrder');
      if (importOrder) {
        config.importOrder = { ...importOrder };
      }
      const debug = vsConfig.get<boolean>('debug');
      if (debug !== undefined) {
        config.debug = debug;
      }
      const excludedFolders = vsConfig.get<string[]>('excludedFolders');
      if (excludedFolders !== undefined) {
        config.excludedFolders = [...excludedFolders];
      }
      return config;

    } catch (error) {
      logError('Error loading configuration:', error);
      // Return default config on error
      return this.deepCloneConfig(DEFAULT_CONFIG);
    }
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

}

export const configManager = new ConfigManager();