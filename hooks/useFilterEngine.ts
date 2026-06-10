
import { useMemo } from 'react';
import { ParsedOrder, User, AppData, FulfillmentStatus } from '../types';
import { safeParseDate } from '../utils/dateUtils';

export type DateRangePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';

export interface FilterState {
    datePreset: DateRangePreset;
    startDate: string;
    endDate: string;
    team: string;
    user: string;
    paymentStatus: string;
    shippingService: string;
    driver: string;
    product: string;
    bank: string;
    fulfillmentStore: string;
    store: string;
    page: string;
    location: string;
    internalCost: string;
    customerName: string;
    customerSearch: string; // Used for text search
    telegramStatus: string;
    fulfillmentStatus: string;
    isVerified: 'All' | 'Verified' | 'Unverified';
}

export const initialFilterState: FilterState = {
    datePreset: 'this_month',
    startDate: '',
    endDate: '',
    team: '',
    user: '',
    paymentStatus: '',
    shippingService: '',
    driver: '',
    product: '',
    bank: '',
    fulfillmentStore: '',
    store: '',
    page: '',
    location: '',
    internalCost: '',
    customerName: '',
    customerSearch: '',
    telegramStatus: '',
    fulfillmentStatus: '',
    isVerified: 'All'
};

export const isMatch = (fV: string, oV: string, partial = false) => {
    if (!fV || fV === 'all' || fV === 'All') return true;
    const sV = fV.split(',').map(v => v.trim().toLowerCase());
    const v = (oV || '').trim().toLowerCase();
    return partial ? sV.some(sv => v.includes(sv)) : sV.includes(v);
};

