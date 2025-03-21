const { 
  loadTestCases, 
  createMockConfig, 
  mockVscode, 
  COLORS, 
  EMOJI, 
  TEST_CONFIG 
} = require('./constant');
const Module = require('module');
const originalRequire = Module.prototype.require;

let ImportParser;
try {
  ImportParser = require('tidyjs-parser').ImportParser;
} catch (error) {
  console.error(`${COLORS.RED}${EMOJI.ERROR} // ERROR: Error during tidyjs-parser import: ${error.message}${COLORS.RESET}`);
  process.exit(1);
}

/**
 * Creates a mock parser result for tests
 * @param {string} sourceText - The source text to parse
 * @returns {Object} - A ParserResult object
 */
function createMockParserResult(sourceText) {
  const mockConfig = createMockConfig();
    
  const parserConfig = {
    importGroups: mockConfig.importGroups,
    defaultGroupName: 'Misc',
    typeOrder: {
      default: 0,
      named: 1,
      typeDefault: 2,
      typeNamed: 3,
      sideEffect: 4
    },
    patterns: {
      appSubfolderPattern: mockConfig.regexPatterns.appSubfolderPattern
    },
    priorityImports: [/^react$/]
  };
  
  const parser = new ImportParser(parserConfig);
  return parser.parse(sourceText);
}

Module.prototype.require = function(...args) {
  if (args[0] === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, args);
};

function printSectionTitle(title, emoji) {
  const line = '═'.repeat(50);
  console.log(`\n${COLORS.CYAN}${line}${COLORS.RESET}`);
  console.log(`${COLORS.BOLD}${COLORS.CYAN}${emoji} ${title}${COLORS.RESET}`);
  console.log(`${COLORS.CYAN}${line}${COLORS.RESET}\n`);
}

/**
 * Display detailed differences between two strings
 * @param {string} expected - The expected result
 * @param {string} actual - The actual result
 */
function printDetailedDiff(expected, actual) {
  if (!TEST_CONFIG.showDetailedDiff) return;
  
  console.log(`${COLORS.YELLOW}${EMOJI.MAGNIFIER} Detailed differences analysis:${COLORS.RESET}`);
  
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLines = Math.max(expectedLines.length, actualLines.length);
  
  let hasDifferences = false;
  
  for (let i = 0; i < maxLines; i++) {
    const expectedLine = expectedLines[i] || '';
    const actualLine = actualLines[i] || '';
    
    if (expectedLine !== actualLine) {
      hasDifferences = true;
      console.log(`${COLORS.YELLOW}Line ${i + 1}:${COLORS.RESET}`);
      
      if (expectedLine && actualLine) {
        console.log(`  ${COLORS.GREEN}Expected: ${COLORS.DIM}"${highlightDifferences(expectedLine, actualLine)}"${COLORS.RESET}`);
        console.log(`  ${COLORS.RED}Got:      ${COLORS.DIM}"${highlightDifferences(actualLine, expectedLine, true)}"${COLORS.RESET}`);
      } else {
        if (!expectedLine) {
          console.log(`  ${COLORS.GREEN}Expected: ${COLORS.DIM}"" (missing line)${COLORS.RESET}`);
          console.log(`  ${COLORS.RED}Got:      ${COLORS.DIM}"${actualLine}"${COLORS.RESET}`);
        } else {
          console.log(`  ${COLORS.GREEN}Expected: ${COLORS.DIM}"${expectedLine}"${COLORS.RESET}`);
          console.log(`  ${COLORS.RED}Got:      ${COLORS.DIM}"" (missing line)${COLORS.RESET}`);
        }
      }
    }
  }
  
  if (!hasDifferences) {
    console.log(`${COLORS.GREEN}${EMOJI.INFO} No differences found in content, but there might be invisible whitespace differences.${COLORS.RESET}`);
  }
}

/**
 * Display details of a failed test
 * @param {Object} testCase - The test case
 * @param {string} result - The obtained result
 * @param {number} testNumber - The test number
 */
function displayTestFailure(testCase, result, testNumber) {
  console.log(`${COLORS.RED}${EMOJI.FAILURE} Test ${testNumber} failed: ${testCase.name}${COLORS.RESET}`);
  console.log(`${COLORS.YELLOW}Input:${COLORS.RESET}`);
  console.log(`${COLORS.DIM}${testCase.input}${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}Expected:${COLORS.RESET}`);
  console.log(`${COLORS.DIM}${testCase.expected}${COLORS.RESET}`);
  console.log(`${COLORS.RED}Got:${COLORS.RESET}`);
  
  // Convert result to string if it's an object
  const resultStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : result;
  console.log(`${COLORS.DIM}${resultStr}${COLORS.RESET}`);
  
  printDetailedDiff(testCase.expected, resultStr);
}

function highlightDifferences(str1, str2, isActual = false) {
  let result = '';
  const color = isActual ? COLORS.RED : COLORS.GREEN;
  
  for (let i = 0; i < str1.length; i++) {
    if (i >= str2.length || str1[i] !== str2[i]) {
      result += `${color}${str1[i]}${COLORS.DIM}`;
    } else {
      result += str1[i];
    }
  }
  
  return result;
}

