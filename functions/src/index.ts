import { HttpsError, onRequest, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as webpush from "web-push";

// Init Admin SDK
initializeApp();
const db = getFirestore();

// Helper to get ISO week number (no client deps)
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// Robust bearer token reader
function getBearerToken(req: { header?: (n: string) => string | undefined; headers?: Record<string, any> }) {
  const h =
    (typeof req.header === "function" ? req.header("authorization") : undefined) ??
    (typeof req.header === "function" ? req.header("Authorization") : undefined) ??
    (req.headers?.authorization as string | undefined) ??
    (req.headers?.Authorization as string | undefined) ??
    "";
  return typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7) : "";
}

export const onBookingPromoted = onDocumentUpdated(
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
  
      // Check if the status changed from WAITLISTED to BOOKED
      if (beforeData.status === "WAITLISTED" && afterData.status === "BOOKED") {
        const orgId = event.params.orgId;
        const participantId = afterData.participantId;
        const scheduleId = afterData.scheduleId;
        const classDate = afterData.classDate;
  
        logger.info(
          `Promotion detected for participant ${participantId} in org ${orgId}. Preparing to send notification.`
        );
  
        try {
          // 1. Get Subscription tokens for the participant
          const subscriptionsSnapshot = await db
            .collection("organizations")
            .doc(orgId)
            .collection("userPushSubscriptions")
            .where("participantId", "==", participantId)
            .get();
  
          if (subscriptionsSnapshot.empty) {
            logger.info(`No push subscriptions found for participant ${participantId}. Aborting.`);
            return;
          }
          
          // 2. Get class details to build a nice message
          const scheduleDoc = await db.collection("organizations").doc(orgId).collection("groupClassSchedules").doc(scheduleId).get();
          if (!scheduleDoc.exists) {
              logger.warn(`Schedule doc ${scheduleId} not found for promoted booking.`);
              return;
          }
          const scheduleData = scheduleDoc.data()!;
          
          const classDefDoc = await db.collection("organizations").doc(orgId).collection("groupClassDefinitions").doc(scheduleData.groupClassId).get();
          if (!classDefDoc.exists) {
              logger.warn(`Class definition doc ${scheduleData.groupClassId} not found.`);
              return;
          }
          const classDefData = classDefDoc.data()!;
          
          const date = new Date(classDate);
          const dateString = date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
          const timeString = scheduleData.startTime;
  
          // 3. Prepare notification payload
          const payload = JSON.stringify({
            title: "Du har fått en plats!",
            body: `Du har flyttats från kön och har nu en plats på ${classDefData.name} ${dateString} kl ${timeString}.`,
          });
  
          // 4. Configure web-push
          const vapidPublicKey = "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";
          const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
          
          if (!vapidPrivateKey) {
              logger.error("VAPID_PRIVATE_KEY secret is not set!");
              return;
          }
  
          webpush.setVapidDetails(
            "mailto:admin@flexibel.se",
            vapidPublicKey,
            vapidPrivateKey
          );
  
          // 5. Send notifications and handle cleanup
          const pushPromises = subscriptionsSnapshot.docs.map(async (doc) => {
            const sub = doc.data().subscription;
            try {
              await webpush.sendNotification(sub, payload);
              logger.info(`Push notification sent to endpoint for participant ${participantId}.`);
            } catch (error: any) {
              logger.error(`Error sending push notification for participant ${participantId}:`, error);
              // If subscription is expired or invalid, delete it from Firestore
              if (error.statusCode === 404 || error.statusCode === 410) {
                logger.warn(`Subscription for participant ${participantId} is gone. Deleting.`);
                await doc.ref.delete();
              }
            }
          });
  
          await Promise.all(pushPromises);
        } catch (error) {
          logger.error("An unexpected error occurred in onBookingPromoted function:", error);
        }
      }
    }
);

