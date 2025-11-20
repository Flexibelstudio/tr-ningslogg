// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { NotificationsProvider } from './context/NotificationsContext';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { BrowserRouter } from 'react-router-dom';


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationsProvider>
        <App />
        <NotificationCenter />
      </NotificationsProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// --- Service Worker-hantering ---

// (PROD/STAGING) Registrera SW och tvinga auto-uppdatering
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Om en ny SW redan väntar → aktivera direkt
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });

        // När en ny hittas → ta över direkt när den är installerad
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => {
        console.warn('SW registration failed:', err);
      });
  });

  // När ny SW tar kontroll → ladda om sidan exakt en gång
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const FLAG = '__reloaded_by_sw__';
    if (!sessionStorage.getItem(FLAG)) {
      sessionStorage.setItem(FLAG, '1');
      window.location.reload();
    }
  });
}