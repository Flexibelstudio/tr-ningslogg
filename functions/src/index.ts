// functions/src/index.ts
import { HttpsError, onRequest, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as webpush from "web-push";
import { getFunctions } from "firebase-admin/functions";

// -----------------------------------------------------------------------------
// Init Admin
// -----------------------------------------------------------------------------
initializeApp();
const db = getFirestore();

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// HTTP: Körs av Cloud Tasks för att skicka pass-påminnelse
// -----------------------------------------------------------------------------
export const sendSessionReminder = onRequest(
  {
    region: "europe-west1",
    secrets: ["VAPID_PRIVATE_KEY"],
  },
  async (request, response) => {
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
      const bookingRef = db.collection("organizations").doc(orgId).collection("participantBookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();
      if (!bookingDoc.exists) {
        logger.warn(`Booking ${bookingId} not found. Aborting.`);
        response.status(200).send("Booking not found, task ignored.");
        return;
      }

      const booking = bookingDoc.data()!;
      // Self-cancel: skicka bara om bokningen fortfarande är aktiv
      if (!["BOOKED", "CHECKED-IN"].includes(booking.status)) {
        logger.info(`Booking ${bookingId} is not active (status: ${booking.status}). Skipping reminder.`);
        response.status(200).send("Booking not active.");
        return;
      }

      const { participantId, scheduleId } = booking;
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

      const schedDoc = await db.collection("organizations").doc(orgId).collection("groupClassSchedules").doc(scheduleId).get();
      const classDefDoc = schedDoc.exists
        ? await db.collection("organizations").doc(orgId).collection("groupClassDefinitions").doc(schedDoc.data()!.groupClassId).get()
        : null;

      if (!schedDoc.exists || !classDefDoc?.exists) {
        logger.warn(`Schedule or class definition missing for booking ${bookingId}.`);
        response.status(200).send("Class details missing.");
        return;
      }

      const settingsDoc = await db.collection("organizations").doc(orgId).collection("integrationSettings").doc("settings").get();
      const reminderHours =
        settingsDoc.exists && typeof settingsDoc.data()?.sessionReminderHoursBefore === "number"
          ? settingsDoc.data()!.sessionReminderHoursBefore
          : 2;

      const payload = JSON.stringify({
        title: `Påminnelse: ${classDefDoc.data()!.name}`,
        body: `Ditt pass börjar om ${reminderHours} timmar kl ${schedDoc.data()!.startTime}. Vi ses!`,
      });

      const vapidPublicKey =
        "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
      if (!vapidPrivateKey) throw new Error("VAPID_PRIVATE_KEY secret is not set!");

      webpush.setVapidDetails("mailto:admin@flexibel.se", vapidPublicKey, vapidPrivateKey);

      await Promise.all(
        subsSnap.docs.map(async (doc) => {
          const sub = doc.data().subscription;
          try {
            await webpush.sendNotification(sub, payload);
          } catch (err: any) {
            logger.error(`Push send error (participant ${participantId})`, err);
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await doc.ref.delete();
            }
          }
        })
      );

      // Rensa ev. flaggor (ingen task-id lagras i denna version)
      await bookingRef.update({ reminderTaskId: null }).catch(() => {});
      response.status(200).send("Reminder sent.");
    } catch (error) {
      logger.error(`Failed to send reminder for booking ${bookingId}:`, error);
      response.status(500).send("Internal Server Error");
    }
  }
);

