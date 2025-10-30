
// firebaseClient.ts — modular Functions (safe i mock-läge)
import { app } from "./firebaseConfig";
import { getFunctions, httpsCallable } from "firebase/functions";

export const callGeminiApiFn = app
  ? httpsCallable(getFunctions(app, "europe-west1"), "callGeminiApi")
  : async () => ({ data: { error: "Mock mode: Cloud Function is not available." } });

export const getAnalyticsDataFn = app
  ? httpsCallable(getFunctions(app, "europe-west1"), "getAnalyticsData")
  : async () => ({ data: { error: "Mock mode: Cloud Function is not available." } });
