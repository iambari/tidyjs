const fs = require('fs')
const path = require('path')

const COLORS = {
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  UNDERLINE: '\x1b[4m'
};

const EMOJI = {
  SUCCESS: '✅',
  FAILURE: '❌',
  ERROR: '⚠️',
  INFO: 'ℹ️',
  ROCKET: '🚀',
  MAGNIFIER: '🔍',
  CHART: '📊',
  CLOCK: '⏱️',
  CHECK: '✅',
  CROSS: '❌',
  STOPWATCH: '⏱️'
};

// Configuration des tests
const TEST_CONFIG = {
  showDetailedDiff: true // Option pour afficher ou masquer les différences détaillées
};

const mockVscode = {
  window: {
    createOutputChannel: (name) => ({
      name,
      appendLine: () => {},
      show: () => {},
      dispose: () => {},
      clear: () => {},
      replace: () => {},
      append: () => {},
      hide: () => {}
    }),
    showErrorMessage: (msg) => console.error(`${COLORS.RED}${EMOJI.ERROR} [VSCode Error]: ${msg}${COLORS.RESET}`),
    showInformationMessage: (msg) => console.log(`${COLORS.BLUE}${EMOJI.INFO} [VSCode Info]: ${msg}${COLORS.RESET}`)
  },
  workspace: {
    getConfiguration: (section) => ({
      get: (key) => {
        const config = {
          importFormatter: {
            groups: [
              { name: 'Misc', regex: '^(react|react-.*|lodash)$', order: 0 },
              { name: 'DS', regex: '^ds$', order: 1 },
              { name: '@app', regex: '^@app$', order: 2 }
            ],
          }
        };
        
        return config[section]?.[key] || null;
      }
    })
  },
  EventEmitter: class EventEmitter {
    constructor() {
      this.listeners = [];
    }
    event = (listener) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = (data) => {
      this.listeners.forEach(listener => listener(data));
    };
  },
  Position: class Position {
    constructor(line, character) {
      this.line = line;
      this.character = character;
    }
  },
  Range: class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
      this.start = { line: startLine, character: startCharacter };
      this.end = { line: endLine, character: endCharacter };
    }
  },
  commands: {
    registerCommand: (id, handler) => ({ 
      dispose: () => {},
      id,
      handler
    })
  }
};

const createMockConfig = () => ({
  importGroups: [
    { name: 'Misc', regex: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/, order: 0 },
    { name: 'DS', regex: /^ds$/, order: 1 },
    { name: '@app/dossier', regex: /^@app\/dossier/, order: 2 },
    { name: '@app', regex: /^@app/, order: 2 },
    { name: '@core', regex: /^@core/, order: 3 },
    { name: '@library', regex: /^@library/, order: 4 },
    { name: 'Utils', regex: /^yutils/, order: 5 },
  ],
  regexPatterns: {
    sectionComment: /^\s*\/\/\s*(?:Misc|DS|@app(?:\/[a-zA-Z0-9_-]+)?|@core|@library|Utils|.*\b(?:misc|ds|dossier|client|notification|core|library|utils)\b.*)\s*$/gim,
    appSubfolderPattern: /^@app\/([a-zA-Z0-9_-]+)/
  }
});

function loadTestCases() {
  const inputDir = path.join(__dirname, 'fixtures/input')
  const expectedDir = path.join(__dirname, 'fixtures/expected')
  const errorDir = path.join(__dirname, 'fixtures/errors')
  const testCases = []

  if (!fs.existsSync(errorDir)) {
      fs.mkdirSync(errorDir, { recursive: true })
  }

  const inputFiles = fs.readdirSync(inputDir)
      .filter(file => file.endsWith('.tsx'))

  for (const file of inputFiles) {
      const name = path.basename(file, '.tsx')
      const input = fs.readFileSync(path.join(inputDir, file), 'utf8')
      
      const errorFile = path.join(errorDir, `${name}.tsx`)
      
      if (fs.existsSync(errorFile)) {
          const errorContent = fs.readFileSync(errorFile, 'utf8')
          const expectedError = errorContent.match(/\/\/\s*(.+)/)
          if (expectedError) {
              testCases.push({
                  name,
                  input,
                  expected: null,
                  expectedError: expectedError[1].trim()
              })
          }
      } else {
          const expectedFile = path.join(expectedDir, file)
          if (fs.existsSync(expectedFile)) {
              testCases.push({
                  name,
                  input,
                  expected: fs.readFileSync(expectedFile, 'utf8')
              })
          }
      }
  }

  return testCases
}

module.exports = {
  EMOJI,
  COLORS,
  mockVscode,
  loadTestCases,
  createMockConfig,
  TEST_CONFIG
};
