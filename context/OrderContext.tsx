import React, { createContext, useState, useContext, useCallback } from 'react';
import { AppData, ParsedOrder } from '../types';

interface OrderContextType {
    orders: ParsedOrder[];
    setOrders: React.Dispatch<React.SetStateAction<ParsedOrder[]>>;
    appData: AppData;
    setAppData: React.Dispatch<React.SetStateAction<AppData>>;
    isOrdersLoading: boolean;
    setIsOrdersLoading: (loading: boolean) => void;
    isGlobalLoading: boolean;
    setIsGlobalLoading: (loading: boolean) => void;
    refreshTimestamp: number;
    setRefreshTimestamp: React.Dispatch<React.SetStateAction<number>>;
}

const OrderContext = createContext<OrderContextType>({} as OrderContextType);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [appData, setAppData] = useState<AppData>({
        users: [], products: [], pages: [], locations: [],
        shippingMethods: [], drivers: [], bankAccounts: [],
        phoneCarriers: [], colors: [], stores: [], settings: [], targets: [],
        inventory: [], stockTransfers: [], returns: [],
        roles: [], permissions: [], orders: []
    });
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());

    return (
        <OrderContext.Provider value={{
            orders, setOrders, appData, setAppData,
            isOrdersLoading, setIsOrdersLoading,
            isGlobalLoading, setIsGlobalLoading,
            refreshTimestamp, setRefreshTimestamp
        }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrders = () => useContext(OrderContext);
