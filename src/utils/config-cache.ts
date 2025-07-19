/**
 * Lightweight config cache that still reads from VS Code but caches validation
 */

import { Config } from '../types';
import { cloneDeepWith } from 'lodash';

export class ConfigCache {
    private lastConfigString = '';
    private lastValidatedConfig: Config | null = null;
    private lastValidationResult: { isValid: boolean; errors: string[] } | null = null;

    /**
     * Get config with cached validation
     */
    getConfig(
        loadFn: () => Config,
        validateFn: (config: Config) => { isValid: boolean; errors: string[] }
    ): { config: Config; validation: { isValid: boolean; errors: string[] } } {
        const config = loadFn();
        const configString = this.serializeConfig(config);

        // If config hasn't changed, return cached validation
        if (configString === this.lastConfigString && this.lastValidatedConfig && this.lastValidationResult) {
            return {
                config: this.deepClone(this.lastValidatedConfig),
                validation: { ...this.lastValidationResult }
            };
        }

        // Config changed, revalidate
        const validation = validateFn(config);
        
        // Cache the results
        this.lastConfigString = configString;
        this.lastValidatedConfig = this.deepClone(config);
        this.lastValidationResult = { ...validation };

        return {
            config: this.deepClone(config),
            validation: { ...validation }
        };
    }

    /**
     * Clear cache
     */
    clear(): void {
        this.lastConfigString = '';
        this.lastValidatedConfig = null;
        this.lastValidationResult = null;
    }

    /**
     * Serialize config with proper RegExp handling for cache comparison
     */
    private serializeConfig(config: Config): string {
        return JSON.stringify(config, (key, value) => {
            if (value instanceof RegExp) {
                return `__REGEXP__${value.source}__FLAGS__${value.flags}`;
            }
            return value;
        });
    }

    /**
     * Deep clone config with RegExp handling
     */
    private deepClone(config: Config): Config {
        return cloneDeepWith(config, (value) => {
            if (value instanceof RegExp) {
                return new RegExp(value.source, value.flags);
            }
            return undefined;
        });
    }
}