# TidyJS Groups Configuration Guide

This guide explains how to configure import groups in TidyJS to organize your imports according to your project's conventions.

## Overview

The `tidyjs.groups` configuration allows you to define categories for organizing imports. Each group has a pattern to match import paths and an order to determine where it appears in the formatted output.

## Basic Structure

Each group in the `tidyjs.groups` array is an object with the following properties:

```typescript
{
  "name": string,          // Required: Display name for the group
  "order": number,         // Optional: Sort order (auto-assigned if missing)
  "match": string,         // Optional: Regex pattern to match import paths
  "isDefault": boolean,    // Optional: Mark as default group for unmatched imports
  "priority": number       // Optional: Priority for matching (rarely needed)
}
```

> **Note**: The `order` property is now optional thanks to the Auto-Order Resolution system. See [Auto-Order Resolution](#auto-order-resolution) below.

## Configuration Examples

### Simple Configuration

```json
{
  "tidyjs.groups": [
    {
      "name": "React",
      "match": "/^react/",
      "order": 0
    },
    {
      "name": "External",
      "match": "/^[a-zA-Z]/",
      "order": 1
    },
    {
      "name": "Internal",
      "match": "/^@/",
      "order": 2
    },
    {
      "name": "Relative",
      "match": "/^\\./",
      "order": 3
    },
    {
      "name": "Other",
      "order": 4,
      "isDefault": true
    }
  ]
}
```

This configuration will organize imports like:

```typescript
// React
import React from 'react';
import { useState } from 'react';

// External
import axios from 'axios';
import lodash from 'lodash';

// Internal
import { Button } from '@components/Button';
import { useAuth } from '@hooks/auth';

// Relative
import { helper } from './utils';
import styles from './styles.css';
```

### Advanced Configuration

```json
{
  "tidyjs.groups": [
    {
      "name": "React & Next",
      "match": "/^(react|react-dom|next)(\\/.*)?$/",
      "order": 0
    },
    {
      "name": "UI Libraries",
      "match": "/^(@mui|@emotion|styled-components)/",
      "order": 1
    },
    {
      "name": "State Management",
      "match": "/^(redux|recoil|zustand|@reduxjs)/",
      "order": 2
    },
    {
      "name": "Utilities",
      "match": "/^(lodash|ramda|date-fns|moment)/",
      "order": 3
    },
    {
      "name": "Testing",
      "match": "/^(@testing-library|jest|cypress)/",
      "order": 4
    },
    {
      "name": "Node Modules",
      "match": "/^[a-zA-Z0-9-]+$/",
      "order": 5
    },
    {
      "name": "Company Packages",
      "match": "/^@mycompany/",
      "order": 6
    },
    {
      "name": "App Modules",
      "match": "/^@app/",
      "order": 7
    },
    {
      "name": "Local",
      "match": "/^\\./",
      "order": 8
    },
    {
      "name": "Misc",
      "order": 9,
      "isDefault": true
    }
  ]
}
```

## Pattern Matching

### Regex Pattern Format

Patterns can be specified in two ways:

1. **Slash-delimited with flags**: `"/pattern/flags"`
   ```json
   "match": "/^react$/i"  // Case-insensitive exact match
   ```

2. **Plain string**: `"pattern"`
   ```json
   "match": "^react$"     // Converted to RegExp automatically
   ```

### Common Pattern Examples

```json
// Exact match
"match": "/^react$/"

// Starts with
"match": "/^@app/"

// Multiple packages
"match": "/^(axios|fetch|got)$/"

// Scoped packages
"match": "/^@[^/]+/"

// Local/relative imports
"match": "/^\\./"

// Specific file extensions
"match": "/\\.css$/"

// Any non-scoped package
"match": "/^[a-zA-Z0-9-]+$/"

// Case-insensitive
"match": "/^react/i"
```

## Matching Rules

1. **Order of evaluation**: Groups are evaluated in the order they appear in the configuration
2. **First match wins**: The first group whose pattern matches the import path is selected
3. **Default fallback**: If no patterns match, the import goes to the default group
4. **Display order**: After matching, groups are sorted by their `order` value

## Auto-Order Resolution

TidyJS includes an intelligent auto-order resolution system that automatically handles group ordering, eliminating configuration errors and simplifying setup.

### How It Works

The auto-order system operates in two phases:

1. **Collision Resolution**: Groups with conflicting explicit orders are automatically moved to the next available slot
2. **Auto-Assignment**: Groups without explicit orders receive sequential numbers starting from 0

### Benefits

- ✅ **No Configuration Errors**: Order collisions are automatically resolved
- ✅ **Simplified Setup**: No need to calculate order numbers manually  
- ✅ **Team-Friendly**: Multiple developers can add groups without conflicts
- ✅ **Zero Breaking Changes**: Existing configurations continue working

### Example: Auto-Resolution in Action

```json
// Configuration with conflicts:
{
  "tidyjs.groups": [
    { "name": "React", "match": "^react", "order": 1 },
    { "name": "Utils", "match": "^@/utils", "order": 1 },    // Collision!
    { "name": "Lodash", "match": "^lodash" },                // Missing order
    { "name": "Components", "match": "^@/components" },      // Missing order  
    { "name": "Misc", "order": 0, "isDefault": true }
  ]
}
```

**Auto-Resolution Result:**
```
Final order assignment:
- Misc: 0 (kept original, default group)
- Lodash: 1 (auto-assigned) 
- Components: 2 (auto-assigned)
- React: 1 → 3 (kept original)
- Utils: 1 → 4 (collision resolved)
```

### Debug Information

When order adjustments occur, debug information is logged:

```
[DEBUG] Group "Utils" order adjusted from 1 to 4 due to collision
[DEBUG] High order value detected: 1001 for group "External"
```

To see these logs, enable debug mode:
```json
{
  "tidyjs.debug": true
}
```

## Validation Rules

TidyJS validates your group configuration and will show errors for:

1. **No default group**: At least one group must have `isDefault: true`
2. **Multiple default groups**: Only one group can be marked as default
3. **Duplicate names**: Each group must have a unique name
4. **Invalid regex**: Match patterns must be valid regular expressions

> **Note**: Order conflicts are no longer validation errors - they're automatically resolved!

## Best Practices

### 1. Order by Dependency Type

```json
[
  { "name": "React", "order": 0 },         // Framework
  { "name": "External", "order": 1 },      // Third-party
  { "name": "Internal", "order": 2 },      // Internal packages
  { "name": "Components", "order": 3 },    // Shared components
  { "name": "Utils", "order": 4 },         // Utilities
  { "name": "Local", "order": 5 },         // Local files
  { "name": "Styles", "order": 6 },        // Style imports
  { "name": "Types", "order": 7 }          // Type definitions
]
```

### 2. Use Descriptive Names

Group names appear as comments in the formatted output:

```typescript
// React & Framework
import React from 'react';

// External Libraries
import axios from 'axios';

// Internal Modules
import { api } from '@app/api';
```

### 3. Keep Patterns Simple

Start with broad patterns and add specific ones as needed:

```json
{
  "tidyjs.groups": [
    { "name": "External", "match": "/^[^@.]/" },   // Auto-assigned order: 0
    { "name": "Scoped", "match": "/^@/" },         // Auto-assigned order: 1
    { "name": "Local", "match": "/^\\./" },        // Auto-assigned order: 2
    { "name": "Other", "isDefault": true }         // Auto-assigned order: 3
  ]
}
```

### 4. Mix Manual and Auto-Assignment

You can combine explicit orders with auto-assignment:

```json
{
  "tidyjs.groups": [
    { "name": "React", "match": "/^react/", "order": 0 },     // Explicit order
    { "name": "External", "match": "/^[^@.]/" },              // Auto-assigned: 1
    { "name": "Important", "match": "/^@critical/", "order": 1 }, // Collision → 2
    { "name": "Internal", "match": "/^@/" },                  // Auto-assigned: 3
    { "name": "Other", "isDefault": true }                    // Auto-assigned: 4
  ]
}
```

### 5. Test Your Patterns

Use a regex tester to verify your patterns match the expected import paths:
- `react` → Should match `/^react/`
- `@app/components` → Should match `/^@app/`
- `./utils` → Should match `/^\./`

## Dynamic Groups

TidyJS can automatically create groups for `@app` subfolders. When an import like `@app/auth/login` is encountered, TidyJS can create an `@app/auth` group dynamically.

This feature works with the base `@app` group and creates subgroups as needed.

## Troubleshooting

### Imports Not Matching Expected Group

1. Check pattern syntax - ensure proper escaping for special characters
2. Verify pattern order - earlier patterns take precedence
3. Enable debug mode to see matching details:
   ```json
   "tidyjs.debug": true
   ```

### Validation Errors

Common errors and solutions:

- **"No group is marked as default"**: Add `"isDefault": true` to one group
- **"Multiple groups are marked as default"**: Remove `isDefault` from all but one group
- **"Duplicate group names found"**: Ensure each group has a unique `name`
- **"Invalid regex pattern"**: Check your regex syntax, especially escape characters

> **Note**: "Duplicate group orders" errors no longer occur - order conflicts are automatically resolved by the Auto-Order Resolution system.

### Pattern Not Working

Test your pattern:
```javascript
// In browser console or Node.js
const pattern = /^@app\//;
console.log(pattern.test('@app/components'));  // Should be true
console.log(pattern.test('react'));            // Should be false
```

## Examples by Project Type

### React Project

```json
{
  "tidyjs.groups": [
    { "name": "React", "match": "/^(react|react-dom)$/", "order": 0 },
    { "name": "Router", "match": "/^react-router/" },              // Auto: 1
    { "name": "UI", "match": "/^(@mui|antd|semantic-ui)/" },       // Auto: 2
    { "name": "State", "match": "/^(redux|mobx|recoil)/" },        // Auto: 3
    { "name": "External", "match": "/^[a-zA-Z]/" },                // Auto: 4
    { "name": "Internal", "match": "/^@/" },                       // Auto: 5
    { "name": "Local", "match": "/^\\./", "order": 10 },           // Explicit
    { "name": "Other", "isDefault": true }                         // Auto: 11
  ]
}
```

### Node.js Project

```json
{
  "tidyjs.groups": [
    { "name": "Node", "match": "/^(fs|path|crypto|http|https)$/", "order": 0 },
    { "name": "Framework", "match": "/^(express|koa|fastify)/", "order": 1 },
    { "name": "Database", "match": "/^(mongoose|sequelize|typeorm)/", "order": 2 },
    { "name": "External", "match": "/^[a-zA-Z]/", "order": 3 },
    { "name": "Internal", "match": "/^@/", "order": 4 },
    { "name": "Local", "match": "/^\\./", "order": 5 },
    { "name": "Other", "order": 6, "isDefault": true }
  ]
}
```

### Monorepo Project

```json
{
  "tidyjs.groups": [
    { "name": "External", "match": "/^[^@.]/", "order": 0 },
    { "name": "Workspace", "match": "/^@mycompany/", "order": 1 },
    { "name": "Shared", "match": "/^@shared/", "order": 2 },
    { "name": "Apps", "match": "/^@apps/", "order": 3 },
    { "name": "Services", "match": "/^@services/", "order": 4 },
    { "name": "Utils", "match": "/^@utils/", "order": 5 },
    { "name": "Local", "match": "/^\\./", "order": 6 },
    { "name": "Other", "order": 7, "isDefault": true }
  ]
}
```