import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { AppData, ParsedOrder, User } from '../types';
import { WEB_APP_URL } from '../constants';
import { CacheService, CACHE_KEYS } from '../services/cacheService';
import { useUser } from './UserContext';

interface OrderContextType {
    orders: ParsedOrder[];
    setOrders: React.Dispatch<React.SetStateAction<ParsedOrder[]>>;
    ordersFetchError: 'permission_denied' | 'network_error' | null;
    appData: AppData;
    setAppData: React.Dispatch<React.SetStateAction<AppData>>;
    isOrdersLoading: boolean;
    isSyncing: boolean; // For polling background sync
    setIsOrdersLoading: (loading: boolean) => void;
    isGlobalLoading: boolean;
    setIsGlobalLoading: (loading: boolean) => void;
    refreshTimestamp: number;
    setRefreshTimestamp: React.Dispatch<React.SetStateAction<number>>;
    fetchData: (force?: boolean) => Promise<Record<string, any> | null>;
    fetchOrders: (force?: boolean) => Promise<void>;
    refreshData: () => Promise<Record<string, any> | null>;
}

const OrderContext = createContext<OrderContextType>({} as OrderContextType);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useUser();
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [appData, setAppData] = useState<AppData>({
        users: [], products: [], pages: [], locations: [],
        shippingMethods: [], drivers: [], bankAccounts: [],
        phoneCarriers: [], colors: [], stores: [], settings: [], targets: [],
        inventory: [], stockTransfers: [], returns: [],
        roles: [], permissions: [], orders: []
    });
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());
    const [ordersFetchError, setOrdersFetchError] = useState<'permission_denied' | 'network_error' | null>(null);

    const handleUnauthorized = useCallback(() => {
        localStorage.removeItem('token');
        CacheService.remove(CACHE_KEYS.SESSION);
        window.location.href = window.location.origin + window.location.pathname + '?view=login';
    }, []);

    const fetchData = useCallback(async (force = false): Promise<Record<string, any> | null> => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            // Retry on 503 (DB still initializing)
            let response: Response | null = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                const url = force
                    ? `${WEB_APP_URL}/api/static-data?_t=${Date.now()}`
                    : `${WEB_APP_URL}/api/static-data`;
                response = await fetch(url, { headers, cache: 'no-store' });
                if (response.status !== 503) break;
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            }
            if (!response) return null;

            // Handle 401 Unauthorized globally
            if (response.status === 401) {
                console.warn("Session expired during static-data fetch. Redirecting...");
                handleUnauthorized();
                return null;
            }

            if (response.ok) {
                const result = await response.json();
                // Accept both 'success' and 'ok' status from backend
                const sourceData = result.data || result.Data || result;
                if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
                    const mappedData: any = { ...sourceData };

                    Object.keys(sourceData).forEach(key => {
                        const val = sourceData[key];
                        const lowerKey = key.toLowerCase();

                        // Ensure common keys are available in camelCase/lowercase as expected by frontend
                        if (lowerKey === 'rolepermissions') mappedData.permissions = val;
                        if (lowerKey === 'shippingmethods') mappedData.shippingMethods = val;
                        if (lowerKey === 'teampages') mappedData.pages = val;

                        // Also provide a completely lowercase version for each
                        mappedData[lowerKey] = val;
                    });

                    setAppData(prev => ({ ...prev, ...mappedData }));
                    return mappedData;
                } else {
                    console.warn("[fetchData] Unexpected response format:", result);
                }
            } else {
                console.error("[fetchData] HTTP error:", response.status, response.statusText);
            }
        } catch (e) {
            console.error("Static data fetch failed", e);
        }
        return null;
    }, [handleUnauthorized]);

    const fetchOrders = useCallback(async (force = false) => {
        if (!force) setIsOrdersLoading(true);
        else setIsSyncing(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            const endpoint = `${WEB_APP_URL}/api/admin/orders`;

            const response = await fetch(endpoint, { headers });

            // Handle 401 Unauthorized globally
            if (response.status === 401) {
                console.warn("Session expired during orders fetch. Redirecting...");
                handleUnauthorized();
                return;
            }

            // Handle 403 Permission Denied — user lacks 'view_order_list' permission in DB.
            // Always refresh static data so the frontend permission state syncs with the real DB state.
            // This resolves the split-brain case where the frontend cache shows permission=enabled
            // while the DB actually has it disabled (or the row doesn't exist yet).
            if (response.status === 403) {
                console.warn("[fetchOrders] 403 Forbidden — role missing 'view_order_list' permission in database.");
                setOrders([]);
                setOrdersFetchError('permission_denied');
                fetchData(true); // Resync frontend permissions with DB (non-blocking)
                return;
            }

            if (response.ok) {
                const result = await response.json();
                // Accept both 'success' and 'ok' status from backend
                const rawList = result.data || result.orders || result.Data || [];
                if (Array.isArray(rawList)) {
                    const parsedOrders = rawList.map((o: any) => {
                        let products: any[] = [];
                        try {
                            const rawProducts = o['Products (JSON)'] || o.Products;
                            const parsed = typeof rawProducts === 'string' ? JSON.parse(rawProducts) : (rawProducts || []);
                            products = (Array.isArray(parsed) ? parsed : []).map((p: any) => ({
                                ...p,
                                name:     p.name     || p.productName || p.ProductName || '',
                                quantity: Number(p.quantity ?? p.Quantity ?? 1) || 1,
                                image:    p.image    || p.imageUrl    || p.ImageURL   || '',
                                cost:     Number(p.cost ?? p.Cost ?? 0),
                                finalPrice: Number(p.finalPrice ?? p.FinalPrice ?? p.price ?? p.Price ?? 0),
                            }));
                        } catch (e) { console.warn("Failed to parse products for order", o['Order ID']); }
                        return {
                            ...o,
                            Products: products,
                            FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending'),
                            IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A'
                        };
                    });
                    setOrders(parsedOrders);
                    setOrdersFetchError(null);
                    setRefreshTimestamp(Date.now());
                } else {
                    console.warn("[fetchOrders] Unexpected response format:", result);
                }
            } else {
                console.error("[fetchOrders] HTTP error:", response.status, response.statusText);
                setOrdersFetchError('network_error');
            }
        } catch (e) {
            console.error("Orders fetch failed", e);
            setOrdersFetchError('network_error');
        } finally {
            setIsOrdersLoading(false);
            setIsSyncing(false);
            setIsGlobalLoading(false);
        }
    }, [handleUnauthorized, currentUser]);

    const refreshData = useCallback(async (): Promise<Record<string, any> | null> => {
        const [staticData] = await Promise.all([fetchData(true), fetchOrders(true)]);
        return staticData;
    }, [fetchData, fetchOrders]);

    // When the current user's permissions change (admin granted access, or login completed),
    // clear any stale permission_denied error AND immediately retry fetching orders.
    // Without the explicit retry, the App.tsx [currentUser] effect only fires when
    // currentUser's reference changes — which the JSON-equality guard in the permission
    // refresh effect may prevent when permissions were already identical.
    useEffect(() => {
        if (currentUser && ordersFetchError === 'permission_denied') {
            setOrdersFetchError(null);
            fetchOrders();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.Role, currentUser?.Permissions]);

    // --- Background Polling (Every 5 minutes) ---
    useEffect(() => {
        if (!currentUser) return;
        
        const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
        const interval = setInterval(() => {
            console.log("[OrderContext] Background polling triggered...");
            refreshData();
        }, POLLING_INTERVAL);

        return () => clearInterval(interval);
    }, [currentUser, refreshData]);

    // --- Midnight Transition Watcher ---
    // Updates refreshTimestamp when the day changes to force dynamic date filters (like "Today") to recalculate
    useEffect(() => {
        let timeoutId: any;
        
        const checkMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const timeUntilMidnight = tomorrow.getTime() - now.getTime();
            
            timeoutId = setTimeout(() => {
                console.log("[OrderContext] Midnight transition detected. Refreshing data...");
                setRefreshTimestamp(Date.now());
                refreshData();
                checkMidnight(); // Re-schedule for next day
            }, timeUntilMidnight + 1000); // Buffer of 1s
        };
        
        checkMidnight();
        return () => clearTimeout(timeoutId);
    }, [refreshData]);

    return (
        <OrderContext.Provider value={{
            orders, setOrders, appData, setAppData,
            ordersFetchError,
            isOrdersLoading, isSyncing, setIsOrdersLoading,
            isGlobalLoading, setIsGlobalLoading,
            refreshTimestamp, setRefreshTimestamp,
            fetchData, fetchOrders, refreshData
        }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrder = () => useContext(OrderContext);
export const useOrders = useOrder; // Alias for compatibility
