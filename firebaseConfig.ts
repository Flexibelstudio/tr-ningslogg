// src/firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Alla värden kommer från miljövariabler (Vite/Netlify):
// - Lokalt: .env.local
// - Netlify: netlify.toml (production/staging)
// FIX: Replaced import.meta.env with process.env to resolve TypeScript error.
const firebaseConfig = {
  apiKey: process.env.VITE_FB_API_KEY,
  authDomain: process.env.VITE_FB_AUTH_DOMAIN,
  projectId: process.env.VITE_FB_PROJECT_ID,
  storageBucket: process.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FB_APP_ID,
  ...(process.env.VITE_FB_MEASUREMENT_ID
    ? { measurementId: process.env.VITE_FB_MEASUREMENT_ID }
    : {}),
};

// Liten debug-logg i dev så du ser vilket projekt som används
// FIX: Replaced import.meta.env with process.env to resolve TypeScript error.
if (process.env.NODE_ENV === 'development') {
  console.log('FB project (DEV):', firebaseConfig.projectId);
}

let app: firebase.app.App;
let auth: firebase.auth.Auth;
let db: firebase.firestore.Firestore;

try {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }

  auth = firebase.auth(app);
  db = firebase.firestore(app);

  // Offline cache med tab-synk (som tidigare)
  db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase persistence failed: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firebase persistence not supported in this browser.');
    }
  });
} catch (e) {
  console.error('Firebase initialization failed:', e);
  // (Låt appen starta utan Firebase; firebaseService hanterar "offline/mock" vid saknade config-värden)
}

export { app, auth, db, firebaseConfig };