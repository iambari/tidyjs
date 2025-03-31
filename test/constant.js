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

// Définition des configurations par défaut
const DEFAULT_IMPORT_GROUPS = [
  { name: 'Misc', regex: '^(react|react-.*|lodash)$', order: 0 },
  { name: 'DS', regex: '^ds$', order: 1 },
  { name: '@app', regex: '^@app$', order: 2 },
  { name: 'Utils', regex: '^yutils$', order: 3 },
];

// Fonctions factory pour les mocks
const createOutputChannel = (name) => ({
  name,
  appendLine: () => {},
  show: () => {},
  dispose: () => {},
  clear: () => {},
  replace: () => {},
  append: () => {},
  hide: () => {}
});

const createWindowMock = () => ({
  createOutputChannel: createOutputChannel,
  showErrorMessage: (msg) => console.error(`${COLORS.RED}${EMOJI.ERROR} [VSCode Error]: ${msg}${COLORS.RESET}`),
  showInformationMessage: (msg) => console.log(`${COLORS.BLUE}${EMOJI.INFO} [VSCode Info]: ${msg}${COLORS.RESET}`)
});

const createWorkspaceMock = () => ({
  getConfiguration: (section) => ({
    get: (key) => {
      const config = {
        importFormatter: {
          groups: DEFAULT_IMPORT_GROUPS,
        }
      };
      
      return config[section]?.[key] || null;
    }
  })
});

// Classes de base pour les mocks
class EventEmitter {
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
}

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(startLine, startCharacter, endLine, endCharacter) {
    this.start = { line: startLine, character: startCharacter };
    this.end = { line: endLine, character: endCharacter };
  }
}

// Création du mockVscode complet
const mockVscode = {
  window: createWindowMock(),
  workspace: createWorkspaceMock(),
  EventEmitter,
  Position,
  Range,
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
    { name: 'Misc', order: 0, priority: 999, isDefault: true, regex: /^(react|react-.*|lodash|date-fns|classnames|@fortawesome|@reach|uuid|@tanstack|ag-grid-community|framer-motion)$/ },
    { name: 'DS', order: 1, regex: /^ds$/ },
    { name: '@app/dossier', order: 2, regex: /^@app\/dossier/ },
    { name: '@app', order: 3, regex: /^@app/ },
    { name: '@core', order: 4, regex: /^@core/ },
    { name: '@library', order: 5, regex: /^@library/ },
    { name: 'Utils', order: 6, regex: /^\.?\/.*utils.*$/ }
  ],
  formatOnSave: false,
  typeOrder: {
    default: 0,
    named: 1,
    typeDefault: 2,
    typeNamed: 3,
    sideEffect: 4
  },
  sectionComment: /^\s*\/\/\s*(?:Misc|DS|@app(?:\/[a-zA-Z0-9_-]+)?|@core|@library|Utils|.*\b(?:misc|ds|dossier|client|notification|core|library|utils)\b.*)\s*$/gim,
  patterns: {
    subfolderPattern: /^@app\/([a-zA-Z0-9_-]+)/
  }
});

function loadTestCases() {
  const inputDir = path.join(__dirname, 'fixtures/input')
  const expectedDir = path.join(__dirname, 'fixtures/expected')
  const errorDir = path.join(__dirname, 'fixtures/expected/errors')
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
