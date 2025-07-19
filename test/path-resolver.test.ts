import { PathResolver, PathResolverConfig } from '../src/utils/path-resolver';
import { workspace, Uri } from 'vscode';

// Mock VS Code workspace
jest.mock('vscode', () => ({
    workspace: {
        getWorkspaceFolder: jest.fn(),
        fs: {
            readFile: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path, toString: () => path })),
        joinPath: jest.fn((uri: any, ...segments: string[]) => {
            const parts = uri.fsPath.split('/').concat(segments);
            const resolved = parts.reduce((acc: string[], part) => {
                if (part === '..') {
                    acc.pop();
                } else if (part !== '.') {
                    acc.push(part);
                }
                return acc;
            }, []);
            return { fsPath: resolved.join('/'), toString: () => resolved.join('/') };
        })
    }
}));

describe('PathResolver', () => {
    describe('Path conversion', () => {
        it('should convert relative paths to absolute with aliases', async () => {
            const resolver = new PathResolver({
                mode: 'absolute',
                preferredAliases: ['@components', '@utils']
            });

            // Mock document
            const mockDocument = {
                uri: { fsPath: '/project/src/pages/Home.tsx' }
            } as any;

            // Mock workspace folder
            (workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
                uri: { fsPath: '/project' }
            });

            // Mock config file read
            const mockTsConfig = {
                compilerOptions: {
                    baseUrl: './src',
                    paths: {
                        '@components/*': ['components/*'],
                        '@utils/*': ['utils/*']
                    }
                }
            };

            (workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from(JSON.stringify(mockTsConfig))
            );

            const result = await resolver.convertImportPath(
                '../components/Button',
                mockDocument
            );

            expect(result).toBe('@components/Button');
        });

        it('should convert absolute aliases to relative paths', async () => {
            const resolver = new PathResolver({
                mode: 'relative',
                preferredAliases: []
            });

            // Mock document
            const mockDocument = {
                uri: { fsPath: '/project/src/pages/Home.tsx' }
            } as any;

            // Mock workspace folder
            (workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
                uri: { fsPath: '/project' }
            });

            // Mock config file read
            const mockTsConfig = {
                compilerOptions: {
                    baseUrl: './src',
                    paths: {
                        '@components/*': ['components/*']
                    }
                }
            };

            (workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from(JSON.stringify(mockTsConfig))
            );

            const result = await resolver.convertImportPath(
                '@components/Button',
                mockDocument
            );

            expect(result).toBe('../components/Button');
        });
    });
});