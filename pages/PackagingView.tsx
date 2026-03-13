import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import FastPackModal from '@/components/admin/FastPackModal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import OrderFilters, { FilterState } from '@/components/orders/OrderFilters';
import Modal from '@/components/common/Modal';

const PackagingView: React.FC<{ orders?: ParsedOrder[] }> = ({ orders: propOrders }) => {
    const { appData, refreshData, currentUser, setMobilePageTitle, previewImage: showFullImage } = useContext(AppContext);
    
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [localOrders, setLocalOrders] = useState<ParsedOrder[]>([]);
    const [displayLimit, setDisplayLimit] = useState(24);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sessionStats, setSessionStats] = useState({ packed: 0, startTime: Date.now() });
    const [filters, setFilters] = useState<FilterState>({
        datePreset: 'all', startDate: '', endDate: '', team: '', user: '',
        paymentStatus: '', shippingService: '', driver: '', product: '',
        bank: '', fulfillmentStore: '', store: '', page: '', location: '',
        internalCost: '', customerName: '',
    });

    const allOrdersMapped = useMemo(() => {
        const rawData = propOrders || (Array.isArray((appData as any).orders) ? (appData as any).orders : []);
        if (!rawData || rawData.length === 0) return [];
        return rawData
            .filter((o: any) => o && o['Order ID'] && o['Order ID'] !== 'Opening_Balance')
            .map((o: any) => {
                let products = o.Products || [];
                if (typeof o['Products (JSON)'] === 'string' && products.length === 0) {
                    try { products = JSON.parse(o['Products (JSON)']); } catch(e) {}
                }
                let team = (o.Team || '').trim();
                if (!team) {
                    const userMatch = appData.users?.find(u => u.UserName === o.User);
                    if (userMatch?.Team) team = userMatch.Team.split(',')[0].trim();
                }
                return { 
                    ...o, 
                    Products: Array.isArray(products) ? products : [], 
                    Team: team || 'A',
                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
                };
            }) as ParsedOrder[];
    }, [appData.orders, propOrders, appData.users]);

    useEffect(() => { setLocalOrders(allOrdersMapped); }, [allOrdersMapped]);
    useEffect(() => { setDisplayLimit(24); }, [activeTab, selectedStore, searchTerm, filters]);
    useEffect(() => {
        setMobilePageTitle(selectedStore ? `HUB: ${selectedStore}` : 'ជ្រើសរើសឃ្លាំង');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const availableStores = useMemo(() => appData.stores ? appData.stores.map((s: any) => s.StoreName) : [], [appData.stores]);
    const storeOrders = useMemo(() => {
        if (!selectedStore) return [];
        const storeLower = selectedStore.trim().toLowerCase();
        return localOrders.filter(o => (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === storeLower);
    }, [localOrders, selectedStore]);

    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        const manualMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (manualMatch) {
            return new Date(
                parseInt(manualMatch[1]),
                parseInt(manualMatch[2]) - 1,
                parseInt(manualMatch[3]),
                parseInt(manualMatch[4]),
                parseInt(manualMatch[5])
            );
        }
        if (dateStr.endsWith('Z')) return new Date(dateStr.slice(0, -1));
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const filteredResult = useMemo(() => {
        let filtered = storeOrders.filter(o => o.FulfillmentStatus === activeTab && o.FulfillmentStatus !== 'Cancelled');
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(order => order['Order ID'].toLowerCase().includes(q) || (order['Customer Name'] || '').toLowerCase().includes(q) || (order['Customer Phone'] || '').includes(q));
        }
        if (filters.team || filters.user || filters.page || filters.product || filters.datePreset !== 'all') {
            filtered = filtered.filter(order => {
                const isMatch = (filterValue: string, orderValue: string) => !filterValue || filterValue.split(',').some(v => (orderValue || '').toLowerCase().includes(v.trim().toLowerCase()));
                if (!isMatch(filters.team, order.Team)) return false;
                if (!isMatch(filters.user, order.User)) return false;
                if (!isMatch(filters.page, order.Page)) return false;
                if (filters.product && !order.Products.some(p => p.name === filters.product)) return false;
                return true;
            });
        }
        filtered = filtered.sort((a, b) => getSafeDateObj(b.Timestamp).getTime() - getSafeDateObj(a.Timestamp).getTime());
        const total = filtered.length;
        const paged = filtered.slice(0, displayLimit);
        const hasMore = total > displayLimit;
        const groups: { [date: string]: ParsedOrder[] } = {};
        if (activeTab === 'Pending') {
            paged.forEach(order => {
                const dateStr = order.Timestamp ? getSafeDateObj(order.Timestamp).toLocaleDateString('km-KH', { month: 'short', day: 'numeric' }) : 'ថ្មីៗ';
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(order);
            });
        } else { groups['បញ្ជីឥវ៉ាន់'] = paged; }
        return { groups, total, hasMore };
    }, [storeOrders, activeTab, searchTerm, filters, displayLimit]);

    const executeAction = async (order: ParsedOrder, newStatus: string, extraData: any = {}) => {
        const orderId = order['Order ID'];
        setLoadingActionId(orderId);
        try {
            const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, team: order.Team, userName: currentUser?.FullName || 'System', newData: { 'Fulfillment Status': newStatus, ...extraData } })
            });
            const result = await res.json();
            if (result.status === 'success') refreshData();
        } catch (err) { alert("ការបញ្ជូនបរាជ័យ!"); } finally { setLoadingActionId(null); }
    };

    const renderOrderCard = (order: ParsedOrder) => {
        const phone = order['Customer Phone'] || '';
        const phoneCarrier = appData.phoneCarriers?.find(c => (c.Prefixes || '').split(',').some(p => phone.startsWith(p.trim())));
        const isUrgent = (new Date().getTime() - getSafeDateObj(order.Timestamp).getTime()) > 86400000; // Over 24h

        return (
            <div key={order['Order ID']} className={`group relative bg-slate-900/40 backdrop-blur-xl border-2 ${isUrgent && activeTab === 'Pending' ? 'border-amber-500/30' : 'border-white/5'} rounded-[2rem] p-5 shadow-2xl transition-all duration-500 hover:border-blue-500/40 hover:bg-slate-900/60 overflow-hidden`}>
                {isUrgent && activeTab === 'Pending' && <div className="absolute top-0 right-0 px-4 py-1 bg-amber-500 text-black text-[8px] font-black uppercase tracking-[0.2em] rounded-bl-xl animate-pulse">ប្រញាប់ (Urgent)</div>}
                {loadingActionId === order['Order ID'] && <div className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center rounded-[2rem]"><Spinner /></div>}
                
                <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {phoneCarrier && <img src={convertGoogleDriveUrl(phoneCarrier.CarrierLogoURL)} className="w-3.5 h-3.5 object-contain" alt="" />}
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{order.Team} Team</span>
                        </div>
                        <h3 className="text-white font-black text-lg truncate tracking-tight">{order['Customer Name']}</h3>
                        <p className="text-gray-400 font-mono text-xs font-bold mt-0.5">{order['Customer Phone']}</p>
                    </div>
                    <button onClick={() => setViewingOrder(order)} className="w-9 h-9 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl flex items-center justify-center transition-all border border-white/5 shadow-inner active:scale-90"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
                </div>

                <div className="bg-black/30 rounded-2xl p-3 border border-white/5 mb-4 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Inventory Assets</span>
                        <span className="text-[8px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/30">{order.Products.length} Items</span>
                    </div>
                    <div className="flex -space-x-3 overflow-hidden">
                        {order.Products.map((p, idx) => (
                            <img key={idx} src={convertGoogleDriveUrl(p.image)} className="w-10 h-10 rounded-lg object-cover border-2 border-[#0f172a] shadow-lg cursor-pointer hover:translate-y-[-4px] transition-transform" alt="" onClick={() => showFullImage(convertGoogleDriveUrl(p.image))} />
                        ))}
                    </div>
                </div>

                <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth={2}/></svg></div>
                        <p className="text-[11px] font-bold text-gray-300 truncate">{order.Location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg></div>
                        <p className="text-xs font-black text-white font-mono">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                    </div>
                </div>

                <div className="pt-3 border-t border-white/5">
                    {activeTab === 'Pending' && (
                        <button onClick={() => setPackingOrder(order)} className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.1em] shadow-xl shadow-blue-900/40 transition-all active:scale-95 flex justify-center items-center gap-2 group/btn">
                            <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                            ចាប់ផ្ដើមវេចខ្ចប់
                        </button>
                    )}
                    {activeTab === 'Ready to Ship' && (
                        <button onClick={() => executeAction(order, 'Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'Packer' })} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.1em] shadow-xl shadow-amber-900/40 transition-all active:scale-95 flex justify-center items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            បញ្ជូនទៅអ្នកដឹក
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderOrderListRow = (order: ParsedOrder) => (
        <div key={order['Order ID']} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-4 hover:bg-slate-900/60 transition-all">
            <div className="flex items-center gap-3 min-w-0 flex-grow">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/20 font-black text-[10px]">{order.Team}</div>
                <div className="min-w-0">
                    <h4 className="text-white font-black truncate text-sm">{order['Customer Name']}</h4>
                    <p className="text-gray-500 text-[10px] font-mono">{order['Customer Phone']}</p>
                </div>
            </div>
            <div className="hidden md:block text-right">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest truncate max-w-[150px]">{order.Location}</p>
                <p className="text-emerald-400 font-mono font-black text-xs">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
                {activeTab === 'Pending' ? (
                    <button onClick={() => setPackingOrder(order)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Pack</button>
                ) : activeTab === 'Ready to Ship' ? (
                    <button onClick={() => executeAction(order, 'Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'Packer' })} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Ship</button>
                ) : (
                    <button onClick={() => setViewingOrder(order)} className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Details</button>
                )}
            </div>
        </div>
    );

    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 animate-fade-in">
                <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-3xl text-center space-y-8 relative overflow-hidden ring-1 ring-white/10">
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-600/10 rounded-full blur-[60px] pointer-events-none"></div>
                    <div className="relative z-10 space-y-3">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl mx-auto flex items-center justify-center border-2 border-white/20 shadow-2xl shadow-blue-900/40 transform -rotate-6 hover:rotate-0 transition-transform duration-500"><span className="text-4xl">🏬</span></div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Packaging Hub</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em]">Select Distribution Team</p>
                    </div>
                    <div className="relative z-10 grid grid-cols-1 gap-3">
                        {availableStores.map(store => (
                            <button key={store} onClick={() => setSelectedStore(store)} className="w-full py-4 px-6 bg-white/5 hover:bg-blue-600 text-white border border-white/5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-between group">
                                <span>{store}</span><svg className="w-5 h-5 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const { groups, total, hasMore } = filteredResult;

    return (
        <div className="h-full flex flex-col animate-fade-in px-2 lg:px-4 max-w-[2000px] mx-auto overflow-hidden">
            {/* Header (Fixed) */}
            <div className="flex-shrink-0 mb-4">
                <div className="flex flex-col xl:flex-row justify-between items-center bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-4 shadow-xl gap-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-transparent pointer-events-none"></div>
                    <div className="flex items-center gap-4 relative z-10 w-full xl:w-auto">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40 border border-white/10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                        <div>
                            <h1 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none flex items-center gap-3"><span>Packaging Ops</span><span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 not-italic tracking-widest font-black">{selectedStore}</span></h1>
                            <div className="flex items-center gap-4 mt-1.5">
                                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div><span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Active Stream</span></div>
                                <div className="flex items-center gap-3 ml-2 pl-3 border-l border-white/10">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Packed</span>
                                        <span className="text-xs font-black text-emerald-400 font-mono">{sessionStats.packed}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Rate</span>
                                        <span className="text-xs font-black text-indigo-400 font-mono">
                                            {(() => {
                                                const hours = (Date.now() - sessionStats.startTime) / 3600000;
                                                return hours > 0.01 ? Math.round(sessionStats.packed / hours) : 0;
                                            })()} p/h
                                        </span>
                                    </div>                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10 w-full xl:w-auto">
                        <div className="flex-1 xl:flex-none grid grid-cols-2 gap-2">
                            <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-center shadow-inner"><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Queue</p><p className="text-sm font-black text-white font-mono">{total}</p></div>
                            <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-center shadow-inner"><p className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Station</p><p className="text-sm font-black text-indigo-400 font-mono">#01</p></div>
                        </div>
                        <button onClick={() => setSelectedStore('')} className="px-4 py-3 bg-gray-800/50 hover:bg-red-600 hover:text-white text-gray-400 rounded-xl border border-white/5 active:scale-95 transition-all text-[9px] font-black uppercase tracking-widest shadow-lg">Switch HUB</button>
                    </div>
                </div>
            </div>

            {/* Segmented Status Control & Filter Bar (Fixed) */}
            <div className="flex-shrink-0 space-y-4 mb-4">
                <div className="flex justify-center">
                    <div className="flex bg-[#0f172a]/80 backdrop-blur-2xl p-1 rounded-2xl border border-white/10 shadow-xl max-w-full overflow-x-auto no-scrollbar gap-1 ring-1 ring-white/5">
                        {[
                            {id:'Pending',label:'រង់ចាំវេចខ្ចប់',icon:'📥', color: 'blue'},
                            {id:'Ready to Ship',label:'ខ្ចប់រួចរាល់',icon:'📦', color: 'indigo'},
                            {id:'Shipped',label:'បានបញ្ចេញ',icon:'🚚', color: 'purple'}
                        ].map(tab => {
                            const count = storeOrders.filter(o => o.FulfillmentStatus === tab.id && o.FulfillmentStatus !== 'Cancelled').length;
                            return (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setActiveTab(tab.id as any)} 
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 whitespace-nowrap relative ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <span className="text-base">{tab.icon}</span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black min-w-[18px] text-center ${activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-blue-600/20 text-blue-400 border border-blue-500/20'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-[#020617]/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-2.5 shadow-2xl group transition-all hover:bg-slate-900/80 max-w-6xl mx-auto ring-1 ring-white/5">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
                        <div className="relative w-full lg:max-w-xl group/search">
                            <input type="text" placeholder="ស្វែងរក..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-input !pl-12 !py-2.5 bg-black/40 border-gray-800 rounded-xl text-[14px] font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-gray-700 group-focus-within/search:text-blue-500 transition-colors"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><div className="h-5 w-px bg-gray-800"></div></div>
                        </div>
                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <div className="flex-1 lg:flex-none flex bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner">
                                <button onClick={() => setViewMode('card')} className={`flex-1 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg transition-all ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg></button>
                                <button onClick={() => setViewMode('list')} className={`flex-1 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-black/50"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>Engine</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-20">
                {total === 0 ? (
                    <div className="py-32 text-center bg-slate-900/20 rounded-[4rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-6 animate-fade-in"><span className="text-7xl opacity-30 drop-shadow-2xl">📦</span><p className="text-gray-500 font-black uppercase tracking-[0.4em] text-xs">No Pending Operations</p></div>
                ) : (
                    <div className="space-y-16">
                        {(Object.entries(groups) as [string, ParsedOrder[]][]).map(([date, groupOrders]) => (
                            groupOrders.length > 0 && (
                                <div key={date} className="space-y-8 animate-fade-in-up">
                                    <div className="flex items-center gap-6 px-4">
                                        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
                                        <span className="text-sm font-black text-blue-400 uppercase tracking-[0.4em] bg-blue-600/5 px-8 py-3 rounded-full border border-blue-500/20 shadow-2xl backdrop-blur-md">{date}</span>
                                        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
                                    </div>
                                    <div className={viewMode === 'card' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 min-[1600px]:grid-cols-5 min-[1920px]:grid-cols-6 gap-6 sm:gap-8" : "flex flex-col gap-4"}>
                                        {groupOrders.map(order => viewMode === 'card' ? renderOrderCard(order) : renderOrderListRow(order))}
                                    </div>
                                </div>
                            )
                        ))}
                        {hasMore && (
                            <div className="flex justify-center pt-10 pb-20"><button onClick={() => setDisplayLimit(prev => prev + 24)} className="px-16 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-[0_20px_50px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center gap-4 border border-white/20 group"><svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>Load Next Stream</button></div>
                        )}
                    </div>
                )}
            </div>

            {packingOrder && (
                <FastPackModal 
                    order={packingOrder} 
                    onClose={() => setPackingOrder(null)} 
                    onSuccess={(tempUrl) => { 
                        const orderId = packingOrder['Order ID'];
                        setLocalOrders(prev => prev.map(o => 
                            o['Order ID'] === orderId 
                                ? { 
                                    ...o, 
                                    FulfillmentStatus: 'Ready to Ship' as any,
                                    'Package Photo URL': tempUrl || o['Package Photo URL']
                                  } 
                                : o
                        ));
                        setPackingOrder(null); 
                        setActiveTab('Ready to Ship'); 
                        setSessionStats(prev => ({ ...prev, packed: prev.packed + 1 }));
                        refreshData(); 
                    }} 
                />
            )}
            
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-4xl">
                    <div className="p-8 sm:p-12 bg-[#0f172a] rounded-[3rem] border border-white/10 shadow-3xl flex flex-col max-h-[90vh] relative overflow-hidden">
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                        <div className="flex justify-between items-start mb-10 relative z-10">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-blue-600/20 rounded-[1.5rem] flex items-center justify-center border border-blue-500/30 text-blue-400 shadow-2xl"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                                <div><h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Order Profile</h3><p className="text-blue-400 font-mono text-sm font-bold mt-1 tracking-widest uppercase">Node ID: {viewingOrder['Order ID']}</p></div>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="w-12 h-12 rounded-2xl bg-white/5 text-gray-500 hover:text-white flex items-center justify-center transition-all hover:bg-red-600/20 hover:text-red-400 border border-white/5 active:scale-90 shadow-xl"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-4 space-y-10 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/[0.03] p-8 rounded-[2.5rem] border border-white/5 shadow-inner"><p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Customer Intelligence</p><div className="space-y-4"><p className="text-white font-black text-2xl tracking-tight">{viewingOrder['Customer Name']}</p><p className="text-blue-400 font-mono font-black text-xl">{viewingOrder['Customer Phone']}</p><div className="h-px bg-white/5 my-4"></div><p className="text-gray-400 text-sm leading-relaxed">{viewingOrder.Location}</p><p className="text-gray-500 text-xs italic">{viewingOrder['Address Details']}</p></div></div>
                                <div className="bg-white/[0.03] p-8 rounded-[2.5rem] border border-white/5 shadow-inner"><p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-6">Logistics Flow</p><div className="space-y-6"><div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Team</span><span className="text-white font-black text-sm">{viewingOrder.Team}</span></div><div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Source Page</span><span className="text-white font-black text-xs">{viewingOrder.Page}</span></div><div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Fulfillment</span><span className="text-orange-400 font-black text-xs uppercase">{viewingOrder['Fulfillment Store']}</span></div><div className="flex justify-between items-center pt-4 border-t border-white/5"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Net Valuation</span><span className="text-emerald-400 font-black text-xl font-mono">${(Number(viewingOrder['Grand Total']) || 0).toFixed(2)}</span></div></div></div>
                            </div>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4"><div className="h-px flex-grow bg-white/5"></div><span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Asset Manifest</span><div className="h-px flex-grow bg-white/5"></div></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {viewingOrder.Products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-5 bg-white/[0.02] p-4 rounded-3xl border border-white/5 hover:bg-white/5 transition-colors group shadow-lg"><img src={convertGoogleDriveUrl(p.image)} className="w-16 h-16 rounded-2xl object-cover border border-white/10 group-hover:scale-105 transition-transform shadow-2xl" alt="" /><div className="flex-grow min-w-0"><p className="text-white font-black text-sm truncate">{p.name}</p><p className="text-blue-400 font-black text-xs mt-1 uppercase tracking-widest">Quantity: {p.quantity}</p></div></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 pt-8 border-t border-white/5 flex justify-end relative z-10"><button onClick={() => setViewingOrder(null)} className="px-12 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl border border-white/5 active:scale-95">Terminate View</button></div>
                    </div>
                </Modal>
            )}

            {isFilterModalOpen && (
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-5xl">
                    <div className="p-8 md:p-12 bg-[#0f172a] rounded-[3rem] overflow-hidden relative flex flex-col h-full shadow-3xl">
                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-2.5 h-12 bg-blue-600 rounded-full shadow-[0_0_25px_rgba(37,99,235,0.6)]"></div>
                                <div><h2 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Engine</h2><p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-2">Deep Search Algorithm</p></div>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 shadow-2xl hover:bg-white/10">&times;</button>
                        </div>
                        <div className="flex-grow pr-4 relative z-10">
                            <OrderFilters filters={filters} setFilters={setFilters} orders={allOrdersMapped} usersList={appData.users || []} appData={appData} calculatedRange="All available records" />
                        </div>
                        <div className="mt-12 flex justify-center relative z-10 border-t border-white/5 pt-10">
                            <button onClick={() => setIsFilterModalOpen(false)} className="btn btn-primary w-full max-w-lg py-6 text-sm font-black uppercase tracking-[0.3em] shadow-[0_25px_60px_rgba(37,99,235,0.4)] rounded-[2rem] active:scale-[0.98] transition-all">Execute Configuration</button>
                        </div>
                        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PackagingView;