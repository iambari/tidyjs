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
  ImportParser = require('tidyimport-parser').ImportParser;
} catch (error) {
  console.error(`${COLORS.RED}${EMOJI.ERROR} Erreur lors de l'importation de tidyimport-parser: ${error.message}${COLORS.RESET}`);
  process.exit(1);
}

/**
 * Crée un résultat de parser simulé pour les tests
 * @param {string} sourceText - Le texte source à analyser
 * @returns {Object} - Un objet ParserResult
 */
function createMockParserResult(sourceText) {
  try {
    // Ne pas détecter les imports dynamiques ici, laisser le formateur le faire
    const mockConfig = createMockConfig();
      
    const parserConfig = {
      importGroups: mockConfig.importGroups,
      defaultGroupName: 'Misc',
      typeOrder: {
        sideEffect: 0,
        default: 1,
        named: 2,
        typeDefault: 3,
        typeNamed: 4
      },
      patterns: {
        appSubfolderPattern: mockConfig.regexPatterns.appSubfolderPattern
      },
      priorityImports: [/^react$/] // Priorité pour les imports de React
    };
    
    const parser = new ImportParser(parserConfig);
    const result = parser.parse(sourceText);
    
    return result;
  } catch (error) {
    console.error(`${COLORS.RED}${EMOJI.ERROR} Erreur lors de l'analyse des imports: ${error.message}${COLORS.RESET}`);
    return {
      groups: [],
      originalImports: [],
      appSubfolders: [],
      invalidImports: [{ error: error.message }]
    };
  }
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
 * Affiche les différences détaillées entre deux chaînes de caractères
 * @param {string} expected - Le résultat attendu
 * @param {string} actual - Le résultat obtenu
 */
function printDetailedDiff(expected, actual) {
  if (!TEST_CONFIG.showDetailedDiff) return;
  
  console.log(`${COLORS.YELLOW}${EMOJI.MAGNIFIER} Analyse détaillée des différences:${COLORS.RESET}`);
  
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLines = Math.max(expectedLines.length, actualLines.length);
  
  let hasDifferences = false;
  
  for (let i = 0; i < maxLines; i++) {
    const expectedLine = expectedLines[i] || '';
    const actualLine = actualLines[i] || '';
    
    if (expectedLine !== actualLine) {
      hasDifferences = true;
      console.log(`${COLORS.YELLOW}Ligne ${i + 1}:${COLORS.RESET}`);
      
      if (expectedLine && actualLine) {
        console.log(`  ${COLORS.GREEN}Attendu: ${COLORS.DIM}"${highlightDifferences(expectedLine, actualLine)}"${COLORS.RESET}`);
        console.log(`  ${COLORS.RED}Obtenu:  ${COLORS.DIM}"${highlightDifferences(actualLine, expectedLine, true)}"${COLORS.RESET}`);
      } else {
        if (!expectedLine) {
          console.log(`  ${COLORS.GREEN}Attendu: ${COLORS.DIM}"" (ligne absente)${COLORS.RESET}`);
          console.log(`  ${COLORS.RED}Obtenu:  ${COLORS.DIM}"${actualLine}"${COLORS.RESET}`);
        } else {
          console.log(`  ${COLORS.GREEN}Attendu: ${COLORS.DIM}"${expectedLine}"${COLORS.RESET}`);
          console.log(`  ${COLORS.RED}Obtenu:  ${COLORS.DIM}"" (ligne absente)${COLORS.RESET}`);
        }
      }
    }
  }
  
  if (!hasDifferences) {
    console.log(`${COLORS.GREEN}${EMOJI.INFO} Aucune différence trouvée au niveau du contenu, mais peut-être des différences d'espaces blancs invisibles.${COLORS.RESET}`);
  }
}

/**
 * Affiche les détails d'un test échoué
 * @param {Object} testCase - Le cas de test
 * @param {string} result - Le résultat obtenu
 * @param {number} testNumber - Le numéro du test
 */
function displayTestFailure(testCase, result, testNumber) {
  console.log(`${COLORS.RED}${EMOJI.FAILURE} Test ${testNumber} échoué: ${testCase.name}${COLORS.RESET}`);
  console.log(`${COLORS.YELLOW}Input:${COLORS.RESET}`);
  console.log(`${COLORS.DIM}${testCase.input}${COLORS.RESET}`);
  console.log(`${COLORS.GREEN}Attendu:${COLORS.RESET}`);
  console.log(`${COLORS.DIM}${testCase.expected}${COLORS.RESET}`);
  console.log(`${COLORS.RED}Obtenu:${COLORS.RESET}`);
  
  // Convertir le résultat en chaîne de caractères s'il s'agit d'un objet
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
 * Mesure le temps d'exécution d'une fonction
 * @param {Function} fn - La fonction à exécuter
 * @returns {[any, number]} - Le résultat de la fonction et le temps d'exécution en ms
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
 * Calcule le temps d'exécution en ms
 * @param {bigint} startTime - Le temps de début en nanosecondes
 * @returns {number} - Le temps d'exécution en ms
 */
function calculateExecutionTime(startTime) {
  const endTime = process.hrtime.bigint();
  return Number(endTime - startTime) / 1_000_000;
}

/**
 * Affiche le résultat d'un test
 * @param {Object} testResult - Le résultat du test
 * @param {number} executionTimeMs - Le temps d'exécution en ms
 */
function displayTestResult(testResult, executionTimeMs) {
  const { status, number, name, isErrorCase } = testResult;
  const timeInfo = `${COLORS.DIM}[${executionTimeMs.toFixed(2)}ms]${COLORS.RESET}`;
  
  if (status === 'passed') {
    if (isErrorCase) {
      console.log(`${COLORS.GREEN}${EMOJI.SUCCESS} Test ${number}: ${name} - Got expected error ${timeInfo}`);
      
      const errorLines = testResult.errorMessage.split('\n');
      errorLines.forEach(line => {
        console.log(`   ${COLORS.RED}${line}${COLORS.RESET}`);
      });
    } else {
      console.log(`${COLORS.GREEN}${EMOJI.SUCCESS} Test ${number}: ${name} ${timeInfo}`);
    }
  } else if (status === 'failed') {
    if (testResult.expectedError) {
      console.log(`${COLORS.RED}${EMOJI.FAILURE} Test ${number}: ${name} - Expected error but got result ${timeInfo}`);
    } else {
      console.log(`${COLORS.RED}${EMOJI.FAILURE} Test ${number}: ${name} ${timeInfo}`);
    }
  }
}

/**
 * Exécute tous les tests
 * @returns {Object} - Les résultats des tests
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
  console.log(`\n${COLORS.BOLD}Temps moyen d'exécution: ${COLORS.DIM}${averageTime.toFixed(2)}ms${COLORS.RESET}`);
  
  displayTestSummary(results, startTime);
  return results;
}

/**
 * Gère un test qui a généré une erreur
 * @param {Error} error - L'erreur générée
 * @param {Object} testCase - Le cas de test
 * @param {Object} testResult - Le résultat du test
 * @param {Object} results - Les résultats globaux
 * @param {number} testNumber - Le numéro du test
 * @param {number} executionTimeMs - Le temps d'exécution en ms
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
 * Gère un test qui a produit un résultat
 * @param {string|Object} result - Le résultat du test
 * @param {Object} testCase - Le cas de test
 * @param {Object} testResult - Le résultat du test
 * @param {Object} results - Les résultats globaux
 * @param {number} testNumber - Le numéro du test
 * @param {number} executionTimeMs - Le temps d'exécution en ms
 */
function handleTestWithResult(result, testCase, testResult, results, testNumber, executionTimeMs) {
  // Extraire la propriété text si le résultat est un objet avec cette propriété
  const textResult = typeof result === 'object' && result !== null && 'text' in result 
    ? result.text 
    : result;
  
  if (testCase.expectedError) {
    testResult.status = 'failed';
    testResult.expected = `Error: ${testCase.expectedError}`;
    testResult.actual = textResult;
    results.failed++;
  } else if (textResult === testCase.expected) {
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
 * Gère une erreur de test
 * @param {Error} error - L'erreur générée
 * @param {Object} testResult - Le résultat du test
 * @param {Object} results - Les résultats globaux
 * @param {number} testNumber - Le numéro du test
 * @param {Object} testCase - Le cas de test
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
  console.log(`${COLORS.RED}Error: ${error.message}`);
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
✅ Passed: ${results.passed}
 └─ Error cases: ${errorCasesPassed}
 └─ Regular cases: ${regularCasesPassed}
❌ Failed: ${results.failed}
⚠️  Errors: ${results.errors}
ℹ️  Total: ${total}

Success rate: ${progressBar} ${successRate.toFixed(1)}%`
  }
}

const displayTestSummary = (results, startTime) => {
    printSectionTitle('RÉSUMÉ DES TESTS', EMOJI.CHART)
    
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    
    const stats = calculateStats({
        ...results,
        duration
    })
    
    console.log(stats.display)
    
    if (results.failed === 0 && results.errors === 0) {
        console.log(`\n${COLORS.GREEN}${EMOJI.SUCCESS} TOUS LES TESTS ONT RÉUSSI !${COLORS.RESET}`)
    } else {
        console.log(`\n${COLORS.RED}${EMOJI.FAILURE} CERTAINS TESTS ONT ÉCHOUÉ. Veuillez vérifier les erreurs ci-dessus.${COLORS.RESET}`)
    }
    
    return results
}

const results = runTests();

Module.prototype.require = originalRequire;

// Calculer le taux de réussite
const total = results.passed + results.failed + results.errors;
const successRate = total > 0 ? (results.passed / total) * 100 : 0;

// Vérifier si le taux de réussite est d'au moins 9X%
if (successRate < 95) {
  console.log(`\n${COLORS.RED}${EMOJI.ERROR} ERREUR: Le taux de réussite (${successRate.toFixed(1)}%) est inférieur à 90%.${COLORS.RESET}`);
  console.log(`${COLORS.RED}La couverture des tests n'est pas suffisante pour continuer.${COLORS.RESET}`);
  process.exit(1);
} else if (results.failed > 0 || results.errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
