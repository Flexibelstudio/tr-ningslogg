import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Init Admin SDK
initializeApp();
const db = getFirestore();

// Init Gemini SDK med secret
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Webhook från Zapier som skapar en lead i Firestore.
 * Kräver header: Authorization: Bearer <ZAPIER_SECRET_KEY>
 */
export const createLeadFromZapier = onRequest(
  {
    region: "europe-west1",
    secrets: ["ZAPIER_SECRET_KEY"],
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      logger.warn("Method Not Allowed:", req.method);
      res.status(405).send("Method Not Allowed");
      return;
    }

    const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;
    const authHeader = req.header("authorization") ?? req.header("Authorization") ?? "";
    const presented = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!ZAPIER_SECRET_KEY || presented !== ZAPIER_SECRET_KEY) {
      logger.warn("Unauthorized attempt to access webhook.");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { firstName, lastName, email, phone, locationName, orgId } = (req.body ?? {}) as any;

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
      const locationsSnapshot = await db
        .collection("organizations")
        .doc(orgId)
        .collection("locations")
        .get();

      const locations = locationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { name?: string }),
      }));

      const targetLocation = locations.find(
        (loc) => loc.name && loc.name.toLowerCase().includes(String(locationName).toLowerCase())
      );

      if (!targetLocation) {
        logger.error(`Location named '${locationName}' could not be found.`);
        res.status(400).json({ error: `Bad Request: Location '${locationName}' not found.` });
        return;
      }

      const newLead = {
        firstName,
        lastName,
        email: String(email).toLowerCase(),
        phone: phone ?? "",
        locationId: targetLocation.id,
        source: "Meta",
        createdDate: new Date().toISOString(),
        status: "new",
      };

      const leadRef = await db
        .collection("organizations")
        .doc(orgId)
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
 * Proxy till Gemini API (server-side) med @google/generative-ai.
 * Body: { model: string, contents: string | Content[], config?: GenerationConfig }
 */
export const callGeminiApi = onRequest(
  {
    region: "europe-west1",
    secrets: ["GEMINI_API_KEY"],
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { model, contents, config } = (req.body ?? {}) as any;
      if (!model || contents === undefined || contents === null) {
        logger.error("Bad Request: Missing 'model' or 'contents' in request body.");
        res.status(400).json({ error: "Bad Request: Missing 'model' or 'contents'." });
        return;
      }

      const llm = genAI.getGenerativeModel({ model });

      let resultText = "";
      if (typeof contents === "string") {
        // Enkel textprompt
        const result = await llm.generateContent({
          contents: [{ role: "user", parts: [{ text: contents }] }],
          generationConfig: config,
        });
        resultText = result.response.text();
      } else {
        // Avancerat: passa igenom structured contents (roller/parts)
        const result = await llm.generateContent({
          contents,
          generationConfig: config,
        });
        resultText = result.response.text();
      }

      res.status(200).json({ text: resultText });
    } catch (error) {
      logger.error("Error calling Gemini API:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);
