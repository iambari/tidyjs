# Support des Alias Vite dans TidyJS

## Vue d'ensemble

TidyJS peut maintenant détecter et gérer automatiquement les alias définis dans différents systèmes de build :

- **TypeScript/JavaScript** : `tsconfig.json`, `jsconfig.json`
- **Vite** : `vite.config.js`, `vite.config.ts`, `vite.config.mjs`
- **Webpack** : `webpack.config.js`, `webpack.config.ts`

## Exemples de Configuration

### 1. Configuration Vite (Object notation)

```javascript
// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@utils': '/src/utils',
      '@api': '/src/api',
      '@assets': '/src/assets'
    }
  }
})
```

### 2. Configuration Vite (Array notation)

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
      { find: /^~(.+)/, replacement: path.resolve(__dirname, 'node_modules/$1') }
    ]
  }
})
```

### 3. Configuration TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@components/*": ["components/*"],
      "@utils/*": ["utils/*"]
    }
  }
}
```

## Utilisation dans TidyJS

### Configuration VS Code

```json
{
  "tidyjs.pathResolution": {
    "enabled": true,
    "mode": "absolute", // ou "relative"
    "preferredAliases": ["@components", "@utils", "@"]
  }
}
```

### Exemples de Conversion

#### Mode "absolute" (relatif → alias)

```typescript
// Avant
import { Button } from '../../../components/ui/Button'
import { formatDate } from '../../utils/date'

// Après
import { Button } from '@components/ui/Button'
import { formatDate } from '@utils/date'
```

#### Mode "relative" (alias → relatif)

```typescript
// Avant
import { Button } from '@components/ui/Button'
import { api } from '@api/client'

// Après
import { Button } from '../../../components/ui/Button'
import { api } from '../../api/client'
```

## Fonctionnement

1. **Détection automatique** : TidyJS cherche les fichiers de config dans l'ordre :
   - `vite.config.{js,ts,mjs}`
   - `tsconfig.json` / `jsconfig.json`
   - `webpack.config.{js,ts}`

2. **Priorité** : Le premier fichier trouvé est utilisé (en remontant depuis le fichier actuel)

3. **Cache intelligent** : Les configurations sont mises en cache par workspace

4. **Support des patterns** : Gère les wildcards (`*`) et les regex

## Cas d'usage

### 1. Migration de projet
Convertir tous les imports relatifs en alias lors de l'adoption de Vite :

```bash
# Activer le mode absolute dans VS Code
# Formatter tous les fichiers du projet
```

### 2. Cohérence d'équipe
Forcer un style d'import uniforme :

```json
{
  "tidyjs.pathResolution": {
    "enabled": true,
    "mode": "absolute"
  }
}
```

### 3. Refactoring
Changer facilement de style d'import selon les besoins.

## Limitations et Considérations

1. **Performance** : La première résolution peut être lente (lecture des fichiers)
2. **Configs dynamiques** : Les configurations JS complexes peuvent ne pas être totalement supportées
3. **Monorepos** : Cherche la config la plus proche du fichier actuel

## Extensibilité

Ajouter un nouveau système de build :

```typescript
const customLoader: ConfigLoader = {
    name: 'rollup',
    configFileNames: ['rollup.config.js'],
    extractAliases(configPath: string, content: string): PathMapping[] {
        // Logique d'extraction personnalisée
    }
};

// Dans l'extension
pathResolver.unifiedLoader.addLoader(customLoader);
```