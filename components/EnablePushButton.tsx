// src/components/EnablePushButton.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { Button } from './Button';

// Firestore
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  doc as fsDoc,
  doc,
} from 'firebase/firestore';

const VAPID_PUBLIC_KEY =
  'BO21Yp3_p0o_5ce295-SC_pY9nZ8aGRi_SC2B5UF0jbl4M13nS2j52hce5C65a0gI55NUEM02eKYpOMYJ0pM5cE';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export const EnablePushButton: React.FC<{ small?: boolean }> = ({ small }) => {
  const auth = useAuth();
  const { participantDirectory, addNotification } = useAppContext() as any;
  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        addNotification?.({ type: 'WARNING', title: 'Notiser ej stödda', message: 'Din webbläsare saknar stöd för push.' });
        return;
      }
      if (!auth.organizationId || !auth.currentParticipantId) {
        addNotification?.({ type: 'WARNING', title: 'Inte inloggad som deltagare', message: 'Byt till deltagarvy och försök igen.' });
        return;
      }
      // Kolla att användaren faktiskt vill ha push
      const profile = participantDirectory.find((p: any) => p.id === auth.currentParticipantId);
      const pushEnabled = profile?.notificationSettings?.pushEnabled ?? true;
      if (!pushEnabled) {
        addNotification?.({ type: 'INFO', title: 'Push avstängd i profil', message: 'Aktivera push i dina inställningar först.' });
        return;
      }

      setBusy(true);

      // 1) Registrera/återanvänd SW
      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register('/sw.js'));

      // 2) Permission (måste triggas av click)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addNotification?.({ type: 'INFO', title: 'Behörighet nekad', message: 'Du måste tillåta notiser i webbläsaren.' });
        setBusy(false);
        return;
      }

      // 3) Subscribe
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));

      // 4) Spara till Firestore
      const db = getFirestore();
      const subsCol = collection(db, 'organizations', auth.organizationId, 'userPushSubscriptions');
      const json = subscription.toJSON() as any;

      const payload = {
        participantId: auth.currentParticipantId,
        subscription: {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        },
        createdAt: new Date().toISOString(),
        ua: navigator.userAgent,
      };

      const q = query(
        subsCol,
        where('participantId', '==', auth.currentParticipantId),
        where('subscription.endpoint', '==', json.endpoint)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        const stableId = btoa(`${auth.currentParticipantId}::${json.endpoint}`).replace(/=+$/, '');
        await setDoc(doc(subsCol, stableId), payload);
        addNotification?.({ type: 'SUCCESS', title: 'Notiser aktiverade', message: 'Prenumeration sparad.' });
      } else {
        await updateDoc(fsDoc(db, snap.docs[0].ref.path), payload);
        addNotification?.({ type: 'SUCCESS', title: 'Notiser uppdaterade', message: 'Prenumeration uppdaterad.' });
      }
    } catch (err) {
      console.error('[Push] enable failed', err);
      addNotification?.({ type: 'ERROR', title: 'Kunde inte aktivera notiser', message: String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handleEnable} size={small ? 'sm' : 'md'} disabled={busy}>
      {busy ? 'Aktiverar…' : 'Aktivera notiser'}
    </Button>
  );
};
