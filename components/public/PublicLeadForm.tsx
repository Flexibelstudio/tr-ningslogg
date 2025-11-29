import React, { useState, useEffect } from 'react';
import { LeadCaptureForm } from './LeadCaptureForm';
import { Lead, Location, Organization } from '../../types';
import dataService from '../../services/dataService';
import { Button } from '../Button';

// Placeholder for the external booking URL
const EXTERNAL_BOOKING_URL = 'https://calendly.com/your-booking-page'; 
const ORG_ID = 'org-flexibel'; // Hardcoded for this prototype

export const PublicLeadForm: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [organizationName, setOrganizationName] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const orgData = dataService.getOrgData(ORG_ID);
            const orgs = dataService.get('organizations');
            const org = orgs.find(o => o.id === ORG_ID);

            if (orgData && org) {
                setLocations(orgData.locations);
                setOrganizationName(org.name);
            } else {
                setError("Kunde inte hitta organisationens data.");
            }
        } catch (e) {
            setError("Ett fel uppstod vid hämtning av data.");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSubmit = (formData: { firstName: string; lastName: string; email: string; phone: string; locationId: string; }) => {
        const newLead: Omit<Lead, 'id' | 'createdDate'> = {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim() || undefined,
            locationId: formData.locationId,
            source: 'Hemsida',
            status: 'new',
        };
        
        try {
            // Mimic an API call by directly updating the data source
            dataService.setOrgData(ORG_ID, prevData => ({
                ...prevData,
                leads: [
                    ...prevData.leads,
                    {
                        ...newLead,
                        id: crypto.randomUUID(),
                        createdDate: new Date().toISOString(),
                    } as Lead
                ]
            }));
            setIsSubmitted(true);
        } catch (e) {
            setError("Kunde inte spara dina uppgifter. Försök igen senare.");
            console.error(e);
        }
    };

    if (isLoading) {
        return <div className="text-center p-8">Laddar...</div>;
    }

    if (error && !isSubmitted) {
         return <div className="text-center p-8 text-red-600 bg-red-100">{error}</div>;
    }

    return (
        <div className="min-h-screen flex flex-col bg-dotted-pattern bg-dotted-size bg-gray-100">
            <main className="flex-grow flex items-center justify-center py-12 px-4">
                <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in-down">
                    <div className="text-center mb-8">
                         <img src="/icon-180x180.png" alt="Logotyp" className="mx-auto h-20 w-auto mb-4" />
                        <h1 className="text-3xl font-bold text-gray-800">Intresseanmälan till {organizationName}</h1>
                    </div>

                    {isSubmitted ? (
                        <div className="text-center space-y-6">
                            <h2 className="text-2xl font-bold text-green-600">Tack för din anmälan!</h2>
                            <p className="text-lg text-gray-700">Vi har tagit emot dina uppgifter. Du kan nu antingen vänta på att en coach kontaktar dig, eller så kan du boka en tid för introsamtal direkt i vår kalender.</p>
                            <a href={EXTERNAL_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                                <Button size="lg" className="animate-pulse-cta">
                                    Boka tid direkt i kalendern
                                </Button>
                            </a>
                        </div>
                    ) : (
                        <LeadCaptureForm locations={locations} onSubmit={handleSubmit} />
                    )}
                </div>
            </main>
        </div>
    );
};