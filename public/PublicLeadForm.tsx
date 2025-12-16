
import React, { useState, useEffect } from 'react';
import { LeadCaptureForm } from './LeadCaptureForm';
import { Lead, Location } from '../../types';
import dataService from '../../services/dataService';
import { Button } from '../Button';

// ORG_ID för prototypen. I en riktig app skulle detta kanske hämtas från URL:en eller config.
const ORG_ID = 'org-flexibel'; 

export const PublicLeadForm: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            // Försök hämta organisationsdata (mock/local)
            const orgData = dataService.getOrgData(ORG_ID);
            if (orgData) {
                setLocations(orgData.locations);
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

    const handleSubmit = async (formData: { firstName: string; lastName: string; email: string; phone: string; locationId: string; }) => {
        setIsSubmitting(true);
        
        const newLead: Omit<Lead, 'id' | 'createdDate'> = {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim() || undefined,
            locationId: formData.locationId,
            source: 'Påbörjad bokning',
            status: 'new',
        };
        
        try {
            // 1. Spara leadet (Simulerar API-anrop mot databasen)
            // I en riktig implementation: await firebaseService.addDocToOrg(ORG_ID, 'leads', newLead);
            // Här använder vi dataService direkt för att det ska fungera i prototypen/offline.
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

            // 2. Simulera nätverksfördröjning för bättre UX (spinner syns)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. Redirect baserat på vald ort
            const selectedLocation = locations.find(l => l.id === formData.locationId);
            const locationName = selectedLocation?.name.toLowerCase() || '';

            if (locationName.includes('salem')) {
                window.location.href = 'https://flexibelfriskvard.zoezi.se/introsamtal-salem';
            } else if (locationName.includes('kärra') || locationName.includes('karra')) {
                window.location.href = 'https://flexibelfriskvard.zoezi.se/introsamtal-karra';
            } else {
                // Fallback om vi lägger till fler orter i framtiden utan specifika länkar
                // Eller om orten inte matchar kända mönster
                alert("Tack för din anmälan! Vi kontaktar dig inom kort.");
                setIsSubmitting(false); // Återställ knapp om vi stannar kvar
            }

        } catch (e) {
            setError("Kunde inte spara dina uppgifter. Försök igen senare.");
            console.error(e);
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
            </div>
        );
    }

    if (error) {
         return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
                    <p className="text-red-600 font-semibold text-lg mb-2">Ett fel uppstod</p>
                    <p className="text-gray-600">{error}</p>
                    <Button className="mt-4" onClick={() => window.location.reload()}>Försök igen</Button>
                </div>
            </div>
         );
    }

    return (
        <div className="min-h-screen flex flex-col bg-dotted-pattern bg-dotted-size bg-gray-50">
            <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="bg-white p-8 sm:p-12 rounded-3xl shadow-2xl w-full max-w-2xl animate-fade-in-down border border-gray-100">
                    
                    <div className="text-center mb-8">
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
                            Välkommen på ett kostnadsfritt introsamtal <br className="hidden sm:block" />
                            <span className="text-flexibel">– låt oss hjälpa dig igång!</span>
                        </h1>
                        
                        <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl mx-auto">
                            Träffa en coach, sätt upp mål och få en personlig plan – <span className="font-semibold text-gray-800">helt gratis!</span>
                        </p>
                    </div>

                    <div className="bg-gray-50/50 p-6 sm:p-8 rounded-2xl border border-gray-100">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-gray-800 mb-1">Börja med att fylla i dina uppgifter</h2>
                            <p className="text-sm text-gray-500">Vi skickar dig vidare till bokningen i nästa steg.</p>
                        </div>
                        
                        <LeadCaptureForm 
                            locations={locations} 
                            onSubmit={handleSubmit} 
                            isSubmitting={isSubmitting} 
                        />
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-gray-400">
                            Genom att skicka in godkänner du att vi kontaktar dig gällande din intresseanmälan.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};
