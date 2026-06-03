import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { AppData, ParsedOrder } from '../types';
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
    fetchOrders: (force?: boolean, params?: Record<string, string | number>) => Promise<any>;
    fetchPromotions: () => Promise<void>;
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
        roles: [], permissions: [], orders: [], promotions: []
    });
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());
    const [ordersFetchError, setOrdersFetchError] = useState<'permission_denied' | 'network_error' | null>(null);
    const lastFetchParams = React.useRef<Record<string, string | number>>({});

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
                const sourceData = result.data || result.Data || result;
                if (sourceData && typeof sourceData === 'object' && !Array.isArray(sourceData)) {
                    const mappedData: any = { ...sourceData };
                    Object.keys(sourceData).forEach(key => {
                        const val = sourceData[key];
                        const lowerKey = key.toLowerCase();
                        if (lowerKey === 'rolepermissions') mappedData.permissions = val;
                        if (lowerKey === 'shippingmethods') mappedData.shippingMethods = val;
                        if (lowerKey === 'teampages') mappedData.pages = val;
                        mappedData[lowerKey] = val;
                    });
                    setAppData(prev => ({ ...prev, ...mappedData }));
                    return mappedData;
                }
            }
        } catch (e) {
            console.error("Static data fetch failed", e);
        }
        return null;
    }, [handleUnauthorized]);

    const fetchOrders = useCallback(async (force = false, params?: Record<string, string | number>) => {
        if (!force) setIsOrdersLoading(true);
        else setIsSyncing(true);

        // Remember params if provided, otherwise reuse last ones
        if (params !== undefined) {
            lastFetchParams.current = params;
        }
        const activeParams = lastFetchParams.current;

        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            
            // Build Query String
            const queryParams = new URLSearchParams();
            Object.entries(activeParams).forEach(([key, val]) => {
                if (val !== undefined && val !== null && val !== '') {
                    queryParams.append(key, String(val));
                }
            });
            
            const queryString = queryParams.toString();
            const endpoint = `${WEB_APP_URL}/api/admin/orders${queryString ? `?${queryString}` : ''}`;
            const response = await fetch(endpoint, { headers });

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (response.status === 403) {
                setOrders([]);
                setOrdersFetchError('permission_denied');
                fetchData(true);
                return;
            }

            if (response.ok) {
                const result = await response.json();
                const rawList = result.data || result.orders || result.Data || [];
                if (Array.isArray(rawList)) {
                    const parsedOrders = rawList.map((o: any) => {
                        let products: any[] = [];
                        try {
                            const rawProducts = o['Products (JSON)'] || o.Products;
                            const parsed = typeof rawProducts === 'string' ? JSON.parse(rawProducts) : (rawProducts || []);
                            products = (Array.isArray(parsed) ? parsed : []).map((p: any) => ({
                                ...p,
                                name: p.name || p.productName || p.ProductName || '',
                                quantity: Number(p.quantity ?? p.Quantity ?? 1) || 1,
                                image: p.image || p.imageUrl || p.ImageURL || '',
                                cost: Number(p.cost ?? p.Cost ?? 0),
                                finalPrice: Number(p.finalPrice ?? p.FinalPrice ?? p.price ?? p.Price ?? 0),
                            }));
                        } catch (e) { }
                        return {
                            ...o,
                            Products: products,
                            FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending'),
                            IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A'
                        };
                    });
                    
                    // If it's a paginated response, we might not want to overwrite EVERYTHING 
                    // depending on how the UI uses it. For now, we overwrite.
                    setOrders(parsedOrders);
                    setOrdersFetchError(null);
                    setRefreshTimestamp(Date.now());
                    
                    return {
                        orders: parsedOrders,
                        total: result.total || parsedOrders.length,
                        limit: result.limit,
                        offset: result.offset
                    };
                }
            } else {
                setOrdersFetchError('network_error');
            }
        } catch (e) {
            setOrdersFetchError('network_error');
        } finally {
            setIsOrdersLoading(false);
            setIsSyncing(false);
            setIsGlobalLoading(false);
        }
    }, [handleUnauthorized, fetchData]);

    const fetchPromotions = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const response = await fetch(`${WEB_APP_URL}/api/promotions`, { headers });
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    setAppData(prev => ({ ...prev, promotions: result.data }));
                }
            }
        } catch (e) {
            console.error("Promotions fetch failed", e);
        }
    }, []);

    const refreshData = useCallback(async (): Promise<Record<string, any> | null> => {
        const [staticData] = await Promise.all([fetchData(true), fetchOrders(true), fetchPromotions()]);
        return staticData;
    }, [fetchData, fetchOrders, fetchPromotions]);

    useEffect(() => {
        if (currentUser && ordersFetchError === 'permission_denied') {
            setOrdersFetchError(null);
            fetchOrders();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.Role, currentUser?.Permissions]);

    useEffect(() => {
        if (!currentUser) return;
        const POLLING_INTERVAL = 5 * 60 * 1000;
        const interval = setInterval(() => {
            refreshData();
        }, POLLING_INTERVAL);
        return () => clearInterval(interval);
    }, [currentUser, refreshData]);

    useEffect(() => {
        let timeoutId: any;
        const checkMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            const timeUntilMidnight = tomorrow.getTime() - now.getTime();
            timeoutId = setTimeout(() => {
                setRefreshTimestamp(Date.now());
                refreshData();
                checkMidnight();
            }, timeUntilMidnight + 1000);
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
            fetchData, fetchOrders, fetchPromotions, refreshData
        }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrder = () => useContext(OrderContext);
export const useOrders = useOrder;
