# Gestion des Imports Non Utilisés et Modules Manquants

Cette documentation explique comment TidyJS gère les imports non utilisés, y compris ceux provenant de modules inexistants.

## Fonctionnalités

### 1. Détection des Imports Non Utilisés Classiques

TidyJS détecte automatiquement les imports qui ne sont pas utilisés dans votre code grâce aux diagnostics TypeScript/JavaScript de VS Code.

```typescript
import React, { useState, useEffect } from 'react'; // useEffect non utilisé
import { format } from 'date-fns'; // format non utilisé

export default function Component() {
  const [state, setState] = useState(0);
  return <div>{state}</div>;
}
```

**Résultat après nettoyage:**
```typescript
import React, { useState } from 'react';

export default function Component() {
  const [state, setState] = useState(0);
  return <div>{state}</div>;
}
```

### 2. Détection des Modules Manquants (Nouvelle Fonctionnalité)

TidyJS peut également détecter et supprimer les imports provenant de modules qui n'existent pas ou ne peuvent pas être trouvés.

**Exemple avec le fichier `11-mixed-import-fix.tsx`:**

```typescript
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
  createContext,
  memo,
  forwardRef,
  lazy,
  Suspense
} from 'react';
import { WsDataModel } from '@library/form-new/models/ProviderModel'; // Module inexistant !

export default function TestComponent() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    console.log('Effect');
  }, []);
  
  const memoizedValue = useMemo(() => state, [state]);
  const callbackFn = useCallback(() => {}, []);
  
  return React.createElement('div', null, 'Test');
}
```

**Problème détecté:**
- `@library/form-new/models/ProviderModel` → Module non trouvé
- Plusieurs imports React non utilisés: `useRef`, `useContext`, `createContext`, `memo`, `forwardRef`, `lazy`, `Suspense`
- `WsDataModel` importé mais jamais utilisé

**Résultat après nettoyage (avec `removeMissingModules: true`):**
```typescript
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo
} from 'react';

export default function TestComponent() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    console.log('Effect');
  }, []);
  
  const memoizedValue = useMemo(() => state, [state]);
  const callbackFn = useCallback(() => {}, []);
  
  return React.createElement('div', null, 'Test');
}
```

## Configuration

### Option `removeUnused`

Active la suppression des imports non utilisés détectés par TypeScript.

```json
{
  "tidyjs.format.removeUnused": true
}
```

### Option `removeMissingModules` (Nouvelle)

Active la suppression des imports provenant de modules inexistants.

```json
{
  "tidyjs.format.removeMissingModules": true
}
```

## Comment ça Fonctionne

### 1. Détection via Diagnostics VS Code

TidyJS utilise le système de diagnostics de VS Code pour identifier:

**Imports non utilisés (codes diagnostic):**
- `6192` - Import non utilisé
- `6133` - Variable déclarée mais jamais utilisée
- `unused-import` - Import non utilisé (ESLint)

**Modules manquants (codes diagnostic):**
- `2307` - Cannot find module
- `2318` - Cannot find module or its corresponding type declarations

### 2. Processus de Nettoyage

1. **Analyse des diagnostics** - Récupère les erreurs/warnings de VS Code
2. **Identification des imports problématiques** - Filtre par codes de diagnostic
3. **Mapping avec les imports parsés** - Associe avec les imports détectés par TidyJS
4. **Suppression granulaire** - Supprime specifiers individuels ou imports complets
5. **Préservation des side-effects** - Garde toujours les imports comme `import './styles.css'`

### 3. Types de Suppression

**Suppression partielle:**
```typescript
// Avant
import { Component, useState, useEffect } from 'react';
// Si Component et useEffect sont non utilisés

// Après
import { useState } from 'react';
```

**Suppression complète:**
```typescript
// Avant
import { CompletelyUnused } from '@missing/module';

// Après
// (import complètement supprimé)
```

## API pour Tests

### `getMissingModuleImports(uri, parserResult)`

Retourne la liste des modules manquants détectés.

### `getUnusedImports(uri, parserResult, includeMissingModules)`

Retourne les imports non utilisés, avec option d'inclure les modules manquants.

### `removeUnusedImports(parserResult, unusedImports)`

Supprime les imports spécifiés du résultat du parser.

## Exemples de Tests

```typescript
// Test avec module manquant
const sourceCode = `
  import React from 'react';
  import { MissingType } from '@missing/module';
  import { useState } from 'react';
`;

const unusedImports = ['MissingType']; // Module manquant
const result = removeUnusedImports(parserResult, unusedImports);

// Résultat: garde React et useState, supprime MissingType
```

## Avantages

1. **Nettoyage automatique** - Supprime automatiquement les imports problématiques
2. **Réduction de la taille des bundles** - Élimine les imports inutiles
3. **Amélioration de la maintenance** - Code plus propre et plus lisible
4. **Détection proactive** - Identifie les modules manquants avant le build
5. **Configuration flexible** - Options séparées pour différents types de nettoyage

## Cas d'Usage

- **Refactoring de code** - Suppression d'anciens imports après modification
- **Migration de dépendances** - Nettoyage après changement de librairies
- **Optimisation de performance** - Réduction des imports inutiles
- **Maintenance de projets** - Nettoyage régulier des imports obsolètes