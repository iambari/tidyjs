# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# TidyJS - Import Organization VS Code Extension

TidyJS is a VS Code extension that automatically organizes and formats import declarations in TypeScript/JavaScript files. It groups imports by customizable categories, aligns 'from' keywords, and sorts imports by type and length.

## Build/Test/Lint Commands

-   Development mode: `npm run dev` (runs both watch:esbuild and watch:tsc in parallel)
-   Watch build: `npm run watch:esbuild` (watches and rebuilds with esbuild)
-   Watch types: `npm run watch:tsc` (watches TypeScript types without emitting)
-   Run all tests: `npm run test` (runs Jest tests)
-   Run E2E tests: `npm run test:e2e` (builds and runs VS Code extension tests)
-   Type check: `tsc --noEmit`
-   Lint: `npm run lint` (runs ESLint on src, test/parser, and jest.config.js)
-   Full check: `npm run check` (runs type check, lint, and tests)
-   Package extension: `npm run build` (production build + creates .vsix file)
-   Version bump: `npm run bump` (uses bump.sh script)

## Architecture

### Core Components

1. **Parser (`src/parser.ts`)**: Advanced AST-based import analysis with smart separation

    - Uses @typescript-eslint/parser to analyze TypeScript/JavaScript AST
    - **Smart Mixed Import Separation**: Automatically separates mixed imports (e.g., `import React, { useState, type FC } from 'react'` → 3 separate imports)
    - Categorizes imports by type (sideEffect, default, named, typeDefault, typeNamed)
    - Supports all TypeScript import types including namespaces and type imports
    - Groups imports based on regex patterns from configuration
    - Intelligent consolidation of same-type imports from same source

2. **Formatter (`src/formatter.ts`)**: Visual formatting and alignment engine

    - Uses @babel/parser for robust parsing with error recovery
    - Aligns 'from' keywords across import groups with pixel-perfect precision
    - Handles multiline imports and preserves section comments
    - Manages spacing, indentation, and group separation
    - Optimized alignment algorithm for performance

3. **Extension (`src/extension.ts`)**: VS Code integration layer

    - Registers commands and keybindings
    - Handles format-on-save functionality
    - Manages configuration updates and validation
    - Provides error recovery and user notifications
    - **Non-intrusive debug logging** without UI interruption

4. **Configuration (`src/utils/config.ts`)**: ConfigManager with advanced validation
    - **Advanced Cache System**: Smart caching with RegExp serialization support
    - **Robust Validation**: Detects duplicate group orders and names
    - Manages group patterns and import ordering
    - Handles dynamic subfolder detection for @app modules
    - Provides real-time configuration change events with detailed error reporting

### Import Processing Flow

1. **AST Analysis**: Parser extracts all imports from source code using TypeScript AST
2. **Smart Separation**: Mixed imports are intelligently separated by type (value vs type)
3. **Type Categorization**: Each import is categorized (sideEffect, default, named, typeDefault, typeNamed)
4. **Group Matching**: Imports are matched to groups using regex patterns
5. **Consolidation**: Same-type imports from same source are merged and deduplicated
6. **Sorting**: Groups and imports are sorted by configured order and priority
7. **Alignment**: Formatter applies visual alignment and spacing rules
8. **Output**: Extension writes formatted imports back to document

### Smart Import Separation Examples

```typescript
// Input: Mixed import
import React, { useState, type FC } from 'react';

// Parser Output: 3 separate imports
1. Default: React
2. Named: useState
3. Type Named: FC

// Final Output: 3 properly formatted imports
import React from 'react';
import { useState } from 'react';
import type { FC } from 'react';
```

## Code Style

-   TypeScript with strict typing - explicit return types required
-   Single quotes for strings
-   4-space indentation
-   Semicolons required
-   No `any` types - code must be strongly typed
-   Import sorting hierarchy: sideEffect → default → named → typeOnly (covers typeDefault + typeNamed)
-   React imports always first within their group
-   camelCase for variables and functions
-   Comprehensive error handling with utils/log.ts

## Testing

