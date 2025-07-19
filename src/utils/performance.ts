/**
 * Performance monitoring utilities for TidyJS extension
 */

export interface PerformanceMetrics {
    operation: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export class PerformanceMonitor {
    private metrics: PerformanceMetrics[] = [];
    private timers = new Map<string, number>();

    /**
     * Start timing an operation
     */
    start(operation: string): void {
        this.timers.set(operation, performance.now());
    }

    /**
     * End timing an operation and record the metric
     */
    end(operation: string, metadata?: Record<string, unknown>): number {
        const startTime = this.timers.get(operation);
        if (!startTime) {
            console.warn(`No start time found for operation: ${operation}`);
            return 0;
        }

        const duration = performance.now() - startTime;
        this.timers.delete(operation);

        this.metrics.push({
            operation,
            duration,
            timestamp: Date.now(),
            metadata
        });

        return duration;
    }

    /**
     * Measure a synchronous function
     */
    measureSync<T>(operation: string, fn: () => T, metadata?: Record<string, unknown>): T {
        this.start(operation);
        try {
            const result = fn();
            this.end(operation, metadata);
            return result;
        } catch (error) {
            this.end(operation, { ...metadata, error: true });
            throw error;
        }
    }

    /**
     * Measure an async function
     */
    async measureAsync<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T> {
        this.start(operation);
        try {
            const result = await fn();
            this.end(operation, metadata);
            return result;
        } catch (error) {
            this.end(operation, { ...metadata, error: true });
            throw error;
        }
    }

    /**
     * Get all metrics
     */
    getMetrics(): PerformanceMetrics[] {
        return [...this.metrics];
    }

    /**
     * Get summary of metrics
     */
    getSummary(): Record<string, { count: number; totalDuration: number; avgDuration: number }> {
        const summary: Record<string, { count: number; totalDuration: number; avgDuration: number }> = {};

        for (const metric of this.metrics) {
            if (!summary[metric.operation]) {
                summary[metric.operation] = { count: 0, totalDuration: 0, avgDuration: 0 };
            }
            summary[metric.operation].count++;
            summary[metric.operation].totalDuration += metric.duration;
            summary[metric.operation].avgDuration = 
                summary[metric.operation].totalDuration / summary[metric.operation].count;
        }

        return summary;
    }

    /**
     * Clear all metrics
     */
    clear(): void {
        this.metrics = [];
        this.timers.clear();
    }

    /**
     * Log performance summary
     */
    logSummary(threshold = 10): void {
        const summary = this.getSummary();
        console.log('\n=== TidyJS Performance Summary ===');
        
        const entries = Object.entries(summary)
            .filter(([, stats]) => stats.avgDuration >= threshold)
            .sort((a, b) => b[1].totalDuration - a[1].totalDuration);

        for (const [operation, stats] of entries) {
            console.log(`${operation}:`);
            console.log(`  Count: ${stats.count}`);
            console.log(`  Total: ${stats.totalDuration.toFixed(2)}ms`);
            console.log(`  Average: ${stats.avgDuration.toFixed(2)}ms`);
        }
        
        const totalDuration = Object.values(summary)
            .reduce((sum, stats) => sum + stats.totalDuration, 0);
        console.log(`\nTotal execution time: ${totalDuration.toFixed(2)}ms`);
    }
}

// Global instance for the extension
export const perfMonitor = new PerformanceMonitor();