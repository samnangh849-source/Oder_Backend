
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import EditOrderPage from './EditOrderPage';
import OrdersList from '../components/orders/OrdersList';
import { WEB_APP_URL } from '../constants';
import { useUrlState } from '../hooks/useUrlState';
import PdfExportModal from '../components/admin/PdfExportModal';
import BulkActionManager from '../components/admin/BulkActionManager';
import MobileFilterEngine from '../components/orders/MobileFilterEngine';
import { FilterPanel } from '../components/orders/FilterPanel';
import { ColumnToggler, availableColumns } from '../components/orders/ColumnToggler';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import { translations } from '../translations';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { FilterState } from '../components/orders/OrderFilters';
import { useUI } from '../context/UIContext';

interface MobileOrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const MobileOrdersDashboard: React.FC<MobileOrdersDashboardProps> = ({ onBack, initialFilters }) => {
    const { 
        appData, refreshData, orders, isOrdersLoading, language, isSyncing
    } = useContext(AppContext);
    const { setIsBottomNavHidden } = useUI();
    
    const { playClick, playTransition, playPop, playSuccess } = useSoundEffects();
    const t = useMemo(() => translations[language || 'km'] || translations['km'], [language]);

    const [editingOrderId, setEditingOrderId] = useUrlState<string>('editOrder', '');
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [sortBy, setSortBy] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useUrlState<'card' | 'list'>('viewMode', 'card');
    
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
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Hide Bottom Nav when items are selected
    useEffect(() => {
        const hasSelection = selectedIds.size > 0;
        setIsBottomNavHidden(hasSelection);
        return () => setIsBottomNavHidden(false); // Clean up on unmount
    }, [selectedIds.size, setIsBottomNavHidden]);

    const toggleSelectionMode = () => {
        playPop();
        if (isSelectionMode) {
            setSelectedIds(new Set());
        }
        setIsSelectionMode(!isSelectionMode);
    };

