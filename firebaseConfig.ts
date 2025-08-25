import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// These environment variables MUST be configured in your build environment.
const firebaseConfig = {
  apiKey: "AIzaSyAYIyG3Vufbc6MLpb48xLgJpF8zsZa2iHk",
  authDomain: "smartstudio-da995.firebaseapp.com",
  projectId: "smartstudio-da995",
  storageBucket: "smartstudio-da995.appspot.com",
  messagingSenderId: "704268843753",
  appId: "1:704268843753:web:743a263e46774a178c0e78"
};

let app: firebase.app.App;
let auth: firebase.auth.Auth;
let db: firebase.firestore.Firestore;

// Initialize Firebase only if config is valid
// This prevents crashing if env vars are missing
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }
        auth = firebase.auth(app);
        db = firebase.firestore(app);

        // Enable Firestore offline persistence with tab synchronization
        db.enablePersistence({ synchronizeTabs: true })
          .catch((err) => {
            if (err.code == 'failed-precondition') {
              // This can happen if multiple tabs are open.
              console.warn('Firebase persistence failed: multiple tabs open. Offline data will not be synced across tabs.');
            } else if (err.code == 'unimplemented') {
              // The current browser does not support all of the features required to enable persistence
              console.warn('Firebase persistence is not supported in this browser. App will work online only.');
            }
          });

    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }
}

export { app, auth, db, firebaseConfig };