export const useFilterEngine = (orders: ParsedOrder[], appData: AppData) => {
    
    const uniqueValues = useMemo(() => {
        const pages = new Set<string>();
        const locations = new Set<string>();
        const shippingMethods = new Set<string>();
        const drivers = new Set<string>();
        const fulfillmentStores = new Set<string>();
        const banks = new Set<string>();
        const costs = new Set<string>();
        const teams = new Set<string>();
        const customerMap = new Map<string, string>();

        (orders || []).forEach(o => {
            if (o.Page) pages.add(o.Page);
            if (o.Location) locations.add(o.Location);
            if (o['Internal Shipping Method']) shippingMethods.add(o['Internal Shipping Method']);
            if (o['Internal Shipping Details']) drivers.add(o['Internal Shipping Details']);
            if (o['Fulfillment Store']) fulfillmentStores.add(o['Fulfillment Store']);
            if (o['Payment Info']) banks.add(o['Payment Info']);
            if (o['Internal Cost'] !== undefined) costs.add(String(o['Internal Cost']));
            if (o.Team) teams.add(o.Team);
            
            if (o['Customer Name']) {
                customerMap.set(o['Customer Name'], o['Customer Phone'] || '');
            }
        });

        const customerOptions = Array.from(customerMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, phone]) => ({
                label: `${name} ${phone ? `(${phone})` : ''}`,
                value: name
            }));

        return {
            pages: Array.from(pages).sort(),
            locations: Array.from(locations).sort(),
            shippingMethods: Array.from(shippingMethods).sort(),
            drivers: Array.from(drivers).sort(),
            fulfillmentStores: Array.from(fulfillmentStores).sort(),
            banks: Array.from(banks).sort(),
            costs: Array.from(costs).sort((a, b) => Number(a) - Number(b)),
            teams: Array.from(teams).sort(),
            customerOptions
        };
    }, [orders]);

    const filterOrders = (ordersToFilter: ParsedOrder[], filters: FilterState, searchQuery: string = '') => {
        // Technical Upgrade: Centralized Date Filtering
        let dateStart: Date | null = null;
        let dateEnd: Date | null = null;

        if (filters.datePreset && filters.datePreset !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            dateEnd = endOfToday;

            switch (filters.datePreset) {
                case 'today': 
                    dateStart = today; 
                    break;
                case 'yesterday':
                    dateStart = new Date(today); 
                    dateStart.setDate(today.getDate() - 1);
                    dateEnd = new Date(today); 
                    dateEnd.setMilliseconds(-1); 
                    break;
                case 'this_week': {
                    const d = now.getDay();
                    dateStart = new Date(today); 
                    dateStart.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
                    break;
                }
                case 'last_week': {
                    const d = now.getDay();
                    const startOfThisWeek = new Date(today);
                    startOfThisWeek.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
                    dateStart = new Date(startOfThisWeek);
                    dateStart.setDate(startOfThisWeek.getDate() - 7);
                    dateEnd = new Date(dateStart);
                    dateEnd.setDate(dateStart.getDate() + 6);
                    dateEnd.setHours(23, 59, 59, 999);
                    break;
                }
                case 'this_month': 
                    dateStart = new Date(now.getFullYear(), now.getMonth(), 1); 
                    break;
                case 'last_month':
                    dateStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    dateEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); 
                    break;
                case 'this_year': 
                    dateStart = new Date(now.getFullYear(), 0, 1); 
                    break;
                case 'last_year':
                    dateStart = new Date(now.getFullYear() - 1, 0, 1);
                    dateEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999); 
                    break;
                case 'custom':
                    if (filters.startDate) dateStart = new Date(filters.startDate + 'T00:00:00');
                    if (filters.endDate) dateEnd = new Date(filters.endDate + 'T23:59:59');
                    break;
            }
        }

        return (ordersToFilter || []).filter(order => {
            // Date Consistency Check
            if (dateStart || dateEnd) {
                if (!order.Timestamp) return false;
                const d = safeParseDate(order.Timestamp);
                if (!d || isNaN(d.getTime())) return false;
                if (dateStart && d < dateStart) return false;
                if (dateEnd && d > dateEnd) return false;
            }

            if (!isMatch(filters.fulfillmentStore, order['Fulfillment Store'] || 'Unassigned')) return false;
            if (filters.store) {
                const pageConfig = appData.pages?.find(p => p.PageName === order.Page);
                if (!isMatch(filters.store, pageConfig?.DefaultStore || '')) return false;
            }
            if (!isMatch(filters.team, order.Team)) return false;
            if (!isMatch(filters.user, order.User || '')) return false;
            if (!isMatch(filters.paymentStatus, order['Payment Status'])) return false;
            if (!isMatch(filters.shippingService, order['Internal Shipping Method'])) return false;
            if (!isMatch(filters.driver, order['Internal Shipping Details'])) return false;
            if (!isMatch(filters.bank, order['Payment Info'])) return false;
            if (!isMatch(filters.page, order.Page)) return false;
            if (!isMatch(filters.location, order.Location, true)) return false;
            if (!isMatch(filters.internalCost, String(order['Internal Cost']))) return false;
            if (!isMatch(filters.fulfillmentStatus, order.FulfillmentStatus)) return false;
            if (!isMatch(filters.customerName, order['Customer Name'])) return false;

            if (filters.customerSearch) {
                const q = filters.customerSearch.toLowerCase();
                if (!(order['Customer Name'] || '').toLowerCase().includes(q) && !(order['Customer Phone'] || '').includes(q)) return false;
            }

            if (filters.product) {
                const sP = filters.product.split(',').map(v => v.trim().toLowerCase());
                if (!order.Products.some(p => sP.includes((p.name || p.ProductName || '').toLowerCase()))) return false;
            }

            if (filters.telegramStatus) {
                const id1 = order['Telegram Message ID 1'];
                const id2 = order['Telegram Message ID 2'];
                const isSent = (id1 && id2) && id1 !== 'CHECKING';
                const s = filters.telegramStatus.split(',').map(v => v.trim());
                if (s.includes('Sent') && !isSent) return false;
                if (s.includes('Not Sent') && isSent) return false;
            }

            if (filters.isVerified !== 'All') {
                const isV = order.IsVerified === 'true' || order.IsVerified === 'A' || order.IsVerified === 'Verified';
                if (filters.isVerified === 'Verified' && !isV) return false;
                if (filters.isVerified === 'Unverified' && isV) return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    order['Order ID'].toLowerCase().includes(q) || 
                    (order['Customer Name'] || '').toLowerCase().includes(q) || 
                    (order['Customer Phone'] || '').includes(q)
                );
            }

            return true;
        });
    };

    return {
        uniqueValues,
        filterOrders
    };
};
