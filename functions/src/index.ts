import { onRequest, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI, type GenerationConfig } from "@google/genai";

// Init Admin SDK
initializeApp();
const db = getFirestore();

// Helper to get ISO week number (to avoid client-side dependencies)
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
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
  // explicit any för att slippa Express-typer som kan strula i vissa miljöer
  async (request: any, response: any) => {
    try {
      if (request.method !== "POST") {
        logger.warn("Method Not Allowed:", request.method);
        response.status(405).send("Method Not Allowed");
        return;
      }

      // Auth (robust)
const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY ?? "";

// Plocka ut Authorization-headern (kan vara string eller string[])
const rawAuth =
  (request.headers?.authorization as string | string[] | undefined) ??
  (request.headers as any)?.Authorization;

const auth = Array.isArray(rawAuth) ? rawAuth[0] : (rawAuth ?? "");

// Matcha "Bearer <token>" (case-insensitive) och trimma
const match = /^Bearer\s+(.+)$/i.exec(auth);
const presented = match?.[1]?.trim() ?? "";

if (!ZAPIER_SECRET_KEY || presented !== ZAPIER_SECRET_KEY) {
  logger.warn("Unauthorized attempt to access webhook.");
  response.status(401).json({ error: "Unauthorized" });
  return;
}

      // Body
      const {
        firstName,
        lastName,
        email,
        phone,
        locationName,
        orgId,
        source,
      } = (request.body ?? {}) as Record<string, unknown>;

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
        response
          .status(400)
          .json({ error: `Bad Request: Missing fields: ${missing}` });
        return;
      }

      // Logga inkommande data för felsökning (innehåller INTE hemligheter)
      logger.info("Incoming lead payload", {
        firstName,
        lastName,
        email,
        phone,
        locationName,
        orgId,
        source,
      });

      // Hämta locations för org
      const orgIdStr = String(orgId);
      const locationsSnapshot = await db
        .collection("organizations")
        .doc(orgIdStr)
        .collection("locations")
        .get();

      logger.info(`Found ${locationsSnapshot.size} locations for org ${orgIdStr}`);

      if (locationsSnapshot.empty) {
        response.status(400).json({
          error:
            "Bad Request: No locations found for provided orgId. Verify orgId and your Firestore data.",
        });
        return;
      }

      // Funktion som normaliserar text (tar bort diakritik, gör lower-case)
      const norm = (s: unknown) =>
        String(s ?? "")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .trim();

      type LocationDoc = { name?: string };
      const wanted = norm(locationName);

      // Matcha location: exakt namn eller substring (utan diakritik)
      const locations = locationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as LocationDoc),
      }));

      const targetLocation =
        locations.find((l) => norm(l.name) === wanted) ||
        locations.find((l) => norm(l.name).includes(wanted));

      if (!targetLocation) {
        logger.error(
          `Location '${locationName}' not matched in org ${orgIdStr}. Available: ${locations
            .map((l) => l.name)
            .join(", ")}`
        );
        response.status(400).json({
          error: `Bad Request: Location '${locationName}' not found for org '${orgIdStr}'.`,
        });
        return;
      }

      // Telefonnormalisering (valfritt): ersätt inledande +46 eller 0046 med 0
      const phoneStr = String(phone ?? "").trim();
      const phoneNormalized = phoneStr
        .replace(/^\s*\+46/, "0")
        .replace(/^\s*0046/, "0");

      // Skapa lead
      const newLead = {
        firstName: String(firstName),
        lastName: String(lastName),
        email: String(email).toLowerCase(),
        phone: phoneNormalized,
        locationId: targetLocation.id,
        // sätt källa – låt incoming source vinna om den finns, annars "Meta"
        source: source ? String(source) : "Meta",
        createdDate: new Date().toISOString(),
        status: "new",
      };

      const leadRef = await db
        .collection("organizations")
        .doc(orgIdStr)
        .collection("leads")
        .add(newLead);

      logger.info(
        `Successfully created lead with ID: ${leadRef.id} for org ${orgIdStr}`
      );
      response.status(201).json({ success: true, leadId: leadRef.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      logger.error("Error creating lead:", err);
      // TILLFÄLLIGT: skicka tillbaka 'details' för snabb felsökning
      response.status(500).json({ error: "Internal Server Error", details: msg });
    }
  }
);

/**
 * Callable: Server-side proxy to Gemini (Generative AI)
 * Called via Firebase SDK (httpsCallable) -> no CORS.
 * Data: { model: string, contents: string | Content[], config?: GenerationConfig }
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
        contents?: unknown; // string or structured contents
        config?: GenerationConfig;
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

      // Use the new SDK
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model,
        contents: contents as any, // Cast as any to handle string or structured content
        config,
      });

      const text = response.text;
      return { text };

    } catch (error) {
      logger.error("Error calling Gemini API:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      return { error: `Internal Server Error: ${msg}` };
    }
  }
);


/**
 * Scheduled: Automatically generates and posts "Weekly Highlights".
 * Runs hourly, checks org settings for timing.
 */
