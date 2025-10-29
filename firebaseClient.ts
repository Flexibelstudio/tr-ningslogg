// firebaseClient.ts
import 'firebase/compat/functions';
import { app } from './firebaseConfig'; // Import the initialized compat app instance

const functions = app ? app.functions('europe-west1') : null;

export const callGeminiApiFn = functions 
    ? functions.httpsCallable('callGeminiApi') 
    : () => {
        console.error("Firebase is not initialized. Cannot call cloud function 'callGeminiApi'.");
        // Returning a promise that resolves to an error object that the calling components can handle.
        return Promise.resolve({ data: { error: "Firebase är inte konfigurerad korrekt. Funktionen kan inte anropas." } });
    };
