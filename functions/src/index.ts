import {onRequest, Request, Response} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

// Define the secret in the function's environment.
// You MUST set this by running: firebase functions:secrets:set ZAPIER_SECRET_KEY
const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;

export const createLeadFromZapier = onRequest(
  // v2 function options: region and secrets
  {
    region: "europe-west1",
    secrets: ["ZAPIER_SECRET_KEY"],
    cors: true,
  },
  // FIX: Explicitly typed the request and response objects. The environment seems to be failing to infer the correct types from the 'onRequest' wrapper, leading to property access errors.
  async (req: Request, res: Response) => {
    // 1. Security Checks
    if (req.method !== "POST") {
      logger.warn("Method Not Allowed:", req.method);
      res.status(405).send("Method Not Allowed");
      return;
    }

    const authHeader = req.headers.authorization;
    if (
      !ZAPIER_SECRET_KEY ||
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      authHeader.split("Bearer ")[1] !== ZAPIER_SECRET_KEY
    ) {
      logger.warn("Unauthorized attempt to access webhook.");
      res.status(401).json({error: "Unauthorized"});
      return;
    }

    // 2. Validate incoming data
    const {firstName, lastName, email, phone, locationName, orgId} = req.body;

    if (!firstName || !lastName || !email || !locationName || !orgId) {
      const missing = [
        !firstName && "firstName",
        !lastName && "lastName",
        !email && "email",
        !locationName && "locationName",
        !orgId && "orgId",
      ]
        .filter(Boolean)
        .join(", ");
      logger.error("Bad Request: Missing required fields:", missing);
      res.status(400).json({error: `Bad Request: Missing fields: ${missing}`});
      return;
    }

    try {
      // 3. Find locationId based on locationName
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
        (loc) =>
          loc.name &&
          loc.name.toLowerCase().includes(locationName.toLowerCase()),
      );

      if (!targetLocation) {
        logger.error(`Location named '${locationName}' could not be found.`);
        res.status(400).json({
          error: `Bad Request: Location '${locationName}' not found.`,
        });
        return;
      }
      const locationId = targetLocation.id;

      // 4. Create the new lead object
      const newLead = {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: phone || "",
        locationId,
        source: "Meta",
        createdDate: new Date().toISOString(),
        status: "new",
      };

      // 5. Save the new lead to Firestore
      const leadRef = await db
        .collection("organizations")
        .doc(orgId)
        .collection("leads")
        .add(newLead);

      logger.info(
        `Successfully created lead with ID: ${leadRef.id} for org ${orgId}`,
      );
      res.status(201).json({success: true, leadId: leadRef.id});
    } catch (error) {
      logger.error("Error creating lead:", error);
      res.status(500).json({error: "Internal Server Error"});
    }
  },
);
