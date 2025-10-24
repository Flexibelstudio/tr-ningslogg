// firebaseClient.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseConfig } from './firebaseConfig';

// Initialize Firebase if not already initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Cloud Functions and point to the correct region
const functions = getFunctions(app, "europe-west1");

// Create and export the callable function for the Gemini API proxy
export const callGeminiApiFn = httpsCallable(functions, 'callGeminiApi');
