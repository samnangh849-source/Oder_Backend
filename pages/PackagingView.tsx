import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import FastPackModal from '@/components/admin/FastPackModal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

const PackagingView: React.FC = () => {
    const { appData, refreshData, setMobilePageTitle, previewImage: showFullImage } = useContext(AppContext);
    
    // Derived raw list
    const allOrders = useMemo(() => {
        const rawData = Array.isArray(appData.orders) ? appData.orders : [];
        return rawData
            .filter((o: any) => o !== null && o['Order ID'] !== 'Opening_Balance')
            .map(o => {
                let products = [];
                try { if (o['Products (JSON)']) products = JSON.parse(o['Products (JSON)']); } catch(e) {}
                return { 
                    ...o, 
                    Products: products, 
                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
                };
            }) as ParsedOrder[];
    }, [appData.orders]);

    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

    useEffect(() => {
        setMobilePageTitle('PACKING STATION');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle]);

    // Grouping pending orders by date created
    const groupedOrders = useMemo(() => {
        const filtered = allOrders.filter(o => o.FulfillmentStatus === activeTab && o.FulfillmentStatus !== 'Cancelled').sort((a, b) => {
            return b['Order ID'].localeCompare(a['Order ID']);
        });

        if (activeTab === 'Pending') {
            const groups: { [date: string]: ParsedOrder[] } = {};
            filtered.forEach(order => {
                // Extracting date assuming 'Timestamp' or 'Date' exists, fallback to 'Unknown Date'
                const dateStr = order.Timestamp ? new Date(order.Timestamp).toLocaleDateString('km-KH') : 'ថ្ងៃនេះ';
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(order);
            });
            return groups;
        }
        
        return { 'All': filtered };
    }, [allOrders, activeTab]);

    const handleAction = async (order: ParsedOrder, newStatus: string) => {
        setLoadingActionId(order['Order ID']);
        try {
            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'AllOrders',
                    primaryKey: { 'Order ID': order['Order ID'] },
                    newData: { 
                        'Fulfillment Status': newStatus,
                        ...(newStatus === 'Shipped' ? { 'Dispatched Time': new Date().toLocaleString('km-KH') } : {})
                    }
                })
            });

            if (!updateRes.ok) throw new Error("Status update failed");
            refreshData(); 
        } catch (error) {
            console.error("Action error:", error);
            alert("បរាជ័យក្នុងការធ្វើបច្ចុប្បន្នភាព។ សូមព្យាយាមម្ដងទៀត។");
        } finally {
            setLoadingActionId(null);
        }
    };

    const renderOrderCard = (order: ParsedOrder) => (
        <div key={order['Order ID']} className="bg-[#1e293b]/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            {loadingActionId === order['Order ID'] && (
                <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm rounded-[2rem]">
                    <Spinner />
                </div>
            )}
            
            <div className="flex justify-between items-start">
                <div className="min-w-0">
                    <h3 className="text-white font-black text-lg truncate">{order['Customer Name']}</h3>
                    <p className="text-blue-400 font-mono text-xs font-bold">{order['Customer Phone']}</p>
                    <p className="text-gray-500 text-[10px] mt-1 italic font-bold">#{order['Order ID'].substring(0,8)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="bg-white/5 px-2 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400 border border-white/10">
                        {order.Products.length} Items
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">{order['Internal Shipping Method']}</span>
                </div>
            </div>

            <div className="bg-black/30 rounded-2xl p-3 border border-white/5 flex gap-2 overflow-x-auto custom-scrollbar">
                {order.Products.map((p, idx) => (
                    <div key={idx} className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-900 border border-gray-800 cursor-pointer hover:border-blue-500/50" onClick={() => showFullImage(convertGoogleDriveUrl(p.image))}>
                        <img src={convertGoogleDriveUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-2">
                {activeTab === 'Pending' && (
                    <button 
                        onClick={() => setPackingOrder(order)}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ចាប់ផ្ដើមវេចខ្ចប់
                    </button>
                )}
                {activeTab === 'Ready to Ship' && (
                    <button 
                        onClick={() => handleAction(order, 'Shipped')}
                        className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-amber-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        ប្រគល់អោយអ្នកដឹករួចរាល់
                    </button>
                )}
                {activeTab === 'Shipped' && (
                    <div className="w-full py-3 bg-gray-800/50 text-emerald-500 border border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex justify-center items-center gap-2 cursor-not-allowed">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        បានបញ្ចេញរួចរាល់
                    </div>
                )}
            </div>
        </div>
    );

    const hasOrders = Object.values(groupedOrders).some(list => list.length > 0);

    return (
        <div className="space-y-6 pb-24 animate-fade-in px-4 lg:px-8">
            {/* 4 Steps Navigation (Visualizing 4 steps, Step 2 is modal) */}
            <div className="flex bg-black/40 p-1.5 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar max-w-2xl mx-auto shadow-inner gap-1">
                {[
                    { id: 'Pending', label: '1. រង់ចាំខ្ចប់', icon: '📥' },
                    { id: 'Ready to Ship', label: '3. ខ្ចប់រួច', icon: '📦' },
                    { id: 'Shipped', label: '4. បានបញ្ចេញ', icon: '🚚' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 min-w-[120px] px-4 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 relative ${activeTab === tab.id ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <span className="text-lg">{tab.icon}</span>
                        <span>{tab.label}</span>
                        {activeTab === tab.id && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>}
                    </button>
                ))}
            </div>

            {/* Live Update Indicator */}
            {activeTab === 'Pending' && (
                <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Live Auto-Update</span>
                    </div>
                </div>
            )}

            {/* Content List */}
            {!hasOrders ? (
                <div className="py-20 text-center bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4">
                    <span className="text-4xl opacity-50">📭</span>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">មិនមានកញ្ចប់ឥវ៉ាន់ទេ</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedOrders).map(([date, orders]) => (
                        orders.length > 0 && (
                            <div key={date} className="space-y-4">
                                {activeTab === 'Pending' && (
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-grow bg-gradient-to-r from-transparent to-white/10"></div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 bg-black/40 rounded-full border border-white/5">{date}</span>
                                        <div className="h-px flex-grow bg-gradient-to-l from-transparent to-white/10"></div>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                                    {orders.map(renderOrderCard)}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            )}

            {/* Step 2: Packing Modal */}
            {packingOrder && (
                <FastPackModal 
                    order={packingOrder} 
                    onClose={() => setPackingOrder(null)} 
                    onSuccess={() => {
                        setPackingOrder(null);
                        refreshData(); // Triggers a re-fetch/update in Context
                    }} 
                />
            )}
        </div>
    );
};

export default PackagingView;