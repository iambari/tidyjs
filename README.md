# TidyJS

A VS Code extension that automatically organizes and formats import declarations in TypeScript and JavaScript files. It groups imports by customizable categories, aligns 'from' keywords, and intelligently separates mixed import types.

## Features

-   **Smart Import Separation**: Automatically separates mixed imports (e.g., `import { useState, type FC } from 'react'` becomes two separate imports)
-   **Comprehensive Type Support**: Full support for all import types including TypeScript type imports and namespaces
-   **Intelligent Grouping**: Group imports by configurable categories with regex patterns
-   **Auto-Order Resolution**: Intelligent automatic ordering that resolves conflicts and assigns missing orders
-   **Perfect Alignment**: Align 'from' keywords for improved readability
-   **Flexible Sorting**: Sort imports by customizable type hierarchy
-   **Advanced Cache System**: Smart caching with RegExp support for optimal performance
-   **Robust Validation**: Configuration validation with detailed error messages
-   **Dynamic Groups**: Automatically create groups for @app subfolders
-   **Multi-Language Support**: TypeScript, JavaScript, TSX and JSX files
-   **Non-Intrusive Logging**: Debug logging without UI interruption

## Example

### Smart Import Separation

TidyJS intelligently separates mixed imports for better organization:

#### Before
```typescript
import { YpTable, YpDivider, YpTypography, YpElement, YpTag, YpButton } from 'ds';
import React, { FC, useState, type ReactNode, type ComponentProps } from 'react';
import cn from 'classnames';
import type { User } from '@app/dossier/models';
import { formatDate } from '@library/helpers';
import { useTranslation } from '@core/i18n';
import * as Utils from './utils';
```

#### After
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

### All Import Types Supported

```typescript
// Side-effect imports
import './styles.css';

// Default imports
import React from 'react';

// Named imports
import { useState, useEffect } from 'react';

// Namespace imports
import * as ReactDOM from 'react-dom';

// Type default imports
import type React from 'react';

// Type named imports
import type { FC, ReactNode } from 'react';

// Type namespace imports
import type * as Types from './types';

// Mixed imports (automatically separated)
import React, { useState, type FC } from 'react';
// ↓ Becomes ↓
import React from 'react';
import { useState } from 'react';
import type { FC } from 'react';
```

## Installation

### Stable Version
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "TidyJS"
4. Click Install

## Usage

### Manual Formatting

-   Use the keyboard shortcut `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (macOS)
-   Or use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "TidyJS: Format Imports"

## Configuration

### Basic Configuration

```json
{
    "tidyjs.groups": [
        {
            "name": "React",
            "match": "/^(react|react-dom|next)$/",
            "order": 0
        },
        {
            "name": "External",
            "match": "/^[^@]/",
            "order": 1
        },
        {
            "name": "Internal",
            "match": "/^@app/",
            "order": 2
        },
        {
            "name": "Misc",
            "order": 3,
            "isDefault": true
        }
    ]
}
```

### Configuration Options

#### Import Groups

`tidyjs.groups` - Array of import group definitions

Each group can have:

-   `name` (required): The name of the group (used in comments)
-   `match` (optional): Regex pattern to match import paths
-   `order` (optional): Numeric order for sorting groups (auto-assigned if missing)
-   `isDefault` (optional): Mark as default group for unmatched imports

**Important**: Exactly one group must have `isDefault: true`

> **New**: The `order` property is now optional! TidyJS includes an intelligent Auto-Order Resolution system that automatically assigns order numbers and resolves conflicts. See [Groups Configuration Guide](./documentation/groups-configuration.md#auto-order-resolution) for details.

#### Format Options

-   `tidyjs.format.removeUnusedImports`: Remove imports that aren't used in the code (default: `false`)
-   `tidyjs.format.removeMissingModules`: Remove imports from non-existent modules (default: `false`)

#### Import Order

`tidyjs.importOrder` - Configure the order of import types within groups:

```json
{
    "tidyjs.importOrder": {
        "sideEffect": 0,
        "default": 1,
        "named": 2,
        "typeOnly": 3
    }
}
```

**Import Types Explained:**
- `sideEffect`: Side-effect imports like `import './styles.css'`
- `default`: Default imports like `import React from 'react'`
- `named`: Named imports like `import { useState } from 'react'`
- `typeOnly`: Type imports like `import type { FC } from 'react'`

**Note**: Mixed imports are automatically separated into their respective types.

#### Other Options

-   `tidyjs.excludedFolders`: Array of folder names to exclude from processing
-   `tidyjs.debug`: Enable debug logging (default: `false`)

## Import Processing Rules

### Automatic Import Separation

TidyJS intelligently separates mixed imports for better organization:

```typescript
// Input
import React, { useState, type FC } from 'react';

// Output (3 separate imports)
import React from 'react';                    // Default import
import { useState } from 'react';             // Named import  
import type { FC } from 'react';              // Type import
```

### Sorting Hierarchy

Within each group, imports are sorted by:

1. **React Priority**: React imports always come first within their group
2. **Type Order**: Configurable via `importOrder` (default: sideEffect → default → named → typeOnly)
3. **Alphabetical**: Within each type, imports are sorted alphabetically

### Supported Import Types

| Type | Example | Description |
|------|---------|-------------|
| Side-effect | `import './styles.css'` | Imports with side effects only |
| Default | `import React from 'react'` | Default imports |
| Named | `import { useState } from 'react'` | Named imports |
| Namespace | `import * as Utils from './utils'` | Namespace imports (treated as default) |
| Type Default | `import type React from 'react'` | TypeScript type default imports |
| Type Named | `import type { FC } from 'react'` | TypeScript type named imports |
| Type Namespace | `import type * as Types from './types'` | TypeScript type namespace imports |

### Mixed Import Handling

All combinations of mixed imports are automatically separated:
- Default + Named → Separate imports
- Default + Namespace → Separate imports  
- Named + Type Named → Separate imports
- Default + Named + Type → Three separate imports
- And all other combinations...

## Troubleshooting

### Common Issues

1. **Configuration validation errors**: Check the output panel (View > Output > TidyJS) for detailed error messages
2. **Imports not formatting**: Ensure the file type is supported (TS, JS, TSX, JSX)
3. **Groups not matching**: Verify your regex patterns are correctly formatted

### Debug Mode

Enable debug logging to troubleshoot issues:

```json
{
    "tidyjs.debug": true
}
```

Then check the output panel for detailed logs.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request
For a detailed guide, see [documentation](documentation/README.md).
