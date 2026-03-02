
import { useState, useCallback, useMemo, useContext } from 'react';
import { ParsedOrder, FulfillmentStatus } from '../types';
import { WEB_APP_URL } from '../constants';
import { AppContext } from '../context/AppContext';

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
            if (status === ('Cancelled' as any)) return;
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
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'AllOrders',
                    primaryKey: { 'Order ID': orderId },
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
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userName: 'System', type: 'text', content: chatMsg, MessageType: 'text', Content: chatMsg })
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
