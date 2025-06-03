// Edge cases and unusual import patterns
import './side-effect-first';
import 'global-polyfill';

// Default import after side effects
import React from 'react';

// Mixed with comments
import { 
  /* This is a component */ 
  Button,
  // Another comment
  TextField,
  /* Multi-line
     comment here */ 
  Card
} from '@mui/material';

// Unusual spacing and formatting
import{useState,useEffect}from'react';
import  *    as    utils    from    './utils';
import type{User,Post}from'./types';

// Very long import line
import { VeryLongComponentNameThatExceedsNormalLineLengthAndShouldBeFormattedProperly, AnotherVeryLongComponentName, YetAnotherExtremelyLongComponentName } from './components/very-long-component-names';

// Import with trailing comma
import { 
  something,
  another,
  third, // trailing comma
} from './module';

// Dynamic import (should not be touched by formatter)
const LazyComponent = React.lazy(() => import('./LazyComponent'));

// Import with single quotes and double quotes mixed (bad practice)
import singleQuote from './single';
import doubleQuote from "./double";

// Import with unusual characters in path
import special from './special-chars_123/file.name.js';
import withDots from './some.file.with.dots';

// Import with relative paths
import parent from '../parent';
import grandparent from '../../grandparent';
import deep from '../../../very/deep/path';

// Import with query parameters (unusual but valid)
import withQuery from './file?query=param';
import withHash from './file#hash';

// Import with no space after import keyword (should be formatted)
import{noSpace}from'./no-space';

// Empty imports (should be handled gracefully)
import {} from './empty-import';
import './just-side-effect';

// Import with unicode characters
import unicode from './ültra-spëcial-çhars';
import emoji from './😀-emoji-file';

// Complex nested destructuring
import {
  deeply: {
    nested: {
      property
    }
  }
} from './nested-object';

// Import with as keyword
import { 
  originalName as renamedFunction,
  anotherName as different,
  thirdName as renamed
} from './renamed-imports';

// Import default and named together
import DefaultComponent, { 
  namedExport1,
  namedExport2 as renamed2,
  namedExport3
} from './mixed-exports';

// Very short imports
import a from './a';
import b from './b';
import c from './c';

// Import with numbers
import module1 from './module1';
import module2 from './module2';
import module10 from './module10';

// Import with special characters in module name
import hyphenated from './hyphen-ated';
import underscored from './under_scored';
import dotted from './dot.ted';

// Conditional imports (for testing edge cases)
if (typeof window !== 'undefined') {
  // This should not be formatted as it's not a top-level import
  const browserOnly = import('./browser-only');
}

// Function that returns dynamic import (should not be touched)
function loadModule(name) {
  return import(`./dynamic/${name}`);
}

// Import inside a function (should not be touched by formatter)
function conditionalImport() {
  return import('./conditional');
}

// Export statements mixed with imports (testing order)
export { utils };
export default function EdgeCasesComponent() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    loadModule('test').then(module => {
      setState(module.default);
    });
  }, []);

  return React.createElement(DefaultComponent, {
    onClick: renamedFunction,
    onChange: different,
    onSubmit: renamed
  }, [
    React.createElement(Button, { key: '1' }, 'Button'),
    React.createElement(TextField, { key: '2' }),
    React.createElement(Card, { key: '3' })
  ]);
}

// Re-exports
export { Button, TextField } from '@mui/material';
export { useState, useEffect } from 'react';
export * from './all-exports';
export * as allUtils from './all-utils';

// More edge cases
import /* comment */ defaultWithComment from './commented';
import { /* comment */ namedWithComment } from './named-commented';

// Import with line continuation (unusual formatting)
import veryLongVariableName 
  from './split-line';

// Multiple imports from same module (should be consolidated)
import { first } from './same-module';
import { second } from './same-module';
import { third } from './same-module';

// Final side effect import
import './cleanup-side-effect';