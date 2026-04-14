import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { AppData, ParsedOrder, User } from '../types';
import { WEB_APP_URL } from '../constants';
import { CacheService, CACHE_KEYS } from '../services/cacheService';
import { useUser } from './UserContext';

interface OrderContextType {
    orders: ParsedOrder[];
    setOrders: React.Dispatch<React.SetStateAction<ParsedOrder[]>>;
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
                response = await fetch(`${WEB_APP_URL}/api/static-data`, { headers });
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
                if (result.status === 'success') {
                    // Map data while keeping original casing AND providing lowercase/aliased versions for consistency
                    const mappedData: any = { ...result.data };

                    if (result.data && typeof result.data === 'object') {
                        Object.keys(result.data).forEach(key => {
                            const val = result.data[key];
                            const lowerKey = key.toLowerCase();

                            // Ensure common keys are available in camelCase/lowercase as expected by frontend
                            if (lowerKey === 'rolepermissions') mappedData.permissions = val;
                            if (lowerKey === 'shippingmethods') mappedData.shippingMethods = val;
                            if (lowerKey === 'teampages') mappedData.pages = val;

                            // Also provide a completely lowercase version for each
                            mappedData[lowerKey] = val;
                        });
                    }

                    setAppData(prev => ({ ...prev, ...mappedData }));
                    return mappedData;
                }
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

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    const parsedOrders = (result.data || []).map((o: any) => {
                        let products: any[] = [];
                        try {
                            const rawProducts = o['Products (JSON)'] || o.Products;
                            const parsed = typeof rawProducts === 'string' ? JSON.parse(rawProducts) : (rawProducts || []);
                            // Normalize product fields — different code paths and older data may use
                            // productName/ProductName instead of name, Quantity instead of quantity, etc.
                            // The checklist and all downstream UI use only the canonical field names.
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
                    setRefreshTimestamp(Date.now());
                }
            }
        } catch (e) {
            console.error("Orders fetch failed", e);
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
