
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

interface OrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const OrdersDashboard: React.FC<OrdersDashboardProps> = ({ onBack, initialFilters }) => {
    const { 
        appData, refreshData, refreshTimestamp, currentUser, 
        setMobilePageTitle, orders, isOrdersLoading 
    } = useContext(AppContext);
    const [editingOrderId, setEditingOrderId] = useUrlState<string>('editOrder', '');
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [sortBy, setSortBy] = useState<string>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [groupBy, setGroupBy] = useState<string>('none');
    
    // Set Mobile Title
    useEffect(() => {
        setMobilePageTitle('គ្រប់គ្រងប្រតិបត្តិការណ៍');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle]);

    // URL State for Filters (Keep for deep linking if user refreshes)
    // Core
    const [urlTeam, setUrlTeam] = useUrlState<string>('teamFilter', '');
    const [urlDate, setUrlDate] = useUrlState<string>('dateFilter', 'this_month');
    const [urlLocation, setUrlLocation] = useUrlState<string>('locationFilter', '');
    const [urlStore, setUrlStore] = useUrlState<string>('storeFilter', ''); // This maps to fulfillmentStore filter
    const [urlStart, setUrlStart] = useUrlState<string>('startDate', '');
    const [urlEnd, setUrlEnd] = useUrlState<string>('endDate', '');
    
    // Logistics
    const [urlShipping, setUrlShipping] = useUrlState<string>('shippingFilter', '');
    const [urlDriver, setUrlDriver] = useUrlState<string>('driverFilter', '');
    
    // Extended Filters
    const [urlBrand, setUrlBrand] = useUrlState<string>('brandFilter', '');
    const [urlPayment, setUrlPayment] = useUrlState<string>('paymentFilter', '');
    const [urlUser, setUrlUser] = useUrlState<string>('userFilter', '');
    const [urlPage, setUrlPage] = useUrlState<string>('pageFilter', '');
    const [urlCost, setUrlCost] = useUrlState<string>('costFilter', '');
    const [urlBank, setUrlBank] = useUrlState<string>('bankFilter', '');
    const [urlProduct, setUrlProduct] = useUrlState<string>('productFilter', '');
    const [urlCustomer, setUrlCustomer] = useUrlState<string>('customerFilter', ''); // New URL State

