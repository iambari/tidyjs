<div align="center">
  <img src="https://i.imghippo.com/files/xHR6550fA.png" width="120" alt="TidyJS Logo" />
  <h1 align="center">TidyJS</h1>
  <p align="center">Automatically organizes and formats import declarations in <code>TypeScript</code> and <code>JavaScript</code> files. It groups imports by customizable categories, perfectly aligns <code>from</code> keywords, and intelligently sorts imports by type and length.</p>
</div>

## ✨ Features

- 📋 Group imports by configurable categories
- 📐 Align 'from' keywords for improved readability
- 🔄 Sort imports by type hierarchy (side-effects, default, named, type)
- ⚛️ Handle higher priority imports with special priority
    - First name in regex group is higher priority
- 🔧 Dynamically create groups based on import paths
- 🔠 Support for TypeScript, JavaScript, TSX and JSX files
- ⚙️ Configurable spacing and maximum line length

## 🔍 Example

### Before:

```typescript
import { YpTable, YpDivider, YpTypography, YpElement, YpTag, YpButton } from 'ds';
import React, { FC, useState } from 'react';
import cn from 'classnames';
import type { User } from '@app/dossier/models';
import { formatDate } from '@library/helpers';
import { useTranslation } from '@core/i18n';
```

### After:

```typescript
// Misc
import React, { FC, useState } from 'react';
import cn                      from 'classnames';

// DS
import {
    YpButton,
    YpDivider,
    YpElement,
    YpTag,
    YpTable,
    YpTypography
} from 'ds';

// @app/dossier
import type { User } from '@app/dossier/models';

// @core
import { useTranslation } from '@core/i18n';

// @library
import { formatDate } from '@library/helpers';
```

## ⚙️ Configuration

```json
{
  "tidyjs.groups": [
    {
      "name": "Misc",
      "regex": "^(react|lodash|date-fns)$",
      "order": 0
    },
    {
      "name": "DS",
      "regex": "^ds$",
      "order": 1
    },
    {
      "name": "@app/dossier",
      "regex": "^@app\\/dossier",
      "order": 2
    }
    // other groups...
  ],
  "tidyjs.formatOnSave": false,
}
```

## 🚀 Usage

- Use the keyboard shortcut <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> on macOS)
- Use the "Format Imports" command from the command palette
- Enable automatic formatting on save by setting `"tidyjs.formatOnSave": true` in your VS Code settings

## 📊 Import Sorting Rules

TidyJS sorts imports according to the following hierarchy:

1. **React imports** always come first within their group
2. **Side-effect imports** (e.g., `import 'module'`)
3. **Default non-type imports**
4. **Named non-type imports**
5. **Default type imports**
6. **Named type imports**

Within each category, imports are sorted alphabetically.