// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { NotificationsProvider } from './context/NotificationsContext';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { HashRouter } from 'react-router-dom';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <NotificationsProvider>
        <App />
        <NotificationCenter />
      </NotificationsProvider>
    </HashRouter>
  </React.StrictMode>
);
