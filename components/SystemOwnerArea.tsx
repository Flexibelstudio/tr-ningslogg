import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { useAuth } from '../context/AuthContext';
import firebaseService from '../services/firebaseService';
import dataService from '../services/dataService'; // To get the seed data
import { Organization, User, OrganizationData } from '../types';
import { db } from '../firebaseConfig'; // We need the db instance for writes
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';

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
            const batch = writeBatch(db);
            // This is an undocumented way to get the whole mock DB, but necessary for seeding.
            const mockDb = (dataService as any)._loadData();

            // 1. Seed Users collection
            // NOTE: The user must ensure that the user accounts in Firebase Authentication
            // have UIDs that match the 'id' fields in this mock data for the app to work correctly.
            const users: User[] = mockDb.users;
            users.forEach(user => {
                const userRef = doc(db, 'users', user.id);
                batch.set(userRef, user);
            });

            // 2. Seed Organizations collection
            const organizations: Organization[] = mockDb.organizations;
            organizations.forEach(org => {
                const orgRef = doc(db, 'organizations', org.id);
                batch.set(orgRef, { name: org.name, id: org.id });
            });

            // 3. Seed OrganizationData subcollections
            const orgData: Record<string, OrganizationData> = mockDb.organizationData;
            for (const orgId in orgData) {
                const dataForOrg = orgData[orgId];
                const singleDocKeys: (keyof OrganizationData)[] = ['leaderboardSettings', 'lastFlowViewTimestamp', 'weeklyHighlightSettings', 'integrationSettings'];
                
                for (const collectionKey in dataForOrg) {
                    const collectionData = dataForOrg[collectionKey as keyof OrganizationData];
                    const subCollectionRef = collection(db, 'organizations', orgId, collectionKey);

                    if (singleDocKeys.includes(collectionKey as keyof OrganizationData)) {
                        if(collectionData !== null && collectionData !== undefined) {
                            const docRef = doc(subCollectionRef, 'settings'); // a consistent ID
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
                                const docRef = doc(subCollectionRef, id);
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

    // Fetch organizations from the correct source (Firebase or mock)
    const fetchOrganizations = async () => {
        setIsLoading(true);
        try {
            // Using firebaseService.get() which correctly handles online/offline mode
            const orgs = await firebaseService.get('organizations');
            setOrganizations(orgs);
        } catch (error) {
            console.error("Failed to fetch organizations:", error);
            setOrganizations([]); // Set to empty on error
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchOrganizations();
    }, []);

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
            <h1 className="text-4xl font-bold text-gray-800">Systemöversikt</h1>
            <p className="text-lg text-gray-600 mt-2">Hantera din organisation.</p>

            {organizations.length > 0 ? (
                 <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organizations.map(org => (
                        <div key={org.id} className="bg-white p-6 rounded-lg shadow-md border flex flex-col items-start">
                            <h2 className="text-2xl font-semibold text-gray-900">{org.name}</h2>
                            <p className="text-sm text-gray-500 mb-4">ID: {org.id}</p>
                            <Button 
                                onClick={() => impersonate(org.id)}
                                className="mt-auto"
                            >
                                Administrera
                            </Button>
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
        </div>
    );
};