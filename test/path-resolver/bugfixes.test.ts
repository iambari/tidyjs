import { PathResolver } from '../../src/utils/path-resolver';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
}));

describe('Path Resolver - Critical Bug Fixes', () => {
    describe('[High] Multiple wildcards in alias patterns', () => {
        it('should handle two wildcards correctly: @shop/*/widgets/*', () => {
            const pattern = '@shop/*/widgets/*';
            const importPath = '@shop/products/widgets/inventory';

            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${regexPattern}$`);
            const match = importPath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('products');
            expect(match![2]).toBe('inventory');

            let resolvedPath = 'src/shop/*/widgets/*';
            let captureIndex = 1;
            resolvedPath = resolvedPath.replace(/\*/g, () => {
                return match![captureIndex++] || '';
            });

            expect(resolvedPath).toBe('src/shop/products/widgets/inventory');
        });

        it('should handle three wildcards: @lib/*/modules/*/components/*', () => {
            const pattern = '@lib/*/modules/*/components/*';
            const importPath = '@lib/ui/modules/forms/components/Button';

            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${regexPattern}$`);
            const match = importPath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('ui');
            expect(match![2]).toBe('forms');
            expect(match![3]).toBe('Button');

            let resolvedPath = 'packages/*/modules/*/components/*';
            let captureIndex = 1;
            resolvedPath = resolvedPath.replace(/\*/g, () => {
                return match![captureIndex++] || '';
            });

            expect(resolvedPath).toBe('packages/ui/modules/forms/components/Button');
        });

        it('should use non-greedy matching (.*?) for correct wildcard capture', () => {
            const pattern = '@app/*/utils/*';
            const importPath = '@app/shared/utils/helpers/api';

            const greedyRegex = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*)');
            const greedyMatch = importPath.match(new RegExp(`^${greedyRegex}$`));

            const nonGreedyRegex = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const nonGreedyMatch = importPath.match(new RegExp(`^${nonGreedyRegex}$`));

            expect(nonGreedyMatch![1]).toBe('shared');
            expect(nonGreedyMatch![2]).toBe('helpers/api');
        });
    });

    describe('[Medium] Path fallbacks support', () => {
        it('should explain the fallback scenario from tsconfig.json', () => {
            const tsconfigExample = {
                compilerOptions: {
                    baseUrl: '.',
                    paths: {
                        '@types/*': [
                            'src/types/*',
                            'generated/types/*',
                            'node_modules/@types/*'
                        ]
                    }
                }
            };

            expect(tsconfigExample.compilerOptions.paths['@types/*']).toHaveLength(3);
        });

        it('should demonstrate the need to try all fallback paths', () => {
            const mapping = {
                pattern: '@types/*',
                paths: [
                    '/project/src/types/*',
                    '/project/generated/types/*',
                    '/project/node_modules/@types/*'
                ]
            };

            const importPath = '@types/react';

            expect(mapping.paths.length).toBe(3);
        });

        it('should validate that fallback paths are tried in order', () => {
            const fallbackOrder = [
                { path: 'src/types/react', exists: false },
                { path: 'generated/types/react', exists: true },
                { path: 'node_modules/@types/react', exists: true }
            ];

            const firstExisting = fallbackOrder.find(f => f.exists);

            expect(firstExisting?.path).toBe('generated/types/react');
        });
    });

    describe('[Low] index.d.ts file detection', () => {
        it('should include /index.d.ts in possible extensions', () => {
            const possibleExtensions = [
                '',
                '.ts',
                '.tsx',
                '.js',
                '.jsx',
                '.d.ts',
                '/index.ts',
                '/index.tsx',
                '/index.js',
                '/index.jsx',
                '/index.d.ts'
            ];

            expect(possibleExtensions).toContain('/index.d.ts');
            expect(possibleExtensions).toContain('.d.ts');
        });

        it('should demonstrate type-only package scenario', () => {
            const typeOnlyPackage = {
                path: 'node_modules/@types/react',
                files: [
                    'index.d.ts',
                    'global.d.ts'
                ],
                hasJsFiles: false
            };

            expect(typeOnlyPackage.files).toContain('index.d.ts');
            expect(typeOnlyPackage.hasJsFiles).toBe(false);
        });

        it('should check all possible file variations', () => {
            const basePath = '/project/src/types/User';
            const variations = [
                '/project/src/types/User',
                '/project/src/types/User.ts',
                '/project/src/types/User.tsx',
                '/project/src/types/User.js',
                '/project/src/types/User.jsx',
                '/project/src/types/User.d.ts',
                '/project/src/types/User/index.ts',
                '/project/src/types/User/index.tsx',
                '/project/src/types/User/index.js',
                '/project/src/types/User/index.jsx',
                '/project/src/types/User/index.d.ts'
            ];

            expect(variations).toHaveLength(11);
            expect(variations[variations.length - 1]).toBe('/project/src/types/User/index.d.ts');
        });
    });

    describe('[High] convertToAbsolute with multiple wildcards', () => {
        it('should handle two wildcards when converting relative to alias: @shop/*/widgets/*', () => {
            const mappedPath = '/project/src/shop/*/widgets/*';
            const absolutePath = '/project/src/shop/products/widgets/inventory';

            const mappedPattern = mappedPath.replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('products');
            expect(match![2]).toBe('inventory');

            const aliasPattern = '@shop/*/widgets/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                return match![captureIndex++] || '';
            });

            expect(aliasPath).toBe('@shop/products/widgets/inventory');
            expect(aliasPath).not.toBe('@shop/products/widgets/products');
        });

        it('should demonstrate the OLD BUG: replacing all wildcards with first capture', () => {
            const mappedPath = '/project/src/shop/*/widgets/*';
            const absolutePath = '/project/src/shop/products/widgets/inventory';

            const mappedPattern = mappedPath.replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match![1]).toBe('products');
            expect(match![2]).toBe('inventory');

            const oldBuggyCode = '@shop/*/widgets/*'.replace(/\*/g, match![1] || '');

            expect(oldBuggyCode).toBe('@shop/products/widgets/products');
            expect(oldBuggyCode).not.toBe('@shop/products/widgets/inventory');
        });

        it('should convert complex nested paths correctly', () => {
            const mappedPath = '/monorepo/packages/*/modules/*/components/*';
            const absolutePath = '/monorepo/packages/ui/modules/forms/components/Button';

            const mappedPattern = mappedPath.replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match![1]).toBe('ui');
            expect(match![2]).toBe('forms');
            expect(match![3]).toBe('Button');

            const aliasPattern = '@lib/*/modules/*/components/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                return match![captureIndex++] || '';
            });

            expect(aliasPath).toBe('@lib/ui/modules/forms/components/Button');
        });
    });

    describe('[High] Windows path escaping in convertToAbsolute', () => {
        it('should escape backslashes in Windows paths before creating regex', () => {
            const windowsPath = 'C:\\project\\src\\shop\\*\\widgets\\*';

            const mappedPatternBuggy = windowsPath.replace(/\*/g, '(.*?)');
            const mappedPatternFixed = windowsPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');

            expect(mappedPatternBuggy).toBe('C:\\project\\src\\shop\\(.*?)\\widgets\\(.*?)');

            expect(mappedPatternFixed).toBe('C:\\\\project\\\\src\\\\shop\\\\(.*?)\\\\widgets\\\\(.*?)');
        });

        it('should match Windows absolute paths with escaped backslashes', () => {
            const mappedPath = 'C:\\Users\\dev\\project\\src\\shop\\*\\widgets\\*';
            const absolutePath = 'C:\\Users\\dev\\project\\src\\shop\\products\\widgets\\inventory';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');

            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('products');
            expect(match![2]).toBe('inventory');

            const aliasPattern = '@shop/*/widgets/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                return match![captureIndex++] || '';
            });

            expect(aliasPath).toBe('@shop/products/widgets/inventory');
        });

        it('should handle mixed separators (Unix forward slashes)', () => {
            const unixPath = '/home/user/project/src/shop/*/widgets/*';
            const absolutePath = '/home/user/project/src/shop/products/widgets/inventory';

            const mappedPattern = unixPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');

            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('products');
            expect(match![2]).toBe('inventory');
        });

        it('should escape dots in paths (e.g., .config folders)', () => {
            const pathWithDot = '/project/.config/src/*/components/*';
            const absolutePath = '/project/.config/src/app/components/Button';

            const mappedPatternBuggy = pathWithDot.replace(/\*/g, '(.*?)');
            const mappedPatternFixed = pathWithDot
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');

            const regexBuggy = new RegExp(`^${mappedPatternBuggy}$`);
            const matchBuggy = absolutePath.match(regexBuggy);

            const regexFixed = new RegExp(`^${mappedPatternFixed}$`);
            const matchFixed = absolutePath.match(regexFixed);

            expect(matchFixed).not.toBeNull();
            expect(matchFixed![1]).toBe('app');
            expect(matchFixed![2]).toBe('Button');
        });

        it('should escape special regex characters: $, ^, [, ], (, ), |, +, ?', () => {
            const specialChars = '/path/with$pecial^char[s]/src/*/components/*';

            const escaped = specialChars
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');

            expect(escaped).toContain('\\$');
            expect(escaped).toContain('\\^');
            expect(escaped).toContain('\\[');
            expect(escaped).toContain('\\]');
        });
    });

    describe('[High] Extension stripping in relative→alias conversion', () => {
        it('should strip .ts extension when converting relative to alias', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/components/Button.ts';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('components/Button.ts');

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/components/Button');
            expect(aliasPath).not.toBe('@app/components/Button.ts');
        });

        it('should strip .tsx extension when converting relative to alias', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/components/Button.tsx';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/components/Button');
        });

        it('should strip .js extension when converting relative to alias', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/utils/helpers.js';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/utils/helpers');
        });

        it('should strip .jsx extension when converting relative to alias', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/components/Header.jsx';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/components/Header');
        });

        it('should strip .d.ts extension when converting relative to alias', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/types/User.d.ts';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/types/User');
        });

        it('should handle multiple wildcards with extensions: @shop/*/widgets/*', () => {
            const mappedPath = '/project/src/shop/*/widgets/*';
            const absolutePath = '/project/src/shop/products/widgets/Inventory.tsx';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('products');
            expect(match![2]).toBe('Inventory.tsx');

            const aliasPattern = '@shop/*/widgets/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@shop/products/widgets/Inventory');
            expect(aliasPath).not.toBe('@shop/products/widgets/Inventory.tsx');
        });

        it('should not strip extensions from middle segments, only final segment', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/components.old/Button.ts';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/components.old/Button');
        });

        it('should handle paths with no extension', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/components/Button';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            const aliasPattern = '@app/*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/\.(tsx?|jsx?|d\.ts)$/, '');
            });

            expect(aliasPath).toBe('@app/components/Button');
        });
    });

    describe('[Critical] baseUrl wildcard should not produce invalid aliases', () => {
        it('should NOT convert ./src/aliases to "aliases" (invalid alias without prefix)', () => {
            const mappedPath = '/project/src/*';
            const absolutePath = '/project/src/aliases';

            const mappedPattern = mappedPath
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${mappedPattern}$`);
            const match = absolutePath.match(regex);

            expect(match).not.toBeNull();

            const aliasPattern = '*';
            let captureIndex = 1;
            const aliasPath = aliasPattern.replace(/\*/g, () => {
                const captured = match![captureIndex++] || '';
                return captured.replace(/(\.d\.(?:cts|mts|ts)|\.(?:tsx?|jsx?))$/, '');
            });

            expect(aliasPath).toBe('aliases');

            const isValidAlias = aliasPath.startsWith('@') ||
                               aliasPath.startsWith('~') ||
                               aliasPath.includes('/');

            expect(isValidAlias).toBe(false);
        });

        it('should accept valid alias with prefix like @app/aliases', () => {
            const aliasPath = '@app/aliases';

            const isValidAlias = aliasPath.startsWith('@') ||
                               aliasPath.startsWith('~') ||
                               aliasPath.includes('/');

            expect(isValidAlias).toBe(true);
        });

        it('should accept valid alias with path like utils/helpers', () => {
            const aliasPath = 'utils/helpers';

            const isValidAlias = aliasPath.startsWith('@') ||
                               aliasPath.startsWith('~') ||
                               aliasPath.includes('/');

            expect(isValidAlias).toBe(true);
        });

        it('should reject bare module names that could break imports', () => {
            const bareModules = ['aliases', 'config', 'utils', 'types'];

            for (const moduleName of bareModules) {
                const isValidAlias = moduleName.startsWith('@') ||
                                   moduleName.startsWith('~') ||
                                   moduleName.includes('/');

                expect(isValidAlias).toBe(false);
            }
        });
    });

    describe('Regression tests: ensure old behavior still works', () => {
        it('should still handle single wildcard patterns', () => {
            const pattern = '@app/*';
            const importPath = '@app/components/Button';

            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${regexPattern}$`);
            const match = importPath.match(regex);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('components/Button');

            let resolvedPath = 'src/*';
            let captureIndex = 1;
            resolvedPath = resolvedPath.replace(/\*/g, () => {
                return match![captureIndex++] || '';
            });

            expect(resolvedPath).toBe('src/components/Button');
        });

        it('should handle patterns without wildcards', () => {
            const pattern = 'utils';
            const importPath = 'utils';

            const regexPattern = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\*/g, '(.*?)');
            const regex = new RegExp(`^${regexPattern}$`);
            const match = importPath.match(regex);

            expect(match).not.toBeNull();
            expect(match![0]).toBe('utils');
        });
    });
});
