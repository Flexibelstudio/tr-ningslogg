import { HttpsError, onRequest, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getMessaging } from "firebase-admin/messaging";

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

      // Tre indexerade queries
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

          // Prompt (no stray backslashes; no backticks needed inside the content)
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
3. Lyft fram 2–3 av de mest imponerande PBs från listan (om sådana finns).
4. Avsluta med en uppmuntrande fras om att fortsätta kämpa.
5. Formatera hela texten med Markdown. Kombinera titel och beskrivning till en enda textsträng.`;

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

/**
 * Firestore Trigger: Sends a push notification when a member is promoted from the waitlist.
 * (Set to europe-west1)
 */
export const onBookingPromotion = onDocumentUpdated(
  {
    document: "organizations/{orgId}/participantBookings/{bookingId}",
    region: "europe-west1",
  },
  async (event) => {
    logger.info(`Checking booking update for promotion: ${event.params.bookingId}`);

    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Check if status changed from WAITLISTED to BOOKED
    if (beforeData?.status === "WAITLISTED" && afterData?.status === "BOOKED") {
      logger.info(`Promotion detected for participant ${afterData.participantId}`);

      const participantId = afterData.participantId;
      const orgId = event.params.orgId;

      try {
        // 1. Get participant's profile and notification settings
        const participantDoc = await db.doc(`organizations/${orgId}/participantDirectory/${participantId}`).get();
        if (!participantDoc.exists) {
          logger.warn(`Participant document ${participantId} not found in org ${orgId}.`);
          return;
        }
        const participantData = participantDoc.data();

        // 2. Check notification settings
        const settings = participantData?.notificationSettings;
        const allowPush = settings?.pushEnabled ?? true;
        const allowWaitlist = settings?.waitlist ?? true;

        if (!allowPush || !allowWaitlist) {
          logger.info(`Participant ${participantId} has disabled waitlist notifications. Aborting.`);
          return;
        }

        const tokens = participantData?.notificationTokens;
        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
          logger.info(`Participant ${participantId} has no notification tokens. No push sent.`);
          return;
        }

        // 3. Get class details for the notification message
        const scheduleId = afterData.scheduleId;
        const scheduleDoc = await db.doc(`organizations/${orgId}/groupClassSchedules/${scheduleId}`).get();
        if (!scheduleDoc.exists) {
          logger.warn(`Schedule document ${scheduleId} not found.`);
          return;
        }
        const scheduleData = scheduleDoc.data();

        const classId = scheduleData!.groupClassId;
        const classDefDoc = await db.doc(`organizations/${orgId}/groupClassDefinitions/${classId}`).get();
        if (!classDefDoc.exists) {
          logger.warn(`Class definition document ${classId} not found.`);
          return;
        }
        const classDefData = classDefDoc.data();

        const className = classDefData!.name || "ett pass";
        const classDate = afterData.classDate as string; // YYYY-MM-DD
        const classTime = scheduleData!.startTime as string; // HH:MM

        const dateObj = new Date(`${classDate}T${classTime}`);
        const formattedDate = dateObj.toLocaleDateString("sv-SE", {
          weekday: "long",
          day: "numeric",
          month: "short",
        });

        // 4. Construct and send the notification
        const payload = {
          notification: {
            title: "Du har fått en plats! 🎉",
            body: `En plats blev ledig! Du är nu bokad på ${className} på ${formattedDate} kl ${classTime}.`,
            icon: "/icon-192x192.png",
          },
          webpush: {
            fcm_options: { link: "/" },
          },
        };

        const resp = await getMessaging().sendToDevice(tokens, payload as any);
        logger.info("Successfully sent promotion notification:", (resp as any).successCount ?? resp);
      } catch (error) {
        logger.error(`Error sending promotion notification for participant ${participantId}:`, error);
      }
    }
  }
);

/**
 * Scheduled: Sends reminders for classes starting in ~2 hours.
 * Runs every 30 minutes.
 */
export const onClassReminder = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "europe-west1",
    timeZone: "Europe/Stockholm",
  },
  async () => {
    logger.info("Running scheduled job: onClassReminder");

    const now = new Date();
    const reminderStart = new Date(now.getTime() + 105 * 60 * 1000);
    const reminderEnd = new Date(now.getTime() + 135 * 60 * 1000);

    const today = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Stockholm" }));
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayStr = today.toISOString().split("T")[0];
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const orgsSnapshot = await db.collection("organizations").get();

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      logger.info(`Checking reminders for org: ${orgId}`);
      try {
        const bookingsSnapshot = await db
          .collection(`organizations/${orgId}/participantBookings`)
          .where("status", "==", "BOOKED")
          .where("classDate", "in", [todayStr, tomorrowStr])
          .get();

        if (bookingsSnapshot.empty) {
          logger.info(`No relevant bookings for org ${orgId} on ${todayStr} or ${tomorrowStr}.`);
          continue;
        }

        for (const bookingDoc of bookingsSnapshot.docs) {
          const booking = bookingDoc.data();
          const scheduleDoc = await db.doc(`organizations/${orgId}/groupClassSchedules/${booking.scheduleId}`).get();
          if (!scheduleDoc.exists) continue;

          const schedule = scheduleDoc.data();
          if (!schedule) continue;

          const classDateTime = new Date(`${booking.classDate}T${schedule.startTime}`);

          if (classDateTime >= reminderStart && classDateTime <= reminderEnd) {
            const participantId = booking.participantId;
            const participantDoc = await db.doc(`organizations/${orgId}/participantDirectory/${participantId}`).get();
            if (!participantDoc.exists) continue;

            const participant = participantDoc.data();
            if (!participant) continue;

            const settings = participant.notificationSettings;
            const allowPush = settings?.pushEnabled ?? true;
            const allowReminders = settings?.reminders ?? true;

            if (!allowPush || !allowReminders) {
              logger.info(`Participant ${participantId} has disabled reminders.`);
              continue;
            }

            const tokens = participant.notificationTokens;
            if (!tokens || !Array.isArray(tokens) || tokens.length === 0) continue;

            const classDefDoc = await db.doc(`organizations/${orgId}/groupClassDefinitions/${schedule.groupClassId}`).get();
            const coachDoc = await db.doc(`organizations/${orgId}/staffMembers/${schedule.coachId}`).get();

            const className = classDefDoc.data()?.name || "ditt pass";
            const coachName = coachDoc.data()?.name || "din coach";

            const payload = {
              notification: {
                title: "Dags att ladda! 💪",
                body: `Ditt pass ${className} med ${coachName} startar om ca 2 timmar. Vi ses!`,
                icon: "/icon-192x192.png",
              },
              webpush: { fcm_options: { link: "/" } },
            };

            await getMessaging().sendToDevice(tokens, payload as any);
            logger.info(`Sent reminder to participant ${participantId} for class on ${booking.classDate}`);
          }
        }
      } catch (error) {
        logger.error(`Error processing reminders for org ${orgId}:`, error);
      }
    }
  }
);

/**
 * Firestore Trigger: Sends a push notification when a new coach event/news is created.
 * (Set to europe-west1)
 */
export const onNewCoachEvent = onDocumentCreated(
  {
    document: "organizations/{orgId}/coachEvents/{eventId}",
    region: "europe-west1",
  },
  async (event) => {
    const eventData = event.data?.data();
    if (!eventData) {
      logger.warn("No data in created event document.");
      return;
    }

    const orgId = event.params.orgId;
    logger.info(`New coach event created in org ${orgId}: ${eventData.title}`);

    try {
      const { studioTarget, title } = eventData;

      let participantsQuery = db
        .collection(`organizations/${orgId}/participantDirectory`)
        .where("isActive", "==", true);

      if (studioTarget && studioTarget !== "all") {
        const locationsSnapshot = await db.collection(`organizations/${orgId}/locations`).get();
        const location = locationsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as { name: string }) }))
          .find((l) => l.name.toLowerCase().includes(studioTarget));

        if (location) {
          participantsQuery = participantsQuery.where("locationId", "==", location.id);
        } else {
          logger.warn(`Could not find location matching target: ${studioTarget}`);
        }
      }

      const participantsSnapshot = await participantsQuery.get();
      if (participantsSnapshot.empty) {
        logger.info("No active participants to notify.");
        return;
      }

      const notificationPromises: Promise<any>[] = [];

      for (const doc of participantsSnapshot.docs) {
        const participant = doc.data();
        const settings = participant.notificationSettings;
        const allowPush = settings?.pushEnabled ?? true;
        const allowNews = settings?.news ?? true;
        const tokens = participant.notificationTokens;

        if (allowPush && allowNews && tokens && Array.isArray(tokens) && tokens.length > 0) {
          const payload = {
            notification: {
              title: "Nyhet från studion! ✨",
              body: title as string,
              icon: "/icon-192x192.png",
            },
            webpush: { fcm_options: { link: "/" } },
          };
          notificationPromises.push(getMessaging().sendToDevice(tokens, payload as any));
        }
      }

      await Promise.all(notificationPromises);
      logger.info(`Sent ${notificationPromises.length} notifications for new event.`);
    } catch (error) {
      logger.error(`Error sending news notifications for org ${orgId}:`, error);
    }
  }
);

/**
 * Firestore Trigger: Sends a push notification to friends when a user books a class.
 * (Set to europe-west1)
 */
export const onFriendBooking = onDocumentCreated(
  {
    document: "organizations/{orgId}/participantBookings/{bookingId}",
    region: "europe-west1",
  },
  async (event) => {
    const booking = event.data?.data();
    if (!booking || booking.status === "WAITLISTED") {
      // Only notify for confirmed bookings, not waitlist entries.
      return;
    }

    const { participantId: bookerId, scheduleId, classDate } = booking;
    const orgId = event.params.orgId;
    logger.info(`New booking by ${bookerId} in org ${orgId}. Checking for friends to notify.`);

    try {
      // 1. Find all friends of the booker
      const friendIds = new Set<string>();
      const connectionsRef = db.collection(`organizations/${orgId}/connections`);

      const friendsAsRequester = await connectionsRef
        .where("requesterId", "==", bookerId)
        .where("status", "==", "accepted")
        .get();
      friendsAsRequester.forEach((doc) => friendIds.add(doc.data().receiverId));

      const friendsAsReceiver = await connectionsRef
        .where("receiverId", "==", bookerId)
        .where("status", "==", "accepted")
        .get();
      friendsAsReceiver.forEach((doc) => friendIds.add(doc.data().requesterId));

      if (friendIds.size === 0) {
        logger.info("Booker has no friends to notify.");
        return;
      }

      // 2. Get details for the notification message in parallel
      const bookerProfilePromise = db.doc(`organizations/${orgId}/participantDirectory/${bookerId}`).get();
      const schedulePromise = db.doc(`organizations/${orgId}/groupClassSchedules/${scheduleId}`).get();

      const [bookerProfileDoc, scheduleDoc] = await Promise.all([bookerProfilePromise, schedulePromise]);

      if (!bookerProfileDoc.exists || !scheduleDoc.exists) {
        logger.warn("Could not retrieve booker profile or schedule details.");
        return;
      }

      const bookerName = bookerProfileDoc.data()?.name || "Din vän";
      const schedule = scheduleDoc.data();
      if (!schedule) return;

      const classDefDoc = await db.doc(`organizations/${orgId}/groupClassDefinitions/${schedule.groupClassId}`).get();
      const className = classDefDoc.data()?.name || "ett pass";
      const classTime = schedule.startTime as string;

      const dateObj = new Date(classDate as string);
      const formattedDate = dateObj.toLocaleDateString("sv-SE", { weekday: "long" });

      // 3. Iterate through friends and send notifications
      const notificationPromises: Promise<any>[] = [];
      for (const friendId of friendIds) {
        const friendDoc = await db.doc(`organizations/${orgId}/participantDirectory/${friendId}`).get();
        if (!friendDoc.exists) continue;

        const friend = friendDoc.data();
        if (!friend) continue;

        // Check notification settings
        const settings = friend.notificationSettings;
        const allowPush = settings?.pushEnabled ?? true;
        const allowFriendBooking = settings?.friendBooking ?? true;
        const tokens = friend.notificationTokens;

        if (allowPush && allowFriendBooking && tokens && Array.isArray(tokens) && tokens.length > 0) {
          const payload = {
            notification: {
              title: "Din vän ska träna! 💪",
              body: `${bookerName} har precis bokat ${className} på ${formattedDate} kl ${classTime}. Häng på?`,
              icon: "/icon-192x192.png",
            },
            webpush: { fcm_options: { link: "/" } },
          };
          notificationPromises.push(getMessaging().sendToDevice(tokens, payload as any));
          logger.info(`Queued friend booking notification for ${friendId}`);
        }
      }

      await Promise.all(notificationPromises);
      logger.info(`Sent ${notificationPromises.length} friend booking notifications.`);
    } catch (error) {
      logger.error(`Error sending friend booking notifications for booker ${bookerId}:`, error);
    }
  }
);