// -----------------------------------------------------------------------------
// Firestore: Reagerar på bokningsuppdateringar
//  - WAITLISTED -> BOOKED: skicka “plats släppt”
//  - Ny BOOKED: schemalägg påminnelse via Cloud Tasks
//  - Avbokning: ingen explicit delete (vi har inget task-id); self-cancel räcker
// -----------------------------------------------------------------------------
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

    // --- A) Waitlist -> Booked: push-notis ---
    if (beforeStatus === "WAITLISTED" && afterStatus === "BOOKED") {
      const participantId = afterData.participantId as string;
      const scheduleId = afterData.scheduleId as string;
      const classDate = afterData.classDate as string;

      try {
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

            const vapidPublicKey =
              "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";
            const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
            if (!vapidPrivateKey) throw new Error("VAPID_PRIVATE_KEY secret is not set!");

            webpush.setVapidDetails("mailto:admin@flexibel.se", vapidPublicKey, vapidPrivateKey);

            await Promise.all(
              subsSnap.docs.map(async (doc) => {
                const sub = doc.data().subscription;
                try {
                  await webpush.sendNotification(sub, payload);
                } catch (err: any) {
                  logger.error("Promotion push error:", err);
                  if (err?.statusCode === 404 || err?.statusCode === 410) {
                    await doc.ref.delete();
                  }
                }
              })
            );
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

        const [h, m] = String(schedDoc.data()!.startTime).split(":").map((n) => Number(n));
        const classDateTime = new Date(`${afterData.classDate as string}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
        const scheduleTime = new Date(classDateTime.getTime() - reminderHours * 60 * 60 * 1000);

        if (scheduleTime > new Date()) {
          const queue = getFunctions().taskQueue("sendSessionReminder", "europe-west1");
          const project = process.env.GCLOUD_PROJECT;
          const targetUri = `https://europe-west1-${project}.cloudfunctions.net/sendSessionReminder`;

          await queue.enqueue({ orgId, bookingId }, { scheduleTime, uri: targetUri });

          logger.info(`Scheduled reminder task for booking ${bookingId}.`);
          // Vi har inget task-id; låt ev. fältet vara null/inte satt.
          await event.data!.after.ref.update({ reminderTaskId: null }).catch(() => {});
        }
      } catch (error) {
        logger.error(`Failed to schedule reminder for booking ${bookingId}:`, error);
      }
    }

    // --- C) Avbokning: inget aktivt delete-anrop (utan task-id) ---
    if (["BOOKED", "CHECKED-IN"].includes(beforeStatus) && afterStatus === "CANCELLED") {
      // Inget att ta bort – reminder gör self-cancel när den körs.
      await event.data!.after.ref.update({ reminderTaskId: null }).catch(() => {});
      logger.info(`Booking ${bookingId} cancelled – no explicit task delete (self-cancel strategy).`);
    }
  }
);

// -----------------------------------------------------------------------------
// Zapier → skapa lead
// -----------------------------------------------------------------------------
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

    const { firstName, lastName, email, phone, locationName, orgId, source } = (request.body ?? {}) as Record<string, unknown>;

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

// -----------------------------------------------------------------------------
// Callable: Gemini proxy
// -----------------------------------------------------------------------------
export const callGeminiApi = onCall(
  {
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    try {
      const { model, contents, config } = (request.data ?? {}) as {
        model?: string;
        contents?: unknown;
        config?: any;
      };

      if (!model || contents == null) {
        logger.error("Bad Request: Missing 'model' or 'contents'");
        return { error: "Bad Request: Missing 'model' or 'contents'." };
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error("GEMINI_API_KEY secret not found on the server.");
        return { error: "API key is not configured on the server." };
      }

      const ai = new GoogleGenAI({ apiKey });
      const resp = (await ai.models.generateContent({
        model,
        contents: contents as any,
        config,
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

// -----------------------------------------------------------------------------
// Callable: Analytics 30 dagar
// -----------------------------------------------------------------------------
export const getAnalyticsData = onCall(
  { region: "europe-west1" },
  async (request) => {
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
  }
);

// -----------------------------------------------------------------------------
// Cron: Weekly Highlights (Gemini)
// -----------------------------------------------------------------------------
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
          const title = lines.find((l) => l.trim().length > 0)?.replace(/#/g, "").trim() || `Veckans Höjdpunkter - v${currentWeek}`;
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
