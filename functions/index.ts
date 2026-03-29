
import { onCall, onRequest, HttpsError, Request as HttpsRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, DocumentReference } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFunctions } from "firebase-admin/functions";
import { GoogleGenAI } from "@google/genai";
import * as webpush from "web-push";

/* -----------------------------------------------------------------------------
 * Type Definitions
 * ---------------------------------------------------------------------------*/
interface Membership {
  id: string;
  name: string;
  description?: string;
  readonly type?: "subscription" | "clip_card";
  clipCardClips?: number;
  clipCardValidityDays?: number;
  restrictedCategories?: string[];
}

interface GroupClassSchedule {
  id: string;
  groupClassId: string;
  coachId: string;
  locationId: string;
  daysOfWeek: number[]; // 1=Mon, 7=Sun
  startTime: string; // "HH:MM"
  durationMinutes: number;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

interface GroupClassScheduleException {
  scheduleId: string;
  date: string; // "YYYY-MM-DD"
  status: 'CANCELLED' | 'MODIFIED' | 'DELETED';
  newStartTime?: string;
  newDurationMinutes?: number;
}

/* -----------------------------------------------------------------------------
 * Init Admin
 * ---------------------------------------------------------------------------*/
initializeApp();
const db = getFirestore();

/* -----------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------*/
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

function getBearerToken(req: { header?: (n: string) => string | undefined; headers?: Record<string, any> }) {
  const h =
    (typeof req.header === "function" ? req.header("authorization") : undefined) ??
    (typeof req.header === "function" ? req.header("Authorization") : undefined) ??
    (req.headers?.authorization as string | undefined) ??
    (req.headers?.Authorization as string | undefined) ??
    "";
  return typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : "";
}

function normalizeDateKey(input: string): string {
  const s = String(input ?? "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
}

// Skapar ett Date-objekt från en datumsträng (YYYY-MM-DD) och tid (HH:MM)
function createDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const VAPID_PUBLIC_KEY =
  "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";

function tryInitWebPush(): boolean {
  try {
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!priv) return false;
    webpush.setVapidDetails("mailto:admin@flexibel.se", VAPID_PUBLIC_KEY, priv);
    return true;
  } catch (e) {
    logger.warn("[Push] VAPID-setup misslyckades; push avaktiverad.", e as any);
    return false;
  }
}

/* -----------------------------------------------------------------------------
 * HTTP: Körs av Cloud Tasks för att skicka pass-påminnelse
 * ---------------------------------------------------------------------------*/
export const sendSessionReminder = onRequest(
  {
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
  },
  async (request: any, response: any) => {
    if (!request.headers["x-cloudtasks-queuename"]) {
      logger.error("Unauthorized: Missing Cloud Tasks header.");
      response.status(403).send("Unauthorized");
      return;
    }

    const { orgId, bookingId } = request.body ?? {};
    if (!orgId || !bookingId) {
      logger.error("Bad Request: Missing orgId or bookingId in payload.");
      response.status(400).send("Bad Request");
      return;
    }

    try {
      const bookingRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("participantBookings")
        .doc(bookingId);

      const bookingDoc = await bookingRef.get();
      if (!bookingDoc.exists) {
        response.status(200).send("Booking not found, task ignored.");
        return;
      }

      const booking = bookingDoc.data()!;
      if (!["BOOKED", "CHECKED-IN"].includes(booking.status)) {
        response.status(200).send("Booking not active.");
        return;
      }

      const { participantId, scheduleId } = booking;
      const participantProfileDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("participantDirectory")
        .doc(participantId)
        .get();

      if (!participantProfileDoc.exists) {
        response.status(200).send("Participant profile not found.");
        return;
      }
      const profile = participantProfileDoc.data();
      const settings = profile?.notificationSettings;

      if (settings?.pushEnabled === false || settings?.sessionReminder === false) {
        response.status(200).send("Reminders disabled by user.");
        return;
      }

      const subsSnap = await db
        .collection("organizations")
        .doc(orgId)
        .collection("userPushSubscriptions")
        .where("participantId", "==", participantId)
        .get();

      if (subsSnap.empty) {
        response.status(200).send("No subscriptions.");
        return;
      }

      const schedDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("groupClassSchedules")
        .doc(scheduleId)
        .get();

      const classDefDoc = schedDoc.exists
        ? await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassDefinitions")
            .doc(schedDoc.data()!.groupClassId)
            .get()
        : null;

      if (!schedDoc.exists || !classDefDoc?.exists) {
        response.status(200).send("Class details missing.");
        return;
      }

      const settingsDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("integrationSettings")
        .doc("settings")
        .get();

      const reminderHours =
        settingsDoc.exists && typeof settingsDoc.data()?.sessionReminderHoursBefore === "number"
          ? settingsDoc.data()!.sessionReminderHoursBefore
          : 2;

      const payload = JSON.stringify({
        title: `Påminnelse: ${classDefDoc.data()!.name}`,
        body: `Ditt pass börjar om ${reminderHours} timmar kl ${schedDoc.data()!.startTime}. Vi ses!`,
      });

      const pushEnabled = tryInitWebPush();
      if (pushEnabled) {
        await Promise.all(
          subsSnap.docs.map(async (doc) => {
            const sub = doc.data().subscription;
            try {
              await webpush.sendNotification(sub, payload);
            } catch (err: any) {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await doc.ref.delete();
                await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
              }
            }
          })
        );
      }

      response.status(200).send("Reminder processed.");
    } catch (error) {
      logger.error(`Failed to send reminder for booking ${bookingId}:`, error);
      response.status(500).send("Internal Server Error");
    }
  }
);

