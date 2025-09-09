import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- Service Worker-hantering ---
// 1) I DEV: ta bort ev. registrerade SW + rensa cache (engångsfix när du kör lokalt)
// FIX: Replaced import.meta.env with process.env to resolve TypeScript error.
if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
}

// Prod/staging: registrera SW + auto-uppdatera
// FIX: Replaced import.meta.env with process.env to resolve TypeScript error.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Om en ny SW redan väntar: aktivera direkt
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' });

      // När SW hittar en ny version: be den ta över direkt
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    });
  });

  // När ny SW tar kontroll → ladda om en gång (auto-push till användaren)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}