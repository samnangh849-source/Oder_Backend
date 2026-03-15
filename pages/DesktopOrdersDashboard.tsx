
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import Spinner from '../components/common/Spinner';
import { ParsedOrder, User } from '../types';
import EditOrderPage from './EditOrderPage';
import OrdersList from '../components/orders/OrdersList';
import { WEB_APP_URL } from '../constants';
import Modal from '../components/common/Modal';
import { useUrlState } from '../hooks/useUrlState';
import PdfExportModal from '../components/admin/PdfExportModal';
import BulkActionManager from '../components/admin/BulkActionManager';
import OrderFilters, { FilterState } from '../components/orders/OrderFilters';
import { ColumnToggler, availableColumns } from '../components/orders/ColumnToggler';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import { translations } from '../translations';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface DesktopOrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const DesktopOrdersDashboard: React.FC<DesktopOrdersDashboardProps> = ({ onBack, initialFilters }) => {
    const { 
        appData, refreshData, refreshTimestamp, currentUser, 
        orders, isOrdersLoading, language, isSyncing
    } = useContext(AppContext);
    
    const { playClick, playPop, playTransition } = useSoundEffects();
    const t = useMemo(() => translations[language || 'km'] || translations['km'], [language]);

    const [editingOrderId, setEditingOrderId] = useUrlState<string>('editOrder', '');
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [sortBy, setSortBy] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [groupBy, setGroupBy] = useState<string>('none');
    const [viewMode, setViewMode] = useUrlState<'card' | 'list'>('viewMode', 'list');
    
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
        const defaults = availableColumns || [];
        return new Set(
            defaults.filter(c => 
                c.key !== 'productInfo' && 
                c.key !== 'print' && 
                c.key !== 'check' && 
                c.key !== 'fulfillment' &&
                c.key !== 'note' &&
                c.key !== 'driver'
            ).map(c => c.key)
        );
    });

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBorders, setShowBorders] = useState(true);

    // Filter State
    const [filters, setFilters] = useState<FilterState>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        return {
            datePreset: (initialFilters?.datePreset || searchParams.get('dateFilter') as any) || 'this_month',
            startDate: initialFilters?.startDate || searchParams.get('startDate') || '',
            endDate: initialFilters?.endDate || searchParams.get('endDate') || '',
            team: initialFilters?.team || searchParams.get('teamFilter') || '',
            location: initialFilters?.location || searchParams.get('locationFilter') || '',
            fulfillmentStore: initialFilters?.fulfillmentStore || searchParams.get('storeFilter') || '',
            store: initialFilters?.store || searchParams.get('brandFilter') || '',
            shippingService: initialFilters?.shippingService || searchParams.get('shippingFilter') || '',
            driver: initialFilters?.driver || searchParams.get('driverFilter') || '',
            paymentStatus: initialFilters?.paymentStatus || searchParams.get('paymentFilter') || '',
            user: initialFilters?.user || searchParams.get('userFilter') || '',
            page: initialFilters?.page || searchParams.get('pageFilter') || '',
            internalCost: initialFilters?.internalCost || searchParams.get('costFilter') || '',
            bank: initialFilters?.bank || searchParams.get('bankFilter') || '',
            product: initialFilters?.product || searchParams.get('productFilter') || '',
            customerSearch: initialFilters?.customerSearch || searchParams.get('customerFilter') || '',
            isVerified: 'All'
        };
    });

    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // Data Processing
    const enrichedOrders = useMemo(() => {
        return orders.map(order => {
            let team = (order.Team || '').trim();
            if (!team) {
                const u = appData.users?.find(u => u.UserName === order.User);
                if (u?.Team) team = u.Team.split(',')[0].trim();
                else {
                    const p = appData.pages?.find(pg => pg.PageName === order.Page);
                    if (p?.Team) team = p.Team;
                }
            }
            return { ...order, Team: team || 'Unassigned' };
        });
    }, [orders, appData.users, appData.pages]);

    const filteredOrders = useMemo(() => {
        const base = enrichedOrders.filter(order => {
            if (filters.datePreset !== 'all') {
                const ts = getOrderTimestamp(order);
                const orderDate = new Date(ts);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let start: Date | null = null;
                let end: Date | null = null;
                switch (filters.datePreset) {
                    case 'today': start = today; end = new Date(today); end.setHours(23, 59, 59, 999); break;
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
            const isMatch = (fV: string, oV: string, p = false) => {
                if (!fV) return true;
                const sV = fV.split(',').map(v => v.trim().toLowerCase());
                const v = (oV || '').trim().toLowerCase();
                return p ? sV.some(sv => v.includes(sv)) : sV.includes(v);
            };
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
            if (filters.customerSearch) {
                const q = filters.customerSearch.toLowerCase();
                if (!(order['Customer Name'] || '').toLowerCase().includes(q) && !(order['Customer Phone'] || '').includes(q)) return false;
            }
            if (filters.product) {
                const sP = filters.product.split(',').map(v => v.trim().toLowerCase());
                if (!order.Products.some(p => sP.includes((p.name || p.ProductName || '').toLowerCase()))) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return order['Order ID'].toLowerCase().includes(q) || (order['Customer Name'] || '').toLowerCase().includes(q) || (order['Customer Phone'] || '').includes(q);
            }
            return true;
        });
        return base.sort((a, b) => {
            let vA: any, vB: any;
            switch(sortBy) {
                case 'date': vA = getOrderTimestamp(a); vB = getOrderTimestamp(b); break;
                case 'total': vA = Number(a['Grand Total']) || 0; vB = Number(b['Grand Total']) || 0; break;
                case 'customer': vA = (a['Customer Name'] || '').toLowerCase(); vB = (b['Customer Name'] || '').toLowerCase(); break;
                case 'id': vA = a['Order ID']; vB = b['Order ID']; break;
                default: vA = getOrderTimestamp(a); vB = getOrderTimestamp(b);
            }
            if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
            if (vA > vB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [enrichedOrders, filters, searchQuery, appData.pages, sortBy, sortOrder]);

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    if (editingOrderId) {
        const order = enrichedOrders.find(o => o['Order ID'] === editingOrderId);
        return order ? (
            <EditOrderPage order={order} onSaveSuccess={() => { setEditingOrderId(''); refreshData(); }} onCancel={() => setEditingOrderId('')} />
        ) : null;
    }

    return (
        <div className="w-full h-full flex flex-col animate-reveal relative bg-[#020617] overflow-hidden">
            <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-5xl">
                <div className="p-8 bg-[#0f172a] rounded-[2.5rem] flex flex-col h-[85vh]">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-10 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"></div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">{t.filter_engine}</h2>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white border border-white/5 shadow-xl">&times;</button>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-4 custom-scrollbar">
                        <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={appData.users || []} appData={appData} />
                    </div>
                    <div className="mt-6 border-t border-white/5 pt-6">
                        <button onClick={() => { playPop(); setIsFilterModalOpen(false); }} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl">{t.apply_config}</button>
                    </div>
                </div>
            </Modal>

            <div className="px-6 pt-6 pb-2">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { playTransition(); onBack(); }} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-90 text-gray-400 hover:text-white border border-white/5">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t.manage_orders}</h1>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${isSyncing ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-400 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isSyncing ? 'text-blue-400' : 'text-emerald-500'}`}>{isSyncing ? 'Syncing' : 'Live'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group min-w-[300px]">
                            <input type="text" placeholder={t.search_placeholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm font-bold text-white focus:bg-white/10 outline-none transition-all" />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <button onClick={() => { playClick(); setIsFilterModalOpen(true); }} className="flex items-center gap-2 px-5 py-3 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                        <button onClick={() => { playClick(); setIsPdfModalOpen(true); }} className="flex items-center gap-2 px-5 py-3 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Export
                        </button>
                        <ColumnToggler visibleColumns={visibleColumns} onToggle={toggleColumn} />
                    </div>
                </div>

                <div className="flex items-center justify-between bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[2rem] p-2 mb-4 shadow-2xl">
                    <div className="flex items-center gap-2">
                        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-purple-400 focus:ring-0 uppercase tracking-widest cursor-pointer px-4">
                            <option value="none">No Grouping</option>
                            <option value="Page">By Page</option>
                            <option value="Team">By Team</option>
                            <option value="Fulfillment Store">By Warehouse</option>
                        </select>
                        <div className="h-4 w-px bg-white/5"></div>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-blue-400 focus:ring-0 uppercase tracking-widest cursor-pointer px-4">
                            <option value="date">Sort by Date</option>
                            <option value="total">Sort by Revenue</option>
                            <option value="customer">Sort by Customer</option>
                        </select>
                    </div>
                </div>

                {/* Shortcuts Row */}
                <div className="flex flex-wrap items-center gap-3 mb-2 px-1 animate-reveal">
                    <div className="flex items-center gap-2 bg-gradient-to-br from-blue-900/20 via-black/40 to-indigo-900/20 backdrop-blur-3xl p-2 rounded-[1.5rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/5">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-xl border border-white/5 mr-1">
                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Shortcuts</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {[
                                { id: 'all', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
                                { id: 'today', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                                { id: 'yesterday', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" /></svg> },
                                { id: 'this_week', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
                                { id: 'this_month', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> }
                            ].map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => { playPop(); setFilters(prev => ({ ...prev, datePreset: p.id as any, startDate: '', endDate: '' })); }} 
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${
                                        filters.datePreset === p.id 
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105 active:scale-95' 
                                        : 'text-gray-500 hover:text-white hover:bg-white/5 active:scale-95'
                                    }`}
                                >
                                    {p.icon}
                                    {(t as any)[p.id] || p.id.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-gradient-to-br from-purple-900/20 via-black/40 to-fuchsia-900/20 backdrop-blur-3xl p-2 rounded-[1.5rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/5">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-xl border border-white/5 mr-1">
                            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.warehouse}</span>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[400px]">
                            {Array.from(new Set(appData.stores?.map(s => s.StoreName) || [])).map(s => {
                                const sel = filters.fulfillmentStore.split(',').map(v => v.trim().toLowerCase()).includes(s.toLowerCase());
                                return (
                                    <button 
                                        key={s} 
                                        onClick={() => {
                                            playClick();
                                            const cur = filters.fulfillmentStore.split(',').map(v => v.trim()).filter(v => v);
                                            const nxt = sel ? cur.filter(v => v.toLowerCase() !== s.toLowerCase()) : [...cur, s];
                                            setFilters(prev => ({...prev, fulfillmentStore: nxt.join(',')}));
                                        }} 
                                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all duration-300 whitespace-nowrap ${
                                            sel 
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] scale-105 active:scale-95' 
                                            : 'text-gray-500 hover:text-white hover:bg-white/5 active:scale-95'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden px-6 pb-6">
                <OrdersList orders={filteredOrders} onEdit={o => setEditingOrderId(o['Order ID'])} onView={o => setViewingOrder(o)} showActions={true} visibleColumns={visibleColumns} selectedIds={selectedIds} onToggleSelect={id => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })} showBorders={showBorders} groupBy={groupBy} viewMode="list" />
            </div>

            <BulkActionManager orders={enrichedOrders} selectedIds={selectedIds} onComplete={() => { setSelectedIds(new Set()); refreshData(); }} onClearSelection={() => setSelectedIds(new Set())} />
            {isPdfModalOpen && <PdfExportModal isOpen={true} onClose={() => setIsPdfModalOpen(false)} orders={filteredOrders} />}
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default DesktopOrdersDashboard;