/* -----------------------------------------------------------------------------
 * Firestore: Reagerar på bokningsuppdateringar
 * ---------------------------------------------------------------------------*/
export const onBookingUpdate = onDocumentUpdated(
  {
    document: "organizations/{orgId}/participantBookings/{bookingId}",
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) return;

    const beforeStatus = beforeData.status as string;
    const afterStatus = afterData.status as string;
    const orgId = event.params.orgId;
    const bookingId = event.params.bookingId;

    if (beforeStatus === "WAITLISTED" && afterStatus === "BOOKED") {
      const participantId = afterData.participantId as string;
      const scheduleId = afterData.scheduleId as string;
      const classDate = afterData.classDate as string;

      try {
        const participantProfileDoc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("participantDirectory")
          .doc(participantId)
          .get();
        if (!participantProfileDoc.exists) return;
        const profile = participantProfileDoc.data();
        const settings = profile?.notificationSettings;

        if (settings?.pushEnabled === false || settings?.waitlistPromotion === false) return;

        const subsSnap = await db
          .collection("organizations")
          .doc(orgId)
          .collection("userPushSubscriptions")
          .where("participantId", "==", participantId)
          .get();

        if (!subsSnap.empty) {
          const schedDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassSchedules")
            .doc(scheduleId)
            .get();
          const classDefDoc = schedDoc.exists
            ? await db
                .collection("organizations")
                .doc(orgId)
                .collection("groupClassDefinitions")
                .doc(schedDoc.data()!.groupClassId)
                .get()
            : null;

          if (schedDoc.exists && classDefDoc?.exists) {
            const date = new Date(classDate);
            const dateString = date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });
            const timeString = schedDoc.data()!.startTime;

            const payload = JSON.stringify({
              title: "Du har fått en plats!",
              body: `Du har flyttats från kön och har nu en plats på ${classDefDoc.data()!.name} ${dateString} kl ${timeString}.`,
            });

            if (tryInitWebPush()) {
              await Promise.all(
                subsSnap.docs.map(async (doc) => {
                  const sub = doc.data().subscription;
                  try {
                    await webpush.sendNotification(sub, payload);
                  } catch (err: any) {
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                      await doc.ref.delete();
                      await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
                    }
                  }
                })
              );
            }
          }
        }
      } catch (error) {
        logger.error("Error in onBookingUpdate (Promotion):", error);
      }
    }

    if (afterStatus === "BOOKED" && beforeStatus !== "BOOKED") {
      try {
        const settingsDoc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("integrationSettings")
          .doc("settings")
          .get();
        if (!settingsDoc.exists || !settingsDoc.data()?.enableSessionReminders) return;

        const reminderHours =
          typeof settingsDoc.data()?.sessionReminderHoursBefore === "number"
            ? settingsDoc.data()!.sessionReminderHoursBefore
            : 2;
        if (reminderHours <= 0) return;

        const schedDoc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("groupClassSchedules")
          .doc(afterData.scheduleId as string)
          .get();
        if (!schedDoc.exists) return;

        const [h, m] = String(schedDoc.data()!.startTime)
          .split(":")
          .map((n) => Number(n));
        const classDateTime = new Date(
          `${afterData.classDate as string}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
        );
        const scheduleTime = new Date(classDateTime.getTime() - reminderHours * 60 * 60 * 1000);

        if (scheduleTime > new Date()) {
          const queue = getFunctions().taskQueue("sendSessionReminder", "europe-west1");
          const project = process.env.GCLOUD_PROJECT;
          const targetUri = `https://europe-west1-${project}.cloudfunctions.net/sendSessionReminder`;
          await queue.enqueue({ orgId, bookingId }, { scheduleTime, uri: targetUri });
        }
      } catch (error) {
        logger.error(`Failed to schedule reminder for booking ${bookingId}:`, error);
      }
    }
  }
);

