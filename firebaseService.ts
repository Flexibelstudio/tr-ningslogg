// services/firebaseService.ts
import { 
    MockDB, OrganizationData, Organization, User 
} from '../types';
import dataService, { createInitialOrgData } from './dataService';
import { db, firebaseConfig, auth } from '../firebaseConfig';
import firebase from 'firebase/compat/app';


let isOffline = false;
let initializationError: string | null = null;

// The check for initialized apps is now the single source of truth.
// FIX: Replaced `firebase.getApps().length` with `firebase.apps.length` for v8 compat.
if (firebase.apps.length === 0) {
    const errorMsg = "Firebase initialization failed or was skipped. Running in offline/mock data mode.";
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
            return (async () => {
                if (!db) throw new Error("Firestore is not initialized.");
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
        if (!db) throw new Error("Firestore is not initialized.");
        const userRef = db.collection('users').doc(userId);
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
    
        if (!auth || !db) {
            throw new Error("Firebase Auth or Firestore is not initialized.");
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
            approvalStatus: 'pending' as const,
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
            termsAcceptedTimestamp: new Date().toISOString(),
        };

        const batch = db.batch();
        const participantRef = db.collection('organizations').doc(orgId).collection('participantDirectory').doc(firebaseUser.uid);
        const userRef = db.collection('users').doc(firebaseUser.uid);
        batch.set(participantRef, sanitizeDataForFirebase(newParticipantProfile));
        batch.set(userRef, sanitizeDataForFirebase(newUserDoc));
        
        try {
            await batch.commit();
            await auth.signOut();
        } catch (error) {
            console.error("Firestore write failed during registration. Deleting orphaned auth user.", error);
            try {
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
            return Promise.resolve(createInitialOrgData('offline-fallback'));
        }
        if (!db) throw new Error("Firestore is not initialized.");

        const collectionKeys: (keyof OrganizationData)[] = [
            'participantDirectory', 'workouts', 'workoutLogs', 'participantGoals',
            'generalActivityLogs', 'goalCompletionLogs', 'coachNotes', 'userStrengthStats',
            'userConditioningStatsHistory', 'participantPhysiqueHistory', 'participantMentalWellbeing',
            'participantGamificationStats', 'clubMemberships', 'leaderboardSettings', 'coachEvents',
            'connections', 'lastFlowViewTimestamp', 'locations', 'staffMembers', 'memberships',
            'weeklyHighlightSettings', 'oneOnOneSessions', 'workoutCategories', 'staffAvailability',
            'integrationSettings', 'groupClassDefinitions', 'groupClassSchedules', 'participantBookings', 'branding',
            'leads', 'prospectIntroCalls'
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
        data: any
    ): Promise<void> {
        if (isOffline) {
            dataService.setOrgData(orgId, (prev) => {
                const collection = prev[collectionKey] as any[];
                return { ...prev, [collectionKey]: [...collection, data] };
            });
            return Promise.resolve();
        }
        if (!db) throw new Error("Firestore is not initialized.");
        const { id, ...itemData } = data;
        if (!id) {
            throw new Error("Document data must have an 'id' property to be added.");
        }
        const docRef = db.collection('organizations').doc(orgId).collection(collectionKey as string