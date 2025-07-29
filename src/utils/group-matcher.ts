/**
 * Optimized group matcher with compiled regex cache and LRU eviction
 */

import { Config } from '../types';
import { logDebug } from './log';

export class GroupMatcher {
    private static readonly MAX_CACHE_SIZE = 500; // Reasonable limit for group cache
    private groupCache = new Map<string, string>();
    private compiledPatterns: { name: string; pattern: RegExp; priority: number; order: number }[] = [];
    private defaultGroup: string;
    private cacheHits = 0;
    private cacheMisses = 0;

    constructor(groups: Config['groups']) {
        // Pre-compile all patterns and store them with priority and order information
        // DO NOT sort here - we need to evaluate all matches and choose by priority
        this.compiledPatterns = groups
            .filter(g => g.match)
            .map(g => ({ 
                name: g.name, 
                pattern: g.match!, 
                priority: g.priority || 0,
                order: g.order 
            }));

        const defaultGroupObj = groups.find(g => g.default);
        this.defaultGroup = defaultGroupObj ? defaultGroupObj.name : 'Other';
    }

    /**
     * Get group for import source with LRU caching
     * Now properly respects priority: higher priority groups win over lower priority ones
     */
    getGroup(source: string): string {
        // Check cache first
        const cached = this.groupCache.get(source);
        if (cached) {
            this.cacheHits++;
            // LRU: Move to end by re-inserting
            this.groupCache.delete(source);
            this.groupCache.set(source, cached);
            return cached;
        }

        this.cacheMisses++;

        // Collect ALL groups that match the source
        const allMatches: { name: string; priority: number; order: number }[] = [];
        
        for (const { name, pattern, priority, order } of this.compiledPatterns) {
            if (pattern.test(source)) {
                allMatches.push({ name, priority, order });
            }
        }

        let matchedGroup = this.defaultGroup;
        
        if (allMatches.length > 0) {
            // Sort by priority (DESC), then by order (ASC) for tie-breaking
            allMatches.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority; // Higher priority first
                }
                return a.order - b.order; // Lower order first (as tie-breaker)
            });
            
            matchedGroup = allMatches[0].name;
            
            // Log debug info when priority matters (multiple matches with different priorities)
            if (allMatches.length > 1) {
                const priorities = allMatches.map(m => `${m.name}(p:${m.priority},o:${m.order})`);
                logDebug(`Multiple group matches for "${source}": [${priorities.join(', ')}] → chose "${matchedGroup}"`);
            }
        }

        // Add to cache with LRU eviction
        this.addToCache(source, matchedGroup);
        return matchedGroup;
    }

    /**
     * Add entry to cache with LRU eviction when size limit is reached
     */
    private addToCache(source: string, group: string): void {
        // Evict oldest entries if cache is at capacity
        if (this.groupCache.size >= GroupMatcher.MAX_CACHE_SIZE) {
            const entriesToEvict = Math.max(1, Math.floor(GroupMatcher.MAX_CACHE_SIZE * 0.2)); // Evict 20%
            const keysToDelete = Array.from(this.groupCache.keys()).slice(0, entriesToEvict);
            
            for (const key of keysToDelete) {
                this.groupCache.delete(key);
            }

            logDebug(`GroupMatcher cache evicted ${entriesToEvict} entries. Cache size: ${this.groupCache.size}`);
        }

        this.groupCache.set(source, group);
    }

    /**
     * Clear cache (useful when configuration changes)
     */
    clearCache(): void {
        this.groupCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        logDebug('GroupMatcher cache cleared');
    }

    /**
     * Get cache statistics with accurate hit rate
     */
    getCacheStats(): { size: number; maxSize: number; hitRate: number; hits: number; misses: number } {
        const totalRequests = this.cacheHits + this.cacheMisses;
        return {
            size: this.groupCache.size,
            maxSize: GroupMatcher.MAX_CACHE_SIZE,
            hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
            hits: this.cacheHits,
            misses: this.cacheMisses
        };
    }

    /**
     * Dispose of the GroupMatcher and clean up resources
     */
    dispose(): void {
        this.clearCache();
        this.compiledPatterns = [];
        logDebug('GroupMatcher disposed');
    }

    /**
     * Log cache statistics for debugging purposes
     */
    logCacheStats(): void {
        const stats = this.getCacheStats();
        logDebug(`GroupMatcher cache stats: size=${stats.size}/${stats.maxSize}, hitRate=${(stats.hitRate * 100).toFixed(1)}%, hits=${stats.hits}, misses=${stats.misses}`);
    }
}
