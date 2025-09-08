// src/firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Läs från miljövariabler (Netlify fyller dessa olika för staging vs production)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY || "AIzaSyAYIyG3Vufbc6MLpb48xLgJpF8zsZa2iHk",
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || "smartstudio-da995.firebaseapp.com",
  projectId: import.meta.env.VITE_FB_PROJECT_ID || "smartstudio-da995",
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET || "smartstudio-da995.appspot.com",
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID || "704268843753",
  appId: import.meta.env.VITE_FB_APP_ID || "1:704268843753:web:743a263e46774a178c0e78",
  // measurementId kan lämnas tom om ni inte använder Analytics:
  ...(import.meta.env.VITE_FB_MEASUREMENT_ID ? { measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID } : {}),
};

let app: firebase.app.App | undefined;
let auth: firebase.auth.Auth | undefined;
let db: firebase.firestore.Firestore | undefined;

try {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  auth = firebase.auth(app);
  db = firebase.firestore(app);

  // Offline cache (valfritt, behåll som tidigare)
  db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase persistence failed: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firebase persistence not supported in this browser.');
    }
  });
} catch (e) {
  console.error("Firebase initialization failed:", e);
}

export { app, auth, db, firebaseConfig };
