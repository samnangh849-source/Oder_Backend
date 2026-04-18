
import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
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

interface DesktopOrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const DesktopOrdersDashboard: React.FC<DesktopOrdersDashboardProps> = ({ onBack, initialFilters }) => {
    const {
        appData, refreshData, refreshTimestamp, currentUser,
        orders, isOrdersLoading, language, isSyncing, advancedSettings
    } = useContext(AppContext);

    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isBinance = uiTheme === 'binance';
    
    const t = useMemo(() => translations[language || 'km'] || translations['km'], [language]);

    const [editingOrderId, setEditingOrderId] = useUrlState<string>('editOrder', '');
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [sortBy, setSortBy] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [groupBy, setGroupBy] = useState<string>('none');
    const optimisticUpdateRef = useRef<((ids: string[], status: string) => void) | null>(null);
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
                c.key !== 'driver' &&
                c.key !== 'telegramStatus'
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
            isVerified: 'All',
            telegramStatus: ''
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
            if (filters.telegramStatus) {
                const id1 = order['Telegram Message ID 1'];
                const id2 = order['Telegram Message ID 2'];
                const isSent = (id1 && id2) && id1 !== 'CHECKING';
                const s = filters.telegramStatus.split(',').map(v => v.trim());
                if (s.includes('Sent') && !isSent) return false;
                if (s.includes('Not Sent') && isSent) return false;
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

    if (editingOrderId) {
        const order = enrichedOrders.find(o => o['Order ID'] === editingOrderId);
        return order ? (
            <EditOrderPage order={order} onSaveSuccess={() => { setEditingOrderId(''); refreshData(); }} onCancel={() => setEditingOrderId('')} />
        ) : null;
    }

    return (
        <div className={`w-full h-full flex flex-col animate-reveal relative ${isBinance ? 'bg-[#0B0E11]' : 'bg-[#020617]'} overflow-hidden`}>
            <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-5xl">
                <div className={`p-8 ${isBinance ? 'bg-[#1E2329]' : 'bg-[#0f172a] rounded-[2.5rem]'} flex flex-col h-[85vh]`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                            <div className={`w-2 h-10 ${isBinance ? 'bg-[#FCD535]' : 'bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]'}`} style={isBinance ? { borderRadius: '1px' } : undefined}></div>
                            <h2 className={`text-3xl font-black ${isBinance ? 'text-[#EAECEF]' : 'text-white'} uppercase tracking-tighter ${isBinance ? '' : 'italic'}`}>{t.filter_engine}</h2>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(false)} className={`w-12 h-12 ${isBinance ? 'bg-[#2B3139] border-[#474D57] text-[#848E9C] hover:text-[#EAECEF]' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white'} flex items-center justify-center border shadow-xl`} style={isBinance ? { borderRadius: '2px' } : undefined}>&times;</button>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-4 custom-scrollbar">
                        <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={appData.users || []} appData={appData} calculatedRange={calculatedRange} />
                    </div>
                    <div className={`mt-6 border-t ${isBinance ? 'border-[#2B3139]' : 'border-white/5'} pt-6`}>
                        <button onClick={() => setIsFilterModalOpen(false)} className={`w-full py-4 ${isBinance ? 'bg-[#FCD535] hover:bg-[#f0c51d] text-[#181A20]' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl'} text-[13px] font-black uppercase tracking-[0.25em]`} style={isBinance ? { borderRadius: '2px' } : undefined}>{t.apply_config}</button>
                    </div>
                </div>
            </Modal>

            {/* Binance-Standard Header */}
            <div className={`${isBinance ? 'px-4 pt-4 pb-2' : 'px-6 pt-6 pb-2'}`}>
                
                {/* Row 1: Title + Actions */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => onBack()} className={`p-2 ${isBinance ? 'bg-transparent hover:bg-[#2B3139] text-[#848E9C] hover:text-[#EAECEF]' : 'bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white'} transition-all active:scale-90`} style={isBinance ? { borderRadius: '4px' } : undefined}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="flex items-center gap-2">
                            <div className={`w-1 h-5 ${isBinance ? 'bg-[#FCD535]' : 'bg-blue-500 rounded-full'}`} style={isBinance ? { borderRadius: '1px' } : undefined}></div>
                            <h1 className={`text-base font-black ${isBinance ? 'text-[#EAECEF]' : 'text-white italic'} tracking-tight uppercase`}>{t.manage_orders}</h1>
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 ml-2 ${isBinance ? 'bg-[#0B0E11]' : 'bg-white/5 rounded-lg'} border ${isBinance ? 'border-[#2B3139]' : 'border-white/5'}`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-[#FCD535] animate-pulse' : 'bg-[#0ECB81]'}`}></span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isBinance ? 'text-[#848E9C]' : 'text-gray-400'}`}>
                                    {isSyncing ? 'Sync' : 'Live'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative group">
                            <input 
                                type="text" 
                                placeholder={t.search_placeholder} 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className={`w-[240px] ${isBinance ? 'bg-[#0B0E11] border-[#2B3139] text-[#EAECEF] focus:border-[#FCD535] placeholder-[#848E9C]' : 'bg-white/[0.03] border-white/5 text-white focus:bg-white/10 rounded-2xl'} border py-2 pl-9 pr-3 text-xs font-medium outline-none transition-all`} 
                                style={isBinance ? { borderRadius: '4px' } : undefined} 
                            />
                            <div className={`absolute left-2.5 top-0 bottom-0 flex items-center justify-center pointer-events-none ${isBinance ? 'text-[#848E9C]' : 'text-gray-600 group-focus-within:text-blue-500'} transition-colors`}>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>

                        {/* Filters Button */}
                        <button onClick={() => setIsFilterModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-2 ${isBinance ? 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] hover:border-[#474D57]' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white rounded-2xl'} border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95`} style={isBinance ? { borderRadius: '4px' } : undefined}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>

                        {/* Export Button */}
                        <button onClick={() => setIsPdfModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-2 ${isBinance ? 'bg-transparent border-[#2B3139] text-[#848E9C] hover:text-[#FCD535] hover:border-[#FCD535]' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl'} border text-[10px] font-bold uppercase tracking-wider transition-all`} style={isBinance ? { borderRadius: '4px' } : undefined}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Export
                        </button>

                        {/* Column Toggler */}
                        <ColumnToggler visibleColumns={visibleColumns} onToggle={toggleColumn} />
                    </div>
                </div>

                {/* Row 2: Date Filter Tabs + Sort Controls */}
                <div className={`flex items-center justify-between ${isBinance ? 'border-b border-[#2B3139]' : ''} mb-2 pb-0`}>
                    {/* Date Filter Tabs */}
                    <div className="flex items-center">
                        {[
                            { id: 'all', label: (t as any)['all'] || 'All' },
                            { id: 'today', label: (t as any)['today'] || 'Today' },
                            { id: 'yesterday', label: (t as any)['yesterday'] || 'Yesterday' },
                            { id: 'this_week', label: (t as any)['this_week'] || 'This Week' },
                            { id: 'this_month', label: (t as any)['this_month'] || 'This Month' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => setFilters(prev => ({ ...prev, datePreset: p.id as any, startDate: '', endDate: '' }))}
                                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                                    isBinance
                                    ? (filters.datePreset === p.id
                                        ? 'text-[#EAECEF] border-[#FCD535]'
                                        : 'text-[#848E9C] border-transparent hover:text-[#EAECEF]')
                                    : (filters.datePreset === p.id
                                        ? 'text-white border-blue-500'
                                        : 'text-gray-500 border-transparent hover:text-gray-300')
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Sort + Group Controls */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} uppercase tracking-wider`}>Sort</span>
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={`bg-transparent border-none text-[10px] font-bold ${isBinance ? 'text-[#EAECEF]' : 'text-blue-400'} focus:ring-0 cursor-pointer`}>
                                <option value="date">Date</option>
                                <option value="total">Revenue</option>
                                <option value="customer">Customer</option>
                            </select>
                        </div>
                        <div className={`w-px h-3 ${isBinance ? 'bg-[#2B3139]' : 'bg-white/10'}`}></div>
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-bold ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} uppercase tracking-wider`}>Group</span>
                            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className={`bg-transparent border-none text-[10px] font-bold ${isBinance ? 'text-[#EAECEF]' : 'text-purple-400'} focus:ring-0 cursor-pointer`}>
                                <option value="none">None</option>
                                <option value="Page">Page</option>
                                <option value="Team">Team</option>
                                <option value="Fulfillment Store">Warehouse</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Row 3: Warehouse Quick Filters */}
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} uppercase tracking-wider mr-1`}>{t.warehouse}</span>
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {Array.from(new Set(appData.stores?.map(s => s.StoreName) || [])).map(s => {
                            const sel = filters.fulfillmentStore.split(',').map(v => v.trim().toLowerCase()).includes(s.toLowerCase());
                            return (
                                <button
                                    key={s}
                                    onClick={() => {
                                        const cur = filters.fulfillmentStore.split(',').map(v => v.trim()).filter(v => v);
                                        const nxt = sel ? cur.filter(v => v.toLowerCase() !== s.toLowerCase()) : [...cur, s];
                                        setFilters(prev => ({...prev, fulfillmentStore: nxt.join(',')}));
                                    }}
                                    className={`px-3 py-1.5 text-[9px] font-bold uppercase transition-all whitespace-nowrap ${
                                        isBinance
                                        ? (sel ? 'bg-[#FCD535] text-[#181A20]' : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]')
                                        : (sel
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                                            : 'text-gray-500 hover:text-white hover:bg-white/5')
                                    }`}
                                    style={isBinance ? { borderRadius: '4px' } : undefined}
                                >
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                    <div className={`ml-auto text-[10px] ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} tabular-nums font-medium`}>
                        <span className={isBinance ? 'text-[#EAECEF]' : 'text-white'}>{filteredOrders.length}</span> {language === 'km' ? 'ការកម្មង់' : 'orders'}
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-hidden ${isBinance ? 'px-3 pb-3' : 'px-6 pb-6'}`}>
                <OrdersList 
                    orders={filteredOrders} 
                    onEdit={o => setEditingOrderId(o['Order ID'])} 
                    onView={o => setViewingOrder(o)} 
                    showActions={true} 
                    visibleColumns={visibleColumns} 
                    selectedIds={selectedIds} 
                    onToggleSelect={id => setSelectedIds(prev => { 
                        const next = new Set(prev); 
                        if (next.has(id)) next.delete(id); 
                        else next.add(id); 
                        return next; 
                    })} 
                    showBorders={showBorders} 
                    groupBy={groupBy} 
                    viewMode="list" 
                    onOptimisticUpdate={cb => optimisticUpdateRef.current = cb}
                />
            </div>

            <BulkActionManager 
                orders={enrichedOrders} 
                selectedIds={selectedIds} 
                onComplete={() => { setSelectedIds(new Set()); refreshData(); }} 
                onClearSelection={() => setSelectedIds(new Set())} 
                onOptimisticUpdate={(ids, status) => optimisticUpdateRef.current?.(ids, status)}
            />
            {isPdfModalOpen && <PdfExportModal isOpen={true} onClose={() => setIsPdfModalOpen(false)} orders={filteredOrders} appData={appData} />}
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default DesktopOrdersDashboard;
