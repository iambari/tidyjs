# Path Resolution Examples & Troubleshooting

## Important: Understanding Conversion Modes

### Mode: `"relative"` - Converts TO relative paths
Use this when you want to convert aliased imports (`@app/...`) to relative paths (`../...`)

```json
{
  "tidyjs.pathResolution.enabled": true,
  "tidyjs.pathResolution.mode": "relative"
}
```

**Example:**
```typescript
// Before (with aliases)
import { Button } from '@app/components/Button';

// After (relative)
import { Button } from '../../../components/Button';
```

### Mode: `"absolute"` - Converts TO absolute paths with aliases
Use this when you want to convert relative imports (`../...`) to aliased paths (`@app/...`)

```json
{
  "tidyjs.pathResolution.enabled": true,
  "tidyjs.pathResolution.mode": "absolute"
}
```

**Example:**
```typescript
// Before (relative)
import { Button } from '../../../components/Button';

// After (with aliases)
import { Button } from '@app/components/Button';
```

## Your Use Case

Based on your example with imports like:
```typescript
import LiaisonsComptablesListComponent from '@app/dossier/components/postproduction/liaisons-comptables/LiaisonsComptablesListComponent';
```

You have **aliased imports** that you want to convert to **relative paths**.

**Solution:** Use mode `"relative"`, not `"absolute"`:

```json
{
  "tidyjs.pathResolution.enabled": true,
  "tidyjs.pathResolution.mode": "relative"  // This will convert @app/... to ../...
}
```

## Common Issues

### 1. No conversions happening

**Check:**
- Is the config file being found? Look for "Found vite config at:" in debug logs
- Are the aliases properly defined in your config?
- Are you using the correct mode for your needs?

### 2. Too many ENOENT errors in logs

This is normal - the extension searches for config files in multiple locations. These errors are now filtered out in the latest version.

### 3. Parse errors in tsconfig.json

The error "Expected double-quoted property name in JSON at position 187" suggests your tsconfig.json might have:
- Comments (not supported in strict JSON)
- Trailing commas
- Single quotes instead of double quotes

**Fix:** Ensure your tsconfig.json is valid JSON.

## Debugging

Enable debug mode to see what's happening:

```json
{
  "tidyjs.debug": true,
  "tidyjs.pathResolution.enabled": true,
  "tidyjs.pathResolution.mode": "relative"
}
```

Look for these key logs:
- `Found vite config at: ...` - Config file detected
- `Applying path resolution with mode: ...` - Resolution started
- `Path resolved: ... -> ...` - Successful conversion
- `Path resolution summary: X/Y imports converted` - Final summary