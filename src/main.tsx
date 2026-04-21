import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/styles.css';
import { initializeBusinessBrandTheme } from '@/modules/settings/domain/business-settings';

initializeBusinessBrandTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
