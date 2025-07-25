# TidyJS

**The ultimate TypeScript/JavaScript import organization VS Code extension**

TidyJS automatically transforms messy, disorganized imports into beautifully structured, aligned, and categorized import declarations. With advanced AST parsing, intelligent mixed import separation, and highly configurable grouping rules, TidyJS makes your codebase cleaner and more maintainable.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs)

## ✨ Why TidyJS?

**The Problem**: Modern TypeScript/React projects often have messy, inconsistent imports scattered throughout files, making code hard to read and maintain.

**The Solution**: TidyJS intelligently organizes, groups, and formats all import declarations with pixel-perfect alignment and customizable rules - transforming chaos into clarity.

## 🚀 Key Features

### 🧠 **Smart Import Separation** 
Automatically separates mixed imports like `import React, { useState, type FC } from 'react'` into clean, organized individual imports.

### 🎯 **Advanced AST Parsing**
Uses TypeScript's AST parser for robust, error-tolerant import analysis that handles complex syntax and edge cases.

### ⚡ **Intelligent Auto-Order System**
Resolves group order conflicts automatically and assigns missing order numbers - no more configuration headaches.

### 🎨 **Pixel-Perfect Alignment**
Aligns 'from' keywords across import groups for exceptional visual consistency.

### 📁 **Hierarchical Configuration**
Supports `.tidyjsrc` files and VS Code settings with intelligent merging and priority resolution.

### 🚀 **High Performance**
Advanced caching system with RegExp serialization for lightning-fast processing of large codebases.

### 🛡️ **Robust Error Handling**
Comprehensive validation with meaningful error messages and graceful degradation.

---

## 📸 Before & After Examples

### Mixed Import Separation

**Before TidyJS:**
```typescript
import { YpTable, YpDivider, YpTypography, YpElement, YpTag, YpButton } from 'ds';
import React, { FC, useState, type ReactNode, type ComponentProps } from 'react';
import cn from 'classnames';
import type { User } from '@app/dossier/models';
import { formatDate } from '@library/helpers';
import { useTranslation } from '@core/i18n';
import * as Utils from './utils';
```

**After TidyJS:**
```typescript
// React
import React from 'react';
import { FC, useState } from 'react';
import type { ReactNode, ComponentProps } from 'react';

// External Libraries  
import cn from 'classnames';

// DS Components
import { YpButton, YpDivider, YpElement, YpTag, YpTable, YpTypography } from 'ds';

// @app/dossier
import type { User } from '@app/dossier/models';

// @core
import { useTranslation } from '@core/i18n';

// @library
import { formatDate } from '@library/helpers';

// Local
import * as Utils from './utils';
```

### Complex Mixed Import Transformations

```typescript
// Input: Complex mixed import
import React, { useState, useEffect, type FC, type ReactNode } from 'react';

// Output: 4 perfectly organized imports
import React from 'react';
import { useState, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
```

---

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"TidyJS"**
4. Click **Install**