    const handleSelectAll = () => {
        playClick();
        if (selectedIds.size === filteredOrders.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredOrders.map(o => o['Order ID'])));
        }
    };

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

    const calculatedRange = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date | null = null;
        let end: Date | null = new Date();
        switch (filters.datePreset) {
            case 'today': start = today; break;
            case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'all': return 'All time data';
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
            default: start = today;
        }
        const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return start ? `${formatDate(start)} to ${formatDate(end)}` : 'All time data';
    }, [filters.datePreset, filters.startDate, filters.endDate]);

    // Sync with URL
    const [, setUrlTeam] = useUrlState('teamFilter', '');
    const [, setUrlDate] = useUrlState('dateFilter', 'this_month');
    const [, setUrlLocation] = useUrlState('locationFilter', '');
    const [, setUrlStore] = useUrlState('storeFilter', '');

    useEffect(() => {
        setUrlTeam(filters.team);
        setUrlDate(filters.datePreset);
        setUrlLocation(filters.location);
        setUrlStore(filters.fulfillmentStore);
    }, [filters, setUrlTeam, setUrlDate, setUrlLocation, setUrlStore]);

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
            // 1. Date Filtering
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
                    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
                    case 'custom':
                        if (filters.startDate) start = new Date(filters.startDate + 'T00:00:00');
                        if (filters.endDate) end = new Date(filters.endDate + 'T23:59:59');
                        break;
                }
                if (start && orderDate < start) return false;
                if (end && orderDate > end) return false;
            }

            // 2. Helper for multi-value filters
            const isMatch = (filterValue: string, orderValue: string) => {
                if (!filterValue || filterValue === 'all') return true;
                const filterItems = filterValue.split(',').map(v => v.trim().toLowerCase());
                const val = (orderValue || '').trim().toLowerCase();
                return filterItems.includes(val);
            };

            // 3. Apply individual filters
            if (!isMatch(filters.team, order.Team)) return false;
            if (!isMatch(filters.fulfillmentStore, order['Fulfillment Store'] || 'Unassigned')) return false;
            if (!isMatch(filters.paymentStatus, order['Payment Status'])) return false;
            if (!isMatch(filters.user, order.User)) return false;
            if (!isMatch(filters.page, order.Page)) return false;
            if (!isMatch(filters.shippingService, order['Internal Shipping Method'])) return false;
            if (!isMatch(filters.driver, order['Internal Shipping Details'])) return false;
            if (!isMatch(filters.bank, order['Payment Info'])) return false;

            if (filters.isVerified !== 'All') {
                const isV = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                if (filters.isVerified === 'Verified' && !isV) return false;
                if (filters.isVerified === 'Unverified' && isV) return false;
            }

            // 4. Search Query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    order['Order ID'].toLowerCase().includes(q) || 
                    (order['Customer Name'] || '').toLowerCase().includes(q) ||
                    (order['Customer Phone'] || '').toLowerCase().includes(q)
                );
            }

            return true;
        });

        return base.sort((a, b) => {
            let vA: any, vB: any;
            switch(sortBy) {
                case 'date': vA = getOrderTimestamp(a); vB = getOrderTimestamp(b); break;
                case 'total': vA = Number(a['Grand Total']) || 0; vB = Number(b['Grand Total']) || 0; break;
                case 'customer': vA = (a['Customer Name'] || '').toLowerCase(); vB = (b['Customer Name'] || '').toLowerCase(); break;
                default: vA = getOrderTimestamp(a); vB = getOrderTimestamp(b);
            }
            return sortOrder === 'desc' ? vB - vA : vA - vB;
        });
    }, [enrichedOrders, filters, searchQuery, sortBy, sortOrder]);

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
        <div className="w-full h-full flex flex-col animate-reveal bg-[#020617] relative">
            {/* Mobile Header */}
            <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between bg-[#0f172a]/60 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <button onClick={() => { playTransition(); onBack(); }} className="p-2 bg-white/5 rounded-xl border border-white/5 active:scale-90">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg>
                    </button>
                    <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-tight">{t.manage_orders}</h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-blue-400 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                            <span className="text-[7px] text-gray-500 font-black uppercase tracking-widest">{isSyncing ? 'Syncing' : 'Live Operations'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ColumnToggler visibleColumns={visibleColumns} onToggle={toggleColumn} />
                    <button onClick={() => { playClick(); setIsFilterModalOpen(true); }} className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl relative">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeWidth={2}/></svg>
                        {Object.values(filters).some(v => v && v !== 'all' && v !== 'this_month') && <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#0f172a]"></span>}
                    </button>
                </div>
            </div>

            {/* Mobile Search Bar */}
            <div className="px-4 py-3 bg-[#020617] sticky top-[65px] z-20 space-y-4">
                <div className="relative group">
                    <input 
                        type="text" 
                        placeholder={t.search_placeholder} 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-white placeholder:text-gray-600 focus:bg-white/10 transition-all outline-none"
                    />
                    <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none text-gray-600 group-focus-within:text-blue-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5}/></svg>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 flex-1">
                        <button 
                            onClick={() => { playPop(); setViewMode('card'); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                        >
                            <span>🗂️</span> {t.view_card}
                        </button>
                        <button 
                            onClick={() => { playPop(); setViewMode('list'); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                        >
                            <span>📝</span> {t.view_list}
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={toggleSelectionMode}
                            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all border ${isSelectionMode ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-white/5 border-white/5 text-gray-400'}`}
                            title="Select Multiple"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeWidth={2.5}/></svg>
                        </button>

                        <button 
                            onClick={() => { playClick(); setIsPdfModalOpen(true); }}
                            className="flex items-center justify-center w-10 h-10 bg-red-600/10 text-red-400 border border-red-500/20 rounded-xl active:scale-95 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth={2.5}/></svg>
                        </button>
                    </div>
                </div>

                {isSelectionMode && (
                    <div className="flex items-center justify-between px-1 py-1 bg-blue-600/10 border border-blue-500/20 rounded-xl animate-reveal">
                        <button onClick={handleSelectAll} className="px-4 py-1.5 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            {selectedIds.size === filteredOrders.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-[10px] font-black text-blue-500 uppercase">{selectedIds.size} Selected</span>
                        <button onClick={toggleSelectionMode} className="px-4 py-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Cancel</button>
                    </div>
                )}

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 px-0.5">
                    {[
                        { id: 'all', icon: '♾️', label: 'All' },
                        { id: 'today', icon: '☀️', label: 'Today' },
                        { id: 'yesterday', icon: '🌅', label: 'Yesterday' },
                        { id: 'this_week', icon: '📅', label: 'Week' },
                        { id: 'this_month', icon: '🗓️', label: 'Month' }
                    ].map(p => (
                        <button key={p.id} onClick={() => { playPop(); setFilters(prev => ({ ...prev, datePreset: p.id as any })); }} className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${filters.datePreset === p.id ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-gray-500'}`}>
                            <span className="text-sm">{p.icon}</span> {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-32">
                {isOrdersLoading && orders.length === 0 ? <div className="py-20 flex justify-center"><Spinner size="lg" /></div> : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                        <svg className="w-16 h-16 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={1.5}/></svg>
                        <p className="text-xs font-black uppercase tracking-widest">No Records Found</p>
                    </div>
                ) : (
                    <OrdersList 
                        orders={filteredOrders} viewMode={viewMode}
                        onEdit={o => setEditingOrderId(o['Order ID'])} onView={o => setViewingOrder(o)}
                        showActions={true} selectedIds={selectedIds}
                        isSelectionMode={isSelectionMode}
                        visibleColumns={visibleColumns}
                        onToggleSelect={id => setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
                    />
                )}
            </div>

            <BulkActionManager 
                orders={enrichedOrders} 
                selectedIds={selectedIds} 
                onComplete={() => { setSelectedIds(new Set()); refreshData(); }} 
                onClearSelection={() => setSelectedIds(new Set())} 
            />

            {isFilterModalOpen && (
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <MobileFilterEngine 
                        filters={filters} 
                        setFilters={setFilters} 
                        orders={enrichedOrders} 
                        usersList={appData.users || []} 
                        appData={appData} 
                        calculatedRange={calculatedRange}
                        onApply={() => setIsFilterModalOpen(false)}
                    />
                </FilterPanel>
            )}


            {isPdfModalOpen && <PdfExportModal isOpen={true} onClose={() => setIsPdfModalOpen(false)} orders={filteredOrders} />}
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default MobileOrdersDashboard;