-   Jest with ts-jest for unit tests
-   Tests located in `test/parser/` directory
-   Mock VS Code API provided in `test/mocks/vscode.js`
-   Test fixtures in `test/fixtures/` with input/expected pairs
-   Performance benchmarks included for large files
-   **Comprehensive test coverage** for all import types and mixed import scenarios
-   **Bug reproduction tests** to prevent regressions
-   **After adding any feature** to prevent bugs

## Recent Improvements and Bug Fixes

### Major Bug Fixes ✅

1. **Mixed Import Separation**: Fixed critical bug where mixed imports like `import { useState, type FC } from 'react'` were not properly separated
2. **RegExp Cache Serialization**: Fixed cache invalidation bug where RegExp patterns in configuration were serialized as `{}`
3. **Duplicate Validation**: Fixed broken duplicate detection in configuration validation using `lodash.difference`
4. **UI Interruption**: Fixed debug logging that constantly interrupted users with output panel pop-ups
5. **Namespace Import Handling**: Fixed consolidation issues with mixed default + namespace imports

### New Features 🚀

1. **Smart Import Separation**: Automatic detection and separation of all mixed import combinations
2. **Comprehensive Type Support**: Full support for all TypeScript import types (default, named, namespace, type variants)
3. **Advanced Caching**: Optimized cache system with proper RegExp serialization support
4. **Robust Validation**: Enhanced configuration validation with detailed error reporting
5. **Non-Intrusive Logging**: Debug logging without UI interruption (`preserveFocus: true`)
6. **Auto-Order Resolution**: Intelligent automatic ordering system that resolves group order collisions and assigns missing orders

### Supported Import Types

| Type              | Internal      | Example                                             | Separation Support |
| ----------------- | ------------- | --------------------------------------------------- | ------------------ |
| Side Effect       | `sideEffect`  | `import './styles.css';`                            | ✅                 |
| Default           | `default`     | `import React from 'react';`                        | ✅                 |
| Named             | `named`       | `import { useState } from 'react';`                 | ✅                 |
| Namespace         | `default`     | `import * as Utils from './utils';`                 | ✅                 |
| Type Default      | `typeDefault` | `import type React from 'react';`                   | ✅                 |
| Type Named        | `typeNamed`   | `import type { FC } from 'react';`                  | ✅                 |
| Type Namespace    | `typeDefault` | `import type * as Types from './types';`            | ✅                 |
| **Mixed Imports** | **Multiple**  | `import React, { useState, type FC } from 'react';` | **✅ NEW**         |

### Mixed Import Examples

```typescript
// All these are now properly handled and separated:

// Default + Named
import React, { useState } from 'react';
// → import React from 'react'; + import { useState } from 'react';

// Named + Type Named
import { useState, type FC } from 'react';
// → import { useState } from 'react'; + import type { FC } from 'react';

// Default + Named + Type Named
import React, { useState, type FC } from 'react';
// → import React from 'react'; + import { useState } from 'react'; + import type { FC } from 'react';

// Default + Namespace
import React, * as ReactDOM from 'react-dom';
// → import React from 'react-dom'; + import * as ReactDOM from 'react-dom';

// Type Default + Type Named
import type React, { FC } from 'react';
// → import type React from 'react'; + import type { FC } from 'react';
```

## Auto-Order Resolution System

TidyJS now includes an intelligent auto-order resolution system that automatically handles group ordering configuration, eliminating the need for manual order management and preventing configuration errors.

### How It Works

The auto-order system processes group configurations in two phases:

1. **Collision Resolution**: Groups with explicit orders that conflict are automatically pushed to the next available order slot
2. **Auto-Assignment**: Groups without explicit orders are automatically assigned sequential order numbers starting from 0

### Configuration Examples

#### Before Auto-Order (Manual Management)
```json
{
  "tidyjs.groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "Utils", "match": "^@/utils", "order": 1 },  // ❌ Collision!
    { "name": "Lodash", "match": "^lodash" },              // ❌ Missing order
    { "name": "Components", "match": "^@/components" },    // ❌ Missing order
    { "name": "Other", "order": 0, "default": true }
  ]
}
```

