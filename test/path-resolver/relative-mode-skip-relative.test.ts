import type { TextDocument } from 'vscode';
import { PathResolver } from '../../src/utils/path-resolver';

jest.mock('../../src/utils/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
}));

describe('PathResolver - relative mode guards', () => {
    it('should not attempt to resolve already-relative imports', async () => {
        const resolver = new PathResolver({ mode: 'relative' });
        const loadSpy = jest.spyOn<any, any>(resolver as any, 'loadPathMappings');

        const mockDocument = {
            uri: { fsPath: '/workspace/packages/ds/src/components/foo.ts' }
        } as unknown as TextDocument;

        const result = await resolver.convertImportPath('../..', mockDocument);

        expect(result).toBeNull();
        expect(loadSpy).not.toHaveBeenCalled();
    });
});
