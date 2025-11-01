// firebaseConfig.ts — modular SDK (fungerar i Netlify och lokalt utan mock)

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
} from "firebase/firestore";
import {
  getMessaging,
  isSupported as isMessagingSupported,
  type Messaging,
} from "firebase/messaging";

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
const isAIStudio =
  typeof window !== "undefined" && /(^|\.)ai\.studio$/i.test(window.location.hostname);

export const isMockMode = env?.VITE_USE_MOCK === "true" || isAIStudio || false;

// Prod-fallbacks (OK att ligga i klienten)
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
  console.log(
    `[FB] mode=${env.MODE}, aiStudio=${isAIStudio}, mock=${isMockMode}, project=${firebaseConfig.projectId}`
  );
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let messaging: Messaging | undefined;

if (isMockMode) {
  console.warn("[FB] Mock mode enabled – skipping Firebase init");
} else {
  try {
    // Init endast en gång (skydd mot HMR/dubbelinit)
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Aktivera offline-cache (ignorera fel vid t.ex. flera flikar/privat läge)
    enableIndexedDbPersistence(db).catch((e) => {
      console.warn("Firestore persistence not available, continuing online only:", e);
    });

    // Web Push / FCM finns inte i alla miljöer → feature-detect
    // (t.ex. i iOS Safari/icke-secure origin eller i vissa CI/preview-lägen)
    void isMessagingSupported()
      .then((ok) => {
        if (ok) {
          messaging = getMessaging(app!);
        } else {
          console.warn("Firebase Messaging is not supported in this environment.");
        }
      })
      .catch(() => {
        console.warn("Firebase Messaging support check failed; skipping messaging init.");
      });
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    // Låt resten av appen fortsätta utan Firebase (ingen “mock/offline”-flagga)
    app = undefined;
    auth = undefined;
    db = undefined;
    messaging = undefined;
  }
}

export { app, auth, db, messaging };
