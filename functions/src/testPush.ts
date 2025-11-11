import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import webpush from "web-push";
import { defineSecret } from "firebase-functions/params";

// Lägg VAPID-nycklar som Secrets (steg 2 nedan)
const VAPID_PUBLIC_KEY  = defineSecret("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");

if (!admin.apps.length) admin.initializeApp();

export const sendTestPush = functions.onCall(
  { secrets: [VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY] },
  async (req) => {
    const { orgId, participantId } = req.data || {};
    if (!orgId || !participantId) throw new functions.HttpsError("invalid-argument", "orgId och participantId krävs.");

    webpush.setVapidDetails(
      "mailto:support@flexibelfriskvardhalsa.se",
      VAPID_PUBLIC_KEY.value(),
      VAPID_PRIVATE_KEY.value()
    );

    const snap = await admin.firestore()
      .collection("organizations").doc(orgId)
      .collection("userPushSubscriptions")
      .where("participantId", "==", participantId)
      .get();

    if (snap.empty) throw new functions.HttpsError("not-found", "No subscription");

    const sub = snap.docs[0].data().subscription;

    await webpush.sendNotification(
      sub,
      JSON.stringify({
        title: "Testnotis",
        body: "Hej! Detta är ett test.",
        url: "/"
      })
    );

    return { ok: true };
  }
);
