import { cleanUpLines } from '../../src/formatter';

describe('cleanUpLines', () => {
  test('should ignore inline comments /* ... */', () => {
    const lines = [
      '// Core',
      'import React from "react";',
      '/* Commentaire inline */ import { useState } from "react";',
      '// Misc',
      'import lodash from "lodash";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier que le commentaire inline a été supprimé
    expect(result).toEqual([
      '// Core',
      'import React from "react";',
      '// Misc',
      'import lodash from "lodash";',
      '',
      ''
    ]);
  });
  
  test('ne saute pas l\'import après un commentaire multiligne sur une ligne', () => {
    const lines = [
      '// Core',
      'import React from "react";',
      '/* Commentaire inline */',
      'import { useState } from "react";',
      '// Misc',
      'import lodash from "lodash";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier que l'import après le commentaire multiligne est conservé
    expect(result).toContain('import { useState } from "react";');
  });
  
  test('ignore les commentaires multilignes', () => {
    const lines = [
      '// Core',
      'import React from "react";',
      '/*',
      ' * Commentaire',
      ' * multiligne',
      ' */',
      'import { useState } from "react";',
      '// Misc',
      'import lodash from "lodash";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier que tout le bloc de commentaire est ignoré
    expect(result).toEqual([
      '// Core',
      'import React from "react";',
      'import { useState } from "react";',
      '// Misc',
      'import lodash from "lodash";',
      '',
      ''
    ]);
  });
  
  test('gère correctement le cas avec un import après /* ... */ sur la même ligne', () => {
    const lines = [
      '// Core',
      'import React from "react";',
      '/* Commentaire */ import { useState } from "react";',
      '// Misc',
      'import lodash from "lodash";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier que le commentaire est ignoré mais que le code sur la même ligne l'est aussi
    expect(result).not.toContain('import { useState } from "react";');
    expect(result).not.toContain('/* Commentaire */ import { useState } from "react";');
  });
  
  test('préserve les commentaires de groupe', () => {
    const lines = [
      '// Core',
      'import React from "react";',
      '// Core',  // Doublon, devrait être ignoré
      'import { useState } from "react";',
      '// Misc',
      'import lodash from "lodash";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier que les commentaires dupliqués sont dédupliqués
    const coreCommentCount = result.filter(line => line === '// Core').length;
    expect(coreCommentCount).toBe(1);
  });
  
  test('gère les commentaires imbriqués incorrectement', () => {
    const lines = [
      '// Un commentaire avec /* dedans',
      'import React from "react";',
      '// Un commentaire avec */ dedans',
      'import { useState } from "react";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier que les lignes de code sont préservées
    expect(result).toContain('import React from "react";');
    expect(result).toContain('import { useState } from "react";');
  });
  
  test('limite les lignes vides consécutives', () => {
    const lines = [
      'import React from "react";',
      '',
      '',
      '',
      'import { useState } from "react";'
    ];
    
    const result = cleanUpLines(lines);
    
    // Vérifier qu'il n'y a qu'une seule ligne vide entre les imports
    expect(result).toEqual([
      'import React from "react";',
      '',
      'import { useState } from "react";',
      '',
      ''
    ]);
  });
});
