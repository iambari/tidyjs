import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigLoader } from '../../src/utils/configLoader';
import { TidyJSConfigFile } from '../../src/types';

// Mock vscode
jest.mock('vscode');

describe('ConfigLoader', () => {
    const testDir = path.join(__dirname, 'test-configs');
    
    beforeAll(() => {
        // Create test directory structure
        fs.mkdirSync(testDir, { recursive: true });
        fs.mkdirSync(path.join(testDir, 'subfolder'), { recursive: true });
        fs.mkdirSync(path.join(testDir, 'subfolder', 'deep'), { recursive: true });
    });

    afterAll(() => {
        // Clean up test directory
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    describe('findNearestConfigFile', () => {
        it('should find config file in the same directory', async () => {
            const configPath = path.join(testDir, 'tidyjs.json');
            const testFilePath = path.join(testDir, 'test.ts');
            
            // Create config file
            fs.writeFileSync(configPath, JSON.stringify({ debug: true }));
            
            const mockUri = { fsPath: testFilePath } as vscode.Uri;
            const result = await ConfigLoader.findNearestConfigFile(mockUri);
            
            expect(result).toBe(configPath);
            
            // Clean up
            fs.unlinkSync(configPath);
        });

        it('should prefer .tidyjsrc over tidyjs.json in same directory', async () => {
            const tidyjsrcPath = path.join(testDir, '.tidyjsrc');
            const tidyjsPath = path.join(testDir, 'tidyjs.json');
            const testFilePath = path.join(testDir, 'test.ts');
            
            // Create both config files
            fs.writeFileSync(tidyjsrcPath, JSON.stringify({ format: { indent: 2 } }));
            fs.writeFileSync(tidyjsPath, JSON.stringify({ format: { indent: 4 } }));
            
            const mockUri = { fsPath: testFilePath } as vscode.Uri;
            const result = await ConfigLoader.findNearestConfigFile(mockUri);
            
            expect(result).toBe(tidyjsrcPath);
            
            // Clean up
            fs.unlinkSync(tidyjsrcPath);
            fs.unlinkSync(tidyjsPath);
        });

        it('should find config file in parent directory', async () => {
            const configPath = path.join(testDir, 'tidyjs.json');
            const testFilePath = path.join(testDir, 'subfolder', 'test.ts');
            
            // Create config file in parent
            fs.writeFileSync(configPath, JSON.stringify({ debug: true }));
            
            const mockUri = { fsPath: testFilePath } as vscode.Uri;
            const result = await ConfigLoader.findNearestConfigFile(mockUri);
            
            expect(result).toBe(configPath);
            
            // Clean up
            fs.unlinkSync(configPath);
        });

        it('should find nearest config file when multiple exist', async () => {
            const parentConfigPath = path.join(testDir, 'tidyjs.json');
            const subfolderConfigPath = path.join(testDir, 'subfolder', 'tidyjs.json');
            const testFilePath = path.join(testDir, 'subfolder', 'deep', 'test.ts');
            
            // Create config files
            fs.writeFileSync(parentConfigPath, JSON.stringify({ debug: false }));
            fs.writeFileSync(subfolderConfigPath, JSON.stringify({ debug: true }));
            
            const mockUri = { fsPath: testFilePath } as vscode.Uri;
            const result = await ConfigLoader.findNearestConfigFile(mockUri);
            
            expect(result).toBe(subfolderConfigPath);
            
            // Clean up
            fs.unlinkSync(parentConfigPath);
            fs.unlinkSync(subfolderConfigPath);
        });

        it('should return null when no config file exists', async () => {
            const testFilePath = path.join(testDir, 'subfolder', 'test.ts');
            
            const mockUri = { fsPath: testFilePath } as vscode.Uri;
            const result = await ConfigLoader.findNearestConfigFile(mockUri);
            
            expect(result).toBeNull();
        });
    });

    describe('loadConfigFile', () => {
        it('should load and parse config file', async () => {
            const configPath = path.join(testDir, 'tidyjs.json');
            const config: TidyJSConfigFile = {
                groups: [
                    { name: 'React', match: '^react', order: 1 }
                ],
                format: {
                    singleQuote: true,
                    indent: 2
                }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(config));
            
            const result = await ConfigLoader.loadConfigFile(configPath);
            
            expect(result).toEqual(config);
            
            // Clean up
            fs.unlinkSync(configPath);
        });

        it('should handle extends property', async () => {
            const baseConfigPath = path.join(testDir, 'base.config.json');
            const configPath = path.join(testDir, 'tidyjs.json');
            
            const baseConfig: TidyJSConfigFile = {
                format: {
                    singleQuote: true,
                    indent: 4
                }
            };
            
            const config: TidyJSConfigFile = {
                extends: './base.config.json',
                format: {
                    indent: 2
                }
            };
            
            fs.writeFileSync(baseConfigPath, JSON.stringify(baseConfig));
            fs.writeFileSync(configPath, JSON.stringify(config));
            
            const result = await ConfigLoader.loadConfigFile(configPath);
            
            expect(result).toEqual({
                extends: './base.config.json',
                debug: true,
                format: {
                    singleQuote: true,
                    indent: 2
                }
            });
            
            // Clean up
            fs.unlinkSync(baseConfigPath);
            fs.unlinkSync(configPath);
        });

        it('should return null for invalid JSON', async () => {
            const configPath = path.join(testDir, 'tidyjs.json');
            
            fs.writeFileSync(configPath, 'invalid json');
            
            const result = await ConfigLoader.loadConfigFile(configPath);
            
            expect(result).toBeNull();
            
            // Clean up
            fs.unlinkSync(configPath);
        });
    });

    describe('mergeConfigs', () => {
        it('should merge configurations correctly', () => {
            const base: TidyJSConfigFile = {
                groups: [
                    { name: 'Base', match: '^base', order: 1 }
                ],
                format: {
                    singleQuote: true,
                    indent: 4,
                    removeUnusedImports: false
                }
            };
            
            const override: TidyJSConfigFile = {
                format: {
                    indent: 2
                }
            };
            
            const result = ConfigLoader.mergeConfigs(base, override);
            
            expect(result).toEqual({
                debug: true,
                groups: [
                    { name: 'Base', match: '^base', order: 1 }
                ],
                format: {
                    singleQuote: true,
                    indent: 2,
                    removeUnusedImports: false
                }
            });
        });

        it('should replace arrays entirely', () => {
            const base: TidyJSConfigFile = {
                groups: [
                    { name: 'Base', match: '^base', order: 1 }
                ],
                excludedFolders: ['node_modules', 'dist']
            };
            
            const override: TidyJSConfigFile = {
                groups: [
                    { name: 'Override', match: '^override', order: 1 }
                ],
                excludedFolders: ['build']
            };
            
            const result = ConfigLoader.mergeConfigs(base, override);
            
            expect(result.groups).toEqual([
                { name: 'Override', match: '^override', order: 1 }
            ]);
            expect(result.excludedFolders).toEqual(['build']);
        });
    });
});