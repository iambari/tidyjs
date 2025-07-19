# Path Resolution Feature Design for TidyJS

## Overview

This document outlines how to implement import path resolution in TidyJS, allowing users to convert between relative paths and absolute paths with aliases.

## Feature Requirements

1. **Convert relative imports to absolute with aliases**
   ```typescript
   // Before
   import { Button } from '../../../components/ui/Button';
   
   // After (with alias)
   import { Button } from '@components/ui/Button';
   ```

2. **Convert aliased imports to relative paths**
   ```typescript
   // Before
   import { utils } from '@utils/helpers';
   
   // After
   import { utils } from '../../utils/helpers';
   ```

## Implementation Strategy

### 1. Configuration

Add new settings to VS Code configuration:

```json
{
  "tidyjs.pathResolution": {
    "enabled": false,
    "mode": "relative", // or "absolute"
    "preferredAliases": ["@components", "@utils", "@/*"]
  }
}
```

### 2. Architecture Components

#### A. PathResolver Class
- Reads and parses tsconfig.json/jsconfig.json
- Caches configuration for performance
- Resolves aliases to actual file paths
- Converts between relative and absolute paths

#### B. Integration Points

1. **Parser Integration**
   - Modify `ImportInfo` type to include `resolvedPath`
   - Add path resolution step during parsing

2. **Formatter Integration**
   - Apply path transformations before final output
   - Preserve original path if resolution fails

### 3. Algorithm

#### For Converting to Absolute (with aliases):
1. Parse tsconfig.json to get path mappings
2. Resolve relative import to absolute file path
3. Match absolute path against configured aliases
4. Select best matching alias (most specific)
5. Replace path with aliased version

#### For Converting to Relative:
1. Parse tsconfig.json to get path mappings
2. Resolve alias to absolute file path
3. Calculate relative path from current file
4. Ensure proper `./` or `../` prefix

### 4. Edge Cases

- **Missing files**: Keep original path if target doesn't exist
- **Multiple matches**: Use most specific alias
- **No tsconfig**: Disable feature gracefully
- **Monorepo**: Search for nearest tsconfig.json
- **Dynamic imports**: Support same transformations

### 5. Performance Considerations

- Cache tsconfig.json parsing results
- Cache path resolution results
- Invalidate cache on tsconfig changes
- Use VS Code file watcher for efficiency

### 6. User Experience

- Add command: "TidyJS: Convert Import Paths"
- Show progress for bulk conversions
- Provide undo support
- Log warnings for failed conversions

## Example Implementation Flow

```typescript
// In extension.ts
if (config.pathResolution?.enabled) {
    const pathResolver = new PathResolver({
        mode: config.pathResolution.mode || 'relative',
        preferredAliases: config.pathResolution.preferredAliases
    });
    
    // Pass to parser
    const parserResult = parser.parse(documentText, {
        pathResolver,
        // ... other options
    });
}

// In parser.ts
if (options.pathResolver) {
    for (const importInfo of imports) {
        const resolvedPath = await options.pathResolver.convertImportPath(
            importInfo.source,
            document
        );
        if (resolvedPath) {
            importInfo.resolvedSource = resolvedPath;
        }
    }
}

// In formatter.ts
const importPath = importInfo.resolvedSource || importInfo.source;
```

## Benefits

1. **Consistency**: Enforce consistent import style across project
2. **Refactoring**: Easier to move files without breaking imports  
3. **Readability**: Cleaner imports with aliases
4. **Flexibility**: Switch between styles as needed

## Challenges

1. **TypeScript Complexity**: Handle all tsconfig edge cases
2. **Performance**: Minimize file system operations
3. **Compatibility**: Work with different project structures
4. **Accuracy**: Ensure correct path resolution

## Future Enhancements

1. Auto-detect preferred style from existing code
2. Support custom resolution strategies
3. Integration with TypeScript Language Service
4. Bulk conversion commands
5. Project-wide import optimization