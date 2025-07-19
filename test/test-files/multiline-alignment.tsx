// Misc
import {
    fetchData,
    ApiResponse
}               from './api';
import {
    FC,
    ReactNode
}               from 'react';

interface Props {
  children: ReactNode;
}

export const TestMultiline: FC<Props> = ({ children }) => {
  return (
    <div>
      {children}
    </div>
  );
};