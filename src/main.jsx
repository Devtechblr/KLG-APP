import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { DataProvider } from './context/DataContext';
import { SessionProvider } from './context/SessionContext';
import './styles/index.css';
import './styles/delivery.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
      <DataProvider>
        <App />
      </DataProvider>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>
);