/**
 * Measure execution time of a function
 * @param {Function} fn - The function to execute
 * @returns {[any, number]} - The function result and execution time in ms
 */
function measureExecutionTime(fn) {
  const startTime = process.hrtime.bigint();
  let result;
  
  try {
    result = fn();
    return [result, null, calculateExecutionTime(startTime)];
  } catch (error) {
    return [null, error, calculateExecutionTime(startTime)];
  }
}

/**
 * Calculate execution time in ms
 * @param {bigint} startTime - The start time in nanoseconds
 * @returns {number} - The execution time in ms
 */
function calculateExecutionTime(startTime) {
  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime) / 1_000_000;
}

/**
 * Display test result
 * @param {Object} testResult - The test result
 * @param {number} executionTimeMs - The execution time in ms
 */
function displayTestResult(testResult, executionTimeMs) {
  const { status, number, name, isErrorCase } = testResult;
  const timeInfo = `${COLORS.DIM}[${executionTimeMs.toFixed(2)}ms]${COLORS.RESET}`;
  
  if (status === 'passed') {
    if (isErrorCase) {
      console.log(`${COLORS.GREEN}${EMOJI.SUCCESS} Test ${number}: ${name} - Got expected error ${timeInfo}`);
      
      const errorLines = testResult.errorMessage.split('\n');
      errorLines.forEach(line => {
        console.log(`   ${COLORS.RED}// ERROR: ${line}${COLORS.RESET}`);
      });
    } else {
      console.log(`${COLORS.GREEN}${EMOJI.SUCCESS} Test ${number}: ${name} ${timeInfo}`);
    }
  } else if (status === 'failed') {
    if (testResult.expectedError) {
      console.log(`${COLORS.RED}${EMOJI.FAILURE} Test ${number}: ${name} - Expected error but got result ${timeInfo}`);
      console.log(`   ${COLORS.GREEN}Expected error: ${COLORS.DIM}${testResult.expected}${COLORS.RESET}`);
      console.log(`   ${COLORS.RED}Got: ${COLORS.DIM}${testResult.actual}${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.RED}${EMOJI.FAILURE} Test ${number}: ${name} ${timeInfo}`);
    }
  }
}

/**
 * Run all tests
 * @returns {Object} - The test results
 */
function runTests() {
  process.stdout.write('\x1Bc');

  const testCases = loadTestCases();
  printSectionTitle('EXECUTING FORMATTING TESTS', EMOJI.ROCKET);
  
  const startTime = Date.now();
  const results = {
    passed: 0,
    failed: 0,
    errors: 0,
    details: [],
    performance: []
  };

  const formatter = require('../out/formatter');
  const mockConfig = createMockConfig();

  testCases.forEach((testCase, index) => {
    const testNumber = index + 1;
    const testResult = {
      name: testCase.name,
      number: testNumber,
      status: 'pending',
      expectedError: testCase.expectedError
    };
    
    const [result, error, executionTimeMs] = measureExecutionTime(() => {
      const mockParserResult = createMockParserResult(testCase.input);
      return formatter.formatImports(testCase.input, mockConfig, mockParserResult);
    });
    
    results.performance.push({
      name: testCase.name,
      executionTimeMs: executionTimeMs.toFixed(2)
    });
    
    if (error) {
      handleTestWithError(error, testCase, testResult, results, testNumber, executionTimeMs);
    } else {
      handleTestWithResult(result, testCase, testResult, results, testNumber, executionTimeMs);
    }
    
    displayTestResult(testResult, executionTimeMs);
    results.details.push(testResult);
  });
  
  const totalTime = results.performance.reduce((sum, perf) => sum + parseFloat(perf.executionTimeMs), 0);
  const averageTime = totalTime / results.performance.length;
  console.log(`\n${COLORS.BOLD}Average execution time: ${COLORS.DIM}${averageTime.toFixed(2)}ms${COLORS.RESET}`);
  
  displayTestSummary(results, startTime);
  return results;
}

/**
 * Handle a test that generated an error
 * @param {Error} error - The generated error
 * @param {Object} testCase - The test case
 * @param {Object} testResult - The test result
 * @param {Object} results - The global results
 * @param {number} testNumber - The test number
 * @param {number} executionTimeMs - The execution time in ms
 */
function handleTestWithError(error, testCase, testResult, results, testNumber, executionTimeMs) {
  if (testCase.expectedError && error.message.includes(testCase.expectedError)) {
    testResult.status = 'passed';
    testResult.isErrorCase = true;
    testResult.errorMessage = error.message;
    results.passed++;
  } else {
    handleTestError(error, testResult, results, testNumber, testCase);
    console.log(`   ${COLORS.DIM}[${executionTimeMs.toFixed(2)}ms]${COLORS.RESET}`);
  }
}

