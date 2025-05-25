// Test for race condition bug fix
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('Race Condition Bug Fix', () => {
  let isFormatting: boolean;
  let formatCalls: Array<{ source: string; timestamp: number }>;

  beforeEach(() => {
    isFormatting = false;
    formatCalls = [];
  });

  // Mock the formatImportsCommand behavior
  async function mockFormatImportsCommand(source: string = 'manual'): Promise<void> {
    const timestamp = Date.now();
    
    // Prevent concurrent formatting operations
    if (isFormatting) {
      console.log(`Skipping ${source} format operation - already formatting`);
      return;
    }

    formatCalls.push({ source, timestamp });
    isFormatting = true;

    try {
      // Simulate formatting work
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log(`Successfully completed ${source} format operation`);
    } finally {
      isFormatting = false;
    }
  }

  // Mock debouncer
  function createDebouncer<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  }

  test('should prevent race condition between manual and auto-save formatting', async () => {
    const debouncedManualFormat = createDebouncer(() => mockFormatImportsCommand('manual'), 400);
    const debouncedAutoSaveFormat = createDebouncer(() => mockFormatImportsCommand('auto-save'), 400);

    // Trigger both operations rapidly (simulating the race condition scenario)
    debouncedManualFormat();
    setTimeout(() => debouncedAutoSaveFormat(), 100);

    // Wait for debouncing and execution to complete
    await new Promise(resolve => setTimeout(resolve, 600));

    // Only one format operation should have executed due to debouncing
    expect(formatCalls.length).toBe(1);
  });

  test('should handle concurrent format attempts correctly', async () => {
    // Start first format operation
    const firstFormat = mockFormatImportsCommand('manual');
    
    // Try to start second format operation immediately
    const secondFormat = mockFormatImportsCommand('auto-save');
    
    await Promise.all([firstFormat, secondFormat]);

    // Should have only executed the first operation
    expect(formatCalls.length).toBe(1);
    expect(formatCalls[0].source).toBe('manual');
  });

  test('should allow sequential format operations', async () => {
    // Execute first format operation
    await mockFormatImportsCommand('manual');
    
    // Execute second format operation after first completes
    await mockFormatImportsCommand('auto-save');

    // Both operations should have executed
    expect(formatCalls.length).toBe(2);
    expect(formatCalls[0].source).toBe('manual');
    expect(formatCalls[1].source).toBe('auto-save');
  });

  test('should maintain proper timing between operations', async () => {
    // Execute first format operation
    await mockFormatImportsCommand('manual');
    const firstTimestamp = formatCalls[0].timestamp;
    
    // Execute second format operation
    await mockFormatImportsCommand('auto-save');
    const secondTimestamp = formatCalls[1].timestamp;

    // Second operation should start after first completes (at least 50ms apart)
    expect(secondTimestamp - firstTimestamp).toBeGreaterThanOrEqual(50);
  });
});