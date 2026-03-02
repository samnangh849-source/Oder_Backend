import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder, FulfillmentStatus } from '@/types';
import FulfillmentDashboard from '@/pages/FulfillmentDashboard';
import PackagingView from '@/pages/PackagingView';
import DriverDeliveryView from '@/pages/DriverDeliveryView';
import InventoryManagement from '@/components/admin/InventoryManagement';

const FulfillmentPage: React.FC = () => {
    const { refreshTimestamp, setMobilePageTitle, appData } = useContext(AppContext);
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSubView, setActiveSubView] = useState<'dashboard' | 'packaging' | 'delivery' | 'inventory'>('dashboard');

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                // Fetch 30 days of data to ensure we see all recent pending/active orders
                const response = await fetch(`${WEB_APP_URL}/api/admin/all-orders?days=30`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success') {
                        const rawData = Array.isArray(result.data) ? result.data : [];
                        const parsed = rawData
                            .filter((o: any) => o !== null && o['Order ID'] !== 'Opening_Balance')
                            .map(o => {
                                let products = [];
                                try { if (o['Products (JSON)']) products = JSON.parse(o['Products (JSON)']); } catch(e) {}
                                
                                // Normalize product fields
                                const normalizedProducts = Array.isArray(products) ? products.map((p: any) => {
                                    let img = [p.image, p.ImageURL, p.Image].find(val => val && val !== 'N/A' && val !== 'null') || '';
                                    
                                    // Fallback to Master Product image if missing
                                    if (!img && appData.products) {
                                        const masterProd = appData.products.find(mp => mp.ProductName === p.name);
                                        if (masterProd && masterProd.ImageURL && masterProd.ImageURL !== 'N/A') {
                                            img = masterProd.ImageURL;
                                        }
                                    }

                                    return { ...p, image: img };
                                }) : [];

                                return { 
                                    ...o, 
                                    Products: normalizedProducts, 
                                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
                                };
                            });
                        setOrders(parsed);
                    }
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchOrders();
    }, [refreshTimestamp, appData.products]);

    if (loading && orders.length === 0) {
        return <div className="flex h-screen items-center justify-center bg-gray-950"><Spinner size="lg" /></div>;
    }

    return (
        <div className="flex flex-col min-h-[calc(100vh-120px)] relative">
            {/* Content Area */}
            <div className="flex-grow pb-28 animate-fade-in px-1">
                {activeSubView === 'dashboard' && <FulfillmentDashboard orders={orders} />}
                {activeSubView === 'packaging' && <PackagingView orders={orders} />}
                {activeSubView === 'delivery' && <DriverDeliveryView />}
                {activeSubView === 'inventory' && <InventoryManagement />}
            </div>

            {/* Premium Floating Bottom Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-[70] px-4 pb-6 pointer-events-none">
                <div className="max-w-md mx-auto bg-[#0f172a]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-around pointer-events-auto ring-1 ring-white/5">
                    <button 
                        onClick={() => setActiveSubView('dashboard')}
                        className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-[1.8rem] transition-all duration-300 ${activeSubView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 scale-105' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em]">Hub</span>
                    </button>
                    <button 
                        onClick={() => setActiveSubView('packaging')}
                        className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-[1.8rem] transition-all duration-300 ${activeSubView === 'packaging' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 scale-105' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em]">Pack</span>
                    </button>
                    <button 
                        onClick={() => setActiveSubView('delivery')}
                        className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-[1.8rem] transition-all duration-300 ${activeSubView === 'delivery' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40 scale-105' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em]">Ship</span>
                    </button>
                    <button 
                        onClick={() => setActiveSubView('inventory')}
                        className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-[1.8rem] transition-all duration-300 ${activeSubView === 'inventory' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 scale-105' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em]">Stock</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FulfillmentPage;