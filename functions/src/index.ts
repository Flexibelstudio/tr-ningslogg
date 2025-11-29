import { onCall, onRequest, HttpsError, Request as HttpsRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue, QueryDocumentSnapshot, DocumentReference } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFunctions } from "firebase-admin/functions";
import { GoogleGenAI } from "@google/genai";
import * as webpush from "web-push";

/* -----------------------------------------------------------------------------
 * Type Definitions (Copied from frontend for backend type safety)
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

// Normalisera olika datumformat till "YYYY-MM-DD"
function normalizeDateKey(input: string): string {
  const s = String(input ?? "");
  // redan rätt format?
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // försök parsa
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  // fallback: första 10 tecken
  return s.slice(0, 10);
}

// Public VAPID (webbens nyckel)
const VAPID_PUBLIC_KEY =
  "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";

/**
 * Initiera webpush när möjligt. Om något fel uppstår loggas det och PUSH stängs
 * av (så att API:erna inte kastar 500).
 */
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
  async (request: HttpsRequest, response: any) => {
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

    logger.info(`Processing reminder for booking ${bookingId} in org ${orgId}.`);

    try {
      const bookingRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("participantBookings")
        .doc(bookingId);

      const bookingDoc = await bookingRef.get();
      if (!bookingDoc.exists) {
        logger.warn(`Booking ${bookingId} not found. Aborting.`);
        response.status(200).send("Booking not found, task ignored.");
        return;
      }

      const booking = bookingDoc.data()!;
      if (!["BOOKED", "CHECKED-IN"].includes(booking.status)) {
        logger.info(`Booking ${bookingId} is not active (status: ${booking.status}). Skipping reminder.`);
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
        logger.warn(`Participant profile ${participantId} not found for reminder.`);
        response.status(200).send("Participant profile not found.");
        return;
      }
      const profile = participantProfileDoc.data();
      const settings = profile?.notificationSettings;

      if (settings?.pushEnabled === false || settings?.sessionReminder === false) {
        logger.info(`Reminders disabled for participant ${participantId}. Skipping.`);
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
        logger.info(`No push subscriptions for participant ${participantId}.`);
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
        logger.warn(`Schedule or class definition missing for booking ${bookingId}.`);
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
              logger.error(`Push send error (participant ${participantId})`, err);
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await doc.ref.delete();
                await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
              }
            }
          })
        );
      } else {
        logger.info("[Push] Skippas i sendSessionReminder (ej initierad).");
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

    if (!beforeData || !afterData) {
      logger.info("No data found in trigger event.");
      return;
    }

    const beforeStatus = beforeData.status as string;
    const afterStatus = afterData.status as string;
    const orgId = event.params.orgId;
    const bookingId = event.params.bookingId;

    // --- A) Waitlist -> Booked: push-notis (icke-kritisk) ---
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
        if (!participantProfileDoc.exists) {
          logger.warn(`Waitlist promotion: Participant profile ${participantId} not found.`);
          return;
        }
        const profile = participantProfileDoc.data();
        const settings = profile?.notificationSettings;

        if (settings?.pushEnabled === false || settings?.waitlistPromotion === false) {
          logger.info(`Waitlist promotion notifications disabled for participant ${participantId}. Skipping.`);
          return;
        }

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
                    logger.error("Promotion push error:", err);
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                      await doc.ref.delete();
                      await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
                    }
                  }
                })
              );
            } else {
              logger.info("[Push] Skippas i onBookingUpdate (promotion).");
            }
          }
        }
      } catch (error) {
        logger.error("Error in onBookingUpdate (Promotion):", error);
      }
    }

    // --- B) Ny BOOKED: schemalägg påminnelse ---
    if (afterStatus === "BOOKED" && beforeStatus !== "BOOKED") {
      try {
        const settingsDoc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("integrationSettings")
          .doc("settings")
          .get();
        if (!settingsDoc.exists || !settingsDoc.data()?.enableSessionReminders) {
          logger.info(`Reminders disabled for org ${orgId}. Skipping scheduling.`);
          return;
        }

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

          logger.info(`Scheduled reminder for booking ${bookingId}.`);
        }
      } catch (error) {
        logger.error(`Failed to schedule reminder for booking ${bookingId}:`, error);
      }
    }
  }
);

