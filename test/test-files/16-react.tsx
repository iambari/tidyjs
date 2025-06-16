import React from 'react';                    // utilisé
import { useState, useEffect } from 'react';  // useState utilisé, useEffect non utilisé
import { Button } from '@mui/material';       // non utilisé
import { UserProfile } from './missing-file'; // module manquant

export function MyComponent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}