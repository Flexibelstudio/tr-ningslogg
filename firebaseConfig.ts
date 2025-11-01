// firebaseConfig.ts — robust init för Netlify/staging (ingen onödig “offline/mock”)

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

// AI Studio → mock
const isAIStudio =
  typeof window !== "undefined" && /(^|\.)ai\.studio$/i.test(window.location.hostname);
export const isMockMode = env?.VITE_USE_MOCK === "true" || isAIStudio || false;

// Prod-fallbacks (public klientkonfig är OK)
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

// Hjälpflagga som resten av appen kan nyttja
let firebaseReady = false;

if (isMockMode) {
  console.warn("[FB] Mock mode enabled – skipping Firebase init");
} else {
  // 1) App
  try {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    console.log("[FB] App initialized");
  } catch (e) {
    console.error("[FB] initializeApp failed → kan inte gå vidare:", e);
  }

  // 2) Auth (kritiskt men brukar inte fela)
  if (app) {
    try {
      auth = getAuth(app);
      console.log("[FB] Auth ready");
    } catch (e) {
      console.error("[FB] getAuth failed (fortsätter utan auth):", e);
    }
  }

  // 3) Firestore (kritiskt)
  if (app) {
    try {
      db = getFirestore(app);
      console.log("[FB] Firestore ready");
    } catch (e) {
      console.error("[FB] getFirestore failed → ingen DB:", e);
    }
  }

  // 4) Persistence (aldrig kritiskt)
  if (db) {
    enableIndexedDbPersistence(db).then(
      () => console.log("[FB] Persistence enabled"),
      (e) => console.warn("[FB] Persistence unavailable (fortsätter online):", e)
    );
  }

  // 5) Messaging (feature-detect, aldrig kritiskt)
  if (app) {
    isMessagingSupported()
      .then((ok) => {
        if (ok) {
          try {
            messaging = getMessaging(app!);
            console.log("[FB] Messaging ready");
          } catch (e) {
            console.warn("[FB] getMessaging failed (skippas):", e);
          }
        } else {
          console.warn("[FB] Messaging not supported in this environment");
        }
      })
      .catch((e) => {
        console.warn("[FB] Messaging support check failed (skippas):", e);
      });
  }

  // Sätt ready om kärnan funkar
  if (app && db) {
    firebaseReady = true;
  }
}

export { app, auth, db, messaging, firebaseReady };