/* -----------------------------------------------------------------------------
 * Callable: Ställ in ett helt pass (ROBUST, push icke-kritisk)
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
      classDate?: string; // "YYYY-MM-DD" eller ISO
    };

    if (!orgId || !scheduleId || !classDate) {
      throw new HttpsError("invalid-argument", "Nödvändiga parametrar saknas (orgId, scheduleId, classDate).");
    }

    const opId = `${scheduleId}-${Date.now()}`;
    logger.info("cancelClassInstance called", { opId, orgId, scheduleId, classDate, coachUid: uid, coachName: name });

    try {
      // 1) Skapa exception
      const exceptionRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("groupClassScheduleExceptions")
        .doc();

      await exceptionRef.set({
        scheduleId,
        date: classDate,
        createdBy: { uid, name },
        createdAt: new Date().toISOString(),
      });
      logger.info(`[${opId}] WROTE exception`, { exceptionId: exceptionRef.id });

      // 2) Hitta bokningar (robust)
      const dateKey = normalizeDateKey(String(classDate));
      logger.info(`[${opId}] Booking lookup input`, {
        scheduleId,
        classDateInput: classDate,
        normalizedDateKey: dateKey,
      });

      const bookingsRef = db.collection("organizations").doc(orgId).collection("participantBookings");

      let bookingsSnap = await bookingsRef
        .where("scheduleId", "==", scheduleId)
        .where("classDate", "==", dateKey)
        .where("status", "in", ["BOOKED", "CHECKED-IN", "CONFIRMED", "ACTIVE"])
        .get();

      logger.info(`[${opId}] Primary bookings query`, { count: bookingsSnap.size });

      if (bookingsSnap.empty) {
        const schedOnlySnap = await bookingsRef
          .where("scheduleId", "==", scheduleId)
          .where("status", "in", ["BOOKED", "CHECKED-IN", "CONFIRMED", "ACTIVE"])
          .get();

        const candidates: QueryDocumentSnapshot[] = [];
        schedOnlySnap.forEach((d) => {
          const b = d.data() as any;
          const cd = String(b.classDate || "");
          if (cd.slice(0, 10) === dateKey) candidates.push(d);
        });

        if (candidates.length > 0) {
          (bookingsSnap as any) = { empty: false, size: candidates.length, docs: candidates };
          logger.info(`[${opId}] Fallback hit (scheduleId-only + in-memory date filter)`, { count: candidates.length });
        }
      }

      if (bookingsSnap.empty) {
        logger.info(
          `[${opId}] No active bookings found for schedule ${scheduleId} on ${dateKey}. Exception created.`
        );
        return { success: true, message: "Class cancelled, no active bookings found." };
      }

      // 3) Uppdatera bokningar + ev. refund + event + in-app notiser
      const batch = db.batch();
      const participantIdsToRefundClips = new Set<string>();
      const affectedParticipantIds = new Set<string>();

      const membershipsSnap = await db.collection("organizations").doc(orgId).collection("memberships").get();
      const memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Membership));

      const nowTs = Timestamp.now();

      for (const doc of bookingsSnap.docs) {
        const booking = doc.data() as any;
        affectedParticipantIds.add(booking.participantId);

        if (["BOOKED", "CHECKED-IN", "CONFIRMED", "ACTIVE"].includes(booking.status)) {
          const participantDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("participantDirectory")
            .doc(booking.participantId)
            .get();
          if (participantDoc.exists) {
            const participant = participantDoc.data() as any;
            const membership = memberships.find((m) => m.id === participant?.membershipId);
            if (membership?.type === "clip_card") {
              participantIdsToRefundClips.add(booking.participantId);
            }
          }
        }

        batch.update(doc.ref, {
          status: "CANCELLED",
          cancelReason: "coach_cancelled",
          cancelledAt: nowTs,
          updatedAt: nowTs,
        });
      }

      for (const participantId of participantIdsToRefundClips) {
        const participantRef = db
          .collection("organizations")
          .doc(orgId)
          .collection("participantDirectory")
          .doc(participantId);
        batch.update(participantRef, { "clipCardStatus.remainingClips": FieldValue.increment(1) });
      }

      const scheduleDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("groupClassSchedules")
        .doc(scheduleId)
        .get();
      const classDefDoc = scheduleDoc.exists
        ? await db
            .collection("organizations")
            .doc(orgId)
            .collection("groupClassDefinitions")
            .doc(scheduleDoc.data()!.groupClassId)
            .get()
        : null;

      let className = "passet";
      let classTime = "";
      let locationName = "din studio";
      if (scheduleDoc.exists) {
        classTime = scheduleDoc.data()!.startTime;
        const locationDoc = await db
          .collection("organizations")
          .doc(orgId)
          .collection("locations")
          .doc(scheduleDoc.data()!.locationId)
          .get();
        if (locationDoc.exists) locationName = (locationDoc.data() as any).name;
      }
      if (classDefDoc?.exists) className = (classDefDoc.data() as any).name;

      const date = new Date(String(classDate));
      const dateString = `${date.getDate()} ${date.toLocaleString("sv-SE", { month: "long" })}`;

      const eventTitle = `INSTÄLLT: ${className}`;
      const eventDescription = `Passet ${className} (${locationName}) den ${dateString} kl ${classTime} är tyvärr inställt.`;
      const studioTarget =
        locationName.toLowerCase().includes("salem")
          ? "salem"
          : locationName.toLowerCase().includes("kärra") || locationName.toLowerCase().includes("karra")
          ? "karra"
          : "all";

      const eventRef = db.collection("organizations").doc(orgId).collection("coachEvents").doc();
      batch.set(eventRef, {
        title: eventTitle,
        description: eventDescription,
        type: "news",
        studioTarget,
        targetParticipantIds: Array.from(affectedParticipantIds),
        createdDate: new Date().toISOString(),
      });

      for (const participantId of affectedParticipantIds) {
        const notifRef = db
          .collection("organizations")
          .doc(orgId)
          .collection("participantDirectory")
          .doc(participantId)
          .collection("user_notifications")
          .doc();

        batch.set(notifRef, {
          type: "CLASS_CANCELLED",
          scheduleId,
          classDate: dateKey,
          title: "Pass inställt",
          body: "Ditt bokade pass har ställts in av en coach.",
          createdAt: nowTs,
          read: false,
        });
      }

      await batch.commit();
      logger.info(`[${opId}] Bookings updated`, {
        cancelledCount: bookingsSnap.size,
        affectedParticipants: Array.from(affectedParticipantIds).length,
        refunds: participantIdsToRefundClips.size,
      });

      // 4) Push – gör icke-kritiskt (svälj fel)
      const payload = JSON.stringify({
        title: `Pass inställt: ${className}`,
        body: `Ditt pass ${className} den ${dateString} kl ${classTime} har tyvärr ställts in.`,
      });

      let notificationsSent = 0;
      if (tryInitWebPush()) {
        for (const participantId of affectedParticipantIds) {
          const participantProfileDoc = await db
            .collection("organizations")
            .doc(orgId)
            .collection("participantDirectory")
            .doc(participantId)
            .get();
          if (!participantProfileDoc.exists) continue;
          const profile = participantProfileDoc.data();
          const settings = (profile as any)?.notificationSettings;
          if (settings?.pushEnabled === false || settings?.classCancellation === false) {
            continue;
          }

          const subsSnap = await db
            .collection("organizations")
            .doc(orgId)
            .collection("userPushSubscriptions")
            .where("participantId", "==", participantId)
            .get();
          if (!subsSnap.empty) {
            await Promise.all(
              subsSnap.docs.map(async (doc) => {
                const sub = doc.data().subscription;
                try {
                  await webpush.sendNotification(sub, payload);
                  notificationsSent++;
                } catch (err: any) {
                  logger.error(`Push send error for participant ${participantId}:`, err);
                  if (err?.statusCode === 404 || err?.statusCode === 410) {
                    await doc.ref.delete();
                    await participantProfileDoc.ref.update({ "notificationSettings.pushEnabled": false });
                  }
                }
              })
            );
          }
        }
        logger.info(`[${opId}] SENT push`, { notificationsSent });
      } else {
        logger.info("[Push] Skippas i cancelClassInstance (ej initierad).");
      }

      logger.info(`[${opId}] DONE`);
      return { success: true, cancelledCount: (bookingsSnap as any).size, notificationsSent };
    } catch (error) {
      logger.error(`Error in cancelClassInstance for schedule ${scheduleId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "An unexpected error occurred while cancelling the class.");
    }
  }
);

/* -----------------------------------------------------------------------------
 * HTTP: Calendar Feed (iCal)
 * ---------------------------------------------------------------------------*/
