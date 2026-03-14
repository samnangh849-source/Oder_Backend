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
    fetchData: (force?: boolean) => Promise<void>;
    fetchOrders: (force?: boolean) => Promise<void>;
    refreshData: () => Promise<void>;
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

    const fetchData = useCallback(async (force = false) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            const response = await fetch(`${WEB_APP_URL}/api/static-data`, { headers });
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    const mappedData = { ...result.data };
                    // Fix: Backend sends rolePermissions, Frontend expects permissions
                    if (mappedData.rolePermissions) {
                        mappedData.permissions = mappedData.rolePermissions;
                    }
                    setAppData(prev => ({ ...prev, ...mappedData }));
                }
            }
        } catch (e) {
            console.error("Static data fetch failed", e);
        }
    }, [handleUnauthorized]);

    const fetchOrders = useCallback(async (force = false) => {
        if (!force) setIsOrdersLoading(true);
        else setIsSyncing(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

            // Determine endpoint based on role to avoid unnecessary 403s
            const isAdmin = currentUser?.IsSystemAdmin || (currentUser?.Role && currentUser.Role.toLowerCase() === 'admin');
            const endpoint = isAdmin ? `${WEB_APP_URL}/api/admin/orders` : `${WEB_APP_URL}/api/orders`;

            const response = await fetch(endpoint, { headers });
            
            if (response.status === 401) return;

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    const parsedOrders = (result.data || []).map((o: any) => {
                        let products = [];
                        try {
                            const rawProducts = o['Products (JSON)'] || o.Products;
                            products = typeof rawProducts === 'string' ? JSON.parse(rawProducts) : (rawProducts || []);
                        } catch (e) { console.warn("Failed to parse products for order", o['Order ID']); }
                        return { ...o, Products: products };
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
    }, [handleUnauthorized]);

    const refreshData = useCallback(async () => {
        await Promise.all([fetchData(true), fetchOrders(true)]);
    }, [fetchData, fetchOrders]);

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
