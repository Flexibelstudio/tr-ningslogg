// utils/firestoreUtils.ts
// Helper function to prepare data for Firestore.
// Recursively removes `undefined` values and keys starting with "VITE_".
export const sanitizeDataForFirebase = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(item => sanitizeDataForFirebase(item));
    }
    if (data instanceof Date) {
        return data;
    }
    if (data !== null && typeof data === 'object') {
        const sanitized: { [key: string]: any } = {};
        for (const key of Object.keys(data)) {
            // Firestore cannot handle 'undefined' values.
            // Also, filter out any keys that start with VITE_ to prevent env vars from leaking.
            if (data[key] !== undefined && !key.startsWith('VITE_')) {
                sanitized[key] = sanitizeDataForFirebase(data[key]);
            }
        }
        return sanitized;
    }
    return data;
};
