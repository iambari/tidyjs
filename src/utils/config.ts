import { Config } from '../types';
import vscode from 'vscode';
import { logDebug, logError } from './log';
import { cloneDeepWith, uniq } from 'lodash';
import { ConfigCache } from './config-cache';
import { ConfigLoader } from './configLoader';

const DEFAULT_CONFIG: Config = {
  debug: false,
  groups: [
    {
      name: 'Other',
      order: 0,
      default: true,
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
  pathResolution: {
    enabled: false,
    mode: 'relative',
    preferredAliases: [],
  },
  excludedFolders: [],
};

class ConfigManager {
  private subfolders = new Map<string, Config['groups'][0]>();
  private configCache = new ConfigCache();
  private documentConfigCache = new Map<string, Config>();

  /**
   * Initializes the ConfigManager with VS Code context
   * Sets up configuration change listeners and initializes ConfigLoader
   * @param context The VS Code extension context
   */
  public initialize(context: vscode.ExtensionContext): void {
    // Initialize ConfigLoader with file watcher
    ConfigLoader.initialize(context);
    
    // Listen for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('tidyjs')) {
          this.clearDocumentCache();
          logDebug('Configuration changed, clearing caches');
        }
      })
    );
    
    logDebug('ConfigManager initialized');
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
   * - Valid regex patterns in group match properties
   * - Valid sortOrder configurations
   * @param config The configuration to validate
   * @returns Object containing validation status and error messages
   */
  public validateConfiguration(config: Config): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const defaultGroups = config.groups.filter(group => group.default === true);
    
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

    // Validate regex patterns
    const regexErrors = this.validateRegexPatterns(config.groups);
    errors.push(...regexErrors);

    // Validate sortOrder configurations
    const sortOrderErrors = this.validateSortOrders(config.groups);
    errors.push(...sortOrderErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates regex patterns in group configurations
   * Checks that all match patterns are valid RegExp objects or can be created from strings
   * @param groups Array of groups to validate
   * @returns Array of validation error messages
   */
  private validateRegexPatterns(groups: Config['groups']): string[] {
    const errors: string[] = [];
    
    for (const group of groups) {
      // Check if group has originalMatchString (raw string from config)
      const groupWithOriginal = group as Config['groups'][0] & { originalMatchString?: string };
      const matchString = groupWithOriginal.originalMatchString;
      
      if (matchString !== undefined && matchString !== null) {
        const validation = this.validateRegexString(matchString);
        if (!validation.isValid) {
          errors.push(`Invalid regex pattern in group "${group.name}": ${validation.error}`);
        }
      } else if (group.match !== undefined) {
        try {
          // If it's already a RegExp, test it with a simple string
          if (group.match instanceof RegExp) {
            group.match.test('test');
          } else {
            // If it's a string, try to create a RegExp from it
            new RegExp(group.match as string);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown regex error';
          errors.push(`Invalid regex pattern in group "${group.name}": ${errorMessage}`);
        }
      }
    }
    
    return errors;
  }

  /**
   * Validates sortOrder configurations in groups
   * Checks that sortOrder is either 'alphabetic' or a valid array of strings
   * @param groups Array of groups to validate
   * @returns Array of validation error messages
   */
  private validateSortOrders(groups: Config['groups']): string[] {
    const errors: string[] = [];
    
    for (const group of groups) {
      if (group.sortOrder !== undefined) {
        if (group.sortOrder !== 'alphabetic' && !Array.isArray(group.sortOrder)) {
          errors.push(`Invalid sortOrder in group "${group.name}": must be 'alphabetic' or an array of strings`);
        } else if (Array.isArray(group.sortOrder)) {
          if (group.sortOrder.length === 0) {
            errors.push(`Invalid sortOrder in group "${group.name}": array cannot be empty`);
          } else if (!group.sortOrder.every(item => typeof item === 'string')) {
            errors.push(`Invalid sortOrder in group "${group.name}": all array items must be strings`);
          } else {
            // Check for duplicate patterns in sortOrder
            const uniquePatterns = [...new Set(group.sortOrder)];
            if (uniquePatterns.length !== group.sortOrder.length) {
              errors.push(`Invalid sortOrder in group "${group.name}": duplicate patterns found`);
            }
          }
        }
      }
    }
    
    return errors;
  }

  /**
   * Safely validates a regex string before creating a RegExp object
   * @param regexStr The regex string to validate
   * @returns Object with validation status and error message if invalid
   */
  private validateRegexString(regexStr: string): { isValid: boolean; error?: string } {
    if (!regexStr) {
      return { isValid: false, error: 'Empty regex pattern' };
    }

    try {
      if (regexStr.startsWith('/') && regexStr.length > 1) {
        const lastSlashIndex = regexStr.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          const pattern = regexStr.slice(1, lastSlashIndex);
          const flags = regexStr.slice(lastSlashIndex + 1);
          
          // Validate flags
          const validFlags = /^[gimsuy]*$/.test(flags);
          if (!validFlags) {
            return { isValid: false, error: `Invalid regex flags '${flags}'` };
          }
          
          // Test pattern creation
          new RegExp(pattern, flags);
        } else {
          new RegExp(regexStr.slice(1));
        }
      } else {
        new RegExp(regexStr);
      }
      
      return { isValid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown regex error';
      return { isValid: false, error: errorMessage };
    }
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
   * // groups might include: [External, Internal, @app/auth, @app/utils, Other]
   * groups.forEach(group => {
   *   console.log(`${group.name}: order ${group.order}, default: ${group.default}`);
   * });
   * ```
   */
  public getGroups(): Config['groups'] {
    const config = this.getConfig();
    const baseGroups = config.groups.map(g => ({
      ...g,
      default: !!g.default,
    }));

    const subfolderGroups = Array.from(this.subfolders.values());
    const combinedGroups = [...baseGroups, ...subfolderGroups];

    combinedGroups.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      if (a.default && !b.default) {return 1;}
      if (!a.default && b.default) {return -1;}

      return a.name.localeCompare(b.name);
    });

    return combinedGroups;
  }

  /**
   * Parses a RegExp string in format "/pattern/flags" or "pattern"
   * Handles both slash-delimited regex strings with flags and plain patterns
   * Now includes validation before parsing to prevent runtime errors
   * @param regexStr The regex string to parse
   * @returns Parsed RegExp object or undefined if parsing fails
   * @example
   * ```typescript
   * parseRegexString('/^@app\/(.*)/i') // Returns: /^@app\/(.*)/i
   * parseRegexString('^@app') // Returns: /^@app/
   * parseRegexString('[invalid') // Returns: undefined (logs error)
   * ```
   */
  private parseRegexString(regexStr: string): RegExp | undefined {
    if (!regexStr) {return undefined;}

    // Validate the regex string first
    const validation = this.validateRegexString(regexStr);
    if (!validation.isValid) {
      logError(`Invalid regex pattern "${regexStr}": ${validation.error}`);
      return undefined;
    }

    try {
      if (regexStr.startsWith('/') && regexStr.length > 1) {
        const lastSlashIndex = regexStr.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          const pattern = regexStr.slice(1, lastSlashIndex);
          const flags = regexStr.slice(lastSlashIndex + 1);
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
        default?: boolean;
        isDefault?: boolean; // Support deprecated property for migration
        sortOrder?: 'alphabetic' | string[];
      }[]>('groups');

      if (customGroupsSetting !== undefined) {
        const rawGroups = customGroupsSetting.map(group => {
          // Check for deprecated isDefault property
          if (group.isDefault !== undefined) {
            logError(`DEPRECATION WARNING: Group "${group.name}" uses deprecated property "isDefault". Please use "default" instead. The "isDefault" property will be removed in a future version.`);
            
            // If both are specified, default takes precedence
            if (group.default === undefined) {
              logDebug(`Auto-migrating "isDefault" to "default" for group "${group.name}"`);
            } else {
              logError(`Group "${group.name}" has both "isDefault" and "default" properties. Using "default" value and ignoring "isDefault".`);
            }
          }

          return {
            name: group.name,
            match: group.match ? this.parseRegexString(group.match) : undefined,
            order: group.order,
            default: group.default !== undefined ? !!group.default : !!group.isDefault, // Fallback to isDefault if default is not set
            sortOrder: group.sortOrder,
            originalMatchString: group.match, // Keep original string for validation
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
      
      // Path resolution settings
      const pathResolutionEnabled = vsConfig.get<boolean>('pathResolution.enabled');
      const pathResolutionMode = vsConfig.get<'relative' | 'absolute'>('pathResolution.mode');
      const pathResolutionAliases = vsConfig.get<string[]>('pathResolution.preferredAliases');
      
      if (pathResolutionEnabled !== undefined) {
        config.pathResolution = config.pathResolution || {};
        config.pathResolution.enabled = pathResolutionEnabled;
      }
      if (pathResolutionMode !== undefined) {
        config.pathResolution = config.pathResolution || {};
        config.pathResolution.mode = pathResolutionMode;
      }
      if (pathResolutionAliases !== undefined) {
        config.pathResolution = config.pathResolution || {};
        config.pathResolution.preferredAliases = [...pathResolutionAliases];
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

  /**
   * Gets configuration for a specific document, considering all config sources
   * @param document The VS Code text document
   * @returns Configuration merged from all applicable sources
   */
  public async getConfigForDocument(document: vscode.TextDocument): Promise<Config> {
    const cacheKey = document.uri.toString();
    
    // Check cache first
    const cached = this.documentConfigCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get all config sources for this document
    const sources = await ConfigLoader.getConfigForDocument(document.uri);
    
    if (sources.length === 0) {
      // No specific config found, use default
      const config = this.getConfig();
      this.documentConfigCache.set(cacheKey, config);
      return config;
    }

    // Start with default config
    let mergedConfig = this.deepCloneConfig(DEFAULT_CONFIG);

    logDebug(`Merging ${sources.length} config sources for document`);

    // Apply configurations in reverse order (most general to most specific)
    for (let i = sources.length - 1; i >= 0; i--) {
      const source = sources[i];
      logDebug(`Applying config source ${i}: ${source.type} from ${source.path}`, {
        hasFormat: !!source.config.format,
        formatConfig: source.config.format
      });
      mergedConfig = this.mergeConfigs(mergedConfig, source.config);
    }

    // Apply auto-order to the final merged groups
    if (mergedConfig.groups) {
      mergedConfig.groups = this.computeAutoOrder(mergedConfig.groups);
    }

    // Add dynamic subfolders
    const allGroups = this.getAllGroupsForConfig(mergedConfig);
    mergedConfig.groups = allGroups;

    logDebug(`Config loaded for ${document.fileName} from ${sources.length} sources`);
    logDebug(`Final merged config format:`, {
      indent: mergedConfig.format?.indent,
      singleQuote: mergedConfig.format?.singleQuote,
      bracketSpacing: mergedConfig.format?.bracketSpacing,
      removeUnusedImports: mergedConfig.format?.removeUnusedImports
    });
    
    this.documentConfigCache.set(cacheKey, mergedConfig);
    return mergedConfig;
  }

  /**
   * Merges two configurations, with the second overriding the first
   * @param base The base configuration
   * @param override The configuration to merge on top
   * @returns The merged configuration
   */
  private mergeConfigs(base: Config, override: Partial<Config>): Config {
    const result = this.deepCloneConfig(base);

    if (override.debug !== undefined) {
      result.debug = override.debug;
    }

    if (override.groups !== undefined) {
      result.groups = override.groups;
    }

    if (override.importOrder) {
      result.importOrder = { ...result.importOrder, ...override.importOrder };
    }

    if (override.format) {
      result.format = { ...result.format, ...override.format };
    }

    if (override.pathResolution) {
      result.pathResolution = { ...result.pathResolution, ...override.pathResolution };
    }

    if (override.excludedFolders !== undefined) {
      result.excludedFolders = override.excludedFolders;
    }

    return result;
  }

  /**
   * Gets all groups including dynamic subfolders for a specific config
   * @param config The base configuration
   * @returns All groups including dynamic ones
   */
  private getAllGroupsForConfig(config: Config): Config['groups'] {
    const allGroups = [...config.groups];
    
    // Add dynamic subfolder groups
    this.subfolders.forEach((group) => {
      if (!allGroups.some(g => g.name === group.name)) {
        allGroups.push(group);
      }
    });

    return allGroups;
  }

  /**
   * Clears the document configuration cache
   * Should be called when configuration changes
   */
  public clearDocumentCache(): void {
    this.documentConfigCache.clear();
    ConfigLoader.clearCache();
    logDebug('Document configuration cache cleared');
  }

}

export const configManager = new ConfigManager();
