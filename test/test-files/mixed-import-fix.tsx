// Misc
import React    from 'react';
import {
    useMemo,
    useState,
    useEffect,
    useCallback
}               from 'react';

export default function TestComponent() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    console.log('Effect');
  }, []);
  
  const memoizedValue = useMemo(() => state, [state]);
  const callbackFn = useCallback(() => {}, []);
  
  return React.createElement('div', null, 'Test');
}