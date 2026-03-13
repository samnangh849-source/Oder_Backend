// services/dataWorker.ts
export {};

self.onmessage = (e: MessageEvent) => {
    const { action, payload } = e.data;

    if (action === 'parseOrders') {
        const { rawData } = payload;
        
        try {
            const parsed = rawData.map((o: any) => {
                let products = [];
                if (o['Products (JSON)']) {
                    try {
                        products = JSON.parse(o['Products (JSON)']);
                    } catch (e) {
                        console.error("Worker: Failed to parse products JSON for order", o['Order ID']);
                    }
                }
                
                return { 
                    ...o, 
                    Products: products, 
                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending')
                };
            });

            self.postMessage({ action: 'parseOrdersComplete', payload: { parsed } });
        } catch (error) {
            self.postMessage({ action: 'error', payload: { message: 'Failed to parse orders in worker' } });
        }
    }
};
