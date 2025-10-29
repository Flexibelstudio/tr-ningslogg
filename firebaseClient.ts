// firebaseClient.ts
import 'firebase/compat/functions';
import { app } from './firebaseConfig';

const functions = app.functions('europe-west1');

export const callGeminiApiFn = functions.httpsCallable('callGeminiApi');
