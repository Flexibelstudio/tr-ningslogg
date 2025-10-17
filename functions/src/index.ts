import { onRequest, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Init Admin SDK
initializeApp();
const db = getFirestore();

/**
 * Zapier-webhook: skapar lead i Firestore
 * Header: Authorization: Bearer <ZAPIER_SECRET_KEY>
 */
export const createLeadFromZapier = onRequest(
  {
    region: "europe-west1",
    secrets: ["ZAPIER_SECRET_KEY"],
    cors: true, // Firebase hanterar CORS-headrarna åt oss
  },
  async (req, res) => {
    if (req.method !== "POST") {
      logger.warn("Method Not Allowed:", req.method);
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Auth
    const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;
    const authHeader = req.header("authorization") ?? req.header("Authorization") ?? "";
    const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!ZAPIER_SECRET_KEY || presented !== ZAPIER_SECRET_KEY) {
      logger.warn("Unauthorized attempt to access webhook.");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Body
    const { firstName, lastName, email, phone, locationName, orgId } = (req.body ?? {}) as Record<
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
      res.status(400).json({ error: `Bad Request: Missing fields: ${missing}` });
      return;
    }

    try {
      // Hämta locations och typa dem så TS vet att "name?" kan finnas
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
        res.status(400).json({ error: `Bad Request: Location '${locationName}' not found.` });
        return;
      }

      // Skapa lead
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
      res.status(201).json({ success: true, leadId: leadRef.id });
    } catch (error) {
      logger.error("Error creating lead:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * Callable: Server-side proxy till Gemini (Generative AI)
 * Anropas via Firebase SDK (httpsCallable) → ingen CORS.
 * Data: { model: string, contents: string | Content[], config?: GenerationConfig }
 */
export const callGeminiApi = onCall(
  {
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
    cors: true,
    // enforceAppCheck: true,          // aktivera om du vill kräva App Check
    // enforceAppCheckOptional: true,  // eller logga varningar
  },
  async (request) => {
    try {
      const { model, contents, config } = (request.data ?? {}) as {
        model?: string;
        contents?: unknown;
        config?: unknown;
      };

      if (!model || contents == null) {
        logger.error("Bad Request: Missing 'model' or 'contents'");
        return { error: "Bad Request: Missing 'model' or 'contents'." };
        }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return { error: "GEMINI_API_KEY secret not found." };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const llm = genAI.getGenerativeModel({ model });

      // Stöder både rå text och redan strukturerade contents
      const result =
        typeof contents === "string"
          ? await llm.generateContent({
              contents: [{ role: "user", parts: [{ text: contents }] }],
              generationConfig: config as any,
            })
          : await llm.generateContent({
              contents: contents as any, // structured contents
              generationConfig: config as any,
            });

      return { text: result.response.text() };
    } catch (error) {
      logger.error("Error calling Gemini API:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { error: `Internal Server Error: ${errorMessage}` };
    }
  }
);
