// functions/src/index.ts
import {
  onRequest,
  Request,
  Response,
  onDocumentCreated,
} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {
  WorkoutLog,
  FlowItem,
  ParticipantProfile,
  Workout,
  GeneralActivityLog,
  GoalCompletionLog,
  ParticipantClubMembership,
} from "./types";
import {CLUB_DEFINITIONS} from "./constants";

initializeApp();
const db = getFirestore();

// --- HELPER FUNCTIONS ---
/**
 * Fetches a participant's profile from Firestore.
 * @param {string} orgId The organization ID.
 * @param {string} participantId The participant's ID.
 * @return {Promise<ParticipantProfile | null>} The participant's profile or null if not found.
 */
async function getParticipant(
  orgId: string,
  participantId: string,
): Promise<ParticipantProfile | null> {
  const docRef = db
    .collection("organizations")
    .doc(orgId)
    .collection("participantDirectory")
    .doc(participantId);
  const doc = await docRef.get();
  if (doc.exists) {
    return {id: doc.id, ...doc.data()} as ParticipantProfile;
  }
  logger.warn(
    `Participant profile ${participantId} not found in org ${orgId}.`,
  );
  return null;
}

/**
 * Fetches a workout template from Firestore.
 * @param {string} orgId The organization ID.
 * @param {string} workoutId The workout's ID.
 * @return {Promise<Workout | null>} The workout template or null if not found.
 */
async function getWorkout(
  orgId: string,
  workoutId: string,
): Promise<Workout | null> {
  const docRef = db
    .collection("organizations")
    .doc(orgId)
    .collection("workouts")
    .doc(workoutId);
  const doc = await docRef.get();
  if (doc.exists) {
    return {id: doc.id, ...doc.data()} as Workout;
  }
  logger.warn(`Workout template ${workoutId} not found in org ${orgId}.`);
  return null;
}

/**
 * Creates a document in the flowItems collection.
 * @param {string} orgId The organization ID.
 * @param {Omit<FlowItem, "id">} flowItemData The data for the new flow item.
 */
async function createFlowItem(
  orgId: string,
  flowItemData: Omit<FlowItem, "id">,
) {
  // Add a server-side timestamp for consistency
  const dataWithTimestamp = {
    ...flowItemData,
    serverTimestamp: FieldValue.serverTimestamp(),
  };
  await db
    .collection("organizations")
    .doc(orgId)
    .collection("flowItems")
    .add(dataWithTimestamp);
}

// --- CLOUD FUNCTION TRIGGERS ---

export const onWorkoutLogCreate = onDocumentCreated(
  "organizations/{orgId}/workoutLogs/{logId}",
  async (event) => {
    const {orgId, logId} = event.params;
    const logData = event.data?.data() as WorkoutLog;

    if (!logData) {
      logger.error(`WorkoutLog data missing for logId: ${logId}`);
      return;
    }

    try {
      const participant = await getParticipant(orgId, logData.participantId);
      if (!participant?.name) {
        logger.error(`Participant ${logData.participantId} not found or has no name.`);
        return;
      }

      const workout = await getWorkout(orgId, logData.workoutId);
      const workoutTitle = workout?.title || "ett pass";

      const flowItem: Omit<FlowItem, "id"> = {
        orgId,
        timestamp: logData.completedDate,
        participantId: logData.participantId,
        icon: "🏋️",
        title: `${participant.name} loggade: ${workoutTitle}`,
        description: logData.postWorkoutComment,
        sourceLogId: logId,
        sourceLogType: "workout",
        visibility: "friends",
        praiseItems: [],
        reactions: [],
        comments: [],
      };

      if (logData.postWorkoutSummary?.newPBs) {
        logData.postWorkoutSummary.newPBs.forEach((pb) => {
          flowItem.praiseItems?.push({
            icon: "⭐",
            text: `${pb.achievement} i ${pb.exerciseName}: ${pb.value} ${pb.previousBest || ""}`.trim(),
            type: "pb",
          });
        });
      }

      if (logData.postWorkoutSummary?.newBaselines) {
        logData.postWorkoutSummary.newBaselines.forEach((baseline) => {
          flowItem.praiseItems?.push({
            icon: "📊",
            text: `Ny baslinje satt i ${baseline.exerciseName}: ${baseline.value}`,
            type: "baseline",
          });
        });
      }

      await createFlowItem(orgId, flowItem);
      logger.info(`Created flow item for workout log ${logId} in org ${orgId}`);
    } catch (error) {
      logger.error(`Error in onWorkoutLogCreate for org ${orgId}:`, error);
    }
  },
);

