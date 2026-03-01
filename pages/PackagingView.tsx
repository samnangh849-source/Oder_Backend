import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import FastPackModal from '@/components/admin/FastPackModal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import OrderFilters, { FilterState } from '@/components/orders/OrderFilters';
import { FilterPanel } from '@/components/orders/FilterPanel';
import Modal from '@/components/common/Modal';

const PackagingView: React.FC<{ orders?: ParsedOrder[] }> = ({ orders: propOrders }) => {
    const { appData, refreshData, setMobilePageTitle, previewImage: showFullImage } = useContext(AppContext);
    
    // Derived raw list
    const allOrders = useMemo(() => {
        // If propOrders are passed (which are already parsed), use them directly
        if (propOrders) return propOrders;
        
        const rawData = Array.isArray((appData as any).orders) ? (appData as any).orders : [];
        return rawData
            .filter((o: any) => o !== null && o['Order ID'] !== 'Opening_Balance')
            .map((o: any) => {
                let products = [];
                try { if (o['Products (JSON)']) products = JSON.parse(o['Products (JSON)']); } catch(e) {}
                return { 
                    ...o, 
                    Products: products, 
                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
                };
            }) as ParsedOrder[];
    }, [appData, propOrders]);

    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    
    // Comprehensive Filters
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<FilterState>({
        datePreset: 'all',
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
    });

    useEffect(() => {
        setMobilePageTitle('PACKING STATION');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle]);

    const calculatedRange = useMemo(() => {
        if (filters.datePreset === 'all') return 'All time data stream';
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date | null = null;
        let end: Date | null = new Date();
        switch (filters.datePreset) {
            case 'today': start = today; break;
            case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
            case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
            case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
        }
        const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return start ? `${formatDate(start)} to ${formatDate(end)}` : 'All time data stream';
    }, [filters.datePreset, filters.startDate, filters.endDate]);

    // Robust Date Parsing helper
    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
        return new Date(ts).getTime();
    };

    // Grouping and filtering logic
    const groupedOrders = useMemo(() => {
        let filtered = allOrders.filter(o => o.FulfillmentStatus === activeTab && o.FulfillmentStatus !== 'Cancelled');

        // Apply Comprehensive Filters
        filtered = filtered.filter(order => {
            // 1. Date Filter
            if (filters.datePreset !== 'all') {
                const ts = getOrderTimestamp(order);
                const orderDate = new Date(ts);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let start: Date | null = null;
                let end: Date | null = null;
                switch (filters.datePreset) {
                    case 'today': start = today; break;
                    case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
                    case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
                    case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
                    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
                    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
                    case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
                    case 'custom':
                        if (filters.startDate) start = new Date(filters.startDate + 'T00:00:00');
                        if (filters.endDate) end = new Date(filters.endDate + 'T23:59:59');
                        break;
                }
                if (start && orderDate < start) return false;
                if (end && orderDate > end) return false;
            }

            // Helper for multi-select
            const isMatch = (filterValue: string, orderValue: string) => {
                if (!filterValue) return true;
                const selectedValues = filterValue.split(',').map(v => v.trim().toLowerCase());
                const val = (orderValue || '').trim().toLowerCase();
                return selectedValues.includes(val);
            };

            if (!isMatch(filters.fulfillmentStore, order['Fulfillment Store'] || 'Unassigned')) return false;
            if (filters.store) {
                const pageConfig = appData.pages?.find(p => p.PageName === order.Page);
                const orderStore = pageConfig ? pageConfig.DefaultStore : null;
                const selectedStores = filters.store.split(',');
                if (!orderStore || !selectedStores.includes(orderStore)) return false;
            }
            if (!isMatch(filters.team, order.Team)) return false;
            if (!isMatch(filters.user, order.User || '')) return false;
            if (!isMatch(filters.paymentStatus, order['Payment Status'])) return false;
            if (!isMatch(filters.shippingService, order['Internal Shipping Method'])) return false;
            if (!isMatch(filters.driver, order['Internal Shipping Details'])) return false;
            if (!isMatch(filters.bank, order['Payment Info'])) return false;
            if (!isMatch(filters.page, order.Page)) return false;
            if (!isMatch(filters.location, order.Location)) return false;
            if (!isMatch(filters.customerName, order['Customer Name'])) return false;
            if (filters.product && !order.Products.some(p => p.name === filters.product)) return false;

            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                return order['Order ID'].toLowerCase().includes(q) ||
                       (order['Customer Name'] || '').toLowerCase().includes(q) ||
                       (order['Customer Phone'] || '').includes(q);
            }
            return true;
        });

        filtered = filtered.sort((a, b) => b['Order ID'].localeCompare(a['Order ID']));

        if (activeTab === 'Pending') {
            const groups: { [date: string]: ParsedOrder[] } = {};
            filtered.forEach(order => {
                const dateStr = order.Timestamp ? new Date(order.Timestamp).toLocaleDateString('km-KH') : 'ថ្ងៃនេះ';
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(order);
            });
            return groups;
        }
        
        return { 'All': filtered };
    }, [allOrders, activeTab, searchTerm, filters, appData.pages]);

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

            {/* Show Package Photo if it's already packed (Step 3 or 4) */}
            {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && order['Package Photo URL'] && (
                <div className="space-y-2 mt-2">
                    <div 
                        className="w-full h-24 rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-blue-500/50 transition-all relative group/photo"
                        onClick={() => showFullImage(convertGoogleDriveUrl(order['Package Photo URL'] as string))}
                    >
                        <img src={convertGoogleDriveUrl(order['Package Photo URL'] as string)} className="w-full h-full object-cover opacity-60 group-hover/photo:opacity-100 transition-opacity" alt="Package" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/photo:bg-transparent transition-all">
                            <svg className="w-6 h-6 text-white shadow-xl" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                    </div>
                    <button 
                        onClick={() => showFullImage(convertGoogleDriveUrl(order['Package Photo URL'] as string))}
                        className="w-full py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-xl font-black uppercase text-[9px] tracking-widest border border-white/10 transition-all flex justify-center items-center gap-2"
                    >
                        មើលរូបធំ
                    </button>
                </div>
            )}

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

            {/* Filter Section */}
            <div className="bg-gray-800/20 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-5 sm:p-6 mb-8 shadow-2xl relative z-20 group transition-all hover:bg-gray-800/30 max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="relative w-full lg:max-w-2xl group">
                        <input 
                            type="text" 
                            placeholder="ស្វែងរក ID, ឈ្មោះ, ឬលេខទូរស័ព្ទ..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="form-input !pl-16 !py-5 bg-black/40 border-gray-800 rounded-[1.8rem] text-[15px] font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" 
                        />
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-4 text-gray-700 group-focus-within:text-blue-500 transition-colors">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <div className="h-6 w-px bg-gray-800"></div>
                        </div>
                    </div>
                    <div className="flex items-stretch gap-3 w-full lg:w-auto h-16 sm:h-[68px]">
                        <button 
                            onClick={() => setIsFilterModalOpen(true)} 
                            className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/30 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Modal/Panel */}
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <OrderFilters filters={filters} setFilters={setFilters} orders={allOrders} usersList={appData.users} appData={appData} calculatedRange={calculatedRange} />
                </FilterPanel>
            </div>
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10 shadow-3xl overflow-hidden relative">
                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Subsystem</h2>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5">&times;</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 relative z-10">
                            <OrderFilters filters={filters} setFilters={setFilters} orders={allOrders} usersList={appData.users} appData={appData} calculatedRange={calculatedRange} />
                        </div>
                        <div className="mt-12 flex justify-center relative z-10"><button onClick={() => setIsFilterModalOpen(false)} className="btn btn-primary w-full py-5 text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl active:scale-[0.98] transition-all">Apply Filter Configuration</button></div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                    </div>
                </Modal>
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