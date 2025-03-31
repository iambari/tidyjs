import { findImportsRange } from '../../src/formatter';

describe('findImportsRange', () => {
  test('identifie correctement la plage d\'imports, même avec des commentaires multilignes compacts', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* Commentaire sur une ligne */ 
import { ParsedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

function someFunction() {
  // Code...
}
`;
    
    const result = findImportsRange(source);
    
    // Vérifier que la plage couvre tous les imports
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result.start).toBeLessThan(result.end);
      const importText = source.substring(result.start, result.end);
    
      // Vérifier que tous les imports sont inclus
      expect(importText).toContain("import { FormatterConfig } from './types';");
      expect(importText).toContain("import { ParsedImport } from 'tidyjs-parser';");
      expect(importText).toContain("import { logDebug } from './utils/log';");
    
      // Vérifier que le code après les imports n'est pas inclus
      expect(importText).not.toContain("function someFunction()");
    }
  });

  describe('Dynamic imports detection', () => {
    test('détecte différentes formes d\'imports dynamiques', () => {
      const sources = [
        // Import dynamique simple
        'const module = import("./module");',
        // Import dynamique avec await sur la même ligne
        'const module = await import("./module");',
        // Import dynamique avec await et espaces multiples
        'const module = await    import("./module");',
        // Import dynamique avec await et retour à la ligne
        'const module = await \n  import("./module");',
        // Import dynamique avec déclaration et assignation
        'let module; module = await import("./module");',
        // Import dynamique dans une fonction
        'async function load() { return await import("./module"); }',
        // Import dynamique avec caractères avant sur la même ligne
        'if (condition) const module = await import("./module");'
      ];

      for (const source of sources) {
        const result = findImportsRange(source);
        // On s'attend à avoir result === null car ce sont des imports dynamiques
        expect(result).toBeNull();
      }
    });

    test('rejette le mélange d\'imports statiques et dynamiques', () => {
      const source = `
  import { something } from 'somewhere';

  const module = await import('./module');
  `;
      
      const result = findImportsRange(source);
      expect(result).toBeNull();
    });
  });
  
  test('traite correctement les commentaires multilignes standards', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* 
 * Commentaire
 * multiligne
 */
import { ParsedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

function someFunction() {
  // Code...
}
`;
    
    const result = findImportsRange(source);
    
    // Vérifier que la plage couvre tous les imports
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result.start).toBeLessThan(result.end);
      const importText = source.substring(result.start, result.end);
    
      // Vérifier que tous les imports sont inclus
      expect(importText).toContain("import { FormatterConfig } from './types';");
      expect(importText).toContain("import { ParsedImport } from 'tidyjs-parser';");
      expect(importText).toContain("import { logDebug } from './utils/log';");
    }
  });
  
  test('gère correctement les imports à côté des commentaires multilignes', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* Commentaire */ import { ParsedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

function someFunction() {
  // Code...
}
`;
    
    const result = findImportsRange(source);
    
    // Vérifier que la plage couvre tous les imports
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result.start).toBeLessThan(result.end);
      const importText = source.substring(result.start, result.end);
    
      // Vérifier que le commentaire multiligne est inclus
      expect(importText).toContain("/* Commentaire */ import { ParsedImport }");
    }
  });
  
  test('ignore les imports à l\'intérieur des commentaires multilignes', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* 
import { ParsedImport } from 'tidyjs-parser';
*/

// Utils
import { logDebug } from './utils/log';

function someFunction() {
  // Code...
}
`;
    
    const result = findImportsRange(source);
    
    // Vérifier que la plage couvre tous les imports réels
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result.start).toBeLessThan(result.end);
      const importText = source.substring(result.start, result.end);
    
      // L'import dans le commentaire doit être ignoré pour le traitement
      // mais sera inclus dans la plage de texte
      expect(importText).toContain("import { FormatterConfig } from './types';");
      expect(importText).toContain("import { logDebug } from './utils/log';");
    }
  });
  
  test('ne s\'interrompt pas par des commentaires multilignes qui commencent et finissent sur la même ligne', () => {
    const source = `
// Misc
import { FormatterConfig } from './types';

/* Commentaire inline */
import { ParsedImport } from 'tidyjs-parser';

// Utils
import { logDebug } from './utils/log';

function someFunction() {
  // Code...
}
`;
    
    const result = findImportsRange(source);
    
    // Vérifier que la plage couvre tous les imports
    expect(result).not.toBeNull();
    if (result !== null) {
      const importText = source.substring(result.start, result.end);
    
      // Vérifier que tous les imports sont inclus
      expect(importText).toContain("import { FormatterConfig } from './types';");
      expect(importText).toContain("import { ParsedImport } from 'tidyjs-parser';");
      expect(importText).toContain("import { logDebug } from './utils/log';");
    }
  });
  
  test('gère correctement les commentaires imbriqués dans les imports', () => {
    const source = `
// Misc
import { 
  /* commentaire multiligne */
  FormatterConfig 
} from './types';

import { logDebug } from './utils/log';

function someFunction() {
  // Code...
}
`;
    
    const result = findImportsRange(source);
    
    // Vérifier que la plage couvre tous les imports
    expect(result).not.toBeNull();
    if (result !== null) {
      const importText = source.substring(result.start, result.end);
    
      // Vérifier que tous les imports sont inclus
      expect(importText).toContain("import {");
      expect(importText).toContain("FormatterConfig");
      expect(importText).toContain("} from './types';");
      expect(importText).toContain("import { logDebug } from './utils/log';");
    }
  });
});