export const onGeneralActivityLogCreate = onDocumentCreated(
  "organizations/{orgId}/generalActivityLogs/{logId}",
  async (event) => {
    const {orgId, logId} = event.params;
    const logData = event.data?.data() as GeneralActivityLog;

    if (!logData) {
      logger.error(`GeneralActivityLog data missing for logId: ${logId}`);
      return;
    }

    try {
      const participant = await getParticipant(orgId, logData.participantId);
      if (!participant?.name) {
        logger.error(`Participant ${logData.participantId} not found.`);
        return;
      }

      // Simple emoji picker for common activities
      const activityNameLower = logData.activityName.toLowerCase();
      let icon = "🤸";
      if (activityNameLower.includes("löp") || activityNameLower.includes("spring")) icon = "🏃";
      if (activityNameLower.includes("promenad")) icon = "🚶";
      if (activityNameLower.includes("cykel")) icon = "🚴";
      if (activityNameLower.includes("yoga")) icon = "🧘";

      let description = `${logData.durationMinutes} minuter.`;
      if (logData.comment) {
        description += `\n"${logData.comment}"`;
      }

      const flowItem: Omit<FlowItem, "id"> = {
        orgId,
        timestamp: logData.completedDate,
        participantId: logData.participantId,
        icon: icon,
        title: `${participant.name} loggade: ${logData.activityName}`,
        description: description,
        sourceLogId: logId,
        sourceLogType: "general",
        visibility: "friends",
        reactions: [],
        comments: [],
      };

      await createFlowItem(orgId, flowItem);
      logger.info(
        `Created flow item for general log ${logId} in org ${orgId}`,
      );
    } catch (error) {
      logger.error(
        `Error in onGeneralActivityLogCreate for org ${orgId}:`,
        error,
      );
    }
  },
);

export const onGoalCompletionLogCreate = onDocumentCreated(
  "organizations/{orgId}/goalCompletionLogs/{logId}",
  async (event) => {
    const {orgId, logId} = event.params;
    const logData = event.data?.data() as GoalCompletionLog;

    if (!logData) {
      logger.error(`GoalCompletionLog data missing for logId: ${logId}`);
      return;
    }

    try {
      const participant = await getParticipant(orgId, logData.participantId);
      if (!participant?.name) {
        logger.error(`Participant ${logData.participantId} not found.`);
        return;
      }

      const flowItem: Omit<FlowItem, "id"> = {
        orgId,
        timestamp: logData.completedDate,
        participantId: logData.participantId,
        icon: "🏆",
        title: `${participant.name} uppnådde ett mål!`,
        description: `Starkt jobbat med att slutföra målet: "${logData.goalDescription}"`,
        sourceLogId: logId,
        sourceLogType: "goal_completion",
        visibility: "friends",
        reactions: [],
        comments: [],
      };

      await createFlowItem(orgId, flowItem);
      logger.info(
        `Created flow item for goal completion log ${logId} in org ${orgId}`,
      );
    } catch (error) {
      logger.error(
        `Error in onGoalCompletionLogCreate for org ${orgId}:`,
        error,
      );
    }
  },
);

export const onClubMembershipCreate = onDocumentCreated(
  "organizations/{orgId}/clubMemberships/{membershipId}",
  async (event) => {
    const {orgId, membershipId} = event.params;
    const membershipData = event.data?.data() as ParticipantClubMembership;

    if (!membershipData) {
      logger.error(`ClubMembership data missing for id: ${membershipId}`);
      return;
    }

    try {
      const participant = await getParticipant(orgId, membershipData.participantId);
      if (!participant?.name) {
        logger.error(`Participant ${membershipData.participantId} not found.`);
        return;
      }

      const clubDef = CLUB_DEFINITIONS.find((c) => c.id === membershipData.clubId);
      if (!clubDef) {
        logger.warn(
          `Club definition ${membershipData.clubId} not found in constants.`,
        );
        return;
      }

      const flowItem: Omit<FlowItem, "id"> = {
        orgId,
        timestamp: membershipData.achievedDate,
        participantId: membershipData.participantId,
        icon: "🏅",
        title: `${participant.name} gick med i en ny klubb!`,
        sourceLogId: membershipId,
        sourceLogType: "participant_club_membership",
        visibility: "friends",
        praiseItems: [{
          icon: clubDef.icon,
          text: `Välkommen till ${clubDef.name}!`,
          type: "club",
        }],
        reactions: [],
        comments: [],
      };

      await createFlowItem(orgId, flowItem);
      logger.info(
        `Created flow item for club membership ${membershipId} in org ${orgId}`,
      );
    } catch (error) {
      logger.error(`Error in onClubMembershipCreate for org ${orgId}:`, error);
    }
  },
);


// --- EXISTING ZAPIER WEBHOOK (Unchanged) ---
const ZAPIER_SECRET_KEY = process.env.ZAPIER_SECRET_KEY;

export const createLeadFromZapier = onRequest(
  {
    region: "europe-west1",
    secrets: ["ZAPIER_SECRET_KEY"],
    cors: true,
  },
  async (req: Request, res: Response) => {
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
