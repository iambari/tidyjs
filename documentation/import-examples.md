# TidyJS - Exemples d'imports supportés

Ce document présente tous les types d'imports supportés par TidyJS et comment ils sont traités.

## Types d'imports de base

### 1. Imports d'effet de bord (Side Effect)

```typescript
// Input
import './styles.css';
import 'normalize.css';

// Output (inchangé)
import './styles.css';
import 'normalize.css';
```

### 2. Imports par défaut (Default)

```typescript
// Input
import React from 'react';
import lodash from 'lodash';

// Output (inchangé)  
import React from 'react';
import lodash from 'lodash';
```

### 3. Imports nommés (Named)

```typescript
// Input
import { useState, useEffect } from 'react';
import { map, filter } from 'lodash';

// Output (consolidé et trié)
import { useEffect, useState } from 'react';
import { filter, map } from 'lodash';
```

### 4. Imports namespace (Namespace)

```typescript
// Input
import * as React from 'react';
import * as Utils from './utils';

// Output (inchangé)
import * as React from 'react';
import * as Utils from './utils';
```

### 5. Imports de types par défaut (Type Default)

```typescript
// Input
import type React from 'react';
import type Component from './Component';

// Output (inchangé)
import type React from 'react';
import type Component from './Component';
```

### 6. Imports de types nommés (Type Named)

```typescript
// Input
import type { FC, ReactNode } from 'react';
import type { Config, Options } from './types';

// Output (consolidé et trié)
import type { FC, ReactNode } from 'react';
import type { Config, Options } from './types';
```

### 7. Imports de types namespace (Type Namespace)

```typescript
// Input
import type * as React from 'react';
import type * as Types from './types';

// Output (inchangé)
import type * as React from 'react';
import type * as Types from './types';
```

## Imports mixtes - La fonctionnalité phare ✨

### 1. Default + Named

```typescript
// Input
import React, { useState, useEffect } from 'react';

// Output (séparé automatiquement)
import React from 'react';
import { useEffect, useState } from 'react';
```

### 2. Named + Type Named (Le bug principal corrigé)

```typescript
// Input
import { useState, useEffect, type FC, type ReactNode } from 'react';

// Output (séparé automatiquement)
import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
```

### 3. Default + Named + Type Named (Complexe)

```typescript
// Input
import React, { useState, useEffect, type FC, type ReactNode } from 'react';

// Output (séparé en 3 imports)
import React from 'react';
import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
```

### 4. Default + Namespace

```typescript
// Input
import React, * as ReactDOM from 'react-dom';

// Output (séparé automatiquement)
import React from 'react-dom';
import * as ReactDOM from 'react-dom';
```

### 5. Type Default + Type Named

```typescript
// Input
import type React, { FC, ReactNode } from 'react';

// Output (séparé automatiquement)
import type React from 'react';
import type { FC, ReactNode } from 'react';
```

### 6. Type Default + Type Namespace

```typescript
// Input
import type React, * as Types from 'react';

// Output (séparé automatiquement)
import type React from 'react';
import type * as Types from 'react';
```

## Cas complexes avec aliases

### 1. Imports nommés avec aliases

```typescript
// Input
import { useState as state, useEffect as effect, type FC as Component } from 'react';

// Output (séparé et trié)
import { useEffect as effect, useState as state } from 'react';
import type { FC as Component } from 'react';
```

### 2. Imports mixtes avec aliases

```typescript
// Input
import React, { useState as state, type FC as Component } from 'react';

// Output (séparé automatiquement)
import React from 'react';
import { useState as state } from 'react';
import type { FC as Component } from 'react';
```

## Consolidation intelligente

### Avant (multiple imports de la même source)

```typescript
import { useState } from 'react';
import { useEffect } from 'react';
import type { FC } from 'react';
import type { ReactNode } from 'react';
import React from 'react';
```

### Après (consolidé par type)

```typescript
import React from 'react';
import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
```

## Exemple complet avec groupes

### Input (désorganisé)

```typescript
import { YpTable, YpButton } from 'ds';
import React, { useState, useEffect, type FC, type ReactNode } from 'react';
import { debounce } from 'lodash';
import './styles.css';
import type { User } from '@app/models';
import * as Utils from './utils';
import { formatDate } from '@library/helpers';
```

### Output (organisé avec séparation intelligente)

```typescript
// Side Effects
import './styles.css';

// React  
import React from 'react';
import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';

// External Libraries
import { debounce } from 'lodash';

// DS Components
import { YpButton, YpTable } from 'ds';

// @app
import type { User } from '@app/models';

// @library  
import { formatDate } from '@library/helpers';

// Local
import * as Utils from './utils';
```

## Avantages de la séparation

### 1. Clarté du code
- Types séparés des valeurs
- Intention plus claire
- Facilite la compréhension

### 2. Meilleure maintenance
- Imports by type plus faciles à gérer
- Détection des imports inutilisés plus précise
- Refactoring plus sûr

### 3. Performances 
- Tree-shaking optimisé
- Bundling plus efficace
- Analyse statique améliorée

### 4. Standards modernes
- Suit les bonnes pratiques TypeScript
- Compatible avec les outils modernes
- Prépare pour les futures évolutions du langage

## Configuration recommandée

```json
{
    "tidyjs.groups": [
        {
            "name": "Side Effects",
            "match": "/\\.(css|scss|sass)$/",
            "order": 0
        },
        {
            "name": "React",
            "match": "/^(react|react-dom)$/",
            "order": 1
        },
        {
            "name": "External",
            "match": "/^[^@.]/",
            "order": 2
        },
        {
            "name": "@app",
            "match": "/^@app/",
            "order": 3
        },
        {
            "name": "Local",
            "order": 4,
            "default": true
        }
    ],
    "tidyjs.importOrder": {
        "sideEffect": 0,
        "default": 1,
        "named": 2,
        "typeOnly": 3
    }
}
```

Cette configuration garantit un ordre optimal et tire parti de toutes les fonctionnalités de séparation intelligente de TidyJS.