#### After Auto-Order (Automatic Resolution)
```
Final order assignment:
- Other: 0 (default group, kept original)
- Lodash: 1 (auto-assigned)
- Components: 2 (auto-assigned) 
- React: 1 → 3 (kept original, no collision)
- Utils: 1 → 4 (collision resolved, pushed to next slot)
```

### Key Features

#### ✅ **Collision Resolution**
- Groups with duplicate orders are automatically pushed to the next available slot
- Original order preference is preserved when possible
- Collision adjustments are logged for transparency

#### ✅ **Missing Order Assignment**
- Groups without explicit `order` values get auto-assigned sequential numbers
- Assignment starts from 0 and avoids conflicts with manual orders
- Maintains predictable and consistent ordering

#### ✅ **Smart Validation**
```typescript
// Valid order values (automatically handled)
{ "order": 0 }     // ✅ Valid (default groups)
{ "order": 5 }     // ✅ Valid 
{ "order": 1001 }  // ⚠️ Valid but warns about high values

// Invalid order values (treated as missing)
{ "order": -1 }    // ❌ Negative → auto-assigned
{ "order": 1.5 }   // ❌ Decimal → auto-assigned
{ "order": "3" }   // ❌ String → auto-assigned
```

#### ✅ **Debug Logging**
```
[DEBUG] Group "Utils" order adjusted from 3 to 4 due to collision
[DEBUG] High order value detected: 1001 for group "External". Consider using lower values.
```

### Real-World Scenarios

#### Scenario 1: Team Configuration Conflicts
```json
// Developer A adds:
{ "name": "API", "match": "^@/api", "order": 2 }

// Developer B adds (same order):
{ "name": "Hooks", "match": "^@/hooks", "order": 2 }

// Result: Auto-resolved to API: 2, Hooks: 3
```

#### Scenario 2: Legacy Migration
```json
// Old config with missing orders:
[
  { "name": "React", "match": "^react" },           // Gets order: 0
  { "name": "External", "match": "^[^@]" },         // Gets order: 1  
  { "name": "Internal", "match": "^@/" },           // Gets order: 2
  { "name": "Other", "order": 99, "default": true} // Keeps order: 99
]
```

#### Scenario 3: Configuration Evolution
```json
// Start simple:
{ "name": "External", "order": 1 }
{ "name": "Internal", "order": 2 }

// Add more groups (no order conflicts):
{ "name": "React", "match": "^react" }      // Auto-assigned: 0
{ "name": "Utils", "order": 1 }             // Collision → pushed to 3
// Final: React(0), External(1), Internal(2), Utils(3)
```

### Migration Benefits

- **Zero Breaking Changes**: Existing configurations continue to work
- **Reduced Configuration Errors**: No more duplicate order validation failures  
- **Simplified Setup**: New groups can be added without calculating order numbers
- **Team Collaboration**: Multiple developers can add groups without conflicts
- **Future-Proof**: Configuration grows organically without manual maintenance

## Configuration System

TidyJS supports hierarchical configuration through:

1. **VS Code Settings** (`settings.json`): Configure via VS Code's `tidyjs.*` settings
2. **Project Config Files**: Place a `.tidyjsrc` or `tidyjs.json` file in any directory

### Configuration Priority (highest to lowest)
1. `.tidyjsrc` or `tidyjs.json` in the same directory as the file (`.tidyjsrc` takes precedence)
2. `.tidyjsrc` or `tidyjs.json` in parent directories (closest first, `.tidyjsrc` takes precedence)
3. VS Code workspace folder settings
4. VS Code global settings
5. Default configuration

### Supported Configuration Files

TidyJS supports two configuration file formats:

1. **`.tidyjsrc`** (recommended) - JSON file with schema validation
2. **`tidyjs.json`** - Traditional JSON configuration file

### Example `.tidyjsrc` file
```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "External", "match": "^[^@.]", "order": 2 },
    { "name": "Internal", "match": "^@/", "order": 3 },
    { "name": "Relative", "match": "^\\.", "order": 4 }
  ],
  "format": {
    "indent": 4,
    "singleQuote": true,
    "bracketSpacing": true,
    "removeUnusedImports": false
  }
}
```
