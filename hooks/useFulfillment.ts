
import { useState, useCallback, useMemo } from 'react';
import { ParsedOrder, FulfillmentStatus } from '../types';
import { WEB_APP_URL } from '../constants';

export const useFulfillment = (allOrders: ParsedOrder[], onUpdate?: () => void) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const ordersByStatus = useMemo(() => {
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
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Fulfillment update error:", error);
            alert("មិនអាចធ្វើបច្ចុប្បន្នភាពស្ថានភាពបានទេ។ សូមព្យាយាមម្តងទៀត។");
        } finally {
            setLoadingId(null);
        }
    }, [onUpdate]);

    return {
        ordersByStatus,
        updateStatus,
        loadingId
    };
};