export const calendarFeed = onRequest({ region: "europe-west1" }, async (req: HttpsRequest, res: any) => {
  const { userId, type } = req.query;

  if (!userId || typeof userId !== "string") {
    res.status(400).send("Bad Request: Missing userId.");
    return;
  }

  try {
    // 1. Hitta org + profil utifrån userId
    const orgsSnap = await db.collection("organizations").get();
    let foundOrgId = "";
    let userProfile: any = null;

    for (const orgDoc of orgsSnap.docs) {
      if (type === "coach") {
        const staffRef = orgDoc.ref.collection("staffMembers").doc(userId);
        const staffSnap = await staffRef.get();
        if (staffSnap.exists) {
          foundOrgId = orgDoc.id;
          userProfile = staffSnap.data();
          break;
        }
      } else {
        const partRef = orgDoc.ref.collection("participantDirectory").doc(userId);
        const partSnap = await partRef.get();
        if (partSnap.exists) {
          foundOrgId = orgDoc.id;
          userProfile = partSnap.data();
          break;
        }
      }
    }

    if (!foundOrgId || !userProfile) {
      res.status(404).send("User not found.");
      return;
    }

    // 2. Hämta events
    let events: string[] = [];
    const now = new Date();

    if (type === "coach") {
      // Återkommande scheman där coachId == userId (ej expanderade än – TODO om du vill)
      const schedulesSnap = await db
        .collection("organizations")
        .doc(foundOrgId)
        .collection("groupClassSchedules")
        .where("coachId", "==", userId)
        .get();

      if (!schedulesSnap.empty) {
        logger.info(`Found ${schedulesSnap.size} recurring schedules for coach ${userId}, not yet expanded to iCal.`);
      }

      // 1-on-1 där coachId == userId
      const sessionsSnap = await db
        .collection("organizations")
        .doc(foundOrgId)
        .collection("oneOnOneSessions")
        .where("coachId", "==", userId)
        .where("startTime", ">=", now.toISOString())
        .get();

      sessionsSnap.forEach((sessionDoc) => {
        const s = sessionDoc.data();
        events.push(createVEVENT(s.title, s.purpose, new Date(s.startTime), new Date(s.endTime)));
      });
    } else {
      // Participant: Bookings + 1-on-1
      const bookingsSnap = await db
        .collection("organizations")
        .doc(foundOrgId)
        .collection("participantBookings")
        .where("participantId", "==", userId)
        .where("status", "in", ["BOOKED", "CHECKED-IN"])
        .where("classDate", ">=", normalizeDateKey(now.toISOString()))
        .get();

      for (const bookingDoc of bookingsSnap.docs) {
        const b = bookingDoc.data();
        const schedDoc = await db
          .collection("organizations")
          .doc(foundOrgId)
          .collection("groupClassSchedules")
          .doc(b.scheduleId)
          .get();
        if (schedDoc.exists) {
          const s = schedDoc.data()!;
          const defDoc = await db
            .collection("organizations")
            .doc(foundOrgId)
            .collection("groupClassDefinitions")
            .doc(s.groupClassId)
            .get();
          const className = defDoc.exists ? defDoc.data()!.name : "Pass";

          const [h, m] = String(s.startTime).split(":").map(Number);
          const start = new Date(b.classDate);
          start.setHours(h, m, 0, 0);
          const end = new Date(start.getTime() + s.durationMinutes * 60000);

          events.push(createVEVENT(className, "Träning på Flexibel", start, end));
        }
      }

      const sessionsSnap = await db
        .collection("organizations")
        .doc(foundOrgId)
        .collection("oneOnOneSessions")
        .where("participantId", "==", userId)
        .where("startTime", ">=", now.toISOString())
        .get();

      sessionsSnap.forEach((sessionDoc) => {
        const s = sessionDoc.data();
        events.push(createVEVENT(s.title, s.purpose, new Date(s.startTime), new Date(s.endTime)));
      });
    }

    // 3. Skapa ICS
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Flexibel//Träningslogg//SV
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Flexibel Träning
${events.join("\n")}
END:VCALENDAR`;

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="calendar.ics"');
    res.send(icsContent);
  } catch (e) {
    logger.error("Calendar feed error", e);
    res.status(500).send("Internal Server Error");
  }
});

function createVEVENT(summary: string, description: string, start: Date, end: Date): string {
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VEVENT
UID:${Math.random().toString(36).substr(2)}@flexibel.se
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:${summary}
DESCRIPTION:${description}
END:VEVENT`;
}

/* -----------------------------------------------------------------------------
 * Zapier → skapa lead
 * ---------------------------------------------------------------------------*/
export const createLeadFromZapier = onRequest(
  {
    region: "europe-west1",
    secrets: ["ZAPIER_SECRET_KEY"],
    cors: true,
  },
  async (request: any, response: any) => {
    if (request.method !== "POST") {
      logger.warn("Method Not Allowed:", request.method);
      response.status(405).send("Method Not Allowed");
      return;
    }

    const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;
    const presented = getBearerToken(request);
    if (!ZAPIER_SECRET_KEY || presented !== ZAPIER_SECRET_KEY) {
      logger.warn("Unauthorized attempt to access webhook.");
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { firstName, lastName, email, phone, locationName, orgId, source } =
      (request.body ?? {}) as Record<string, unknown>;

    const missing = [
      !firstName && "firstName",
      !lastName && "lastName",
      !email && "email",
      !locationName && "locationName",
      !orgId && "orgId",
    ]
      .filter(Boolean)
      .join(", ");

    if (missing) {
      logger.error("Bad Request: Missing required fields:", missing);
      response.status(400).json({ error: `Bad Request: Missing fields: ${missing}` });
      return;
    }

    try {
      const locationsSnapshot = await db
        .collection("organizations")
        .doc(String(orgId))
        .collection("locations")
        .get();

      type LocationDoc = { name?: string };
      const locations: Array<{ id: string; name?: string }> = locationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as LocationDoc),
      }));

      const targetLocation = locations.find(
        (l) => typeof l.name === "string" && l.name.toLowerCase().includes(String(locationName).toLowerCase())
      );

      if (!targetLocation) {
        logger.error(`Location named '${locationName}' could not be found.`);
        response.status(400).json({ error: `Bad Request: Location '${locationName}' not found.` });
        return;
      }

      const newLead = {
        firstName: String(firstName),
        lastName: String(lastName),
        email: String(email).toLowerCase(),
        phone: phone ? String(phone) : "",
        locationId: targetLocation.id,
        source: source ? String(source) : "Meta",
        createdDate: new Date().toISOString(),
        status: "new",
      };

      const leadRef = await db.collection("organizations").doc(String(orgId)).collection("leads").add(newLead);
      logger.info(`Successfully created lead with ID: ${leadRef.id} for org ${orgId}`);
      response.status(201).json({ success: true, leadId: leadRef.id });
    } catch (error) {
      logger.error("Error creating lead:", error);
      response.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/* -----------------------------------------------------------------------------
 * Callable: Gemini proxy
 * ---------------------------------------------------------------------------*/
export const callGeminiApi = onCall(
  {
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    try {
      const { model, contents, config, action, context } = (request.data ?? {}) as {
        model?: string;
        contents?: unknown;
        config?: any;
        action?: string;
        context?: any;
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("GEMINI_API_KEY secret not found on the server.");
        return { error: "API key is not configured on the server." };
      }

      const ai = new GoogleGenAI({ apiKey });

      let targetModel = model || "gemini-2.5-flash";
      let targetContents = contents;
      let targetConfig = config;

      if (action) {
        switch (action) {
          case "generate_goal_prognosis": {
            const { fitnessGoals, workoutsPerWeekTarget, targetDate, preferences } = context || {};
            targetContents = `
Du är en expert PT och coach. En klient har satt upp följande träningsmål:
- Mål: "${fitnessGoals}"
- Målfrekvens: ${workoutsPerWeekTarget} pass/vecka
- Måldatum: ${targetDate || "Ej satt"}
- Preferenser/Övrigt: "${preferences || "Inga"}"

Ge en kort, peppande och realistisk prognos.
1. Är målet realistiskt med tanke på frekvensen?
2. Ge 2-3 konkreta tips på vad klienten bör fokusera på för att lyckas.
3. Om måldatum saknas eller verkar orimligt, ge ett förslag.

Svara direkt till klienten ("Du..."). Håll det under 150 ord. Använd Markdown.
            `;
            break;
          }
          case "generate_smart_goal": {
            targetContents = `Du är en expert på att formulera SMART-mål för träning.\nAnvändaren har skrivit: "${context?.goalInput}"\n\nFormulera om detta till ett tydligt, inspirerande SMART-mål (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet) på svenska.\nSvara ENDAST med själva målformuleringen, ingen inledning eller förklaring.`;
            break;
          }
          case "chat_with_coach": {
            targetContents = `
Du är en vänlig, peppande och kunnig AI-coach för Flexibel Hälsostudio. Du pratar med ${context?.participant?.name || "en medlem"}.

**Profil:**
- Mål: ${context?.goal}
- Senaste träning: ${JSON.stringify(context?.recentWorkouts)}
- Övrig aktivitet: ${JSON.stringify(context?.recentActivities)}

**Användarens meddelande:** "${context?.userMessage}"

Svara hjälpsamt, kortfattat och engagerande på svenska. Om de frågar om passförslag, utgå från: ${JSON.stringify(context?.availableWorkouts)}.
            `;
            break;
          }
          case "generate_workout_tips": {
            targetContents = `
Du är en expertcoach. Ge korta, peppande tips inför passet "${context?.workoutTitle}" för ${context?.participantName}.
${context?.aiInstruction ? `Coach-instruktion: ${context?.aiInstruction}` : ""}
${context?.previousLog ? `Förra gången: ${JSON.stringify(context?.previousLog)}` : "Första gången detta pass loggas."}
Övningar: ${context?.exercisesList}

Svara med strikt JSON: { "generalTips": "...", "exerciseTips": [{ "exerciseName": "...", "tip": "..." }] }
            `;
            targetConfig = { ...targetConfig, responseMimeType: "application/json" };
            break;
          }
          case "generate_checkin_summary": {
            targetContents = `
Du är en coach. Skapa en kort sammanfattning av medlemmens aktivitet för ett avstämningssamtal.
Namn: ${context?.participantName}
Mål: ${context?.goal} (Mål: ${context?.goalTarget} pass/v)
Senaste avstämning: ${context?.lastCheckinDate || "Aldrig"}
Aktivitetssammanfattning: ${context?.logSummary}

Ge en kort analys av trender och föreslå 1-2 frågor att ställa till medlemmen. Använd Markdown.
            `;
            break;
          }
          case "analyze_business_insights": {
            const { dataSnapshot, question } = context;
            targetContents = `Analysera denna data: ${dataSnapshot}. Svara på frågan: "${question}"`;
            break;
          }
          case "analyze_member_insights": {
            const { recentComments, avgMoodRating } = context;
            targetContents = `Analysera medlemmens data för att hitta mönster.\nKommentarer: ${recentComments}. Mående: ${avgMoodRating}. Mål: ${context?.goal}\n\nGe en kort insikt om medlemmens mentala inställning och progression.`;
            break;
          }
          case "generate_weekly_highlights": {
            const { pbs, totalLogs } = context;
            targetContents = `Skriv ett inlägg om veckans höjdpunkter. ${totalLogs} pass loggade. PBs: ${JSON.stringify(pbs)}.`;
            break;
          }
          case "generate_workout_program": {
            targetContents = `
Du är en expertcoach som skapar träningsprogram.
Medlem: ${context?.participantName} (${context?.age} år, ${context?.gender})
Mål: ${context?.goal}
Coach-recept: ${context?.coachPrescription}
Specifika önskemål: ${context?.specificRequests}
Tillgängliga baslyft: ${context?.availableBaseLifts}

Skapa ett pass i Markdown-format.
Struktur:
**Titel:** [Passets namn]
**Coachanteckning:** [Kort intro]

### [Blocknamn 1]
* [Övning 1]: [Set] x [Reps] @ [Vikt/RPE] (Baslyft: [Valfritt baslyft från listan])
* [Övning 2]...

Var kreativ men följ önskemålen.
            `;
            break;
          }
          case "analyze_activity_trends": {
            const { summaryOfLogs } = context;
            targetContents = `Analysera följande träningsloggar och ge en kort sammanfattning av trender, styrkor och vad som kan förbättras. Tilltala medlemmen direkt.\n\nLoggar: ${summaryOfLogs}`;
            break;
          }
          case "identify_silent_heroes": {
            const { candidates } = context;
            targetContents = `Identifiera "Tysta hjältar" (hög aktivitet men lite interaktion) från listan. Returnera JSON array: [{ "participantId": "...", "name": "...", "reason": "..." }].\nLista: ${JSON.stringify(candidates)}`;
            targetConfig = { ...targetConfig, responseMimeType: "application/json" };
            break;
          }
          case "identify_churn_risks": {
            const { candidates } = context;
            targetContents = `Identifiera "Churn risk" (minskande aktivitet) från listan. Returnera JSON array: [{ "participantId": "...", "name": "...", "reason": "..." }].\nLista: ${JSON.stringify(candidates)}`;
            targetConfig = { ...targetConfig, responseMimeType: "application/json" };
            break;
          }
          default:
            if (!targetContents && context?.prompt) targetContents = context.prompt;
            break;
        }
      }

      if (!targetContents) {
        logger.error("Bad Request: Missing 'contents' or valid 'action'");
        return { error: "Bad Request: Missing 'contents' or valid 'action'." };
      }

      const resp = (await ai.models.generateContent({
        model: targetModel,
        contents: targetContents as any,
        config: targetConfig,
      })) as any;

      const text = resp.text as string | undefined;
      if (!text) {
        const pf = resp.promptFeedback;
        if (pf?.blockReason) {
          const safetyRatings = pf.safetyRatings?.map((r: any) => `${r.category}: ${r.probability}`).join(", ");
          const errorMessage = `Request blocked by Gemini API. Reason: ${pf.blockReason}. Ratings: ${safetyRatings || "N/A"}`;
          logger.error(errorMessage, { fullResponse: resp });
          throw new Error(errorMessage);
        }
        logger.warn("Gemini API returned empty text.", JSON.stringify(resp, null, 2));
        throw new Error("Received empty response from AI, but not due to safety blocking.");
      }
      return { text };
    } catch (error) {
      logger.error("Error calling Gemini API:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { error: `Internal Server Error: ${msg}` };
    }
  }
);

/* -----------------------------------------------------------------------------
 * Callable: Vänbokningsnotis (icke-kritisk push)
 * ---------------------------------------------------------------------------*/
export const notifyFriendsOnBooking = onCall(
  {
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Funktionen måste anropas som inloggad användare.");
    }
    const { orgId, participantId, scheduleId, classDate } = (request.data ?? {}) as {
      orgId?: string;
      participantId?: string;
      scheduleId?: string;
      classDate?: string;
    };

    if (!orgId || !participantId || !scheduleId || !classDate) {
      throw new HttpsError(
        "invalid-argument",
        "Nödvändiga parametrar saknas (orgId, participantId, scheduleId, classDate)."
      );
    }

    try {
      const bookerProfileRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("participantDirectory")
        .doc(participantId);
      const bookerProfileDoc = await bookerProfileRef.get();
      if (!bookerProfileDoc.exists || !bookerProfileDoc.data()?.shareMyBookings) {
        return { success: true, message: "Sharing disabled." };
      }
      const bookerName = (bookerProfileDoc.data() as any)?.name || "En kompis";

      const connectionsSnap = await db.collection("organizations").doc(orgId).collection("connections").get();
      const friendIds = new Set<string>();
      connectionsSnap.forEach((doc) => {
        const conn = doc.data() as any;
        if (conn.status === "accepted") {
          if (conn.requesterId === participantId) friendIds.add(conn.receiverId);
          if (conn.receiverId === participantId) friendIds.add(conn.requesterId);
        }
      });

      if (friendIds.size === 0) return { success: true, message: "No friends." };

      const friendsToNotify: { id: string; doc: DocumentReference }[] = [];
      const participantDirectoryRef = db.collection("organizations").doc(orgId).collection("participantDirectory");
      const friendProfilePromises = Array.from(friendIds).map((id) => participantDirectoryRef.doc(id).get());
      const friendProfileDocs = await Promise.all(friendProfilePromises);

      for (const doc of friendProfileDocs) {
        if (doc.exists) {
          const friendProfile = doc.data() as any;
          if (
            friendProfile &&
            (friendProfile.receiveFriendBookingNotifications ?? true) &&
            friendProfile.notificationSettings?.pushEnabled !== false
          ) {
            friendsToNotify.push({ id: doc.id, doc: doc.ref });
          }
        }
      }

      if (friendsToNotify.length === 0) return { success: true, message: "No friends with notifications enabled." };

      const scheduleDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("groupClassSchedules")
        .doc(scheduleId)
        .get();
      if (!scheduleDoc.exists) return { success: false, message: "Schedule not found." };
      const schedule = scheduleDoc.data() as any;
      const classDefDoc = await db
        .collection("organizations")
        .doc(orgId)
        .collection("groupClassDefinitions")
        .doc(schedule.groupClassId)
        .get();
      if (!classDefDoc.exists) return { success: false, message: "Class definition not found." };
      const className = (classDefDoc.data() as any)?.name || "ett pass";

      const payload = JSON.stringify({
        title: "Träningsdags?",
        body: `${String(bookerName).split(" ")[0]} har bokat ${className}, ska du haka på?`,
      });

      let notificationsSent = 0;
      if (tryInitWebPush()) {
        for (const friend of friendsToNotify) {
          const subsSnap = await db
            .collection("organizations")
            .doc(orgId)
            .collection("userPushSubscriptions")
            .where("participantId", "==", friend.id)
            .get();
          if (!subsSnap.empty) {
            await Promise.all(
              subsSnap.docs.map(async (doc) => {
                const sub = doc.data().subscription;
                try {
                  await webpush.sendNotification(sub, payload);
                  notificationsSent++;
                } catch (err: any) {
                  logger.error(`Push send error for friend ${friend.id}:`, err);
                  if (err?.statusCode === 404 || err?.statusCode === 410) {
                    await doc.ref.delete();
                    await friend.doc.update({ "notificationSettings.pushEnabled": false });
                  }
                }
              })
            );
          }
        }
      } else {
        logger.info("[Push] Skippas i notifyFriendsOnBooking (ej initierad).");
      }
      return { success: true, notificationsSent };
    } catch (error) {
      logger.error(`Error in notifyFriendsOnBooking for participant ${participantId}:`, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "An unexpected error occurred.");
    }
  }
);

/* -----------------------------------------------------------------------------
 * Callable: Analytics 30 dagar
 * ---------------------------------------------------------------------------*/
export const getAnalyticsData = onCall({ region: "europe-west1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const { orgId } = request.data || {};
  if (!orgId) {
    throw new HttpsError("invalid-argument", "The function must be called with an 'orgId'.");
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);
    const sinceTs = Timestamp.fromDate(since);

    const daily = new Map<string, { bookings: number; cancellations: number; checkins: number }>();
    for (let i = 0; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split("T")[0];
      daily.set(key, { bookings: 0, cancellations: 0, checkins: 0 });
    }

    const makeQuery = (type: "BOOKING_CREATED" | "BOOKING_CANCELLED" | "CHECKIN") =>
      db
        .collection("analyticsEvents")
        .where("orgId", "==", orgId)
        .where("type", "==", type)
        .where("timestamp", ">=", sinceTs)
        .orderBy("timestamp", "asc")
        .get();

    const [q1, q2, q3] = await Promise.all([makeQuery("BOOKING_CREATED"), makeQuery("BOOKING_CANCELLED"), makeQuery("CHECKIN")]);

    const toKey = (ts: Timestamp) => {
      const dt = ts.toDate();
      return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString().split("T")[0];
    };

    q1.forEach((doc) => {
      const ts = doc.get("timestamp") as Timestamp | undefined;
      if (ts) {
        const key = toKey(ts);
        const r = daily.get(key);
        if (r) r.bookings += 1;
      }
    });

    q2.forEach((doc) => {
      const ts = doc.get("timestamp") as Timestamp | undefined;
      if (ts) {
        const key = toKey(ts);
        const r = daily.get(key);
        if (r) r.cancellations += 1;
      }
    });

    q3.forEach((doc) => {
      const ts = doc.get("timestamp") as Timestamp | undefined;
      if (ts) {
        const key = toKey(ts);
        const r = daily.get(key);
        if (r) r.checkins += 1;
      }
    });

    const data = Array.from(daily.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { data };
  } catch (err) {
    logger.error("getAnalyticsData failed:", err);
    throw new HttpsError("internal", "Failed to retrieve analytics data.");
  }
});

/* -----------------------------------------------------------------------------
 * Cron: Weekly Highlights (Gemini)
 * ---------------------------------------------------------------------------*/
export const generateWeeklyHighlights = onSchedule(
  {
    schedule: "every 1 hours",
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
    timeZone: "Europe/Stockholm",
  },
  async () => {
    logger.info("Running scheduled job: generateWeeklyHighlights");
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1, Sun=7
    const currentHour = now.getHours();
    const currentWeek = getISOWeek(now);

    const orgsSnapshot = await db.collection("organizations").get();

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;

      const settingsRef = db.collection("organizations").doc(orgId).collection("weeklyHighlightSettings").doc("settings");
      const settingsDoc = await settingsRef.get();
      if (!settingsDoc.exists) continue;

      const settings = settingsDoc.data() as any;
      if (!settings.isEnabled) continue;

      const lastGenTimestamp = settings.lastGeneratedTimestamp ? new Date(settings.lastGeneratedTimestamp) : null;
      if (lastGenTimestamp && getISOWeek(lastGenTimestamp) === currentWeek) continue;

      const scheduledDay = settings.dayOfWeek as number; // 1-7
      const scheduledHour = parseInt(String(settings.time).split(":")[0], 10);
      if (currentDay !== scheduledDay || currentHour !== scheduledHour) continue;

      try {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const locationsSnapshot = await db.collection("organizations").doc(orgId).collection("locations").get();
        const locations = locationsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as { name: string }) }));

        const targets: { studioTarget: "all" | "salem" | "karra"; locationName: string }[] = [];
        if (settings.studioTarget === "separate") {
          targets.push({ studioTarget: "salem", locationName: "Salem" });
          targets.push({ studioTarget: "karra", locationName: "Kärra" });
        } else {
          targets.push({ studioTarget: settings.studioTarget, locationName: "Alla" });
        }

        for (const target of targets) {
          let participantQuery = db
            .collection("organizations")
            .doc(orgId)
            .collection("participantDirectory")
            .where("enableLeaderboardParticipation", "==", true);

          if (target.studioTarget !== "all") {
            const location = locations.find((l) => l.name.toLowerCase().includes(target.studioTarget));
            if (location) {
              participantQuery = participantQuery.where("locationId", "==", location.id);
            }
          }

          const participantsSnapshot = await participantQuery.get();
          const targetParticipants = participantsSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as { name: string }) }));
          const targetParticipantIds = targetParticipants.map((p) => p.id);
          if (targetParticipantIds.length === 0) continue;

          const workoutLogsSnapshot = await db
            .collection("organizations")
            .doc(orgId)
            .collection("workoutLogs")
            .where("participantId", "in", targetParticipantIds)
            .where("completedDate", ">=", oneWeekAgo.toISOString())
            .get();

          const logsLastWeek = workoutLogsSnapshot.docs.map((doc) => doc.data() as any);

          const pbsLastWeek = logsLastWeek
            .flatMap((log) => {
              const participant = targetParticipants.find((p) => p.id === (log as any).participantId);
              return ((log as any).postWorkoutSummary?.newPBs || []).map((pb: any) => ({
                ...pb,
                participantName: participant?.name || "Okänd",
              }));
            })
            .slice(0, 10);

          const prompt = `Du är "Flexibot", en AI-assistent för Flexibel Hälsostudio. Din uppgift är att skapa ett "Veckans Höjdpunkter"-inlägg för community-flödet. Svaret MÅSTE vara på svenska och formaterat med Markdown.

**Data från den gångna veckan:**
- Totalt antal loggade pass: ${logsLastWeek.length}
- Antal medlemmar som tränat: ${new Set(logsLastWeek.map((l: any) => l.participantId)).size}
- Några av veckans personliga rekord (PBs):
${
  pbsLastWeek.length > 0
    ? pbsLastWeek.map((pb) => `  * ${pb.participantName} slog PB i ${pb.exerciseName} med ${pb.value}!`).join("\n")
    : "  * Inga nya PBs loggade denna vecka."
}

**Ditt uppdrag:**
1. Skapa en titel i formatet: Veckans Höjdpunkter - v${getISOWeek(new Date())}.
2. Skriv en kort, peppande sammanfattning av veckans aktivitet.
3. Lyft fram 2–3 av de mest imponerande PBs från listan.
4. Avsluta med en uppmuntrande fras om att fortsätta kämpa.
5. Formatera hela texten med Markdown. Kombinera titel och beskrivning till en enda textsträng.`;

          const apiKey = process.env.GEMINI_API_KEY!;
          const ai = new GoogleGenAI({ apiKey });
          const resp = (await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          })) as any;

          const text = resp.text as string | undefined;
          if (!text) throw new Error("Empty AI response for weekly highlights.");

          const lines = text.split("\n");
          const title =
            lines.find((l) => l.trim().length > 0)?.replace(/#/g, "").trim() || `Veckans Höjdpunkter - v${currentWeek}`;
          const description = lines.slice(1).join("\n").trim();

          const newEvent = {
            title,
            description,
            type: "news",
            studioTarget: target.studioTarget,
            createdDate: now.toISOString(),
          };

          await db.collection("organizations").doc(orgId).collection("coachEvents").add(newEvent);
        }

        await settingsRef.update({ lastGeneratedTimestamp: now.toISOString() });
      } catch (error) {
        logger.error(`Failed to generate highlights for org ${orgId}:`, error);
      }
    }
  }
);