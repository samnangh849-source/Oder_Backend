import { WEB_APP_URL } from '../constants';
import { UserActivityLog, EditLog } from '../types';
import { CacheService, CACHE_KEYS } from './cacheService';

const getAuthHeaders = async () => {
    const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.token || ''}`
    };
};

// Function to log general user activity
export const logUserActivity = async (user: string, action: string, details: string) => {
    try {
        const headers = await getAuthHeaders();
        await fetch(`${WEB_APP_URL}/api/admin/add-row`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'UserActivityLogs',
                newData: {
                    Timestamp: new Date().toISOString(),
                    User: user,
                    Action: action,
                    Details: details
                }
            })
        });
    } catch (error) {
        // Silently fail
    }
};

// Function to log specific edits to orders
export const logOrderEdit = async (orderId: string, user: string, field: string, oldValue: string, newValue: string) => {
    if (!field) return; 

    try {
        const headers = await getAuthHeaders();
        await fetch(`${WEB_APP_URL}/api/admin/add-row`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sheetName: 'EditLogs',
                newData: {
                    Timestamp: new Date().toISOString(),
                    OrderID: orderId,
                    Requester: user,
                    "Field Changed": field,
                    "Old Value": oldValue,
                    "New Value": newValue
                }
            })
        });
    } catch (error) {
        console.warn("[Audit] Failed to log edit:", error);
    }
};

// --- Fetch Logs ---
export const fetchAuditLogs = async (type: 'activity' | 'edit'): Promise<UserActivityLog[] | EditLog[]> => {
    try {
        const headers = await getAuthHeaders();
        // Since logs are now just static data from DB, we can get them from static-data or specific endpoint if added
        // For now, let's assume static-data is refreshed. 
        // If specific log endpoints are added to Go, we use them here.
        // The Go backend handleGetStaticData returns editLogs and actLogs.
        const response = await fetch(`${WEB_APP_URL}/api/static-data`, { headers });
        const result = await response.json();
        if (result.status === 'success') {
            return type === 'activity' ? result.data.actLogs : result.data.editLogs;
        }
        return [];
    } catch (error) {
        console.warn("[Audit] Data unavailable:", error);
        return [];
    }
};