### Quick Setup
After installation, TidyJS works immediately with sensible defaults. For custom configuration, see the [Configuration Guide](#-configuration) below.

---

## 🎮 Usage

### Methods to Format Imports

1. **Command Palette**: `Ctrl+Shift+P` → "TidyJS: Format Imports"
2. **Format on Save**: Enable `editor.formatOnSave` in VS Code settings
3. **Right-click Context Menu**: Available in supported file types
4. **Custom Keyboard Shortcut**: Set your own keybinding (see Commands section below)

### Create Configuration File

**New in v1.5.6**: Easily create a `.tidyjsrc` configuration file:

1. **Command Palette**: `Ctrl+Shift+P` → "TidyJS: Create Configuration File"
2. **Choose Location**: Select where to save the configuration file
3. **Auto-Generated**: Creates a minimal config with sensible defaults

### Supported File Types
- **TypeScript**: `.ts`, `.tsx`
- **JavaScript**: `.js`, `.jsx`
- **All JS/TS variants**: Including React, Vue, Angular files

---

## ⚙️ Configuration

### Configuration Hierarchy

TidyJS uses a sophisticated configuration system with clear precedence:

1. **`.tidyjsrc`** (highest priority) - Project-specific JSON config
2. **`tidyjs.json`** - Alternative project config
3. **VS Code Workspace Settings** - Workspace-level configuration
4. **VS Code Global Settings** - User-level configuration
5. **Default Configuration** - Built-in sensible defaults

### Default Configuration

```json
{
  "tidyjs.debug": false,
  "tidyjs.groups": [
    {
      "name": "Misc",
      "order": 0,
      "isDefault": true
    }
  ],
  "tidyjs.importOrder": {
    "sideEffect": 3,
    "default": 0,
    "named": 1,
    "typeOnly": 2
  },
  "tidyjs.format": {
    "indent": 4,
    "removeUnusedImports": false,
    "removeMissingModules": false,
    "singleQuote": true,
    "bracketSpacing": true
  },
  "tidyjs.pathResolution": {
    "enabled": false,
    "mode": "relative",
    "preferredAliases": []
  },
  "tidyjs.excludedFolders": []
}
```

## 📂 Group Configuration

### Basic Group Setup

```json
{
  "tidyjs.groups": [
    {
      "name": "React",
      "match": "/^(react|react-dom|next)$/",
      "order": 1
    },
    {
      "name": "External Libraries",
      "match": "/^[^@.]/",
      "order": 2
    },
    {
      "name": "Internal",
      "match": "/^@app/",
      "order": 3
    },
    {
      "name": "Relative",
      "match": "/^\\./",
      "order": 4
    },
    {
      "name": "Misc",
      "order": 5,
      "isDefault": true
    }
  ]
}
```

### Advanced Group Patterns

```json
{
  "tidyjs.groups": [
    {
      "name": "React Ecosystem",
      "match": "/^(react|react-dom|react-router|next|gatsby)/",
      "order": 1,
      "priority": true,
      "sortOrder": ["react", "react-dom", "react-*", "*"]
    },
    {
      "name": "UI Libraries",
      "match": "/^(@mui|@mantine|antd|semantic-ui)/",
      "order": 2,
      "sortOrder": "alphabetic"
    },
    {
      "name": "State Management",
      "match": "/^(redux|@reduxjs|zustand|recoil|jotai)/",
      "order": 3
    },
    {
      "name": "Utilities",
      "match": "/^(lodash|ramda|date-fns|moment)/",
      "order": 4
    }
  ]
}
```

### Group Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Display name for the group (used in comments) |
| `match` | `string` | ❌ | Regex pattern to match import paths |
| `order` | `number` | ❌ | Sort order (auto-assigned if missing) |
| `isDefault` | `boolean` | ❌ | Default group for unmatched imports (exactly one required) |
| `priority` | `boolean` | ❌ | Higher priority within the same order |
| `sortOrder` | `"alphabetic"` or `string[]` | ❌ | Custom sorting within the group |

### 🤖 Auto-Order Resolution System

TidyJS features an intelligent auto-order system that eliminates configuration headaches:

**What it does:**
- ✅ Automatically assigns sequential orders starting from 0
- ✅ Resolves order conflicts by pushing collisions to next available slot
- ✅ Warns about unusually high order values (>1000)
- ✅ Maintains explicit order preferences when possible

**Example:**
```json
// Input configuration with conflicts
{
  "groups": [
    { "name": "React", "order": 1 },
    { "name": "Utils", "order": 1 },    // Collision!
    { "name": "External" },             // Missing order
    { "name": "Internal", "order": 0 }
  ]
}

// Auto-resolved result:
// Internal: 0 (kept original)
// External: 2 (auto-assigned) 
// React: 1 (kept original, no collision)
// Utils: 3 (collision resolved)
```

## 🎨 Format Options

### Import Order Configuration

Control the order of different import types within each group:

```json
{
  "tidyjs.importOrder": {
    "sideEffect": 0,    // import './styles.css'
    "default": 1,       // import React from 'react'
    "named": 2,         // import { useState } from 'react'
    "typeOnly": 3       // import type { FC } from 'react'
  }
}
```

### Formatting Options

```json
{
  "tidyjs.format": {
    "indent": 4,                    // Spaces for multiline imports
    "singleQuote": true,            // Use single quotes
    "bracketSpacing": true,         // Space inside import braces
    "removeUnusedImports": false,   // Remove unused imports
    "removeMissingModules": false   // Remove missing module imports
  }
}
```

### Advanced Options

```json
{
  "tidyjs.pathResolution": {
    "enabled": true,
    "mode": "absolute",                    // Convert to absolute paths
    "preferredAliases": ["@components", "@utils", "@/*"]
  },
  "tidyjs.excludedFolders": [
    "node_modules",
    "dist",
    "build",
    "coverage"
  ]
}
```

---

## 📁 Project Configuration Files

### `.tidyjsrc` (Recommended)

Create a `.tidyjsrc` file in your project root:

**Quick Setup**: Use the command palette (`Ctrl+Shift+P`) → "TidyJS: Create Configuration File" to automatically generate a `.tidyjsrc` file.

**Manual Setup**:

```json
{
  "$schema": "./node_modules/tidyjs/tidyjs.schema.json",
  "groups": [
    {
      "name": "React",
      "match": "^react",
      "order": 1
    },
    {
      "name": "External",
      "match": "^[^@./]",
      "order": 2
    },
    {
      "name": "Internal",
      "match": "^@/",
      "order": 3
    },
    {
      "name": "Relative",
      "match": "^\\.",
      "order": 4
    },
    {
      "name": "Misc",
      "order": 999,
      "isDefault": true
    }
  ],
  "format": {
    "indent": 2,
    "singleQuote": true,
    "removeUnusedImports": true
  }
}
```

### Config Extends Support

```json
{
  "extends": "./base-config.json",
  "groups": [
    {
      "name": "Project Specific",
      "match": "^@myproject/",
      "order": 1
    }
  ]
}
```

---

## 🧩 Supported Import Types

TidyJS handles ALL TypeScript/JavaScript import syntax with intelligent separation:

### Basic Import Types

| Type | Example | Internal Classification |
|------|---------|------------------------|
| **Side-effect** | `import './styles.css';` | `sideEffect` |
| **Default** | `import React from 'react';` | `default` |
| **Named** | `import { useState } from 'react';` | `named` |
| **Namespace** | `import * as Utils from './utils';` | `default` |

### TypeScript Type Imports

| Type | Example | Internal Classification |
|------|---------|------------------------|
| **Type Default** | `import type React from 'react';` | `typeDefault` |
| **Type Named** | `import type { FC } from 'react';` | `typeNamed` |
| **Type Namespace** | `import type * as Types from './types';` | `typeDefault` |

### Mixed Import Separation

TidyJS automatically separates **ALL** mixed import combinations:

```typescript
// All these mixed imports are automatically separated:

// Default + Named
import React, { useState } from 'react';
// → import React from 'react';
// → import { useState } from 'react';

// Named + Type Named  
import { useState, type FC } from 'react';
// → import { useState } from 'react';
// → import type { FC } from 'react';

// Default + Named + Type Named (3-way split)
import React, { useState, type FC } from 'react';
// → import React from 'react';
// → import { useState } from 'react';
// → import type { FC } from 'react';

// Default + Namespace
import React, * as ReactDOM from 'react-dom';
// → import React from 'react-dom';
// → import * as ReactDOM from 'react-dom';

// Type Default + Type Named
import type React, { FC } from 'react';
// → import type React from 'react';
// → import type { FC } from 'react';
```

### Complex Syntax Support

```typescript
// Aliased imports
import { useState as state, useEffect as effect } from 'react';

// Mixed aliases and types
import React, { Component as Comp, type FC } from 'react';

// Complex multiline imports (100+ specifiers supported)
import {
  Button,
  TextField,
  Grid,
  Paper,
  Dialog,
  // ... 100+ more imports
  type Theme,
  type Palette
} from '@mui/material';

// Unicode and special characters
import { café, naïve, 中文 } from 'unicode-module';
import worker from './worker?worker';
import styles from './component.module.css';
```

---

## 🛠️ Advanced Features

### Dynamic Group Creation

TidyJS automatically creates groups for common patterns:

```typescript
// Automatically creates "@app/auth" group
import { login } from '@app/auth/services';
import { AuthProvider } from '@app/auth/components';

// Automatically creates "@app/utils" group  
import { formatDate } from '@app/utils/date';
import { validateEmail } from '@app/utils/validation';
```

### Custom Sort Orders

Define precise ordering within groups:

```json
{
  "name": "React Ecosystem",
  "match": "^react",
  "sortOrder": [
    "react",
    "react-dom", 
    "react-*",
    "@types/react*",
    "*"
  ]
}
```

### Path Resolution

Convert between relative and absolute paths:

```json
{
  "pathResolution": {
    "enabled": true,
    "mode": "absolute",
    "preferredAliases": ["@components", "@utils", "@lib"]
  }
}
```

**Before:**
```typescript
import { Button } from '../../../components/ui/Button';
import { formatDate } from '../../utils/date';
```

**After:**
```typescript
import { Button } from '@components/ui/Button';
import { formatDate } from '@utils/date';
```

---

## 🛡️ Error Handling & Validation

### Robust Configuration Validation

TidyJS provides comprehensive validation with helpful error messages:

```
❌ Configuration Error Examples:
• "Multiple groups marked as default: React, Utils"
• "Invalid regex pattern in group 'External': Unterminated character class"
• "Duplicate group names found: Internal, Internal"
• "Invalid sortOrder in group 'React': array cannot be empty"
```

### Graceful Error Recovery

- **Malformed Imports**: Continues processing valid imports even with syntax errors
- **Invalid Regex**: Falls back to string matching for invalid patterns  
- **Missing Modules**: Optional removal of imports from non-existent packages
- **Parse Errors**: Detailed error reporting with line numbers and context

### Debug Mode

Enable comprehensive logging for troubleshooting:

```json
{
  "tidyjs.debug": true
}
```

**Debug Output Example:**
```
[TidyJS] Configuration loaded: 4 groups, 0 excluded folders
[TidyJS] Parsing document: 23 imports found
[TidyJS] Mixed import separated: React, { useState, type FC }
[TidyJS] Groups created: React (3), External (8), Internal (12)
[TidyJS] Formatting completed in 12.3ms
```

---

## 📋 Commands & Keybindings

### Available Commands

| Command | Description |
|---------|-------------|
| `tidyjs.forceFormatDocument` | Format imports in active file |
| `tidyjs.createConfigFile` | Create a new `.tidyjsrc` configuration file |

### Setting Up Keybindings

To add a keyboard shortcut for formatting imports:

1. Open VS Code Keyboard Shortcuts (`Ctrl+K Ctrl+S` / `Cmd+K Cmd+S`)
2. Search for "TidyJS: Format Imports"
3. Click the + icon to add your preferred keybinding

Or add directly to your keybindings.json:

```json
{
  "key": "cmd+alt+i",  // or your preferred shortcut
  "command": "tidyjs.forceFormatDocument",
  "when": "editorTextFocus"
}
```

---

## 🔧 Integration & Workflows

### Format on Save

Enable automatic formatting when saving files:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "Asmir.tidyjs"
}
```

### Team Configuration

Share configuration across your team using `.tidyjsrc`:

```json
{
  "$schema": "./node_modules/tidyjs/tidyjs.schema.json",
  "groups": [
    {
      "name": "React",
      "match": "^react",
      "order": 1
    },
    {
      "name": "Team Libraries", 
      "match": "^@company/",
      "order": 2
    }
  ],
  "format": {
    "removeUnusedImports": true,
    "singleQuote": true
  }
}

