// src/utils/push.ts
import { getFirestore, collection, query, where, getDocs, setDoc, updateDoc, doc as fsDoc, doc } from "firebase/firestore";
import firebaseService from "../services/firebaseService";

const VAPID_PUBLIC_KEY =
  "BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function ensureWebPushSubscription(orgId: string, participantId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    console.warn("[Push] Browser saknar SW/Push-stöd.");
    return;
  }

  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js"));

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[Push] Permission nekad.");
    throw new Error("Notification permission not granted");
  }

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  let db: any;
  try {
    db =
      (firebaseService as any).db ??
      ((firebaseService as any).app ? getFirestore((firebaseService as any).app) : getFirestore());
  } catch {
    db = getFirestore();
  }
  if (!db) throw new Error("[Push] Ingen Firestore-instans.");

  const subsCol = collection(db, "organizations", orgId, "userPushSubscriptions");
  const json = subscription.toJSON() as any;

  const payload = {
    participantId,
    subscription: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    },
    createdAt: new Date().toISOString(),
    ua: navigator.userAgent,
  };

  // Finns redan?
  const q = query(
    subsCol,
    where("participantId", "==", participantId),
    where("subscription.endpoint", "==", json.endpoint)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    const stableId = btoa(`${participantId}::${json.endpoint}`).replace(/=+$/, "");
    await setDoc(doc(subsCol, stableId), payload);
    console.log("[Push] Ny prenumeration sparad.");
  } else {
    await updateDoc(fsDoc(db, snap.docs[0].ref.path), payload);
    console.log("[Push] Prenumeration uppdaterad.");
  }
}