/**
 * Zapier webhook: creates lead in Firestore
 * Header: Authorization: Bearer <ZAPIER_SECRET_KEY>
 */
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

    // Auth
    const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;
    const presented = getBearerToken(request);
    if (!ZAPIER_SECRET_KEY || presented !== ZAPIER_SECRET_KEY) {
      logger.warn("Unauthorized attempt to access webhook.");
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Body
    const { firstName, lastName, email, phone, locationName, orgId, source } = (request.body ?? {}) as Record<
      string,
      unknown
    >;

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
      // Get locations
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

      // Create lead
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

      const leadRef = await db
        .collection("organizations")
        .doc(String(orgId))
        .collection("leads")
        .add(newLead);

      logger.info(`Successfully created lead with ID: ${leadRef.id} for org ${orgId}`);
      response.status(201).json({ success: true, leadId: leadRef.id });
    } catch (error) {
      logger.error("Error creating lead:", error);
      response.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * Callable: Server-side proxy to Gemini (Generative AI)
 * Data: { model: string, contents: string | Content[], config?: any }
 */
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

      const response = (await ai.models.generateContent({
        model,
        contents: contents as any,
        config,
      })) as any;

      const text = response.text as string | undefined;
      if (!text) {
        const pf = response.promptFeedback;
        if (pf?.blockReason) {
          const safetyRatings = pf.safetyRatings?.map((r: any) => `${r.category}: ${r.probability}`).join(", ");
          const errorMessage = `Request blocked by Gemini API. Reason: ${pf.blockReason}. Ratings: ${safetyRatings || "N/A"}`;
          logger.error(errorMessage, { fullResponse: response });
          throw new Error(errorMessage);
        }
        logger.warn("Gemini API returned empty text. Full response:", JSON.stringify(response, null, 2));
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

/**
 * Callable: Fetches and aggregates analytics data for the last 30 days.
 * Data: { orgId: string }
 */
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
      // 30 dagar bakåt, normaliserad till midnatt
      const since = new Date();
      since.setDate(since.getDate() - 30);
      since.setHours(0, 0, 0, 0);
      const sinceTs = Timestamp.fromDate(since);

      // Förbered dagliga buckets (YYYY-MM-DD i UTC)
      const daily = new Map<string, { bookings: number; cancellations: number; checkins: number }>();
      for (let i = 0; i <= 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
          .toISOString()
          .split("T")[0];
        daily.set(key, { bookings: 0, cancellations: 0, checkins: 0 });
      }

      // Tre indexerade queries (täckta av samma composite-index: orgId, type, timestamp)
      const makeQuery = (type: "BOOKING_CREATED" | "BOOKING_CANCELLED" | "CHECKIN") =>
        db
          .collection("analyticsEvents")
          .where("orgId", "==", orgId)
          .where("type", "==", type)
          .where("timestamp", ">=", sinceTs)
          .orderBy("timestamp", "asc")
          .get();

      const [q1, q2, q3] = await Promise.all([
        makeQuery("BOOKING_CREATED"),
        makeQuery("BOOKING_CANCELLED"),
        makeQuery("CHECKIN"),
      ]);

      const toKey = (ts: Timestamp) => {
        const dt = ts.toDate();
        return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()))
          .toISOString()
          .split("T")[0];
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

/**
 * Scheduled: Automatically generates and posts "Weekly Highlights".
 * Runs hourly, checks org settings for timing.
 */
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
      logger.info(`Checking organization: ${orgId}`);

      const settingsRef = db
        .collection("organizations")
        .doc(orgId)
        .collection("weeklyHighlightSettings")
        .doc("settings");

      const settingsDoc = await settingsRef.get();
      if (!settingsDoc.exists) {
        logger.info(`No settings found for org ${orgId}. Skipping.`);
        continue;
      }

      const settings = settingsDoc.data() as any;

      if (!settings.isEnabled) {
        logger.info(`Highlights disabled for org ${orgId}. Skipping.`);
        continue;
      }

      const lastGenTimestamp = settings.lastGeneratedTimestamp ? new Date(settings.lastGeneratedTimestamp) : null;
      if (lastGenTimestamp && getISOWeek(lastGenTimestamp) === currentWeek) {
        logger.info(`Highlights already generated this week for org ${orgId}. Skipping.`);
        continue;
      }

      const scheduledDay = settings.dayOfWeek as number; // 1-7
      const scheduledHour = parseInt(String(settings.time).split(":")[0], 10);

      if (currentDay !== scheduledDay || currentHour !== scheduledHour) {
        logger.info(
          `Not scheduled time for org ${orgId}. Current: D${currentDay} H${currentHour}, Scheduled: D${scheduledDay} H${scheduledHour}. Skipping.`
        );
        continue;
      }

      logger.info(`Scheduled time matched for org ${orgId}. Generating highlights...`);

      try {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const locationsSnapshot = await db.collection("organizations").doc(orgId).collection("locations").get();
        const locations = locationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as { name: string }),
        }));

        const targets: { studioTarget: "all" | "salem" | "karra"; locationName: string }[] = [];
        if (settings.studioTarget === "separate") {
          targets.push({ studioTarget: "salem", locationName: "Salem" });
          targets.push({ studioTarget: "karra", locationName: "Kärra" });
        } else {
          targets.push({ studioTarget: settings.studioTarget, locationName: "Alla" });
        }

        for (const target of targets) {
          logger.info(`Generating for target: ${target.studioTarget}`);

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
          const targetParticipants = participantsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as { name: string }),
          }));
          const targetParticipantIds = targetParticipants.map((p) => p.id);

          if (targetParticipantIds.length === 0) {
            logger.info(`No participants for target ${target.studioTarget}. Skipping.`);
            continue;
          }

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

          // === Template string (no backslashes before backticks) ===
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
1.  Skapa en titel i formatet: \`Veckans Höjdpunkter - v${getISOWeek(new Date())}\`.
2.  Skriv en kort, peppande sammanfattning av veckans aktivitet.
3.  Lyft fram 2–3 av de mest imponerande PBs från listan.
4.  Avsluta med en uppmuntrande fras om att fortsätta kämpa.
5.  Formatera hela texten med Markdown. Kombinera titel och beskrivning till en enda textsträng.
`;

          const apiKey = process.env.GEMINI_API_KEY!;
          const ai = new GoogleGenAI({ apiKey });
          const response = (await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          })) as any;

          const text = response.text as string | undefined;
          if (!text) {
            throw new Error("Received empty response from AI for weekly highlights.");
          }

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
          logger.info(`Posted highlight for org ${orgId}, target ${target.studioTarget}`);
        }

        await settingsRef.update({ lastGeneratedTimestamp: now.toISOString() });
        logger.info(`Updated lastGeneratedTimestamp for org ${orgId}`);
      } catch (error) {
        logger.error(`Failed to generate highlights for org ${orgId}:`, error);
      }
    }
  }
);
