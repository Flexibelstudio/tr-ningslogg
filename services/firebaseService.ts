import dataService from './dataService';
import { MockDB, OrganizationData } from '../types';
import { db, firebaseConfig } from '../firebaseConfig';
import { collection, doc, getDoc, getDocs, setDoc, query, writeBatch, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';

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

const firebaseService = {
    isOffline: () => isOffline,
    getError: () => initializationError,

    get<K extends keyof MockDB>(key: K): Promise<MockDB[K]> {
        if (isOffline) {
            return Promise.resolve(dataService.get(key));
        } else {
            // This method is primarily for top-level collections like 'users' and 'organizations'
            return (async () => {
                const collectionRef = collection(db, key);
                const snapshot = await getDocs(collectionRef);
                return snapshot.docs.map(d => d.data()) as MockDB[K];
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

    async getCollection<K extends keyof OrganizationData>(orgId: string, collectionKey: K): Promise<OrganizationData[K]> {
        if (isOffline) {
            return Promise.resolve(dataService.getOrgData(orgId)?.[collectionKey] || [] as any);
        }

        const collectionRef = collection(db, 'organizations', orgId, collectionKey as string);
        const snapshot = await getDocs(collectionRef);
        
        // Handle single-document collections (which are stored as objects in mock data)
        const singleDocKeys: (keyof OrganizationData)[] = ['leaderboardSettings', 'lastFlowViewTimestamp', 'weeklyHighlightSettings', 'integrationSettings'];
        if (singleDocKeys.includes(collectionKey)) {
             if (snapshot.docs.length > 0) {
                return snapshot.docs[0].data() as OrganizationData[K];
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

        const collectionRef = collection(db, 'organizations', orgId, collectionKey as string);
        const batch = writeBatch(db);

        const snapshot = await getDocs(query(collectionRef));
        snapshot.docs.forEach(document => {
            batch.delete(document.ref);
        });

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                const { id, ...itemData } = item;
                const docRef = doc(collectionRef, id || crypto.randomUUID());
                batch.set(docRef, itemData);
            });
        } else if (typeof data === 'object' && data !== null) {
            // Handle single-document objects
            const docRef = doc(collectionRef, 'settings'); // Use a consistent ID for single-doc collections
            batch.set(docRef, data);
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

        const docRef = doc(db, 'organizations', orgId, collectionKey as string, docId);
        const finalData: { [key: string]: any } = { ...dataToUpdate, lastUpdated: new Date().toISOString() };
        delete finalData.id; // Do not write the ID field into the document data

        // Convert null values to Firebase's deleteField sentinel
        for (const key in finalData) {
            if (finalData[key] === null) {
                finalData[key] = deleteField();
            }
        }
        await setDoc(docRef, finalData, { merge: true });
    },
};

export default firebaseService;