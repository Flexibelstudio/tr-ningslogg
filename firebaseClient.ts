// firebaseClient.ts
import 'firebase/compat/functions';
import { app } from "./firebaseConfig"; // This will now import the compat app instance

const functions = app ? app.functions('europe-west1') : null;

export const callGeminiApiFn = functions 
    ? functions.httpsCallable('callGeminiApi') 
    : () => {
        console.error("Firebase is not initialized. Cannot call cloud function 'callGeminiApi'.");
        // Returning a promise that resolves to an error object that the calling components can handle.
        return Promise.resolve({ data: { error: "Firebase är inte konfigurerad korrekt. Funktionen kan inte anropas." } });
    };

export const getAnalyticsDataFn = functions
    ? functions.httpsCallable('getAnalyticsData')
    : () => {
        console.error("Firebase is not initialized. Cannot call cloud function 'getAnalyticsData'.");
        return Promise.resolve({ data: { error: "Firebase är inte konfigurerad korrekt. Funktionen kan inte anropas." } });
    };

export const cancelClassInstanceFn = functions
    ? functions.httpsCallable('cancelClassInstance')
    : () => {
        console.error("Firebase is not initialized. Cannot call cloud function 'cancelClassInstance'.");
        return Promise.resolve({ data: { error: "Firebase är inte konfigurerad korrekt. Funktionen kan inte anropas." } });
    };
