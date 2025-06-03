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
import { WsDataModel }  from '@library/form-new/models/ProviderModel';

export default function TestComponent() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    console.log('Effect');
  }, []);
  
  const memoizedValue = useMemo(() => state, [state]);
  const callbackFn = useCallback(() => {}, []);
  
  return React.createElement('div', null, 'Test');
}