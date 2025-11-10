// utils/push.ts
import firebaseService from '../services/firebaseService';

// Firestore v9
import {
  getFirestore, collection, query, where, getDocs, setDoc, updateDoc, doc as fsDoc, doc,
} from 'firebase/firestore';

/** Läs PUBLIC key från Vite env */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

/**
 * Säkerställ web push-prenumeration och spara den i
 * organizations/{orgId}/userPushSubscriptions
 */
export async function ensureWebPushSubscription(orgId: string, participantId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.warn('[Push] SW/Push saknas i denna browser.');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] VITE_VAPID_PUBLIC_KEY saknas – sätt den i Netlify env/.env');
      return;
    }

    // 1) Registrera/återanvänd SW
    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register('/sw.js'));

    // 2) Be om permission (görs gärna efter ett klick)
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') {
      console.warn('[Push] Permission ej granted.');
      return;
    }

    // 3) Skapa/hämta subscription
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    // 4) Firestore-instans
    let db: any;
    try {
      db = (firebaseService as any).db
        ?? ((firebaseService as any).app ? getFirestore((firebaseService as any).app) : getFirestore());
    } catch {
      db = getFirestore();
    }
    if (!db) {
      console.error('[Push] Ingen Firestore-instans.');
      return;
    }

    // 5) Upsert i organizations/{orgId}/userPushSubscriptions
    const subsCol = collection(db, 'organizations', orgId, 'userPushSubscriptions');
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

    // Finns en identisk redan?
    const q = query(
      subsCol,
      where('participantId', '==', participantId),
      where('subscription.endpoint', '==', json.endpoint),
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      const stableId = btoa(`${participantId}::${json.endpoint}`).replace(/=+$/, '');
      await setDoc(doc(subsCol, stableId), payload);
      console.log('[Push] Ny prenumeration sparad.');
    } else {
      await updateDoc(fsDoc(db, snap.docs[0].ref.path), payload);
      console.log('[Push] Prenumeration uppdaterad.');
    }
  } catch (err) {
    console.error('[Push] ensureWebPushSubscription error:', err);
  }
}