    // Safe initialization for columns
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
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBorders, setShowBorders] = useState(true);

    const [filters, setFilters] = useState<FilterState>(() => {
        // Priority: Props -> URL -> Defaults
        const searchParams = new URLSearchParams(window.location.search);
        
        return {
            datePreset: (initialFilters?.datePreset || searchParams.get('dateFilter') as any) || 'this_month',
            startDate: initialFilters?.startDate || searchParams.get('startDate') || '',
            endDate: initialFilters?.endDate || searchParams.get('endDate') || '',
            
            team: initialFilters?.team || searchParams.get('teamFilter') || '',
            location: initialFilters?.location || searchParams.get('locationFilter') || '',
            
            // Note: 'storeFilter' URL param maps to 'fulfillmentStore' logic
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

    // Sync state TO URL changes
    useEffect(() => {
        if (filters.team !== urlTeam) setUrlTeam(filters.team);
        if (filters.datePreset !== urlDate) setUrlDate(filters.datePreset);
        if (filters.location !== urlLocation) setUrlLocation(filters.location);
        if (filters.fulfillmentStore !== urlStore) setUrlStore(filters.fulfillmentStore);
        if (filters.startDate !== urlStart) setUrlStart(filters.startDate);
        if (filters.endDate !== urlEnd) setUrlEnd(filters.endDate);
        if (filters.shippingService !== urlShipping) setUrlShipping(filters.shippingService);
        if (filters.driver !== urlDriver) setUrlDriver(filters.driver);
        
        // Extended
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
            case 'all': return 'All time data stream';
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
        }
        
        // Use local date parts to construct string to avoid timezone shifts
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        return start ? `${formatDate(start)} to ${formatDate(end)}` : 'All time data stream';
    }, [filters.datePreset, filters.startDate, filters.endDate]);

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) { if (next.size > 1) next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    // Robust Date Parsing helper for sorting and filtering
    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        
        // Handle "YYYY-MM-DD H:mm" format (Legacy/Manual)
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) {
            return new Date(
                parseInt(match[1]),
                parseInt(match[2]) - 1,
                parseInt(match[3]),
                parseInt(match[4]),
                parseInt(match[5])
            ).getTime();
        }

        // Handle ISO-like format with Z (e.g., "2026-01-04T06:31:21Z")
        // Treat as local time if it has Z, to match display logic
        if (typeof ts === 'string' && ts.endsWith('Z')) {
            return new Date(ts.slice(0, -1)).getTime();
        }

        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const sortedOrders = useMemo(() => {
        return [...orders].sort((a: any, b: any) => getOrderTimestamp(b) - getOrderTimestamp(a));
    }, [orders]);

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
            // 1. Date Filter
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

            // Helper for multi-select checking
            const isMatch = (filterValue: string, orderValue: string, partial = false) => {
                if (!filterValue) return true;
                const selectedValues = filterValue.split(',').map(v => v.trim().toLowerCase());
                const val = (orderValue || '').trim().toLowerCase();
                if (partial) {
                    return selectedValues.some(sv => val.includes(sv));
                }
                return selectedValues.includes(val);
            };

            // 2. Fulfillment Store Filter (Multi)
            if (!isMatch(filters.fulfillmentStore, order['Fulfillment Store'] || 'Unassigned')) return false;

            // 3. Store Filter (Brand/Sales) (Multi)
            if (filters.store) {
                const pageConfig = appData.pages?.find(p => p.PageName === order.Page);
                const orderStore = pageConfig ? pageConfig.DefaultStore : null;
                if (!isMatch(filters.store, orderStore || '')) return false;
            }

            // 4. Other Filters
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
                const selectedProducts = filters.product.split(',').map(v => v.trim().toLowerCase());
                if (!order.Products.some(p => selectedProducts.includes((p.name || p.ProductName || '').toLowerCase()))) return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return order['Order ID'].toLowerCase().includes(q) ||
                       (order['Customer Name'] || '').toLowerCase().includes(q) ||
                       (order['Customer Phone'] || '').includes(q);
            }
            return true;
        });

        // Apply Sorting
        return base.sort((a, b) => {
            let valA: any, valB: any;
            switch(sortBy) {
                case 'date': valA = getOrderTimestamp(a); valB = getOrderTimestamp(b); break;
                case 'total': valA = Number(a['Grand Total']) || 0; valB = Number(b['Grand Total']) || 0; break;
                case 'customer': valA = (a['Customer Name'] || '').toLowerCase(); valB = (b['Customer Name'] || '').toLowerCase(); break;
                case 'id': valA = a['Order ID']; valB = b['Order ID']; break;
                default: valA = getOrderTimestamp(a); valB = getOrderTimestamp(b);
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [enrichedOrders, filters, searchQuery, appData.pages, sortBy, sortOrder]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = (ids: string[]) => {
        const allSelected = ids.length > 0 && ids.every(id => selectedIds.has(id));
        if (allSelected) setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
        else setSelectedIds(prev => new Set([...prev, ...ids]));
    };

    if (isOrdersLoading && sortedOrders.length === 0) return (
        <div className="flex flex-col h-96 items-center justify-center gap-5">
            <Spinner size="lg" />
            <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Syncing Operational Logs...</p>
            </div>
        </div>
    );

    if (fetchError) return (
        <div className="flex flex-col h-96 items-center justify-center gap-6 p-6 text-center bg-gray-900/50 rounded-[3rem] border border-red-500/20 m-6 animate-fade-in">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center border border-red-500/30 shadow-xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2.5"/></svg>
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">កំហុសទាញយកទិន្នន័យ</h3>
                <p className="text-gray-500 font-bold max-w-md">{fetchError}</p>
            </div>
            <button onClick={() => refreshData()} className="btn btn-primary px-10 py-4 shadow-lg shadow-blue-600/20">ព្យាយាមម្ដងទៀត</button>
        </div>
    );

    if (editingOrderId) {
        const order = enrichedOrders.find(o => o['Order ID'] === editingOrderId);
        return order ? (
            <EditOrderPage 
                order={order} 
                onSaveSuccess={() => { setEditingOrderId(''); refreshData(); }} 
                onCancel={() => setEditingOrderId('')} 
            />
        ) : (
            <div className="p-20 text-center text-gray-500 font-black uppercase italic tracking-widest">រកមិនឃើញ Order ID នេះទេ</div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col animate-fade-in relative overflow-hidden">
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={usersList} appData={appData} calculatedRange={calculatedRange} />
                </FilterPanel>
            </div>
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-5xl">
                    <div className="p-8 bg-[#0f172a] rounded-[2.5rem] overflow-hidden relative flex flex-col h-full">
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-2 h-10 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"></div>
                                <div>
                                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Engine</h2>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1 ml-0.5">Advanced Search Subsystem</p>
                                </div>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10 shadow-xl">&times;</button>
                        </div>
                        
                        <div className="flex-grow pr-4 relative z-10">
                            <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={usersList} appData={appData} calculatedRange={calculatedRange} />
                        </div>
                        
                        <div className="mt-10 flex justify-center relative z-10 border-t border-white/5 pt-8">
                            <button 
                                onClick={() => setIsFilterModalOpen(false)} 
                                className="btn btn-primary w-full max-w-md py-5 text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl active:scale-[0.98] transition-all"
                            >
                                Apply Filter Configuration
                            </button>
                        </div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                        <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none"></div>
                    </div>
                </Modal>
            </div>

            {/* Header Section (Compact) */}
            <div className="flex-shrink-0 px-1 pt-1">
                <div className="flex flex-col lg:flex-row justify-between items-center mb-2 gap-2">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-xl transition-all active:scale-90 text-gray-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h1 className="hidden md:block text-lg lg:text-xl font-black text-white italic tracking-tighter leading-none py-1">គ្រប់គ្រងប្រតិបត្តិការណ៍</h1>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600/10 rounded-full border border-blue-500/20">
                                <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                                <span className="text-[8px] xl:text-[10px] font-black text-blue-400 uppercase tracking-widest">{filteredOrders.length} Logged</span>
                            </div>
                            {filters.team && (
                                <div className="px-2 py-0.5 bg-purple-600/10 rounded-full border border-purple-500/20">
                                    <span className="text-[8px] xl:text-[10px] font-black text-purple-400 uppercase tracking-widest">Team: {filters.team}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Floating Add Button for Mobile/Desktop */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.location.hash = '#/create-order'} className="flex items-center gap-2 px-4 md:px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg>
                            <span className="hidden sm:inline">បន្ថែមថ្មី</span>
                            <span className="sm:hidden">Add</span>
                        </button>
                    </div>
                </div>

                <div className="bg-[#020617]/60 backdrop-blur-2xl border border-white/5 rounded-2xl p-2 xl:p-3 mb-2 shadow-xl group transition-all hover:bg-gray-800/40">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-2">
                        <div className="relative w-full lg:max-w-xl group">
                            <input type="text" placeholder="ស្វែងរក..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input !pl-10 !py-2.5 bg-black/40 border-gray-800 rounded-xl text-[12px] font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" />
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2.5 text-gray-700 group-focus-within:text-blue-500 transition-colors">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <div className="h-4 w-px bg-gray-800"></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                            {/* Group By UI */}
                            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 h-11">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter leading-none flex flex-col">
                                    <span>ក្រុមតាម</span>
                                    <span className="text-[7px] opacity-50">Group By</span>
                                </span>
                                <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-purple-400 p-0 focus:ring-0 uppercase tracking-tight cursor-pointer">
                                    <option value="none">None</option>
                                    <option value="Page">Page</option>
                                    <option value="Team">Team</option>
                                    <option value="Fulfillment Store">Warehouse</option>
                                    <option value="Payment Status">Payment</option>
                                    <option value="Internal Shipping Method">Shipping</option>
                                </select>
                            </div>

                            {/* Sort UI */}
                            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 h-11">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter leading-none flex flex-col">
                                    <span>តម្រៀបតាម</span>
                                    <span className="text-[7px] opacity-50">Order By</span>
                                </span>
                                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-blue-400 p-0 focus:ring-0 uppercase tracking-tight cursor-pointer">
                                    <option value="date">Date</option>
                                    <option value="total">Amount</option>
                                    <option value="customer">Client</option>
                                    <option value="id">ID</option>
                                </select>
                                <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="ml-1 text-blue-500 hover:text-white transition-colors">
                                    {sortOrder === 'asc' ? 
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" strokeLinecap="round" strokeLinejoin="round"/></svg> :
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    }
                                </button>
                            </div>

                            <button onClick={() => setIsFilterModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 h-11">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                Filters
                            </button>
                            <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 h-11">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                Export
                            </button>
                            <button 
                                onClick={() => setShowBorders(!showBorders)} 
                                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border h-11 ${showBorders ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h16M4 19h16" />
                                </svg>
                                Borders
                            </button>
                            <div className="hidden lg:block h-11"><ColumnToggler columns={availableColumns} visibleColumns={visibleColumns} onToggle={toggleColumn} /></div>
                        </div>
                    </div>
                </div>

                {/* Shortcuts Area (New) */}
                <div className="flex flex-wrap items-center gap-3 px-1 mb-3">
                    <div className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-gray-500 uppercase ml-2">Short Cut</span>
                        {['today', 'yesterday', 'this_week', 'this_month'].map(p => (
                            <button key={p} onClick={() => setFilters(prev => ({...prev, datePreset: p as any}))} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${filters.datePreset === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5'}`}>{p.replace('_', ' ')}</button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-gray-500 uppercase ml-2">ឃ្លាំង</span>
                        {Array.from(new Set(appData.stores?.map(s => s.StoreName) || [])).slice(0, 4).map(s => {
                            const selected = filters.fulfillmentStore.split(',').map(v => v.trim()).includes(s);
                            return (
                                <button 
                                    key={s} 
                                    onClick={() => {
                                        const current = filters.fulfillmentStore.split(',').map(v => v.trim()).filter(v => v);
                                        const next = selected ? current.filter(v => v !== s) : [...current, s];
                                        setFilters(prev => ({...prev, fulfillmentStore: next.join(',')}));
                                    }} 
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:bg-white/5'}`}
                                >
                                    {s}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
                        <span className="text-[9px] font-black text-gray-500 uppercase ml-2">ហាង</span>
                        {Array.from(new Set(appData.pages?.map(p => p.DefaultStore).filter(Boolean) || [])).slice(0, 4).map(s => {
                            const selected = filters.store.split(',').map(v => v.trim()).includes(s);
                            return (
                                <button 
                                    key={s} 
                                    onClick={() => {
                                        const current = filters.store.split(',').map(v => v.trim()).filter(v => v);
                                        const next = selected ? current.filter(v => v !== s) : [...current, s];
                                        setFilters(prev => ({...prev, store: next.join(',')}));
                                    }} 
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selected ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:bg-white/5'}`}
                                >
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 min-h-0 relative z-10 overflow-hidden">
                <OrdersList orders={filteredOrders} onEdit={o => setEditingOrderId(o['Order ID'])} onView={o => setViewingOrder(o)} showActions={true} visibleColumns={visibleColumns} selectedIds={selectedIds} onToggleSelect={toggleSelection} onToggleSelectAll={toggleSelectAll} showBorders={showBorders} groupBy={groupBy} />
            </div>

            <BulkActionManager orders={enrichedOrders} selectedIds={selectedIds} onComplete={() => { setSelectedIds(new Set()); refreshData(); }} onClearSelection={() => setSelectedIds(new Set())} />
            {isPdfModalOpen && <PdfExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} orders={filteredOrders} />}
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default OrdersDashboard;