/**
 * Handle a test that produced a result
 * @param {string|Object} result - The test result
 * @param {Object} testCase - The test case
 * @param {Object} testResult - The test result
 * @param {Object} results - The global results
 * @param {number} testNumber - The test number
 * @param {number} executionTimeMs - The execution time in ms
 */
function handleTestWithResult(result, testCase, testResult, results, testNumber, executionTimeMs) {
  if (testCase.expectedError) {
    const resultError = result && typeof result === 'object' && result.error ? result.error : '';
    
    // Vérifier si les chaînes sont exactement identiques
    if (resultError === testCase.expectedError) {
      testResult.status = 'passed';
      testResult.isErrorCase = true;
      testResult.errorMessage = resultError;
      results.passed++;
      return;
    }
    
    // Vérifier si l'erreur attendue est incluse dans l'erreur réelle
    if (resultError && resultError.includes(testCase.expectedError)) {
      testResult.status = 'passed';
      testResult.isErrorCase = true;
      testResult.errorMessage = resultError;
      results.passed++;
      return;
    }
    
    testResult.status = 'failed';
    testResult.expected = testCase.expectedError;
    testResult.actual = resultError || JSON.stringify(result);
    results.failed++;
    return;
  }

  // Extract text property if result is an object with this property
  const textResult = result && typeof result === 'object' && 'text' in result 
    ? result.text 
    : result;

  if (textResult === testCase.expected) {
    testResult.status = 'passed';
    results.passed++;
  } else {
    testResult.status = 'failed';
    testResult.input = testCase.input;
    testResult.expected = testCase.expected;
    testResult.actual = textResult;
    results.failed++;
    displayTestFailure(testCase, textResult, testNumber);
  }
}

/**
 * Handle a test error
 * @param {Error} error - The generated error
 * @param {Object} testResult - The test result
 * @param {Object} results - The global results
 * @param {number} testNumber - The test number
 * @param {Object} testCase - The test case
 */
function handleTestError(error, testResult, results, testNumber, testCase) {
  testResult.status = 'error';
  testResult.error = error.message;
  testResult.input = testCase.input;
  testResult.expected = testCase.expected;
  testResult.stack = error.stack;
  results.errors++;

  const formattedStack = error.stack.split('\n').slice(0, 3).join('\n');
  console.log(`${COLORS.RED}${EMOJI.ERROR} Test ${testNumber}: ${testCase.name}`);
  console.log(`${COLORS.RED}// ERROR: ${error.message}`);
  console.log(`${COLORS.DIM}${formattedStack}${COLORS.RESET}\n`);
}

function calculateStats(results) {
  const total = results.passed + results.failed + results.errors
  const successRate = total > 0 ? (results.passed / total) * 100 : 0
  const barLength = 30
  const filledBars = Math.round((successRate / 100) * barLength)
  
  let barColor = COLORS.RED
  if (successRate >= 90) {
      barColor = COLORS.GREEN
  } else if (successRate >= 50) {
      barColor = COLORS.YELLOW
  }
  
  const progressBar = `${barColor}[${'█'.repeat(filledBars)}${' '.repeat(barLength - filledBars)}]${COLORS.RESET}`

  const errorCasesPassed = results.details.filter(t => 
      t.status === 'passed' && t.isErrorCase
  ).length
  
  const regularCasesPassed = results.passed - errorCasesPassed

  return {
      successRate,
      display: `⏱️  Duration: ${results.duration}s
✅ Tests passed: ${results.passed}
 └─ Error cases: ${errorCasesPassed}
 └─ Regular cases: ${regularCasesPassed}
❌ Tests failed: ${results.failed}
⚠️  Errors: ${results.errors}
ℹ️  Total: ${total}

Success rate: ${progressBar} ${successRate.toFixed(1)}%`
  }
}

const displayTestSummary = (results, startTime) => {
    printSectionTitle('TEST SUMMARY', EMOJI.CHART)
    
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    
    const stats = calculateStats({
        ...results,
        duration
    })
    
    console.log(stats.display)
    
    if (results.failed === 0 && results.errors === 0) {
        console.log(`\n${COLORS.GREEN}${EMOJI.SUCCESS} ALL TESTS PASSED!${COLORS.RESET}`)
    } else {
        console.log(`\n${COLORS.RED}${EMOJI.FAILURE} SOME TESTS FAILED. Please check the errors above.${COLORS.RESET}`)
    }
    
    return results
}

const results = runTests();

Module.prototype.require = originalRequire;

// Calculate success rate
const total = results.passed + results.failed + results.errors;
const successRate = total > 0 ? (results.passed / total) * 100 : 0;

// Check if success rate is at least 9X%
if (successRate < 95) {
  console.log(`\n${COLORS.RED}${EMOJI.ERROR} // ERROR: Success rate (${successRate.toFixed(1)}%) is below 90%.${COLORS.RESET}`);
  console.log(`${COLORS.RED}// ERROR: Test coverage is not sufficient to continue.${COLORS.RESET}`);
  process.exit(1);
} else if (results.failed > 0 || results.errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
