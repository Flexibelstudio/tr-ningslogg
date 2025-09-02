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

    const [apiError, setApiError] = useState('');
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        if (selectedOrgId) {
            const fetchLocations = async () => {
                setIsLoadingLocations(true);
                setSelectedLocationId('');
                setApiError('');
                setFormErrors({});
                try {
                    const mockOrgData = dataService.getOrgData(selectedOrgId);
                    const locs = mockOrgData?.locations || [];

                    setLocationsForOrg(locs);

                    if (locs.length === 0) {
                        const orgName = allOrganizations.find(o => o.id === selectedOrgId)?.name || 'Den valda organisationen';
                        setFormErrors(prev => ({ ...prev, orgId: `'${orgName}' har inga konfigurerade studios/orter.` }));
                    }
                } catch (err) {
                    console.error("Failed to fetch locations from dataService:", err);
                    setApiError('Ett fel uppstod vid hämtning av orter.');
                    setLocationsForOrg([]);
                } finally {
                    setIsLoadingLocations(false);
                }
            };
            fetchLocations();
        } else {
            setLocationsForOrg([]);
            setSelectedLocationId('');
            setApiError('');
        }
    }, [selectedOrgId, allOrganizations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setApiError('');
        
        const trimmedEmail = email.trim();
        setEmail(trimmedEmail); // Uppdatera state för att visa den trimmade versionen i UI:t

        // Validering görs här för att använda den trimmade e-postadressen direkt
        const newErrors: { [key: string]: string } = {};
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            newErrors.email = 'Vänligen ange en giltig e-postadress.';
        }
        if (password.length < 6) {
            newErrors.password = 'Lösenordet måste vara minst 6 tecken långt.';
        }
        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Lösenorden matchar inte.';
        }
        if (!selectedOrgId) {
            newErrors.orgId = 'Du måste välja en organisation.';
        }
        if (!selectedLocationId) {
            newErrors.locationId = 'Du måste välja en studio/ort.';
        }
        setFormErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        setIsLoading(true);
        try {
            await register(trimmedEmail, password, selectedOrgId, selectedLocationId);
            onRegistrationSuccess();
        } catch (err: any) {
            if (err.message === 'AUTH_NO_PREEXISTING_PROFILE') {
                setApiError('Det finns inget konto att aktivera för denna e-post. Kontakta din coach för att bli tillagd i systemet.');
            } else if (err.message === 'AUTH_REGISTRATION_DECLINED') {
                setApiError('Din registrering har nekats. Kontakta din coach för mer information.');
            } else if (err.code === 'auth/email-already-in-use') {
                setApiError('Denna e-postadress är redan registrerad och aktiverad. Prova att logga in.');
            } else if (err.code === 'auth/weak-password') {
                setFormErrors(prev => ({ ...prev, password: 'Lösenordet måste vara minst 6 tecken långt.' }));
            } else if (err.code === 'auth/invalid-email') {
                setFormErrors(prev => ({ ...prev, email: 'E-postadressen är ogiltig eller så har ett tekniskt fel inträffat. Kontrollera adressen och försök igen.' }));
            } else {
                setApiError('Ett oväntat fel uppstod vid registrering. Försök igen.');
            }
            console.error("Registration error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const orgOptions = allOrganizations.map(org => ({ value: org.id, label: org.name }));
    const locationOptions = locationsForOrg.map(loc => ({ value: loc.id, label: loc.name }));

    return (
        <div className="h-screen flex flex-col bg-dotted-pattern bg-dotted-size bg-gray-100 p-4 overflow-hidden">
            <main className="flex-grow flex items-center justify-center">
                <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-lg space-y-4 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-800">Välkommen till din <span className="text-flexibel">Träningslogg</span></h2>
                        <p className="text-gray-600 mt-2">Skapa ditt konto nedan.</p>
                    </div>
                    {apiError && <p className="text-center bg-red-100 text-red-700 p-3 rounded-lg">{apiError}</p>}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                          label="E-post"
                          id="reg-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onBlur={() => setEmail(e => e.trim())}
                          required
                          error={formErrors.email}
                        />
                        <Input label="Lösenord" id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required error={formErrors.password} />
                        <Input label="Bekräfta Lösenord" id="reg-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required error={formErrors.confirmPassword} />
                        
                        <Select 
                            label="Välj Organisation *" 
                            value={selectedOrgId} 
                            onChange={e => setSelectedOrgId(e.target.value)} 
                            options={[{ value: '', label: 'Välj en organisation...' }, ...orgOptions]}
                            required 
                            error={formErrors.orgId}
                        />

                        {isLoadingLocations && <p className="text-sm text-gray-500">Laddar orter...</p>}
                        
                        {selectedOrgId && !isLoadingLocations && locationsForOrg.length > 0 && (
                            <Select 
                                label="Välj Studio / Ort *" 
                                value={selectedLocationId} 
                                onChange={e => setSelectedLocationId(e.target.value)} 
                                options={[{ value: '', label: 'Välj en ort...' }, ...locationOptions]}
                                required
                                error={formErrors.locationId}
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
            <footer className="flex-shrink-0 py-6 text-center text-gray-500 text-base animate-fade-in" style={{ animationDelay: '0.3s' }}>
                Powered by Flexibel Hälsostudio.
            </footer>
        </div>
    );
};