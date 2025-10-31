// firebaseConfig.ts — modular SDK (funka i AI Studio + Netlify)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/messaging';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

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

const env = (typeof import.meta !== "undefined" ? (import.meta as any).env : {}) as Env;

// AI Studio preview → kör mockläge automatiskt (ingen backend behövs där)
const isAIStudio = typeof window !== "undefined" && /(^|\.)ai\.studio$/i.test(window.location.hostname);
export const isMockMode =
  env?.VITE_USE_MOCK === "true" || isAIStudio || false;

// Prod-fallbacks (helt OK på webben)
export const firebaseConfig = {
  apiKey:            env?.VITE_FB_API_KEY             ?? "AIzaSyAYIyG3Vufbc6MLpb48xLgJpF8zsZa2iHk",
  authDomain:        env?.VITE_FB_AUTH_DOMAIN         ?? "smartstudio-da995.firebaseapp.com",
  projectId:         env?.VITE_FB_PROJECT_ID          ?? "smartstudio-da995",
  storageBucket:     env?.VITE_FB_STORAGE_BUCKET      ?? "smartstudio-da995.appspot.com",
  messagingSenderId: env?.VITE_FB_MESSAGING_SENDER_ID ?? "704268843753",
  appId:             env?.VITE_FB_APP_ID              ?? "1:704268843753:web:743a263e46774a178c0e78",
  ...(env?.VITE_FB_MEASUREMENT_ID ? { measurementId: env.VITE_FB_MEASUREMENT_ID } : {}),
} as const;

if (env?.MODE) {
  console.log(`[FB] mode=${env.MODE}, aiStudio=${isAIStudio}, mock=${isMockMode}, project=${firebaseConfig.projectId}`);
}

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;
let messaging: firebase.messaging.Messaging | undefined;

if (isMockMode) {
  console.warn("[FB] Mock mode enabled – skipping Firebase init");
} else {
  try {
    // v8 compat init (återanvänd om redan initierad)
    app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth(app);

    // Offline-cache med tab-synk (modular API ihop med compat app funkar här)
    initializeFirestore(app as any, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    
    db = firebase.firestore(app);

    if (firebase.messaging.isSupported()) {
      messaging = firebase.messaging(app);
    } else {
      console.warn("Firebase Messaging is not supported in this browser.");
    }

  } catch (e) {
    console.error("Firebase initialization failed:", e);
    app = undefined;
    auth = undefined;
    db = undefined;
    messaging = undefined;
  }
}

// ❗ Viktigt: exportera INTE firebaseConfig här igen
export { app, auth, db, messaging };
