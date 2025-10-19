// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- Service Worker-hantering ---

// (DEV) Avregistrera ev. gamla SW + rensa caches en gång när du kör lokalt
if (import.meta.env?.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
}

// (PROD/STAGING) Registrera SW och tvinga auto-uppdatering
if ('serviceWorker' in navigator && import.meta.env?.PROD) {
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