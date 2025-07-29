#!/usr/bin/env node

/**
 * Performance benchmark runner for TidyJS
 * Measures formatting time for different file sizes
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { ImportParser } from '../../src/parser';
import { formatImports } from '../../src/formatter';
import { Config } from '../../src/types';

const DEFAULT_CONFIG: Config = {
    debug: false,
    groups: [
        { name: 'React', order: 0, match: /^react/ },
        { name: 'External', order: 1, match: /^[^@./]/ },
        { name: 'Internal', order: 2, match: /^@\// },
        { name: 'Relative', order: 3, match: /^\./ },
        { name: 'Styles', order: 4, match: /\.(css|scss|sass|less)$/ },
        { name: 'Other', order: 5, default: true }
    ],
    importOrder: {
        default: 0,
        named: 1,
        typeOnly: 2,
        sideEffect: 3,
    },
    format: {
        indent: 4,
        removeUnusedImports: false,
        removeMissingModules: false,
        singleQuote: true,
        bracketSpacing: true,
    },
    excludedFolders: [],
};

interface BenchmarkResult {
    file: string;
    importCount: number;
    parseTime: number;
    formatTime: number;
    totalTime: number;
}

async function runBenchmark(filePath: string, name: string): Promise<BenchmarkResult> {
    const sourceCode = readFileSync(filePath, 'utf-8');
    const parser = new ImportParser(DEFAULT_CONFIG);
    
    console.log(`\n📊 Running benchmark: ${name}`);
    console.log(`   File size: ${(sourceCode.length / 1024).toFixed(2)} KB`);
    
    // Warm up
    for (let i = 0; i < 3; i++) {
        parser.parse(sourceCode);
    }
    
    // Measure parsing
    const parseStart = performance.now();
    let parserResult;
    for (let i = 0; i < 10; i++) {
        parserResult = parser.parse(sourceCode);
    }
    const parseTime = (performance.now() - parseStart) / 10;
    
    // Count imports
    const importCount = parserResult!.groups.reduce((sum, group) => sum + group.imports.length, 0);
    console.log(`   Import count: ${importCount}`);
    
    // Measure formatting
    const formatStart = performance.now();
    for (let i = 0; i < 10; i++) {
        await formatImports(sourceCode, DEFAULT_CONFIG, parserResult!);
    }
    const formatTime = (performance.now() - formatStart) / 10;
    
    const totalTime = parseTime + formatTime;
    
    return {
        file: name,
        importCount,
        parseTime,
        formatTime,
        totalTime
    };
}

async function main() {
    console.log('🚀 TidyJS Performance Benchmarks');
    console.log('================================\n');
    
    const benchmarks = [
        { file: join(__dirname, 'small-file.ts'), name: 'Small file (~20 imports)' },
        { file: join(__dirname, 'medium-file.ts'), name: 'Medium file (~100 imports)' },
        { file: join(__dirname, 'large-file.ts'), name: 'Large file (300+ imports)' }
    ];
    
    const results: BenchmarkResult[] = [];
    
    for (const benchmark of benchmarks) {
        try {
            const result = await runBenchmark(benchmark.file, benchmark.name);
            results.push(result);
        } catch (error) {
            console.error(`❌ Error running benchmark ${benchmark.name}:`, error);
        }
    }
    
    // Display results
    console.log('\n\n📈 Benchmark Results');
    console.log('===================\n');
    console.log('| File | Imports | Parse (ms) | Format (ms) | Total (ms) | ms/import |');
    console.log('|------|---------|------------|-------------|------------|-----------|');
    
    for (const result of results) {
        const msPerImport = result.totalTime / result.importCount;
        console.log(
            `| ${result.file.padEnd(30)} | ${result.importCount.toString().padStart(7)} | ${result.parseTime.toFixed(2).padStart(10)} | ${result.formatTime.toFixed(2).padStart(11)} | ${result.totalTime.toFixed(2).padStart(10)} | ${msPerImport.toFixed(3).padStart(9)} |`
        );
    }
    
    // Performance analysis
    console.log('\n\n📊 Performance Analysis');
    console.log('======================\n');
    
    const avgParseRatio = results.reduce((sum, r) => sum + (r.parseTime / r.totalTime), 0) / results.length;
    const avgFormatRatio = results.reduce((sum, r) => sum + (r.formatTime / r.totalTime), 0) / results.length;
    
    console.log(`Average time distribution:`);
    console.log(`  - Parsing: ${(avgParseRatio * 100).toFixed(1)}%`);
    console.log(`  - Formatting: ${(avgFormatRatio * 100).toFixed(1)}%`);
    
    // Check for linear scaling
    if (results.length >= 2) {
        const small = results[0];
        const large = results[results.length - 1];
        const scalingFactor = (large.totalTime / large.importCount) / (small.totalTime / small.importCount);
        
        console.log(`\nScaling factor (large vs small): ${scalingFactor.toFixed(2)}x`);
        if (scalingFactor > 2) {
            console.log('⚠️  Performance does not scale linearly - optimization needed!');
        } else {
            console.log('✅ Performance scales reasonably well');
        }
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}