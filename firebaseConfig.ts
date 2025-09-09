// src/firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Bygg konfig från Vite-miljövariabler (Netlify/locally)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FB_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FB_APP_ID as string | undefined,
  ...(import.meta.env.VITE_FB_MEASUREMENT_ID
    ? { measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID as string }
    : {}),
} as const;

// Små debugloggar så vi ser vilket projekt som används
if (import.meta.env.DEV)  console.log('FB project (DEV):',  firebaseConfig.projectId ?? '(saknas)');
if (import.meta.env.PROD) console.log('FB project (PROD):', firebaseConfig.projectId ?? '(saknas)');

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

try {
  // Initiera bara om nödvändiga värden finns
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth(app);
    db = firebase.firestore(app);

    // Offline-persistence med tab-synk (ignorera om ej stöds)
    db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
      if (err?.code === 'failed-precondition') {
        console.warn('Firebase persistence: flera flikar öppna – skippar synk.');
      } else if (err?.code === 'unimplemented') {
        console.warn('Firebase persistence stöds ej i denna browser – kör online-only.');
      } else {
        console.warn('Firebase persistence kunde inte aktiveras:', err);
      }
    });
  } else {
    console.warn('Firebase config missing. Running in offline/mock data mode.');
  }
} catch (e) {
  console.error('Firebase initialization failed:', e);
}

export { app, auth, db, firebaseConfig };
