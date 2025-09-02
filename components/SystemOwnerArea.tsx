import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import firebaseService from '../services/firebaseService';
import dataService from '../services/dataService';
import { createInitialOrgData } from '../services/dataService';
import { Organization, User, OrganizationData } from '../types';
import { db } from '../firebaseConfig';
import { AddOrgModal } from './AddOrgModal';
import { ConfirmationModal } from './ConfirmationModal';

// DataSeeder Component - Only shown when online and DB is empty.
const DataSeeder: React.FC<{ onSeedComplete: () => void }> = ({ onSeedComplete }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSeedDatabase = async () => {
        setIsLoading(true);
        setError(null);
        if (!confirm("Är du säker på att du vill fylla databasen med startdata? Detta bör bara göras en gång på en tom databas.")) {
            setIsLoading(false);
            return;
        }

        try {
            const batch = db.batch();
            // This is an undocumented way to get the whole mock DB, but necessary for seeding.
            const mockDb = (dataService as any)._loadData();

            // 1. Seed Users collection
            // NOTE: The user must ensure that the user accounts in Firebase Authentication
            // have UIDs that match the 'id' fields in this mock data for the app to work correctly.
            const users: User[] = mockDb.users;
            users.forEach(user => {
                const { id, ...userData } = user; // Separate id from the rest of the data
                const userRef = db.collection('users').doc(id);
                batch.set(userRef, userData);
            });

            // 2. Seed Organizations collection
            const organizations: Organization[] = mockDb.organizations;
            organizations.forEach(org => {
                const { id, ...orgData } = org;
                const orgRef = db.collection('organizations').doc(id);
                batch.set(orgRef, orgData);
            });

            // 3. Seed OrganizationData subcollections
            const orgData: Record<string, OrganizationData> = mockDb.organizationData;
            for (const orgId in orgData) {
                const dataForOrg = orgData[orgId];
                const singleDocKeys: (keyof OrganizationData)[] = ['leaderboardSettings', 'lastFlowViewTimestamp', 'weeklyHighlightSettings', 'integrationSettings', 'branding'];
                
                for (const collectionKey in dataForOrg) {
                    const collectionData = dataForOrg[collectionKey as keyof OrganizationData];
                    const subCollectionRef = db.collection('organizations').doc(orgId).collection(collectionKey as string);

                    if (singleDocKeys.includes(collectionKey as keyof OrganizationData)) {
                        if(collectionData !== null && collectionData !== undefined) {
                            const docRef = subCollectionRef.doc('settings'); // a consistent ID
                            if (typeof collectionData === 'object') {
                                batch.set(docRef, collectionData);

                            } else {
                                // Handle primitive values like the timestamp string
                                batch.set(docRef, { value: collectionData });
                            }
                        }
                    } else if (Array.isArray(collectionData)) {
                        (collectionData as any[]).forEach(item => {
                            if (item && item.id) {
                                const { id, ...itemData } = item;
                                const docRef = subCollectionRef.doc(id);
                                batch.set(docRef, itemData);
                            }
                        });
                    }
                }
            }

            await batch.commit();
            alert('Databasen har fyllts med startdata! Sidan kommer nu att laddas om.');
            onSeedComplete();
        } catch (e) {
            console.error("Database seeding failed:", e);
            setError(`Ett fel uppstod: ${e instanceof Error ? e.message : String(e)}`);
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-12 p-6 bg-yellow-50 border-l-4 border-yellow-400">
            <h2 className="text-xl font-bold text-gray-800">Databas-initiering</h2>
            <p className="text-base text-gray-700 mt-2">
                Din onlinedatabas verkar vara tom. Klicka på knappen nedan för att fylla den med nödvändig startdata
                (t.ex. medlemskapstyper, passkategorier och testanvändare).
            </p>
            <p className="text-sm text-gray-600 mt-1">
                <strong>Viktigt:</strong> Detta ska bara göras en gång. Knappen försvinner efter att databasen har fyllts.
            </p>
            <div className="mt-4">
                <Button onClick={handleSeedDatabase} disabled={isLoading}>
                    {isLoading ? 'Fyller databasen...' : 'Fyll databasen med startdata'}
                </Button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
    );
};

export const SystemOwnerArea: React.FC = () => {
    const { impersonate } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOrgModalOpen, setIsAddOrgModalOpen] = useState(false);
    const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

    const fetchOrganizations = async () => {
        setIsLoading(true);
        try {
            const orgs = await firebaseService.get('organizations');
            setOrganizations(orgs);
        } catch (error) {
            console.error("Failed to fetch organizations:", error);
            setOrganizations([]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const handleSaveOrganization = async (name: string) => {
        const newOrgId = crypto.randomUUID();
        const newOrg: Organization = { id: newOrgId, name };
        const newOrgData = createInitialOrgData(newOrgId);

        try {
            await firebaseService.addNewOrganization(newOrg, newOrgData);
            await fetchOrganizations(); // Refresh the list
            setIsAddOrgModalOpen(false);
        } catch (error) {
            console.error("Failed to save new organization:", error);
            alert(`Kunde inte spara organisationen: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (!orgToDelete) return;
        try {
            await firebaseService.deleteOrganization(orgToDelete.id);
            alert(`Organisationen "${orgToDelete.name}" har raderats.`);
            setOrgToDelete(null);
            await fetchOrganizations(); // Refresh list
        } catch (error) {
            console.error("Failed to delete organization:", error);
            alert(`Kunde inte radera organisationen: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const isDbEmpty = !isLoading && organizations.length === 0;

    if (isLoading) {
        return (
            <div className="container mx-auto p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-flexibel mx-auto"></div>
                <p className="mt-2 text-lg text-gray-600">Laddar organisationer...</p>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800">Systemöversikt</h1>
                    <p className="text-lg text-gray-600 mt-2">Hantera dina organisationer.</p>
                </div>
                <Button onClick={() => setIsAddOrgModalOpen(true)}>
                    Lägg till Organisation
                </Button>
            </div>


            {organizations.length > 0 ? (
                 <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organizations.map(org => (
                        <div key={org.id} className="bg-white p-6 rounded-lg shadow-md border flex flex-col items-start">
                            <h2 className="text-2xl font-semibold text-gray-900">{org.name}</h2>
                            <p className="text-sm text-gray-500 mb-4">ID: {org.id}</p>
                            <div className="mt-auto w-full space-y-2">
                                <Button 
                                    onClick={() => impersonate(org.id)}
                                    fullWidth
                                >
                                    Administrera
                                </Button>
                                 <Button 
                                    onClick={() => setOrgToDelete(org)}
                                    variant="danger"
                                    fullWidth
                                >
                                    Ta bort
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                !firebaseService.isOffline() && isDbEmpty ? (
                    <DataSeeder onSeedComplete={() => window.location.reload()} />
                ) : null
            )}

            {firebaseService.isOffline() && (
                 <div className="mt-8 p-4 bg-blue-50 text-blue-800 rounded-md border border-blue-200">
                    <p>Appen körs i offlineläge med testdata. Funktioner för databas-initiering är inte tillgängliga.</p>
                 </div>
            )}
            
            <AddOrgModal
                isOpen={isAddOrgModalOpen}
                onClose={() => setIsAddOrgModalOpen(false)}
                onSave={handleSaveOrganization}
                existingOrgNames={organizations.map(o => o.name)}
            />

            <ConfirmationModal
                isOpen={!!orgToDelete}
                onClose={() => setOrgToDelete(null)}
                onConfirm={handleConfirmDelete}
                title={`Radera ${orgToDelete?.name}?`}
                message={
                    <span>
                        Är du säker på att du vill radera organisationen <strong>{orgToDelete?.name}</strong>? 
                        <br />
                        <strong className="text-red-600">All data</strong> för denna organisation, inklusive medlemmar, pass, och loggar, kommer att raderas permanent. Denna åtgärd kan inte ångras.
                    </span>
                }
                confirmButtonText="Ja, radera permanent"
                confirmButtonVariant="danger"
            />
        </div>
    );
};