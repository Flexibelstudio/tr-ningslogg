import { onRequest, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI, type GenerationConfig } from "@google/genai";

// Init Admin SDK
initializeApp();
const db = getFirestore();

// Robust way to read Bearer token from headers
function getBearerToken(req: {
  header?: (n: string) => string | undefined;
  headers?: Record<string, any>;
}) {
  const h =
    (typeof req.header === "function" ? req.header("authorization") : undefined) ??
    (typeof req.header === "function" ? req.header("Authorization") : undefined) ??
    req.headers?.authorization ??
    req.headers?.Authorization ??
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
    cors: true, // Firebase handles CORS headers
  },
  async (request, response) => {
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
    const {
      firstName,
      lastName,
      email,
      phone,
      locationName,
      orgId,
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
        (l) =>
          typeof l.name === "string" &&
          l.name.toLowerCase().includes(String(locationName).toLowerCase())
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
        source: "Meta",
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