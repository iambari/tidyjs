import { GroupMatcher } from '../../src/utils/group-matcher';
import { Config } from '../../src/types';

describe('GroupMatcher Priority System', () => {
    let groups: Config['groups'];

    beforeEach(() => {
        groups = [
            {
                name: 'Other',
                match: /.*/, // Matches everything
                order: 1,
                priority: 0, // Low priority
                default: false
            },
            {
                name: 'React',
                match: /^react/, // Matches react imports
                order: 2,
                priority: 10, // High priority
                default: false
            },
            {
                name: 'External',
                match: /^[^@./]/, // Matches external packages
                order: 3,
                priority: 5, // Medium priority
                default: false
            },
            {
                name: 'Default',
                order: 999,
                default: true
            }
        ];
    });

    it('should respect priority over order when multiple groups match', () => {
        const matcher = new GroupMatcher(groups);

        // 'react' matches both 'Other' (priority 0, order 1) and 'React' (priority 10, order 2)
        // Should choose 'React' because of higher priority despite higher order
        const result = matcher.getGroup('react');
        expect(result).toBe('React');
    });

    it('should use order as tie-breaker when priorities are equal', () => {
        // Create groups with same priority but different orders
        const sameArityGroups: Config['groups'] = [
            {
                name: 'Group1',
                match: /^react/,
                order: 5,
                priority: 10,
                default: false
            },
            {
                name: 'Group2', 
                match: /^react/,
                order: 3,
                priority: 10, // Same priority as Group1
                default: false
            },
            {
                name: 'Default',
                order: 999,
                default: true
            }
        ];

        const matcher = new GroupMatcher(sameArityGroups);
        
        // Should choose Group2 because it has lower order (3 vs 5)
        const result = matcher.getGroup('react');
        expect(result).toBe('Group2');
    });

    it('should fall back to default group when no patterns match', () => {
        // Create a setup where no patterns should match
        const groupsWithSpecificPatterns: Config['groups'] = [
            {
                name: 'React',
                match: /^react/,
                order: 1,
                priority: 10,
                default: false
            },
            {
                name: 'External',
                match: /^[a-z][^@]/,
                order: 2,
                priority: 5,
                default: false
            },
            {
                name: 'Default',
                order: 999,
                default: true
            }
        ];
        
        const matcher = new GroupMatcher(groupsWithSpecificPatterns);
        
        // Use a string that won't match any of our specific patterns
        const result = matcher.getGroup('@internal/some-module');
        expect(result).toBe('Default');
    });

    it('should handle multiple overlapping patterns correctly', () => {
        const overlappingGroups: Config['groups'] = [
            {
                name: 'AllLibs',
                match: /^[^@./]/, // Matches all external libraries
                order: 1,
                priority: 1,
                default: false
            },
            {
                name: 'ReactEcosystem',
                match: /^react/, // Matches react specifically
                order: 2,
                priority: 5,
                default: false
            },
            {
                name: 'ReactDom',
                match: /^react-dom/, // Matches react-dom specifically
                order: 3,
                priority: 10, // Highest priority
                default: false
            },
            {
                name: 'Default',
                order: 999,
                default: true
            }
        ];

        const matcher = new GroupMatcher(overlappingGroups);

        // Test react-dom: matches all three patterns but should go to ReactDom (highest priority)
        expect(matcher.getGroup('react-dom')).toBe('ReactDom');
        
        // Test react: matches AllLibs and ReactEcosystem, should go to ReactEcosystem (priority 5 > 1)
        expect(matcher.getGroup('react')).toBe('ReactEcosystem');
        
        // Test lodash: only matches AllLibs
        expect(matcher.getGroup('lodash')).toBe('AllLibs');
    });

    it('should cache results correctly after priority resolution', () => {
        const matcher = new GroupMatcher(groups);

        // First call should calculate and cache
        const result1 = matcher.getGroup('react');
        expect(result1).toBe('React');

        // Second call should use cache and return same result
        const result2 = matcher.getGroup('react');
        expect(result2).toBe('React');

        // Verify cache is working by checking stats
        const stats = matcher.getCacheStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
    });

    it('should handle groups without priority (defaulting to 0)', () => {
        const groupsWithoutPriority: Config['groups'] = [
            {
                name: 'NoPriority',
                match: /^react/,
                order: 1,
                // No priority specified - should default to 0
                default: false
            },
            {
                name: 'WithPriority',
                match: /^react/,
                order: 2,
                priority: 5,
                default: false
            },
            {
                name: 'Default',
                order: 999,
                default: true
            }
        ];

        const matcher = new GroupMatcher(groupsWithoutPriority);
        
        // Should choose WithPriority (priority 5) over NoPriority (default priority 0)
        const result = matcher.getGroup('react');
        expect(result).toBe('WithPriority');
    });

    it('should clear cache when disposed', () => {
        const matcher = new GroupMatcher(groups);
        
        // Add some cache entries
        matcher.getGroup('react');
        matcher.getGroup('lodash');
        
        let stats = matcher.getCacheStats();
        expect(stats.size).toBe(2);
        
        // Dispose should clear cache
        matcher.dispose();
        
        stats = matcher.getCacheStats();
        expect(stats.size).toBe(0);
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
    });
});
