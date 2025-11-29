import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ZAPIER_WEBHOOK_SECRET } from '../../constants';
import { Lead } from '../../types';

export const ZapierWebhookHandler: React.FC = () => {
    const { setLeadsData, locations } = useAppContext();
    const [status, setStatus] = useState<{ code: number; message: string }>({ code: 400, message: 'Processing...' });

    useEffect(() => {
        const processRequest = () => {
            const params = new URLSearchParams(window.location.search);
            const secret = params.get('secret');
            const data = params.get('data');

            if (secret !== ZAPIER_WEBHOOK_SECRET) {
                setStatus({ code: 403, message: 'Error: Invalid secret key.' });
                return;
            }

            if (!data) {
                setStatus({ code: 400, message: 'Error: Missing data parameter.' });
                return;
            }

            try {
                const decodedData = atob(data);
                const payload = JSON.parse(decodedData);

                // Basic validation of payload
                if (!payload.firstName || !payload.lastName || !payload.email || !payload.locationName) {
                    setStatus({ code: 400, message: 'Error: Missing required fields in payload (firstName, lastName, email, locationName).' });
                    return;
                }

                let locationId: string | undefined;
                const location = locations.find(l => l.name.toLowerCase() === payload.locationName.toLowerCase());
                if (!location) {
                    // Try to find a partial match
                    const partialMatch = locations.find(l => l.name.toLowerCase().includes(payload.locationName.toLowerCase()));
                    if (!partialMatch) {
                        setStatus({ code: 400, message: `Error: Location '${payload.locationName}' not found.` });
                        return;
                    }
                    locationId = partialMatch.id;
                } else {
                     locationId = location.id;
                }
                
                const newLead: Lead = {
                    id: crypto.randomUUID(),
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    email: payload.email,
                    phone: payload.phone || undefined,
                    locationId: locationId,
                    source: 'Meta',
                    createdDate: new Date().toISOString(),
                    status: 'new',
                };

                // Using the context updater to add the lead
                setLeadsData(prev => [...prev, newLead]);
                
                setStatus({ code: 200, message: 'Success: Lead created.' });

            } catch (error) {
                console.error("Zapier Webhook Error:", error);
                setStatus({ code: 500, message: `Error: Failed to process data. ${error instanceof Error ? error.message : 'Unknown error'}` });
            }
        };

        processRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    // Render a plain text response for Zapier
    return (
        <pre style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(status, null, 2)}
        </pre>
    );
};