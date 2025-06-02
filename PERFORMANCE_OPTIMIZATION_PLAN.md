# Plan d'Optimisation des Performances TidyJS

## 🎯 Résumé Exécutif

L'analyse des performances a révélé plusieurs goulots d'étranglement majeurs dans l'extension TidyJS. Ce document présente un plan de refactoring priorisé pour améliorer significativement la vitesse de formatage.

## 🔍 Problèmes Identifiés

### **Parsing AST répété** (Impact: MOYEN)
- **Problème**: Le document est parsé plusieurs fois (TypeScript ESLint + Babel)
- **Impact**: 20-40ms de surcharge

### **Regex dans des boucles O(n*m)** (Impact: MOYEN)
- **Problème**: Chaque import teste toutes les regex de groupes
- **Impact**: Complexité quadratique sur gros fichiers

### **Configuration rechargée à chaque appel** (Impact: FAIBLE)
- **Problème**: La config VS Code est lue et validée à chaque `getConfig()`
- **Impact**: 5-10ms par appel

### **Allocations mémoire excessives** (Impact: FAIBLE)
- **Problème**: Multiples copies d'objets et arrays temporaires
- **Impact**: Pression GC sur gros fichiers

## 🚀 Solutions Implémentées

### ✅ 1. Cache des Diagnostics (TERMINÉ)
```typescript
// Nouveau: src/utils/diagnostics-cache.ts
class DiagnosticsCache {
    getDiagnostics(uri: Uri): readonly Diagnostic[]
}
```
- **Gain attendu**: -50% sur les appels diagnostics
- **Risque**: Aucun (cache TTL court de 100ms)

### ✅ 2. Mesures de Performance (TERMINÉ)
```typescript
// Nouveau: src/utils/performance.ts
class PerformanceMonitor {
    measureSync<T>(operation: string, fn: () => T): T
    measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T>
}
```
- **Bénéfice**: Visibilité sur les goulots d'étranglement
- **Risque**: Aucun (activé seulement en mode debug)

### ✅ 3. Benchmarks (TERMINÉ)
- Fichiers de test: petit (20), moyen (100), grand (300+) imports
- Script de benchmark avec métriques détaillées

## 📋 Optimisations À Implémenter

### 🔥 Quick Wins (1-2 heures chacun)

#### 1. **GroupMatcher avec Cache** (Priorité: HAUTE)
```typescript
// Utiliser src/utils/group-matcher.ts
class GroupMatcher {
    private groupCache = new Map<string, string>();
    getGroup(source: string): string // O(1) après premier appel
}
```
- **Gain attendu**: -70% sur la détermination des groupes
- **Effort**: 1 heure
- **Risque**: Faible

#### 2. **Config avec Validation Cachée** (Priorité: MOYENNE)
```typescript
// Utiliser src/utils/config-cache.ts
class ConfigCache {
    getConfig(): { config: Config; validation: ValidationResult }
}
```
- **Gain attendu**: -90% sur la validation config
- **Effort**: 1 heure
- **Risque**: Faible

#### 3. **Parser Singleton** (Priorité: MOYENNE)
```typescript
// Réutiliser la même instance de parser
let parserInstance: ImportParser | null = null;
function getParser(config: Config): ImportParser {
    if (!parserInstance || configChanged) {
        parserInstance = new ImportParser(config);
    }
    return parserInstance;
}
```
- **Gain attendu**: -20% sur l'initialisation
- **Effort**: 30 minutes
- **Risque**: Faible

### 🏗️ Optimisations Structurelles (4-8 heures)

#### 4. **AST Unifié** (Priorité: HAUTE)
- Utiliser un seul parser (TypeScript ESLint) au lieu de deux
- Extraire les commentaires directement de l'AST
- **Gain attendu**: -40% sur le parsing total
- **Effort**: 4 heures
- **Risque**: Moyen (changements importants)

#### 5. **Streaming pour Gros Fichiers** (Priorité: BASSE)
- Parser les imports de manière incrémentale
- Arrêter après la dernière ligne d'import
- **Gain attendu**: -60% sur très gros fichiers
- **Effort**: 8 heures
- **Risque**: Élevé

## 📊 Gains de Performance Attendus

| Optimisation | Gain Temps | Gain % | Effort | Risque |
|--------------|------------|--------|--------|---------|
| Cache Diagnostics | -30ms | 25% | ✅ Fait | Aucun |
| GroupMatcher | -15ms | 12% | 1h | Faible |
| Config Cache | -5ms | 4% | 1h | Faible |
| Parser Singleton | -10ms | 8% | 30min | Faible |
| AST Unifié | -25ms | 20% | 4h | Moyen |
| **TOTAL** | **-85ms** | **~70%** | | |

## 🎬 Plan d'Action Recommandé

1. **Phase 1** (Immédiat - 2h)
   - [x] Implémenter DiagnosticsCache
   - [ ] Intégrer GroupMatcher dans le parser
   - [ ] Activer ConfigCache

2. **Phase 2** (Court terme - 4h)
   - [ ] Parser singleton
   - [ ] Optimiser les allocations mémoire
   - [ ] Améliorer le debounce

3. **Phase 3** (Moyen terme - 8h)
   - [ ] Unifier les parsers AST
   - [ ] Implémenter le streaming (si nécessaire)

## ⚠️ Points d'Attention

1. **Compatibilité**: Toutes les optimisations doivent être rétro-compatibles
2. **Tests**: Ajouter des tests de performance dans la CI
3. **Monitoring**: Garder les métriques en mode debug uniquement
4. **Cache**: Implémenter des mécanismes d'invalidation appropriés

## 📈 Métriques de Succès

- Formatage < 50ms pour fichiers moyens (100 imports)
- Formatage < 200ms pour gros fichiers (300+ imports)
- Scaling linéaire ou sub-linéaire
- Aucune régression fonctionnelle

## 🔧 Code à Modifier

### Extension.ts
```typescript
// Ajouter au début du formatImportsCommand
diagnosticsCache.clear();
perfMonitor.clear();

// Utiliser getParser() au lieu de parser direct
const parser = getParser(config);
```

### Parser.ts
```typescript
// Remplacer determineGroup par
private groupMatcher: GroupMatcher;
private determineGroup(importStatement: Import): string {
    return this.groupMatcher.getGroup(importStatement.source);
}
```

### Config.ts
```typescript
// Utiliser ConfigCache
private configCache = new ConfigCache();
public getConfig(): Config {
    const { config } = this.configCache.getConfig(
        () => this.loadConfiguration(),
        (c) => this.validateConfiguration(c)
    );
    return config;
}
```

## 🎉 Conclusion

Ces optimisations devraient améliorer les performances de 70% avec un effort minimal et un risque faible. Les quick wins peuvent être implémentés en 3-4 heures pour des gains immédiats, tandis que les optimisations structurelles peuvent être planifiées pour plus tard si nécessaire.