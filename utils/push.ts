// utils/push.ts
// Frikopplad helper för web push – inga projektinterna imports för att undvika import-cirklar.

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export async function ensureWebPushSubscription(orgId: string, participantId: string) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.warn('[Push] Browser saknar SW/Push/Notification.');
      return;
    }

    const VAPID_PUBLIC_KEY = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] Saknar VITE_VAPID_PUBLIC_KEY i miljön.');
      return;
    }
    console.log(
      '[Push][DEBUG] VAPID_PUBLIC_KEY:',
      VAPID_PUBLIC_KEY.slice(0, 10), '…', VAPID_PUBLIC_KEY.slice(-10)
    );

    // 1) Service worker
    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register('/sw.js'));

    // 2) Permission
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== 'granted') {
      console.warn('[Push] Permission ej granted.');
      return;
    }

    // 3) Subscription
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // 4) Dynamiska imports (bryter import-cirklar)
    const [{ getApp }, { getFirestore, collection, query, where, getDocs, setDoc, updateDoc, doc }] =
      await Promise.all([
        import('firebase/app'),
        import('firebase/firestore')
      ]);

    const db = getFirestore(getApp());
    const subsCol = collection(db, 'organizations', orgId, 'userPushSubscriptions');

    const json: any = subscription.toJSON();
    const payload = {
      participantId,
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      },
      createdAt: new Date().toISOString(),
      ua: navigator.userAgent,
    };

    // 5) Upsert (samma endpoint + participantId)
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
      // uppdatera första match
      await updateDoc(doc(db, snap.docs[0].ref.path), payload);
      console.log('[Push] Prenumeration uppdaterad.');
    }
  } catch (err) {
    console.error('[Push] ensureWebPushSubscription error:', err);
  }
}
