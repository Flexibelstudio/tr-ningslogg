// utils/firebaseMessaging.ts
import { getMessaging, getToken } from "firebase/messaging";
import { app } from '../firebaseConfig';
import { ParticipantProfile } from '../types';

// IMPORTANT: Replace this with your VAPID key from the Firebase console.
// Firebase > Project Settings > Cloud Messaging > Web configuration > Key pair
const VAPID_KEY = import.meta.env.VITE_VAPID_KEY || 'YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE';

export const requestNotificationPermissionAndSaveToken = async (
  participant: ParticipantProfile,
  updateParticipantProfile: (id: string, data: Partial<ParticipantProfile>) => Promise<void>
): Promise<{ success: boolean; message: string }> => {
  if (!app) {
    return { success: false, message: 'Firebase app is not initialized.' };
  }
  const messaging = getMessaging(app);

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');

      const currentToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });

      if (currentToken) {
        console.log('FCM Token:', currentToken);
        const existingTokens = participant.notificationTokens || [];
        if (!existingTokens.includes(currentToken)) {
            await updateParticipantProfile(participant.id, {
                notificationTokens: [...existingTokens, currentToken],
            });
            return { success: true, message: 'Notiser aktiverade!' };
        } else {
            return { success: true, message: 'Notiser var redan aktiverade för denna enhet.' };
        }
      } else {
        console.warn('No registration token available. Request permission to generate one.');
        return { success: false, message: 'Kunde inte hämta en notis-token. Försök igen.' };
      }
    } else {
      console.warn('Notification permission denied.');
      return { success: false, message: 'Du har blockerat notiser. Aktivera dem i webbläsarens inställningar.' };
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return { success: false, message: 'Ett fel uppstod vid aktivering av notiser.' };
  }
};
