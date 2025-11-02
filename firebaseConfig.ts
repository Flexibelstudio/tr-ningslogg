// firebaseConfig.ts — compat SDK for Netlify build
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";


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
  DEV?: boolean;
};

const env = (typeof import.meta !== "undefined" ? (import.meta as any).env : {}) as Env;

// AI Studio preview → kör mockläge automatiskt (ingen backend behövs där)
const isAIStudio = typeof window !== "undefined" && /(^|\.)ai\.studio$/i.test(window.location.hostname);
const isAIStudioInDev = isAIStudio && env?.DEV;

export const isMockMode =
  env?.VITE_USE_MOCK === "true" || isAIStudioInDev || false;

export const firebaseConfig = {
  apiKey:            env?.VITE_FB_API_KEY,
  authDomain:        env?.VITE_FB_AUTH_DOMAIN,
  projectId:         env?.VITE_FB_PROJECT_ID,
  storageBucket:     env?.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env?.VITE_FB_MESSAGING_SENDER_ID,
  appId:             env?.VITE_FB_APP_ID,
  ...(env?.VITE_FB_MEASUREMENT_ID ? { measurementId: env.VITE_FB_MEASUREMENT_ID } : {}),
} as const;

const requiredConfigKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingConfigKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);


if (env?.MODE) {
  console.log(`[FB Compat] mode=${env.MODE}, aiStudio=${isAIStudio}, dev=${env.DEV}, mock=${isMockMode}, project=${firebaseConfig.projectId}`);
}

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

if (isMockMode) {
  console.warn("[FB Compat] Mock mode enabled – skipping Firebase init");
} else if (missingConfigKeys.length > 0) {
    console.error(`[FB Compat] Firebase initialization failed! Missing VITE_FB_* env vars: ${missingConfigKeys.join(', ')}. Set these in your build environment (e.g., Netlify).`);
} else {
  try {
    app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth(app);
    
    // Modern offline-persistence med tab-synk (modular API anropad på compat app)
    initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    
    db = firebase.firestore(app);

  } catch (e) {
    console.error("[FB Compat] Firebase initialization failed with error:", e);
    // A failed init will leave `db` undefined, triggering offline mode.
  }
}

export { app, auth, db };
