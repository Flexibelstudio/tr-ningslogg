/**
 * Firebase Cloud Function to receive leads from Zapier.
 *
 * This function provides a secure webhook endpoint that Zapier can call
 * to create new lead documents in your Firestore database.
 */

// Import necessary modules from Firebase Functions and Admin SDKs.
// FIX: Corrected typo in import statement.
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cors from "cors";

// Initialize the Firebase Admin SDK.
// This gives the function administrative access to your Firebase project.
admin.initializeApp();
const db = admin.firestore();

// Initialize CORS middleware. This allows requests from any origin.
// For production, you might want to restrict this to Zapier's IP addresses.
const corsHandler = cors({ origin: true });

// Define the structure of the incoming data from Zapier.
interface ZapierPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  locationName: string; // The name of the studio/location, e.g., "Salem".
  orgId: string;       // The ID of the organization to add the lead to.
}

// Define the main Cloud Function, triggered by an HTTP request.
export const createLeadFromZapier = functions
  .region("europe-west1") // Recommended to deploy in a region close to your users.
  .runWith({
    secrets: ["ZAPIER_SECRET_KEY"], // Load the secret key from Secret Manager.
  })
  .https.onRequest(async (request, response) => {
    // Use the CORS middleware to handle the preflight request.
    corsHandler(request, response, async () => {
      // --- 1. Security Checks ---

      // Only allow POST requests.
      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }

      // Check for the Authorization header.
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        response.status(401).send("Unauthorized: Missing Authorization header.");
        return;
      }

      // Extract and verify the secret key.
      const incomingSecret = authHeader.split("Bearer ")[1];
      const expectedSecret = process.env.ZAPIER_SECRET_KEY;

      if (incomingSecret !== expectedSecret) {
        response.status(403).send("Forbidden: Invalid secret key.");
        return;
      }

      // --- 2. Data Validation & Processing ---
      const payload: ZapierPayload = request.body;

      // Validate required fields in the incoming JSON payload.
      if (
        !payload.firstName ||
        !payload.lastName ||
        !payload.email ||
        !payload.locationName ||
        !payload.orgId
      ) {
        response.status(400).send(
          "Bad Request: Missing required fields (firstName, lastName, email, locationName, orgId)."
        );
        return;
      }

      try {
        // --- 3. Find the Location ID ---
        const locationsRef = db
          .collection("organizations")
          .doc(payload.orgId)
          .collection("locations");
        const locationsSnap = await locationsRef.get();

        if (locationsSnap.empty) {
          response.status(400).send(`Bad Request: No locations configured for organization ${payload.orgId}.`);
          return;
        }

        let foundLocationId: string | null = null;
        for (const doc of locationsSnap.docs) {
          const locationData = doc.data();
          if (locationData.name?.toLowerCase() === payload.locationName.toLowerCase()) {
            foundLocationId = doc.id;
            break;
          }
        }

        if (!foundLocationId) {
          response.status(400).send(`Bad Request: Location '${payload.locationName}' not found for organization ${payload.orgId}.`);
          return;
        }


        // --- 4. Create the Lead Document in Firestore ---
        const newLead = {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone || null, // Ensure phone is null if not provided
          locationId: foundLocationId,
          source: "Meta",
          createdDate: new Date().toISOString(),
          status: "new",
        };

        const leadsCollectionRef = db
          .collection("organizations")
          .doc(payload.orgId)
          .collection("leads");

        // Add the new lead to the 'leads' subcollection.
        const docRef = await leadsCollectionRef.add(newLead);

        // --- 5. Send Success Response ---
        functions.logger.info(`Successfully created lead ${docRef.id} from Zapier.`);
        response.status(201).send({
          message: "Lead created successfully.",
          leadId: docRef.id,
        });
      } catch (error) {
        functions.logger.error("Error creating lead from Zapier:", error);
        response.status(500).send("Internal Server Error: Could not create lead.");
      }
    });
  });