// firebaseConfig.ts — modular SDK (AI Studio = mock, Netlify = live via fallbacks)
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, enableIndexedDbPersistence } from "firebase/firestore";

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

// AI Studio → alltid mock. (snäv detektering: endast ai.studio-domäner)
const isAIStudio =
  typeof window !== "undefined" && /(^|\.)ai\.studio$/i.test(window.location.hostname);

// Manuell override vid behov (lokalt t.ex.)
const forceMock = env?.VITE_USE_MOCK === "true";

// ENDA sätten att hamna i mock:
export const isMockMode = !!(isAIStudio || forceMock);

// Hårdkodade fallbacks för live (så Netlify funkar utan env-variabler)
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
    `[FB] mode=${env.MODE}, aiStudio=${isAIStudio}, forceMock=${forceMock}, mock=${isMockMode}, project=${firebaseConfig.projectId}`
  );
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

if (isMockMode) {
  console.warn("[FB] Mock mode enabled – skipping Firebase init");
} else {
  try {
    app = initializeApp(firebaseConfig);
    console.log("[FB] App initialized (live)");
    auth = getAuth(app);
    console.log("[FB] Auth ready");
    db = getFirestore(app);
    console.log("[FB] Firestore ready");

    // Persistence (ignorera kända fel som multi-tab)
    enableIndexedDbPersistence(db).then(() => {
      console.log("[FB] Persistence enabled");
    }).catch(() => {});
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    throw e;
  }
}

export { app, auth, db };
