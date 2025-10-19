// src/firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Bygg konfig från Vite-miljövariabler (Netlify/locally)
// FIX: Use optional chaining (?.) to safely access import.meta.env properties.
// This prevents a crash in environments where import.meta.env is undefined (like AI Studio preview),
// allowing the offline mode logic to function correctly.
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FB_API_KEY,
  authDomain: import.meta.env?.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env?.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env?.VITE_FB_APP_ID,
  ...(import.meta.env?.VITE_FB_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID }
    : {}),
} as const;

// Små debugloggar så vi ser vilket projekt som används
if (import.meta.env?.DEV)  console.log('FB project (DEV):',  firebaseConfig.projectId ?? '(saknas)');
if (import.meta.env?.PROD) console.log('FB project (PROD):', firebaseConfig.projectId ?? '(saknas)');

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

try {
  // Initiera bara om nödvärdiga värden finns
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth(app);
    
    // NEW: Initialize Firestore using the modular API to set up persistence correctly.
    // This will prevent the deprecation warning.
    try {
        initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
    } catch (err: any) {
      if (err?.code === 'failed-precondition') {
        console.warn('Firebase persistence: flera flikar öppna – skippar synk.');
      } else if (err?.code === 'unimplemented') {
        console.warn('Firebase persistence stöds ej i denna browser – kör online-only.');
      } else {
        console.warn('Firebase persistence kunde inte aktiveras:', err);
      }
    }
    
    // Get the compat instance. It should use the already initialized Firestore instance.
    db = firebase.firestore(app);

  } else {
    console.warn('Firebase config missing. Running in offline/mock data mode.');
  }
} catch (e) {
  console.error('Firebase initialization failed:', e);
}

export { app, auth, db, firebaseConfig };