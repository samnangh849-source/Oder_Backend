
import { useState, useCallback, useMemo, useContext } from 'react';
import { ParsedOrder, FulfillmentStatus } from '../types';
import { WEB_APP_URL } from '../constants';
import { AppContext } from '../context/AppContext';
import { CacheService, CACHE_KEYS } from '../services/cacheService';

export const useFulfillment = (allOrders: ParsedOrder[], onUpdate?: () => void) => {
    const { currentUser } = useContext(AppContext);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const ordersByStatus = useMemo(() => {
        // ... (existing logic)
        const groups = {
            Pending: [] as ParsedOrder[],
            Processing: [] as ParsedOrder[],
            'Ready to Ship': [] as ParsedOrder[],
            Shipped: [] as ParsedOrder[],
            Delivered: [] as ParsedOrder[]
        };

        allOrders.forEach(order => {
            const status = (order.FulfillmentStatus || 'Pending') as FulfillmentStatus;
            if (status === ('Cancelled' as any) || status === 'Scheduled') return;
            if (groups[status as keyof typeof groups]) {
                groups[status as keyof typeof groups].push(order);
            } else if (status !== ('Cancelled' as any)) {
                groups.Pending.push(order);
            }
        });

        return groups;
    }, [allOrders]);

    const updateStatus = useCallback(async (orderId: string, newStatus: FulfillmentStatus, extraData: any = {}) => {
        setLoadingId(orderId);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const headers: HeadersInit = { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const order = allOrders.find(o => o['Order ID'] === orderId);
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    orderId,
                    team: order?.Team || '',
                    userName: currentUser?.UserName || 'System',
                    newData: { 
                        'Fulfillment Status': newStatus,
                        ...extraData
                    }
                })
            });

            if (!response.ok) throw new Error("Failed to update status");

            // Broadcast to Chat
            try {
                const order = allOrders.find(o => o['Order ID'] === orderId);
                if (order) {
                    const id = orderId.substring(0,8);
                    let chatMsg = '';
                    if (newStatus === 'Ready to Ship') chatMsg = `📦 **[PACKED]** កញ្ចប់ #${id} (${order['Customer Name']}) វេចខ្ចប់រួចរាល់ដោយ **${currentUser?.FullName || 'System'}**`;
                    else if (newStatus === 'Shipped') chatMsg = `🚚 **[DISPATCHED]** កញ្ចប់ #${id} (${order['Customer Name']}) ប្រគល់ឱ្យអ្នកដឹករួចរាល់ដោយ **${currentUser?.FullName || 'System'}**`;
                    else if (newStatus === 'Delivered') chatMsg = `✅ **[DELIVERED]** កញ្ចប់ #${id} (${order['Customer Name']}) ដឹកជញ្ជូនជោគជ័យ!`;
                    else if (newStatus === 'Pending') chatMsg = `↩️ **[UNDO]** កញ្ចប់ #${id} ត្រូវបានត្រឡប់ទៅសភាពដើមវិញដោយ **${currentUser?.FullName || 'System'}**`;

                    if (chatMsg) {
                        await fetch(`${WEB_APP_URL}/api/chat/send`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: chatMsg })
                        });
                    }
                }
            } catch (e) { console.warn("Chat broadcast failed", e); }

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Fulfillment update error:", error);
            alert("មិនអាចធ្វើបច្ចុប្បន្នភាពស្ថានភាពបានទេ។ សូមព្យាយាមម្តងទៀត។");
        } finally {
            setLoadingId(null);
        }
    }, [onUpdate, allOrders, currentUser]);

    return {
        ordersByStatus,
        updateStatus,
        loadingId
    };
};
