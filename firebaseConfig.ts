// firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

type Env = {
  MODE?: string;
  VITE_USE_MOCK?: string;
  VITE_FB_API_KEY?: string;
  VITE_FB_AUTH_DOMAIN?: string;
  VITE_FB_PROJECT_ID?: string;
  VITE_FB_STORAGE_BUCKET?: string;
  VITE_FB_MESSAGING_SENDER_ID?: string;
  VITE_FB_APP_ID?: string;
  VITE_FB_MEASUREMENT_ID?: string;
};

const env = (typeof import.meta !== 'undefined' ? (import.meta as any).env : {}) as Env;

// AI Studio kör i en sandbox där querystring kan saknas.
// Gör mock-läge sant om (A) env flaggar det ELLER (B) vi kör på ai.studio.
const isAIStudio = typeof window !== 'undefined' && /(^|\.)ai\.studio$/i.test(window.location.hostname);
export const isMockMode =
  env?.VITE_USE_MOCK === 'true' || isAIStudio;

// Prod-fallbacks (webbnycklar kan ligga i klienten)
export const firebaseConfig = {
  apiKey:            env?.VITE_FB_API_KEY             ?? 'AIzaSyAYIyG3Vufbc6MLpb48xLgJpF8zsZa2iHk',
  authDomain:        env?.VITE_FB_AUTH_DOMAIN         ?? 'smartstudio-da995.firebaseapp.com',
  projectId:         env?.VITE_FB_PROJECT_ID          ?? 'smartstudio-da995',
  storageBucket:     env?.VITE_FB_STORAGE_BUCKET      ?? 'smartstudio-da995.appspot.com',
  messagingSenderId: env?.VITE_FB_MESSAGING_SENDER_ID ?? '704268843753',
  appId:             env?.VITE_FB_APP_ID              ?? '1:704268843753:web:743a263e46774a178c0e78',
  ...(env?.VITE_FB_MEASUREMENT_ID ? { measurementId: env.VITE_FB_MEASUREMENT_ID } : {}),
} as const;

if (env?.MODE) {
  // Liten debug, ta bort om du vill
  console.log(`[FB] mode=${env.MODE}, aiStudio=${isAIStudio}, mock=${isMockMode}, project=${firebaseConfig.projectId}`);
}

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

if (isMockMode) {
  console.warn('[FB] Mock mode enabled – skipping Firebase init');
} else {
  try {
    app  = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth();        // ✅ compat: utan app-argument
    db   = firebase.firestore();   // ✅ compat

    // (Valfritt) försök slå på persistence i compat
    db.enablePersistence?.({ synchronizeTabs: true }).catch(() => {
      /* ignore (t.ex. flera tabs) */
    });
  } catch (e) {
    console.error('Firebase initialization failed:', e);
    throw e;
  }
}

export { app, auth, db };
