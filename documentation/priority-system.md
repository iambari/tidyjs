# Système de Priorité des Groupes TidyJS

## 🎯 Vue d'ensemble

Le système de priorité permet de résoudre les conflits lorsque plusieurs groupes d'imports matchent le même import. Avec la priorité, vous pouvez spécifier quel groupe doit "gagner" même si d'autres groupes matchent aussi.

## 🔧 Fonctionnement

### Algorithme de Résolution

1. **Collecte** : Trouve tous les groupes dont le pattern `match` correspond à l'import
2. **Tri par priorité** : Classe par priorité décroissante (plus élevée = gagne)
3. **Départage par ordre** : En cas d'égalité de priorité, utilise l'`order` (plus faible = gagne)
4. **Sélection** : Choisit le premier groupe du tri final

### Formule de Résolution
```
Groupe gagnant = MAX(priority) puis MIN(order) en cas d'égalité
```

## 📋 Configuration

### Syntaxe de Base

```json
{
  "tidyjs.groups": [
    {
      "name": "Other",
      "match": ".*",           // Match tout
      "order": 1,
      "priority": 0,           // Priorité faible
      "default": false
    },
    {
      "name": "React",
      "match": "^react",       // Match react spécifiquement  
      "order": 2,
      "priority": 10,          // Priorité élevée - gagne sur Other
      "default": false
    }
  ]
}
```

### Valeurs de Priorité

- **Non définie** : `priority` = 0 (par défaut)
- **Numérique** : Plus élevé = plus prioritaire
- **Recommandations** :
  - `0-1` : Groupes généraux (catch-all)
  - `2-5` : Groupes spécialisés
  - `6-10` : Groupes très spécifiques
  - `>10` : Groupes critiques

## 🎮 Exemples Pratiques

### Exemple 1 : React vs Général

**Configuration :**
```json
{
  "groups": [
    {
      "name": "General",
      "match": ".*",        // Match TOUT
      "order": 1,
      "priority": 0
    },
    {
      "name": "React", 
      "match": "^react",    // Match react
      "order": 2,
      "priority": 10        // Priorité plus élevée
    }
  ]
}
```

**Résultat :**
```typescript
import React from 'react';     // → Groupe "React" (priorité 10 > 0)
import lodash from 'lodash';   // → Groupe "General" (seul match)
```

### Exemple 2 : Patterns Imbriqués

**Configuration :**
```json
{
  "groups": [
    {
      "name": "AllExternal",
      "match": "^[^@./]",      // Tous les packages externes
      "order": 1,
      "priority": 1
    },
    {
      "name": "ReactFamily",
      "match": "^react",       // react*
      "order": 2, 
      "priority": 5
    },
    {
      "name": "ReactDom",
      "match": "^react-dom",   // react-dom spécifiquement
      "order": 3,
      "priority": 10           // Priorité maximale
    }
  ]
}
```

**Résultat :**
```typescript
import React from 'react';           // → ReactFamily (prio 5 > 1)
import { render } from 'react-dom';  // → ReactDom (prio 10 > 5 > 1)
import lodash from 'lodash';         // → AllExternal (seul match)
```

### Exemple 3 : Départage par Ordre

**Configuration :**
```json
{
  "groups": [
    {
      "name": "Group1",
      "match": "^react",
      "order": 5,
      "priority": 10         // Même priorité
    },
    {
      "name": "Group2",
      "match": "^react", 
      "order": 3,            // Ordre plus faible
      "priority": 10         // Même priorité
    }
  ]
}
```

**Résultat :**
```typescript
import React from 'react';  // → Group2 (même priorité, ordre 3 < 5)
```

## 🚨 Problèmes Courants

### 1. Pattern Trop Général Sans Priorité

**❌ Problématique :**
```json
{
  "groups": [
    {
      "name": "Everything", 
      "match": ".*",        // Match tout
      "order": 1            // Pas de priorité = 0
    },
    {
      "name": "React",
      "match": "^react",
      "order": 2            // Pas de priorité = 0
    }
  ]
}
```

**Résultat :** Tout va dans "Everything" (ordre 1 < 2)