---

## 🐛 Troubleshooting

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Imports not formatting** | Ensure file type is supported (.ts, .tsx, .js, .jsx) |
| **Groups not matching** | Verify regex patterns are valid and properly escaped |
| **Configuration ignored** | Check configuration hierarchy and file locations |
| **Performance slow** | Enable debug mode to identify bottlenecks |
| **Mixed imports not separated** | Update to latest version (feature added in v1.5.0+) |

### Configuration Validation

Use the built-in validation to catch configuration errors:

```json
{
  "tidyjs.debug": true
}
```

Check the VS Code Output panel (View → Output → TidyJS) for validation messages.

### Getting Help

1. **Enable Debug Mode**: Set `tidyjs.debug: true`
2. **Check Output Panel**: View → Output → Select "TidyJS"
3. **Review Configuration**: Validate your `.tidyjsrc` or settings
4. **GitHub Issues**: Report bugs at [github.com/asmirbe/tidyjs](https://github.com/asmirbe/tidyjs)

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/asmirbe/tidyjs.git
cd tidyjs

# Install dependencies
npm install

# Start development mode
npm run dev

# Run tests
npm run test

# Build extension
npm run build
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development mode with file watching |
| `npm run test` | Run Jest unit tests |
| `npm run test:e2e` | Run end-to-end VS Code tests |  
| `npm run lint` | Lint codebase with ESLint |
| `npm run check` | Full validation (type check + lint + test) |
| `npm run build` | Build production extension |

### Contributing Guidelines

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with comprehensive tests
4. **Run validation**: `npm run check`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

---

## 📄 License

**MIT License** - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TypeScript Team** - For the excellent AST parser
- **VS Code Team** - For the comprehensive extension API
- **Community Contributors** - For feedback, bug reports, and feature requests

---

## 📞 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/asmirbe/tidyjs/issues)
- **Documentation**: [Complete guides and examples](./documentation/)
- **VS Code Marketplace**: [Extension page and reviews](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs)

---

<div align="center">

**Made with ❤️ for the TypeScript/JavaScript community**

⭐ **Star us on GitHub** if TidyJS helps organize your imports!

[⚡ Get TidyJS](https://marketplace.visualstudio.com/items?itemName=Asmir.tidyjs) | [📚 Documentation](./documentation/) | [🐛 Report Issues](https://github.com/asmirbe/tidyjs/issues)

</div>