// Side effect imports test
import 'reflect-metadata';
import 'zone.js/dist/zone';
import './polyfills/array';
import './polyfills/string';
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { store } from './store';
import { theme } from './theme';
import App from './App';
import './index.css';
import './styles/global.scss';

// Additional side effects
import 'intersection-observer';
import 'resize-observer-polyfill';

// Initialize error reporting
import '@sentry/react';

// Import worker for background tasks
import './workers/background-sync';

// Development tools
if (process.env.NODE_ENV === 'development') {
  import('./dev-tools');
}

// Initialize application
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>,
    rootElement
  );
}

// Hot module replacement
if (module.hot) {
  module.hot.accept();
}