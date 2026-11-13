import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { DataProvider } from './context/DataContext';
import { SessionProvider } from './context/SessionContext';
import './styles/index.css';
import './styles/delivery.css';

// Unexpected errors go to the log only; the user never sees raw error text.
window.addEventListener('unhandledrejection', (e) => { console.error('[KLG] unhandled', e.reason); e.preventDefault(); });
window.addEventListener('error', (e) => { console.error('[KLG] error', e.error || e.message); });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <SessionProvider>
      <DataProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </DataProvider>
      </SessionProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