/* -----------------------------------------------------------------------------
 * Callable: Ställ in ett helt pass
 * ---------------------------------------------------------------------------*/
export const cancelClassInstance = onCall(
  {
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
  },
  async (request) => {
    const uid = request.auth?.uid;
    const name = (request.auth?.token as any)?.name || "Coach";
    if (!uid) throw new HttpsError("unauthenticated", "Funktionen måste anropas som inloggad användare.");

    const { orgId, scheduleId, classDate } = (request.data ?? {}) as {
      orgId?: string;
      scheduleId?: string;
      classDate?: string;
    };

    if (!orgId || !scheduleId || !classDate) {
      throw new HttpsError("invalid-argument", "Nödvändiga parametrar saknas.");
    }

    try {
      const exceptionRef = db.collection("organizations").doc(orgId).collection("groupClassScheduleExceptions").doc();
      await exceptionRef.set({ scheduleId, date: classDate, createdBy: { uid, name }, createdAt: new Date().toISOString() });
      const dateKey = normalizeDateKey(String(classDate));
      const bookingsRef = db.collection("organizations").doc(orgId).collection("participantBookings");
      let bookingsSnap = await bookingsRef.where("scheduleId", "==", scheduleId).where("classDate", "==", dateKey).where("status", "in", ["BOOKED", "CHECKED-IN", "CONFIRMED", "ACTIVE"]).get();

      if (bookingsSnap.empty) return { success: true };

      const batch = db.batch();
      const affectedParticipantIds = new Set<string>();
      const membershipsSnap = await db.collection("organizations").doc(orgId).collection("memberships").get();
      const memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Membership));
      const nowTs = Timestamp.now();

      for (const doc of bookingsSnap.docs) {
        const booking = doc.data() as any;
        affectedParticipantIds.add(booking.participantId);
        const participantDoc = await db.collection("organizations").doc(orgId).collection("participantDirectory").doc(booking.participantId).get();
        if (participantDoc.exists) {
          const membership = memberships.find((m) => m.id === (participantDoc.data() as any)?.membershipId);
          if (membership?.type === "clip_card") {
            batch.update(participantDoc.ref, { "clipCardStatus.remainingClips": FieldValue.increment(1) });
          }
        }
        batch.update(doc.ref, { status: "CANCELLED", cancelReason: "coach_cancelled", cancelledAt: nowTs, updatedAt: nowTs });
      }

      const scheduleDoc = await db.collection("organizations").doc(orgId).collection("groupClassSchedules").doc(scheduleId).get();
      const classDefDoc = scheduleDoc.exists ? await db.collection("organizations").doc(orgId).collection("groupClassDefinitions").doc(scheduleDoc.data()!.groupClassId).get() : null;
      let className = classDefDoc?.exists ? (classDefDoc.data() as any).name : "passet";

      const eventRef = db.collection("organizations").doc(orgId).collection("coachEvents").doc();
      batch.set(eventRef, { title: `INSTÄLLT: ${className}`, description: `Passet ${className} den ${classDate} är inställt.`, type: "news", studioTarget: "all", targetParticipantIds: Array.from(affectedParticipantIds), createdDate: new Date().toISOString() });

      await batch.commit();
      return { success: true };
    } catch (error) {
      throw new HttpsError("internal", "Ett fel uppstod.");
    }
  }
);

