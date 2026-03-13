
export const CACHE_KEYS = {
    APP_DATA: 'appDataCache',
    ALL_ORDERS: 'allOrdersCache',
    SESSION: 'orderAppSession',
    CHAT_HISTORY: 'chatHistoryCache',
    GEOJSON: 'cambodiaGeoJsonCache'
};

// Default expiration set to 15 days (15 * 24 * 60 * 60 * 1000)
const DEFAULT_EXPIRY = 15 * 24 * 60 * 60 * 1000; 

// IndexedDB Configuration
const DB_NAME = 'OrderSystemDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

// Initialize DB Promise
const dbPromise = typeof indexedDB !== 'undefined' ? new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
        }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
}) : Promise.reject("IndexedDB not supported");

export const CacheService = {
    /**
     * Save data to IndexedDB with timestamp and expiry duration
     * @param key Storage key
     * @param data Data to store
     * @param expiry Duration in milliseconds (default 48h)
     */
    set: async (key: string, data: any, expiry: number = DEFAULT_EXPIRY) => {
        try {
            const db = await dbPromise;
            const payload = {
                value: data,
                timestamp: Date.now(),
                expiry: expiry
            };
            
            return new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(payload, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn("Cache write failed:", e);
        }
    },

    /**
     * Retrieve data from IndexedDB if valid (not expired)
     * @param key Storage key
     * @returns Data or null if expired/not found
     */
    get: async <T>(key: string): Promise<T | null> => {
        try {
            const db = await dbPromise;
            return new Promise<T | null>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                
                req.onsuccess = () => {
                    const result = req.result;
                    if (!result) {
                        resolve(null);
                        return;
                    }
                    
                    const now = Date.now();
                    // Check if expired
                    if (now - result.timestamp > result.expiry) {
                        // Expired - delete it asynchronously
                        const delTx = db.transaction(STORE_NAME, 'readwrite');
                        delTx.objectStore(STORE_NAME).delete(key);
                        resolve(null);
                    } else {
                        resolve(result.value as T);
                    }
                };
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn("Cache read failed:", e);
            return null;
        }
    },

    /**
     * Remove specific key from storage
     */
    remove: async (key: string) => {
        try {
            const db = await dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
        } catch (e) {
            console.warn("Cache remove failed:", e);
        }
    },

    /**
     * Clear all app data from storage
     */
    clearAll: async () => {
        try {
            const db = await dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
        } catch (e) {
            console.warn("Cache clear failed:", e);
        }
    }
};
