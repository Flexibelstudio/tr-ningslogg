// components/participant/NotificationPermissionManager.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { requestNotificationPermissionAndSaveToken } from '../../utils/firebaseMessaging';
import { useNotifications } from '../../context/NotificationsContext';
import { Button } from '../Button';

export const NotificationPermissionManager: React.FC = () => {
    const { currentParticipantId } = useAuth();
    const { participantDirectory, updateParticipantProfile } = useAppContext();
    const { addNotification } = useNotifications();

    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
    }, []);

    const handleRequestPermission = async () => {
        if (!currentParticipantId) return;

        const participant = participantDirectory.find(p => p.id === currentParticipantId);
        if (!participant) return;

        setIsLoading(true);
        const result = await requestNotificationPermissionAndSaveToken(participant, updateParticipantProfile);
        
        if (result.success) {
            addNotification({ type: 'SUCCESS', title: 'Klart!', message: result.message });
        } else {
            addNotification({ type: 'ERROR', title: 'Fel', message: result.message });
        }
        
        // Update local state to reflect the new permission status
        if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
        setIsLoading(false);
    };

    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return null; // Don't show anything if browser doesn't support notifications
    }
    
    // Don't show if permission is already granted
    if (permissionStatus === 'granted') {
        return null;
    }

    return (
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 space-y-3">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span role="img" aria-label="bell">🔔</span> Missa inga uppdateringar!
            </h3>
            {permissionStatus === 'denied' ? (
                 <p className="text-base text-gray-600">
                    Du har blockerat notiser. För att få påminnelser och nyheter behöver du 
                    <span className="font-semibold"> aktivera notiser för den här sidan</span> i din webbläsares inställningar.
                </p>
            ) : (
                <>
                    <p className="text-base text-gray-600">
                        Aktivera notiser för att få påminnelser om dina bokade pass, när du får en plats från kölistan, och andra viktiga händelser direkt i din enhet.
                    </p>
                    <Button onClick={handleRequestPermission} disabled={isLoading} fullWidth>
                        {isLoading ? 'Aktiverar...' : 'Aktivera Notiser'}
                    </Button>
                </>
            )}
        </div>
    );
};
