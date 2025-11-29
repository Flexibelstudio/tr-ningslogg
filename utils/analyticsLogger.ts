// utils/analyticsLogger.ts
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import firebaseService from "../services/firebaseService";
import { sanitizeDataForFirebase } from './firestoreUtils';

/**
 * Logs an analytics event to Firestore. This is a fire-and-forget operation.
 * If the write fails, it will be logged to the console but will not block the UI or throw an error.
 *
 * @param type The type of event (e.g., "BOOKING_CREATED", "CHECKIN").
 * @param data An object containing relevant data for the event.
 * @param orgId The ID of the organization this event belongs to.
 */
// TODO: Expand analytics events with workout logs and participant engagement metrics
// when insights dashboard is added.
export async function logAnalyticsEvent(
  type: "BOOKING_CREATED" | "BOOKING_CANCELLED" | "CHECKIN" | "WAITLIST_PROMOTION",
  data: Record<string, any>,
  orgId: string
) {
  if (firebaseService.isOffline() || !db) {
    // Silently ignore analytics events in offline mode or if db is not available
    return;
  }

  try {
    const eventPayload = {
      type,
      timestamp: serverTimestamp(),
      orgId,
      ...data,
    };
    await addDoc(collection(db, "analyticsEvents"), sanitizeDataForFirebase(eventPayload));
  } catch (error) {
    console.error("Analytics event logging failed:", error);
  }
}