/* -----------------------------------------------------------------------------
 * HTTP: Calendar Feed (iCal)
 * ---------------------------------------------------------------------------*/
export const calendarFeed = onRequest({ region: "europe-west1" }, async (req: any, res: any) => {
  const { userId, type } = req.query;
  if (!userId || typeof userId !== "string") { res.status(400).send("Missing userId."); return; }

  try {
    const orgsSnap = await db.collection("organizations").get();
    let foundOrgId = "";
    for (const orgDoc of orgsSnap.docs) {
        const snap = await (type === "coach" ? orgDoc.ref.collection("staffMembers").doc(userId) : orgDoc.ref.collection("participantDirectory").doc(userId)).get();
        if (snap.exists) { foundOrgId = orgDoc.id; break; }
    }
    if (!foundOrgId) { res.status(404).send("User not found."); return; }

    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Flexibel//Träningslogg//SV\nEND:VCALENDAR`;
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.send(icsContent);
  } catch (e) {
    res.status(500).send("Internal Error");
  }
});

/* -----------------------------------------------------------------------------
 * Callable: 46elks Proxy (Säkrare anrop)
 * ---------------------------------------------------------------------------*/
export const trigger46elksAction = onCall({ region: "europe-west1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Logga in först.");
    
    const { action, from, to, message, voice_start, elksApiId, elksApiSecret } = (request.data ?? {}) as any;

    if (!elksApiId || !elksApiSecret) throw new HttpsError("invalid-argument", "API-uppgifter saknas.");

    const endpoint = action === 'sms' ? 'https://api.46elks.com/v1/sms' : 'https://api.46elks.com/v1/calls';
    
    // FIX: Node.js does not have btoa, use Buffer instead.
    const authString = Buffer.from(`${elksApiId}:${elksApiSecret}`).toString("base64");
    const formData = new URLSearchParams();
    
    formData.append('from', from);
    formData.append('to', to);
    if (action === 'sms') formData.append('message', message);
    if (action === 'call') formData.append('voice_start', voice_start);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            logger.error(`46elks API error (${response.status}): ${errText}`);
            throw new Error(`46elks API error: ${errText}`);
        }

        return { success: true };
    } catch (error: any) {
        logger.error("46elks Proxy Error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/* -----------------------------------------------------------------------------
 * Callable: Gemini proxy
 * ---------------------------------------------------------------------------*/
export const callGeminiApi = onCall(
  {
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
    cors: true,
  },
  async (request) => {
    try {
      const { model, contents, config, action, context } = (request.data ?? {}) as any;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return { error: "API key missing." };

      const ai = new GoogleGenAI({ apiKey });
      const targetModel = model || "gemini-2.5-flash";
      const resp = (await ai.models.generateContent({ model: targetModel, contents: contents as any, config })) as any;
      return { text: resp.text };
    } catch (error: any) {
      return { error: error.message };
    }
  }
);

/* -----------------------------------------------------------------------------
 * Cron: Weekly Highlights (Gemini)
 * ---------------------------------------------------------------------------*/
export const generateWeeklyHighlights = onSchedule(
  {
    schedule: "every 24 hours",
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
    timeZone: "Europe/Stockholm",
  },
  async () => {
    logger.info("Running scheduled job: generateWeeklyHighlights");
  }
);
