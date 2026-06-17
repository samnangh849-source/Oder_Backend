
import React, { useState } from 'react';
import { ParsedOrder } from '../../types';
import Spinner from '../common/Spinner';
import OrdersList from '../orders/OrdersList';
import EditOrderPage from '../../pages/EditOrderPage';

interface MyOrdersViewProps {
    orders: ParsedOrder[];
    loading: boolean;
    selectedTeam: string;
    onBack: () => void;
    onRefresh: () => void;
}

const MyOrdersView: React.FC<MyOrdersViewProps> = ({ 
    orders, 
    loading, 
    selectedTeam, 
    onBack, 
    onRefresh 
}) => {
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

    // Edit Mode
    if (editingOrderId) {
        const orderToEdit = orders.find(o => o['Order ID'] === editingOrderId);
        if (orderToEdit) {
            return (
                <EditOrderPage 
                    order={orderToEdit}
                    onSaveSuccess={() => {
                        setEditingOrderId(null);
                        onRefresh(); // Refresh Data after edit
                    }}
                    onCancel={() => setEditingOrderId(null)}
                />
            );
        } else {
            // Fallback if order not found
            setEditingOrderId(null);
        }
    }

    return (
        <div className="w-full">
            <div className="flex items-center gap-4 mb-6 px-2">
                <button onClick={onBack} className="bg-gray-800 p-3 rounded-2xl border border-gray-700 hover:bg-gray-700 active:scale-95 transition-all">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <div>
                    <h1 className="text-xl font-black text-white uppercase tracking-tight">My Orders</h1>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{selectedTeam}</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : (
                <OrdersList 
                    orders={orders} 
                    showActions={true} // Enable actions
                    onEdit={(o) => setEditingOrderId(o['Order ID'])} // Pass Edit Handler
                    visibleColumns={new Set(['orderId', 'date', 'customerName', 'total', 'status', 'actions'])} // Ensure 'actions' is visible
                />
            )}
        </div>
    );
};

export default MyOrdersView;
