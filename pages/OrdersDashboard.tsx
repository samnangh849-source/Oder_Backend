
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
import { FilterPanel } from '../components/orders/FilterPanel';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import { translations } from '../translations';

interface OrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const OrdersDashboard: React.FC<OrdersDashboardProps> = ({ onBack, initialFilters }) => {
    const { 
        appData, refreshData, refreshTimestamp, currentUser, 
        setMobilePageTitle, orders, isOrdersLoading, language
    } = useContext(AppContext);
    
    // Safety fallback for translations
    const t = useMemo(() => translations[language || 'km'] || translations['km'], [language]);

    const [editingOrderId, setEditingOrderId] = useUrlState<string>('editOrder', '');
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [sortBy, setSortBy] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [groupBy, setGroupBy] = useState<string>('none');
    
    // Set Mobile Title
    useEffect(() => {
        setMobilePageTitle(t.manage_orders || 'គ្រប់គ្រងប្រតិបត្តិការណ៍');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, t]);

    // URL State for Filters
    const [urlTeam, setUrlTeam] = useUrlState<string>('teamFilter', '');
    const [urlDate, setUrlDate] = useUrlState<string>('dateFilter', 'this_month');
    const [urlLocation, setUrlLocation] = useUrlState<string>('locationFilter', '');
    const [urlStore, setUrlStore] = useUrlState<string>('storeFilter', ''); 
    const [urlStart, setUrlStart] = useUrlState<string>('startDate', '');
    const [urlEnd, setUrlEnd] = useUrlState<string>('endDate', '');
    const [urlShipping, setUrlShipping] = useUrlState<string>('shippingFilter', '');
    const [urlDriver, setUrlDriver] = useUrlState<string>('driverFilter', '');
    const [urlBrand, setUrlBrand] = useUrlState<string>('brandFilter', '');
    const [urlPayment, setUrlPayment] = useUrlState<string>('paymentFilter', '');
    const [urlUser, setUrlUser] = useUrlState<string>('userFilter', '');
    const [urlPage, setUrlPage] = useUrlState<string>('pageFilter', '');
    const [urlCost, setUrlCost] = useUrlState<string>('costFilter', '');
    const [urlBank, setUrlBank] = useUrlState<string>('bankFilter', '');
    const [urlProduct, setUrlProduct] = useUrlState<string>('productFilter', '');
    const [urlCustomer, setUrlCustomer] = useUrlState<string>('customerFilter', '');

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

