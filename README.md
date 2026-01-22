# TidyJS

**TypeScript/JavaScript import organization for VS Code**

TidyJS automatically organizes, groups, and aligns import declarations with advanced AST parsing and intelligent mixed import separation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs)

## Features

- **Smart Import Separation**: Automatically separates mixed imports like `import React, { useState, type FC } from 'react'`
- **AST-Based Parsing**: Robust TypeScript parser handles complex syntax and edge cases
- **Auto-Order Resolution**: Resolves group order conflicts automatically
- **Pixel-Perfect Alignment**: Aligns 'from' keywords across import groups
- **Hierarchical Configuration**: `.tidyjsrc` files and VS Code settings with intelligent merging
- **High Performance**: Advanced caching for large codebases

## Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"TidyJS"**
4. Click **Install**

## Usage

- **Command Palette**: `Ctrl+Shift+P` > "TidyJS: Format Imports"
- **Format on Save**: Enable `editor.formatOnSave` in VS Code settings
- **Create Config**: `Ctrl+Shift+P` > "TidyJS: Create Configuration File"

### Supported Files

`.ts`, `.tsx`, `.js`, `.jsx`

## Quick Start

Create a `.tidyjsrc` in your project root:

```json
{
  "groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "External", "match": "^[^@./]", "order": 2 },
    { "name": "Internal", "match": "^@/", "order": 3 },
    { "name": "Relative", "match": "^\\.", "order": 4 },
    { "name": "Other", "order": 999, "default": true }
  ],
  "format": {
    "singleQuote": true,
    "removeUnusedImports": true
  }
}
```

## Example

**Before:**
```typescript
import { YpTable, YpButton } from 'ds';
import React, { useState, type FC } from 'react';
import { formatDate } from '@library/helpers';
import * as Utils from './utils';
```

**After:**
```typescript
// React
import React        from 'react';
import { useState } from 'react';
import type { FC }  from 'react';

// DS Components
import { YpButton, YpTable } from 'ds';

// @library
import { formatDate } from '@library/helpers';

// Local
import * as Utils from './utils';
```

## Commands

| Command | Description |
|---------|-------------|
| `tidyjs.forceFormatDocument` | Format imports in active file |
| `tidyjs.createConfigFile` | Create a `.tidyjsrc` configuration file |

## Documentation

- [Configuration](./docs/configuration.md) - Complete configuration reference
- [Import Types](./docs/import-types.md) - Supported import types and separation
- [Auto-Order System](./docs/auto-order.md) - Automatic group ordering
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
- [Contributing](./docs/contributing.md) - Development setup and guidelines

## License

[MIT](LICENSE)

## Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs)
- [GitHub Repository](https://github.com/asmirbe/tidyjs)
- [Report Issues](https://github.com/asmirbe/tidyjs/issues)
