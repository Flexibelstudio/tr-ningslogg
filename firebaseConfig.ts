import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// These environment variables MUST be configured in your build environment.
const firebaseConfig = {
  apiKey: "AIzaSyAYIyG3Vufbc6MLpb48xLgJpF8zsZa2iHk",
  authDomain: "smartstudio-da995.firebaseapp.com",
  projectId: "smartstudio-da995",
  storageBucket: "smartstudio-da995.appspot.com",
  messagingSenderId: "704268843753",
  appId: "1:704268843753:web:743a263e46774a178c0e78"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Initialize Firebase only if config is valid
// This prevents crashing if env vars are missing
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }
}

export { app, auth, db, firebaseConfig };