export const generateWeeklyHighlights = onSchedule({
  schedule: "every 1 hours",
  region: "europe-west1",
  secrets: ["GEMINI_API_KEY"],
  timeZone: "Europe/Stockholm", // Run on Swedish time
}, async (event) => {
  logger.info("Running scheduled job: generateWeeklyHighlights");
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1, Sun=7
  const currentHour = now.getHours();
  const currentWeek = getISOWeek(now);

  const orgsSnapshot = await db.collection("organizations").get();

  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    logger.info(`Checking organization: ${orgId}`);

    const settingsRef = db.collection("organizations").doc(orgId).collection("weeklyHighlightSettings").doc("settings");
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

    const scheduledDay = settings.dayOfWeek; // 1-7
    const scheduledHour = parseInt(settings.time.split(":")[0], 10);

    if (currentDay !== scheduledDay || currentHour !== scheduledHour) {
      logger.info(`Not scheduled time for org ${orgId}. Current: D${currentDay} H${currentHour}, Scheduled: D${scheduledDay} H${scheduledHour}. Skipping.`);
      continue;
    }

    logger.info(`Scheduled time matched for org ${orgId}. Generating highlights...`);

    try {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const locationsSnapshot = await db.collection("organizations").doc(orgId).collection("locations").get();
      const locations = locationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as {name: string} }));

      const targets: { studioTarget: "all" | "salem" | "karra", locationName: string }[] = [];
      if (settings.studioTarget === 'separate') {
        targets.push({ studioTarget: 'salem', locationName: 'Salem' });
        targets.push({ studioTarget: 'karra', locationName: 'Kärra' });
      } else {
        targets.push({ studioTarget: settings.studioTarget, locationName: 'Alla' });
      }

      for (const target of targets) {
        logger.info(`Generating for target: ${target.studioTarget}`);
        let participantQuery = db.collection("organizations").doc(orgId).collection("participantDirectory").where('enableLeaderboardParticipation', '==', true);
        if (target.studioTarget !== 'all') {
          const location = locations.find((l) => l.name.toLowerCase().includes(target.studioTarget));
          if (location) {
            participantQuery = participantQuery.where('locationId', '==', location.id);
          }
        }
        const participantsSnapshot = await participantQuery.get();
        const targetParticipants = participantsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as {name: string} }));
        const targetParticipantIds = targetParticipants.map((p) => p.id);

        if (targetParticipantIds.length === 0) {
          logger.info(`No participants for target ${target.studioTarget}. Skipping.`);
          continue;
        }

        const workoutLogsSnapshot = await db.collection("organizations").doc(orgId).collection("workoutLogs")
          .where('participantId', 'in', targetParticipantIds)
          .where('completedDate', '>=', oneWeekAgo.toISOString())
          .get();
        
        const logsLastWeek = workoutLogsSnapshot.docs.map((doc) => doc.data());
        
        const pbsLastWeek = logsLastWeek
          .flatMap((log) => {
            const participant = targetParticipants.find((p) => p.id === log.participantId);
            return (log.postWorkoutSummary?.newPBs || []).map((pb: any) => ({ ...pb, participantName: participant?.name || 'Okänd' }));
          }).slice(0, 10);

        const prompt = `Du är "Flexibot", en AI-assistent för Flexibel Hälsostudio. Din uppgift är att skapa ett "Veckans Höjdpunkter"-inlägg för community-flödet. Svaret MÅSTE vara på svenska och formaterat med Markdown.

            **Data från den gångna veckan:**
            - Totalt antal loggade pass: ${logsLastWeek.length}
            - Antal medlemmar som tränat: ${new Set(logsLastWeek.map((l) => l.participantId)).size}
            - Några av veckans personliga rekord (PBs):
            ${pbsLastWeek.length > 0 ? pbsLastWeek.map((pb) => `  * ${pb.participantName} slog PB i ${pb.exerciseName} med ${pb.value}!`).join('\n') : '  * Inga nya PBs loggade denna vecka.'}

            **Ditt uppdrag:**
            1.  Skapa en titel i formatet: \`Veckans Höjdpunkter - v${getISOWeek(new Date())}\`.
            2.  Skriv en kort, peppande sammanfattning av veckans aktivitet.
            3.  Lyft fram 2-3 av de mest imponerande PBs från listan.
            4.  Avsluta med en uppmuntrande fras om att fortsätta kämpa.
            5.  Formatera hela texten med Markdown. Kombinera titel och beskrivning till en enda textsträng.
            `;
        
        const apiKey = process.env.GEMINI_API_KEY!;
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        const text = response.text;
        
const lines = text ? text.split("\n") : [];        const title = lines.find((l) => l.trim().length > 0)?.replace(/#/g, '').trim() || `Veckans Höjdpunkter - v${currentWeek}`;
        const description = lines.slice(1).join('\n').trim();

        const newEvent = {
          title,
          description,
          type: 'news',
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
});
