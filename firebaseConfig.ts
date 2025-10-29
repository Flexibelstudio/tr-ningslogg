// firebaseConfig.ts (ligger i projektroten hos dig)
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Läs env om de finns, fall tillbaka till prod-värden (webbnycklar är inte hemliga)
const env = (typeof import.meta !== 'undefined' ? import.meta.env : {}) as any;

const cfg = {
  apiKey:            env?.VITE_FB_API_KEY             ?? 'AIzaSyAYIyG3Vufbc6MLpb48xLgJpF8zsZa2iHk',
  authDomain:        env?.VITE_FB_AUTH_DOMAIN         ?? 'smartstudio-da995.firebaseapp.com',
  projectId:         env?.VITE_FB_PROJECT_ID          ?? 'smartstudio-da995',
  storageBucket:     env?.VITE_FB_STORAGE_BUCKET      ?? 'smartstudio-da995.appspot.com',
  messagingSenderId: env?.VITE_FB_MESSAGING_SENDER_ID ?? '704268843753',
  appId:             env?.VITE_FB_APP_ID              ?? '1:704268843753:web:743a263e46774a178c0e78',
  ...(env?.VITE_FB_MEASUREMENT_ID ? { measurementId: env.VITE_FB_MEASUREMENT_ID } : {}),
} as const;

// (valfritt för felsökning – ta bort när du vill)
if (env?.MODE) {
  console.log(`[FB] mode=${env.MODE}, projectId=${cfg.projectId}`);
}

let app: firebase.app.App;
let auth: firebase.auth.Auth;
let db: firebase.firestore.Firestore;

try {
  app  = !firebase.apps.length ? firebase.initializeApp(cfg) : firebase.app();
  auth = firebase.auth(app);

  // Modern offline-persistence med tab-synk
  initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  db = firebase.firestore(app);
} catch (e) {
  console.error('Firebase initialization failed:', e);
  throw e; // låt felet bubbla upp (bättre än att tyst gå i mock-läge)
}

export { app, auth, db, cfg as firebaseConfig };