    const [usersList, setUsersList] = useState<User[]>([]); 
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBorders, setShowBorders] = useState(true);

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

    useEffect(() => {
        if (filters.team !== urlTeam) setUrlTeam(filters.team);
        if (filters.datePreset !== urlDate) setUrlDate(filters.datePreset);
        if (filters.location !== urlLocation) setUrlLocation(filters.location);
        if (filters.fulfillmentStore !== urlStore) setUrlStore(filters.fulfillmentStore);
        if (filters.startDate !== urlStart) setUrlStart(filters.startDate);
        if (filters.endDate !== urlEnd) setUrlEnd(filters.endDate);
        if (filters.shippingService !== urlShipping) setUrlShipping(filters.shippingService);
        if (filters.driver !== urlDriver) setUrlDriver(filters.driver);
        if (filters.store !== urlBrand) setUrlBrand(filters.store);
        if (filters.paymentStatus !== urlPayment) setUrlPayment(filters.paymentStatus);
        if (filters.user !== urlUser) setUrlUser(filters.user);
        if (filters.page !== urlPage) setUrlPage(filters.page);
        if (filters.internalCost !== urlCost) setUrlCost(filters.internalCost);
        if (filters.bank !== urlBank) setUrlBank(filters.bank);
        if (filters.product !== urlProduct) setUrlProduct(filters.product);
        if (filters.customerSearch !== urlCustomer) setUrlCustomer(filters.customerSearch);
    }, [filters, urlTeam, urlDate, urlLocation, urlStore, urlStart, urlEnd, urlShipping, urlDriver, urlBrand, urlPayment, urlUser, urlPage, urlCost, urlBank, urlProduct, urlCustomer]);

    const calculatedRange = useMemo(() => {
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
            case 'all': return t.all_time;
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
        }
        const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return start ? `${formatDate(start)} to ${formatDate(end)}` : t.all_time;
    }, [filters.datePreset, filters.startDate, filters.endDate, t]);

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
        if (typeof ts === 'string' && ts.endsWith('Z')) return new Date(ts.slice(0, -1)).getTime();
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const sortedOrders = useMemo(() => [...orders].sort((a: any, b: any) => getOrderTimestamp(b) - getOrderTimestamp(a)), [orders]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(`${WEB_APP_URL}/api/users`);
                const data = await res.json();
                if (data.status === 'success') setUsersList(data.data || []);
            } catch (e) {}
        };
        fetchUsers();
    }, [refreshTimestamp]);

    const enrichedOrders = useMemo(() => {
        return sortedOrders.map(order => {
            let team = (order.Team || '').trim();
            if (!team) {
                const u = usersList.find(u => u.UserName === order.User);
                if (u?.Team) team = u.Team.split(',')[0].trim();
                else {
                    const p = appData.pages?.find(pg => pg.PageName === order.Page);
                    if (p?.Team) team = p.Team;
                }
            }
            return { ...order, Team: team || 'Unassigned' };
        });
    }, [sortedOrders, usersList, appData.pages]);

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
    }, [enrichedOrders, filters, searchQuery, appData.pages, sortBy, sortOrder, t.all_time]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = (ids: string[]) => {
        const all = ids.length > 0 && ids.every(id => selectedIds.has(id));
        if (all) setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
        else setSelectedIds(prev => new Set([...prev, ...ids]));
    };

    if (isOrdersLoading && sortedOrders.length === 0) return (
        <div className="flex flex-col h-96 items-center justify-center gap-5">
            <Spinner size="lg" />
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Syncing Operational Logs...</p>
        </div>
    );

    if (editingOrderId) {
        const order = enrichedOrders.find(o => o['Order ID'] === editingOrderId);
        return order ? (
            <EditOrderPage order={order} onSaveSuccess={() => { setEditingOrderId(''); refreshData(); }} onCancel={() => setEditingOrderId('')} />
        ) : (
            <div className="p-20 text-center text-gray-500 font-black uppercase italic tracking-widest">{t.no_data || 'No Data Found'}</div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col animate-fade-in relative bg-[#020617] overflow-hidden">
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={usersList} appData={appData} calculatedRange={calculatedRange} />
                </FilterPanel>
            </div>
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-5xl">
                    <div className="p-8 bg-[#0f172a] rounded-[2.5rem] overflow-hidden relative flex flex-col h-[85vh]">
                        <div className="flex-shrink-0 flex justify-between items-center mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-2 h-10 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"></div>
                                <div>
                                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">{t.filter_engine}</h2>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1 ml-0.5">{t.advanced_search}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all border border-white/5 shadow-xl">&times;</button>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-4 relative z-10 custom-scrollbar">
                            <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={usersList} appData={appData} calculatedRange={calculatedRange} />
                        </div>
                        <div className="flex-shrink-0 mt-6 flex justify-center relative z-10 border-t border-white/5 pt-6">
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl transition-all">{t.apply_config}</button>
                        </div>
                    </div>
                </Modal>
            </div>

            <div className="flex-shrink-0 px-4 pt-4 pb-2 relative z-20">
                <div className="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-90 text-gray-400 hover:text-white border border-white/5 shadow-xl">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="flex flex-col">
                            <h1 className="hidden md:block text-xl font-black text-white italic tracking-tighter leading-none">{t.manage_orders}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600/10 rounded-full border border-blue-500/20">
                                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{filteredOrders.length} {t.logged}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.location.hash = '#/create-order'} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all border border-blue-400/20">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg>
                            <span>{t.add_new}</span>
                        </button>
                    </div>
                </div>

                <div className="bg-gray-900/40 backdrop-blur-3xl border border-white/5 rounded-3xl p-3 mb-4 shadow-2xl transition-all">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
                        <div className="relative w-full lg:max-w-xl group">
                            <input type="text" placeholder={t.search_placeholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input !pl-12 !py-3.5 bg-black/40 border-gray-800/50 rounded-2xl text-sm font-bold text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-gray-600 group-focus-within:text-blue-500 transition-colors">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <div className="h-5 w-px bg-gray-800/50"></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <div className="flex items-center gap-3 bg-black/40 border border-gray-800/50 rounded-2xl px-4 h-12 shadow-inner">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none flex flex-col"><span>{t.group_by}</span></span>
                                <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="bg-transparent border-none text-xs font-black text-purple-400 p-0 focus:ring-0 uppercase tracking-tight cursor-pointer">
                                    <option value="none">{t.none}</option>
                                    <option value="Page">Page</option>
                                    <option value="Team">Team</option>
                                    <option value="Fulfillment Store">{t.warehouse}</option>
                                    <option value="Payment Status">{t.group_payment}</option>
                                    <option value="Internal Shipping Method">{t.group_shipping}</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 bg-black/40 border border-gray-800/50 rounded-2xl px-4 h-12 shadow-inner">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none flex flex-col"><span>{t.sort_by}</span></span>
                                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent border-none text-xs font-black text-blue-400 p-0 focus:ring-0 uppercase tracking-tight cursor-pointer">
                                    <option value="date">{t.sort_date}</option>
                                    <option value="total">{t.sort_amount}</option>
                                    <option value="customer">{t.sort_client}</option>
                                    <option value="id">{t.sort_id}</option>
                                </select>
                                <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="ml-1 text-blue-500 hover:text-white transition-colors active:scale-90">
                                    {sortOrder === 'asc' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </button>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2.5 px-5 bg-black/40 border border-gray-800/50 text-gray-400 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 h-12 shadow-inner">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                {t.reports}
                            </button>
                            <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2.5 px-5 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all h-12 shadow-lg shadow-red-900/10">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                {t.export}
                            </button>
                            <button onClick={() => setShowBorders(!showBorders)} className={`flex-1 lg:flex-none flex items-center justify-center gap-2.5 px-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border h-12 ${showBorders ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-black/40 border-gray-800/50 text-gray-400 hover:text-white'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h16M4 19h16" /></svg>
                                {t.borders}
                            </button>
                            <div className="hidden lg:block h-12"><ColumnToggler visibleColumns={visibleColumns} onToggle={toggleColumn} /></div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-2 px-1">
                    <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-gray-600 uppercase ml-2 tracking-widest">ShortCut</span>
                        {['today', 'yesterday', 'this_week', 'this_month'].map(p => (
                            <button key={p} onClick={() => setFilters(prev => ({...prev, datePreset: p as any}))} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filters.datePreset === p ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                {(t as any)[p] || p.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-gray-600 uppercase ml-2 tracking-widest">{t.warehouse}</span>
                        {Array.from(new Set(appData.stores?.map(s => s.StoreName) || [])).slice(0, 4).map(s => {
                            const sel = filters.fulfillmentStore.split(',').map(v => v.trim()).includes(s);
                            return (
                                <button key={s} onClick={() => {
                                    const cur = filters.fulfillmentStore.split(',').map(v => v.trim()).filter(v => v);
                                    const nxt = sel ? cur.filter(v => v !== s) : [...cur, s];
                                    setFilters(prev => ({...prev, fulfillmentStore: nxt.join(',')}));
                                }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${sel ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>{s}</button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative z-10 px-4 pb-4">
                <div className="h-full bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <OrdersList orders={filteredOrders} onEdit={o => setEditingOrderId(o['Order ID'])} onView={o => setViewingOrder(o)} showActions={true} visibleColumns={visibleColumns} selectedIds={selectedIds} onToggleSelect={toggleSelection} onToggleSelectAll={toggleSelectAll} showBorders={showBorders} groupBy={groupBy} />
                </div>
            </div>

            <BulkActionManager orders={enrichedOrders} selectedIds={selectedIds} onComplete={() => { setSelectedIds(new Set()); refreshData(); }} onClearSelection={() => setSelectedIds(new Set())} />
            {isPdfModalOpen && <PdfExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} orders={filteredOrders} />}
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default OrdersDashboard;
