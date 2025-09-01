import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Input, Select } from './Input';
import { APP_NAME } from '../constants';
import { useAppContext } from '../context/AppContext';
import { Location, Organization } from '../types';
import firebaseService from '../services/firebaseService';
import { useNetworkStatus } from '../context/NetworkStatusContext';
import dataService from '../services/dataService';

interface RegisterProps {
    onSwitchToLogin: () => void;
    onRegistrationSuccess: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin, onRegistrationSuccess }) => {
    const { register } = useAuth();
    const { allOrganizations } = useAppContext();
    const { isOnline } = useNetworkStatus();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    
    const [locationsForOrg, setLocationsForOrg] = useState<Location[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        if (selectedOrgId) {
            const fetchLocations = async () => {
                setIsLoadingLocations(true);
                setSelectedLocationId('');
                setError('');
                try {
                    // ALWAYS use the local data service for locations on the public registration page.
                    // An unauthenticated user cannot fetch subcollections from Firestore.
                    const mockOrgData = dataService.getOrgData(selectedOrgId);
                    const locs = mockOrgData?.locations || [];

                    setLocationsForOrg(locs);

                    if (locs.length === 0) {
                        const orgName = allOrganizations.find(o => o.id === selectedOrgId)?.name || 'Den valda organisationen';
                        setError(`'${orgName}' har inga konfigurerade studios/orter. Välj en annan organisation.`);
                    }
                } catch (err) {
                    // This catch block is less likely to be hit now, but good to keep as a safeguard.
                    console.error("Failed to fetch locations from dataService:", err);
                    setError('Ett fel uppstod vid hämtning av orter.');
                    setLocationsForOrg([]);
                } finally {
                    setIsLoadingLocations(false);
                }
            };
            fetchLocations();
        } else {
            setLocationsForOrg([]);
            setSelectedLocationId('');
            setError('');
        }
    }, [selectedOrgId, allOrganizations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Lösenorden matchar inte.');
            return;
        }
        if (!selectedOrgId || !selectedLocationId) {
            setError('Du måste välja en studio och ort.');
            return;
        }
        setIsLoading(true);
        try {
            await register(email.trim(), password, selectedOrgId, selectedLocationId);
            onRegistrationSuccess();
        } catch (err: any) {
            if (err.message === 'AUTH_NO_PREEXISTING_PROFILE') {
                setError('Det finns inget konto att aktivera för denna e-post. Kontakta din coach för att bli tillagd i systemet.');
            } else if (err.message === 'AUTH_REGISTRATION_DECLINED') {
                setError('Din registrering har nekats. Kontakta din coach för mer information.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Denna e-postadress är redan registrerad och aktiverad. Prova att logga in.');
            } else if (err.code === 'auth/weak-password') {
                setError('Lösenordet måste vara minst 6 tecken långt.');
            } else {
                setError('Ett oväntat fel uppstod vid registrering. Försök igen.');
            }
            console.error("Registration error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const orgOptions = allOrganizations.map(org => ({ value: org.id, label: org.name }));
    const locationOptions = locationsForOrg.map(loc => ({ value: loc.id, label: loc.name }));

    return (
        <div className="min-h-screen grid grid-rows-[1fr_auto] bg-dotted-pattern bg-dotted-size bg-gray-100 p-4">
            <main className="flex items-center justify-center overflow-y-auto pt-8 pb-16">
                <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-lg space-y-4 my-auto animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
                    <div className="text-center mb-8 space-y-4">
                        <img src="/icon-180x180.png" alt="Logotyp" className="h-20 w-20 mx-auto" />
                        <h2 className="text-3xl font-bold text-gray-800">Skapa ditt konto</h2>
                        <p className="text-gray-600">Välkommen till din digitala träningspartner.</p>
                    </div>
                    {error && <p className="text-center bg-red-100 text-red-700 p-3 rounded-lg">{error}</p>}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input label="E-post" id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        <Input label="Lösenord" id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        <Input label="Bekräfta Lösenord" id="reg-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                        
                        <Select 
                            label="Välj Organisation *" 
                            value={selectedOrgId} 
                            onChange={e => setSelectedOrgId(e.target.value)} 
                            options={[{ value: '', label: 'Välj en organisation...' }, ...orgOptions]}
                            required 
                        />

                        {isLoadingLocations && <p className="text-sm text-gray-500">Laddar orter...</p>}
                        
                        {selectedOrgId && !isLoadingLocations && locationsForOrg.length > 0 && (
                            <Select 
                                label="Välj Studio / Ort *" 
                                value={selectedLocationId} 
                                onChange={e => setSelectedLocationId(e.target.value)} 
                                options={[{ value: '', label: 'Välj en ort...' }, ...locationOptions]}
                                required
                            />
                        )}

                        <Button type="submit" fullWidth size="lg" disabled={isLoading || !isOnline}>
                            {isLoading ? 'Registrerar...' : (isOnline ? 'Skapa konto' : 'Offline')}
                        </Button>
                    </form>
                    <div className="text-center mt-4">
                        <button onClick={onSwitchToLogin} className="text-flexibel hover:underline font-semibold">
                            Har du redan ett konto? Logga in
                        </button>
                    </div>
                </div>
            </main>
            <footer className="py-6 text-center text-gray-500 text-base animate-fade-in" style={{ animationDelay: '0.3s' }}>
                Powered by Flexibel Hälsostudio.
            </footer>
        </div>
    );
};