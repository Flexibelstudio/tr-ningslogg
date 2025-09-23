import { 
    MockDB, OrganizationData, Organization, User 
} from '../types';
import dataService, { createInitialOrgData } from './dataService';
import { db, firebaseConfig, auth } from '../firebaseConfig';
import firebase from 'firebase/compat/app';


let isOffline = false;
let initializationError: string | null = null;

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    const errorMsg = "Firebase config missing. Running in offline/mock data mode.";
    console.warn(errorMsg);
    initializationError = errorMsg;
    isOffline = true;
} else {
    console.log("Firebase config found. Running in online mode.");
}

// Helper to remove 'undefined' fields which are not allowed by Firestore's set() method.
const sanitizeDataForFirebase = (data: any): any => {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    const sanitized: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
            sanitized[key] = data[key];
        }
    }
    return sanitized;
};


const firebaseService = {
    isOffline: () => isOffline,
    getError: () => initializationError,

    get<K extends keyof MockDB>(key: K): Promise<MockDB[K]> {
        if (isOffline) {
            return Promise.resolve(dataService.get(key));
        } else {
            // This method is primarily for top-level collections like 'users' and 'organizations'
            return (async () => {
                const collectionRef = db.collection(key);
                const snapshot = await collectionRef.get();
                return snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as MockDB[K];
            })();
        }
    },

    set<K extends keyof MockDB>(key: K, updater: MockDB[K] | ((prev: MockDB[K]) => MockDB[K])) {
      // Note: This generic set is not transactional and primarily used by mock data service.
      // Real implementation would be more granular.
        if (isOffline) {
            dataService.set(key, updater);
        } else {
            console.warn(`Online mode: set() called for top-level collection ${key}. This is a read-only collection in production.`);
        }
    },

    async updateUser(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
        if (isOffline) {
            dataService.set('users', (prev) =>
                prev.map((u) => (u.id === userId ? { ...u, ...data, id: userId } : u))
            );
            return Promise.resolve();
        }
        const userRef = db.collection('users').doc(userId);
        // We are updating our own user profile in Firestore, not Firebase Auth user record.
        await userRef.update(sanitizeDataForFirebase(data));
    },

    async registerUserAndCreateProfiles(
        { name, email, password, orgId, locationId }: 
        { name: string, email: string, password: string, orgId: string, locationId: string }
    ): Promise<void> {
        if (isOffline) {
            // This is handled in AuthContext for offline mode
            return Promise.resolve();
        }
    
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;

        if (!firebaseUser) {
            throw new Error("Failed to create user account in authentication service.");
        }
        
        const newParticipantProfile = {
            name: name.trim(),
            email: email.toLowerCase(),
            isActive: false,
            isProspect: false,
            approvalStatus: 'pending',
            isSearchable: true,
            locationId: locationId,
            creationDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        const newUserDoc = {
            name: name.trim(),
            email: email.toLowerCase(),
            roles: { participant: orgId },
            linkedParticipantProfileId: firebaseUser.uid,
        };

        const batch = db.batch();
        const participantRef = db.collection('organizations').doc(orgId).collection('participantDirectory').doc(firebaseUser.uid);
        const userRef = db.collection('users').doc(firebaseUser.uid);
        batch.set(participantRef, sanitizeDataForFirebase(newParticipantProfile));
        batch.set(userRef, sanitizeDataForFirebase(newUserDoc));
        
        try {
            await batch.commit();
            // Sign out immediately after successful commit to prevent UI flicker and race conditions.
            await auth.signOut();
        } catch (error) {
            console.error("Firestore write failed during registration. Deleting orphaned auth user.", error);
            try {
                // Ensure the user is still signed in before attempting to delete.
                if (auth.currentUser && auth.currentUser.uid === firebaseUser.uid) {
                    await firebaseUser.delete();
                }
            } catch (deleteError) {
                console.error("Failed to delete orphaned auth user. Manual cleanup may be required.", deleteError);
            }
            throw error;
        }
    },
    
    async getAllOrgData(orgId: string): Promise<OrganizationData> {
        if (isOffline) {
            const localData = dataService.getOrgData(orgId);
            if (localData) {
                return Promise.resolve(localData);
            }
            // If offline and no cache, return an empty shell to prevent app crash
            return Promise.resolve({
                participantDirectory: [], workouts: [], workoutLogs: [], participantGoals: [],
                generalActivityLogs: [], goalCompletionLogs: [], coachNotes: [], userStrengthStats: [],
                userConditioningStatsHistory: [], participantPhysiqueHistory: [], participantMentalWellbeing: [],
                participantGamificationStats: [], clubMemberships: [], leaderboardSettings: { leaderboardsEnabled: false, weeklyPBChallengeEnabled: false, weeklySessionChallengeEnabled: false }, 
                coachEvents: [], connections: [], lastFlowViewTimestamp: null, locations: [], staffMembers: [],
                memberships: [], weeklyHighlightSettings: { isEnabled: false, dayOfWeek: 1, time: '09:00', studioTarget: 'separate' }, 
                oneOnOneSessions: [], workoutCategories: [], staffAvailability: [],
                integrationSettings: { enableQRCodeScanning: false, isBookingEnabled: false, isClientJourneyEnabled: true, isScheduleEnabled: true }, 
                groupClassDefinitions: [], groupClassSchedules: [], participantBookings: [],
            });
        }

        const collectionKeys: (keyof OrganizationData)[] = [
            'participantDirectory', 'workouts', 'workoutLogs', 'participantGoals',
            'generalActivityLogs', 'goalCompletionLogs', 'coachNotes', 'userStrengthStats',
            'userConditioningStatsHistory', 'participantPhysiqueHistory', 'participantMentalWellbeing',
            'participantGamificationStats', 'clubMemberships', 'leaderboardSettings', 'coachEvents',
            'connections', 'lastFlowViewTimestamp', 'locations', 'staffMembers', 'memberships',
            'weeklyHighlightSettings', 'oneOnOneSessions', 'workoutCategories', 'staffAvailability',
            'integrationSettings', 'groupClassDefinitions', 'groupClassSchedules', 'participantBookings', 'branding'
        ];

        const promises = collectionKeys.map(key => this.getCollection(orgId, key));
        const results = await Promise.all(promises);

        const orgData = collectionKeys.reduce((acc, key, index) => {
            (acc as any)[key] = results[index];
            return acc;
        }, {} as OrganizationData);

        return orgData;
    },

    async addDocToOrg<K extends keyof OrganizationData>(
        orgId: string,
        collectionKey: K,
        data: any // An object with an 'id' property
    ): Promise<void> {
        if (isOffline) {
            dataService.setOrgData(orgId, (prev) => {
                const collection = prev[collectionKey] as any[];
                return { ...prev, [collectionKey]: [...collection, data] };
            });
            return Promise.resolve();
        }
        const { id, ...itemData } = data;
        if (!id) {
            throw new Error("Document data must have an 'id' property to be added.");
        }
        const docRef = db.collection('organizations').doc(orgId).collection(collectionKey as string).doc(id);
        await docRef.set(sanitizeDataForFirebase(itemData));
    },

    async deleteDocFromOrg<K extends keyof OrganizationData>(
        orgId: string,
        collectionKey: K,
        docId: string
    ): Promise<void> {
        if (isOffline) {
            dataService.setOrgData(orgId, (prev) => {
                const collection = prev[collectionKey] as any[];
                const updatedCollection = collection.filter((doc: any) => doc.id !== docId);
                return { ...prev, [collectionKey]: updatedCollection };
            });
            return Promise.resolve();
        }
        const docRef = db.collection('organizations').doc(orgId).collection(collectionKey as string).doc(docId);
        await docRef.delete();
    },

    async getCollection<K extends keyof OrganizationData>(orgId: string, collectionKey: K): Promise<OrganizationData[K]> {
        if (isOffline) {
            return Promise.resolve(dataService.getOrgData(orgId)?.[collectionKey] || [] as any);
        }

        const collectionRef = db.collection('organizations').doc(orgId).collection(collectionKey as string);
        const snapshot = await collectionRef.get();
        
        // Handle single-document collections (which are stored as objects in mock data)
        const singleDocKeys: (keyof OrganizationData)[] = ['leaderboardSettings', 'lastFlowViewTimestamp', 'weeklyHighlightSettings', 'integrationSettings', 'branding'];
        if (singleDocKeys.includes(collectionKey)) {
             if (snapshot.docs.length > 0) {
                const data = snapshot.docs[0].data();
                // Handle the case where timestamp was saved as { value: '...' }
                return (data.hasOwnProperty('value') ? data.value : data) as OrganizationData[K];
             }
             // Return default if not found
             return Promise.resolve(dataService.getOrgData(orgId)?.[collectionKey] as any);
        }
        
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as unknown as OrganizationData[K];
    },

    async setCollection<K extends keyof OrganizationData>(orgId: string, collectionKey: K, data: OrganizationData[K]): Promise<void> {
        if (isOffline) {
            dataService.setOrgData(orgId, (prev) => ({ ...prev, [collectionKey]: data }));
            return Promise.resolve();
        }

        const collectionRef = db.collection('organizations').doc(orgId).collection(collectionKey as string);
        const batch = db.batch();

        const snapshot = await collectionRef.get();
        snapshot.docs.forEach(document => {
            batch.delete(document.ref);
        });

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                const { id, ...itemData } = item;
                const docRef = collectionRef.doc(id || crypto.randomUUID());
                batch.set(docRef, sanitizeDataForFirebase(itemData));
            });
        } else if (typeof data === 'object' && data !== null) {
            // Handle single-document objects
            const docRef = collectionRef.doc('settings'); // Use a consistent ID for single-doc collections
            batch.set(docRef, sanitizeDataForFirebase(data));
        } else if (data !== null && data !== undefined) {
             const docRef = collectionRef.doc('settings');
             batch.set(docRef, { value: data });
        }
        
        await batch.commit();
    },

    async updateDocInOrg<K extends keyof OrganizationData>(
        orgId: string,
        collectionKey: K,
        docId: string,
        dataToUpdate: Partial<any>
    ): Promise<void> {
        if (isOffline) {
            dataService.setOrgData(orgId, (prev) => {
                const collection = prev[collectionKey];
                if (Array.isArray(collection)) {
                    const updatedCollection = collection.map((doc: any) => {
                        if (doc.id === docId) {
                            const newDoc = { ...doc, ...dataToUpdate, lastUpdated: new Date().toISOString() };
                            // Handle deletion for null values (our sentinel)
                            for (const key in newDoc) {
                                if (newDoc[key] === null) {
                                    delete newDoc[key];
                                }
                            }
                            return newDoc;
                        }
                        return doc;
                    });
                    return { ...prev, [collectionKey]: updatedCollection };
                }
                return prev;
            });
            return Promise.resolve();
        }

        const docRef = db.collection('organizations').doc(orgId).collection(collectionKey as string).doc(docId);
        const finalData: { [key: string]: any } = { ...dataToUpdate, lastUpdated: new Date().toISOString() };
        delete finalData.id; // Do not write the ID field into the document data

        // Convert null values to Firebase's deleteField sentinel
        for (const key in finalData) {
            if (finalData[key] === null) {
                finalData[key] = firebase.firestore.FieldValue.delete();
            }
        }
        await docRef.set(sanitizeDataForFirebase(finalData), { merge: true });
    },

    async addNewOrganization(org: Organization, orgData: OrganizationData): Promise<void> {
        if (isOffline) {
            dataService.set('organizations', prev => [...prev, org]);
            dataService.set('organizationData', prev => ({ ...prev, [org.id]: orgData }));
            return Promise.resolve();
        }

        const batch = db.batch();
        
        // 1. Add to 'organizations' collection
        const orgRef = db.collection('organizations').doc(org.id);
        const { id, ...orgSaveData } = org;
        batch.set(orgRef, sanitizeDataForFirebase(orgSaveData));
        
        // 2. Add all the subcollections for organizationData
        const singleDocKeys: (keyof OrganizationData)[] = ['leaderboardSettings', 'lastFlowViewTimestamp', 'weeklyHighlightSettings', 'integrationSettings', 'branding'];

        for (const collectionKey in orgData) {
            const collectionData = orgData[collectionKey as keyof OrganizationData];
            const subCollectionRef = db.collection('organizations').doc(org.id).collection(collectionKey as string);

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
                        batch.set(docRef, sanitizeDataForFirebase(itemData));
                    }
                });
            }
        }
        
        await batch.commit();
    },
    
    async deleteOrganization(orgId: string): Promise<void> {
        if (isOffline) {
            dataService.set('organizations', prev => prev.filter(o => o.id !== orgId));
            dataService.set('organizationData', prev => {
                const newData = { ...prev };
                delete newData[orgId];
                return newData;
            });
            dataService.set('users', prev => {
                return prev.map(user => {
                    const roles = user.roles;
                    let rolesChanged = false;
                    
                    if (roles.orgAdmin?.includes(orgId)) {
                        roles.orgAdmin = roles.orgAdmin.filter(id => id !== orgId);
                        rolesChanged = true;
                    }

                    if (roles.participant === orgId) {
                        delete roles.participant;
                        rolesChanged = true;
                    }
                    
                    return rolesChanged ? { ...user, roles } : user;
                });
            });
            return Promise.resolve();
        }

        // --- ONLINE LOGIC ---
        const initialBatch = db.batch();

        // 1. Delete all subcollection documents
        const collectionsToDelete: (keyof OrganizationData)[] = [
            'participantDirectory', 'workouts', 'workoutLogs', 'participantGoals', 'generalActivityLogs',
            'goalCompletionLogs', 'coachNotes', 'userStrengthStats', 'userConditioningStatsHistory',
            'participantPhysiqueHistory', 'participantMentalWellbeing', 'participantGamificationStats',
            'clubMemberships', 'coachEvents', 'connections', 'locations', 'staffMembers',
            'memberships', 'oneOnOneSessions', 'workoutCategories', 'staffAvailability',
            'groupClassDefinitions', 'groupClassSchedules', 'participantBookings',
            'leaderboardSettings', 'lastFlowViewTimestamp', 'weeklyHighlightSettings', 'integrationSettings', 'branding'
        ];

        for (const collectionKey of collectionsToDelete) {
            const collectionRef = db.collection('organizations').doc(orgId).collection(collectionKey as string);
            const snapshot = await collectionRef.get();
            snapshot.docs.forEach(doc => {
                initialBatch.delete(doc.ref);
            });
        }

        // 2. Delete the main organization document
        const orgRef = db.collection('organizations').doc(orgId);
        initialBatch.delete(orgRef);

        await initialBatch.commit();

        // 3. Clean up user roles in a separate transaction
        const userCleanupBatch = db.batch();
        const usersRef = db.collection('users');
        const usersSnapshot = await usersRef.get();
        let userCleanupNeeded = false;

        usersSnapshot.forEach(userDoc => {
            const user = { id: userDoc.id, ...userDoc.data() } as User;
            const roles = user.roles;
            let rolesChanged = false;
            
            if (roles.orgAdmin?.includes(orgId)) {
                roles.orgAdmin = roles.orgAdmin.filter(id => id !== orgId);
                rolesChanged = true;
            }

            if (roles.participant === orgId) {
                // Using deleteField is robust for removing a field completely
                (roles as any).participant = firebase.firestore.FieldValue.delete();
                rolesChanged = true;
            }

            if (rolesChanged) {
                userCleanupNeeded = true;
                const userRef = db.collection('users').doc(user.id);
                userCleanupBatch.update(userRef, { roles: sanitizeDataForFirebase(roles) });
            }
        });
        
        if (userCleanupNeeded) {
            await userCleanupBatch.commit();
        }
    },
};

export default firebaseService;