# TidyJS

A VS Code extension that automatically organizes and formats import declarations in TypeScript and JavaScript files. It groups imports by customizable categories, aligns 'from' keywords, and sorts imports by type and length.

## Features

-   Group imports by configurable categories
-   Align 'from' keywords for improved readability
-   Sort imports by type hierarchy (side-effects, default, named, type)
-   Remove unused imports and missing modules (optional)
-   Dynamically create groups for @app subfolders
-   Support for TypeScript, JavaScript, TSX and JSX files
-   Configuration validation with helpful error messages

## Example

### Before

```typescript
import { YpTable, YpDivider, YpTypography, YpElement, YpTag, YpButton } from 'ds';
import React, { FC, useState } from 'react';
import cn from 'classnames';
import type { User } from '@app/dossier/models';
import { formatDate } from '@library/helpers';
import { useTranslation } from '@core/i18n';
```

### After

```typescript
// Misc
import React, { FC, useState } from 'react';
import cn from 'classnames';

// DS
import { YpButton, YpDivider, YpElement, YpTag, YpTable, YpTypography } from 'ds';

// @app/dossier
import type { User } from '@app/dossier/models';

// @core
import { useTranslation } from '@core/i18n';

// @library
import { formatDate } from '@library/helpers';
```

## Installation

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
-   `order` (required): Numeric order for sorting groups
-   `isDefault` (optional): Mark as default group for unmatched imports

**Important**: Exactly one group must have `isDefault: true`

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

#### Other Options

-   `tidyjs.excludedFolders`: Array of folder names to exclude from processing
-   `tidyjs.debug`: Enable debug logging (default: `false`)

## Import Sorting Rules

TidyJS sorts imports according to the following hierarchy:

1. React imports always come first within their group
2. Side-effect imports (e.g., `import 'module'`)
3. Default imports
4. Named imports
5. Type-only imports

Within each category, imports are sorted alphabetically.

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

Contributions are welcome! Please feel free to submit a Pull Request.
