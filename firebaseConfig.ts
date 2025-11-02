
// src/firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Safely access env vars
const env = import.meta?.env;

const firebaseConfig = {
  apiKey: env?.VITE_FB_API_KEY,
  authDomain: env?.VITE_FB_AUTH_DOMAIN,
  projectId: env?.VITE_FB_PROJECT_ID,
  storageBucket: env?.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env?.VITE_FB_MESSAGING_SENDER_ID,
  appId: env?.VITE_FB_APP_ID,
  ...(env?.VITE_FB_MEASUREMENT_ID ? { measurementId: env.VITE_FB_MEASUREMENT_ID } : {}),
} as const;

// Safely determine environment
const isDev = env?.DEV ?? false;
if (isDev) console.log('FB project (DEV):', firebaseConfig.projectId ?? '(saknas)');
const isProd = env?.PROD ?? false;
if (isProd) console.log('FB project (PROD):', firebaseConfig.projectId ?? '(saknas)');

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

// Check for all required environment variables before attempting initialization.
const requiredConfigValues: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingConfig = requiredConfigValues.filter(key => !firebaseConfig[key]);

if (missingConfig.length > 0) {
  console.warn(`Firebase initialization skipped. Missing config values: ${missingConfig.join(', ')}. App will run in offline/mock data mode.`);
} else {
  try {
    // FIX: Replaced `firebase.getApps().length` with `firebase.apps.length` for v8 compat.
    app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth(app);

    // Modern offline-persistence med tab-synk (modular API)
    initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    
    db = firebase.firestore(app);

  } catch (e) {
    console.error('Firebase initialization failed:', e);
    // Ensure services are undefined on failure
    app = undefined;
    auth = undefined;
    db = undefined;
  }
}

export { app, auth, db, firebaseConfig };
