// Mock vscode module before importing
const mockOutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  clear: jest.fn(),
};

const mockGetConfiguration = jest.fn().mockReturnValue({
  get: jest.fn().mockReturnValue(true) // Enable debug mode for testing
});

jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn(() => mockOutputChannel)
  },
  workspace: {
    getConfiguration: mockGetConfiguration
  }
}), { virtual: true });

import * as log from '../../src/utils/log';

describe('Log - UI Interruption Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('logDebug should not call OUTPUT_CHANNEL.show() - UI interruption fixed', () => {
    // This test verifies that debug messages don't interrupt the user
    log.logDebug('Test debug message');

    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG] Test debug message')
    );
    
    // The fix: show() should NOT be called for debug messages
    expect(mockOutputChannel.show).not.toHaveBeenCalled();
  });

  test('logError should call OUTPUT_CHANNEL.show(true) with preserveFocus - limited interruption', () => {
    // Errors should still show the output channel but with preserveFocus=true
    log.logError('Test error message');

    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('[ERROR] Test error message')
    );
    
    // Errors should show output channel but without stealing focus
    expect(mockOutputChannel.show).toHaveBeenCalledWith(true);
  });

  test('showOutputChannel should allow manual channel display', () => {
    // Users can manually show the output channel when they want to see logs
    log.showOutputChannel();

    expect(mockOutputChannel.show).toHaveBeenCalledWith();
  });


  test('logDebug with debug mode disabled should not log anything', () => {
    // Mock debug mode as disabled
    mockGetConfiguration.mockReturnValueOnce({
      get: jest.fn().mockReturnValue(false)
    });

    log.logDebug('This should not be logged');

    expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    expect(mockOutputChannel.show).not.toHaveBeenCalled();
  });

  test('logDebug should format objects correctly', () => {
    const testObject = { key: 'value', nested: { prop: 123 } };
    log.logDebug('Test with object', testObject);

    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[DEBUG\] Test with object\n\{[\s\S]*"key": "value"[\s\S]*\}/)
    );
  });

  test('logError should format Error objects with stack trace', () => {
    const testError = new Error('Test error');
    testError.stack = 'Error: Test error\n    at test.js:1:1';
    
    log.logError('Error occurred', testError);

    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Test error\nError: Test error\n    at test.js:1:1')
    );
  });

  test('multiple debug calls should not cause UI interruption spam', () => {
    // Simulate multiple debug calls that could spam the user
    for (let i = 0; i < 10; i++) {
      log.logDebug(`Debug message ${i}`);
    }

    expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(10);
    // The key fix: show() should never be called for debug messages
    expect(mockOutputChannel.show).not.toHaveBeenCalled();
  });

  test('demonstrate the old vs new behavior', () => {
    console.log('OLD BEHAVIOR (problematic):');
    console.log('- logDebug() called OUTPUT_CHANNEL.show() every time');
    console.log('- This interrupted user workflow constantly');
    console.log('- Multiple debug calls = multiple UI interruptions');
    
    console.log('\nNEW BEHAVIOR (fixed):');
    console.log('- logDebug() only writes to channel, no show()');
    console.log('- logError() calls show(true) with preserveFocus');
    console.log('- User can manually call showOutputChannel() when needed');
    console.log('- No more UI interruption spam!');

    // Demonstrate the fix
    log.logDebug('This debug message will NOT interrupt the user');
    log.logError('This error will show output but preserve focus');
    
    expect(mockOutputChannel.show).toHaveBeenCalledTimes(1); // Only for error
    expect(mockOutputChannel.show).toHaveBeenCalledWith(true); // With preserveFocus
  });
});