**✅ Solution :**
```json
{
  "groups": [
    {
      "name": "Everything",
      "match": ".*",
      "order": 1,
      "priority": 0         // Priorité explicitement faible
    },
    {
      "name": "React", 
      "match": "^react",
      "order": 2,
      "priority": 5         // Priorité plus élevée
    }
  ]
}
```

### 2. Conflits de Priorité Non Résolus

**❌ Problématique :**
```json
{
  "groups": [
    {
      "name": "A",
      "match": "^react",
      "order": 1,
      "priority": 5
    },
    {
      "name": "B",
      "match": "^react",
      "order": 1,           // Même ordre
      "priority": 5         // Même priorité
    }
  ]
}
```

**Résultat :** Comportement indéterminé

**✅ Solution :**
```json
{
  "groups": [
    {
      "name": "A",
      "match": "^react",
      "order": 1,           // Ordre différent
      "priority": 5
    },
    {
      "name": "B", 
      "match": "^react",
      "order": 2,           // ou priorité différente
      "priority": 5
    }
  ]
}
```

## 🔍 Debug et Diagnostic

### Mode Debug

Activez le debug pour voir les résolutions de priorité :

```json
{
  "tidyjs.debug": true
}
```

**Logs typiques :**
```
[TidyJS] Multiple group matches for "react": [Other(p:0,o:1), React(p:10,o:2)] → chose "React"
```

### Vérification de Configuration

```typescript
// Utilisez cette fonction pour tester vos patterns
function testGroupPriority(source: string, groups: ConfigGroup[]) {
  const matches = groups
    .filter(g => g.match && g.match.test(source))
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Plus élevé d'abord
      }
      return a.order - b.order; // Plus faible d'abord
    });
  
  return matches[0]?.name || 'Default';
}
```

## 🏆 Bonnes Pratiques

### 1. Hiérarchie Logique

```json
{
  "groups": [
    {
      "name": "Catch-all",
      "match": ".*",
      "priority": 0,        // Plus faible
      "order": 999
    },
    {
      "name": "External",
      "match": "^[^@./]",
      "priority": 2,        // Moyen
      "order": 2
    },
    {
      "name": "React",
      "match": "^react",
      "priority": 8,        // Élevé
      "order": 1
    }
  ]
}
```

### 2. Nommage Explicite

```json
{
  "groups": [
    {
      "name": "React-Specific",      // Clair et précis
      "match": "^react$",
      "priority": 10
    },
    {
      "name": "React-Ecosystem",     // Moins spécifique
      "match": "^react-",
      "priority": 8
    }
  ]
}
```

### 3. Documentation des Priorités

```json
{
  "groups": [
    {
      "name": "React",
      "match": "^react",
      "priority": 10,       // HIGHEST: React core library
      "order": 1
    },
    {
      "name": "UI-Libraries", 
      "match": "^(@mui|antd|semantic-ui)",
      "priority": 7,        // HIGH: UI frameworks
      "order": 2
    },
    {
      "name": "External",
      "match": "^[^@./]",
      "priority": 3,        // MEDIUM: Other external packages
      "order": 3
    },
    {
      "name": "Internal",
      "match": "^@app/",
      "priority": 5,        // MEDIUM-HIGH: Internal modules  
      "order": 4
    }
  ]
}
```

## 📈 Performance

Le système de priorité a un impact minimal sur les performances :

- **Cache LRU** : Les résolutions sont mises en cache
- **Tri optimisé** : Seuls les groupes matchants sont triés
- **Early exit** : Arrêt dès le premier groupe trouvé

**Complexité :** O(n) où n = nombre de groupes matchants (généralement 1-3)

## 🔄 Migration

### Depuis l'Ancien Système

**Avant (ordre uniquement) :**
```json
{
  "groups": [
    {"name": "React", "match": "^react", "order": 1},
    {"name": "General", "match": ".*", "order": 2}
  ]
}
```

**Après (avec priorité) :**
```json
{
  "groups": [
    {"name": "General", "match": ".*", "order": 1, "priority": 0},
    {"name": "React", "match": "^react", "order": 2, "priority": 10}
  ]
}
```

**Résultat :** Comportement identique mais logique plus claire

---

**💡 Le système de priorité vous donne un contrôle total sur l'attribution des groupes, même avec des patterns complexes et imbriqués !**
