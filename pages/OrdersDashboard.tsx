
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

interface OrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const OrdersDashboard: React.FC<OrdersDashboardProps> = ({ onBack, initialFilters }) => {
    const { appData, refreshData, refreshTimestamp, currentUser, setMobilePageTitle } = useContext(AppContext);
    const [editingOrderId, setEditingOrderId] = useUrlState<string>('editOrder', '');
    
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

    const [allOrders, setAllOrders] = useState<ParsedOrder[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]); 
    const [loading, setLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0); 
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
            customerName: initialFilters?.customerName || searchParams.get('customerFilter') || '',
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
        if (filters.customerName !== urlCustomer) setUrlCustomer(filters.customerName);

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

    // --- Lazy Parsing Logic ---
    const parseOrdersInChunks = async (rawOrders: any[]) => {
        const chunkSize = 500;
        let processedOrders: ParsedOrder[] = [];
        for (let i = 0; i < rawOrders.length; i += chunkSize) {
            const chunk = rawOrders.slice(i, i + chunkSize);
            const parsedChunk = chunk.map((o: any) => {
                let products = [];
                try { if (o['Products (JSON)']) products = JSON.parse(o['Products (JSON)']); } catch (e) {}
                
                // Normalize product fields (image vs ImageURL)
                const normalizedProducts = Array.isArray(products) ? products.map((p: any) => {
                    const img = [p.image, p.ImageURL, p.Image].find(val => val && val !== 'N/A' && val !== 'null') || '';
                    return { ...p, image: img };
                }) : [];

                return { ...o, Products: normalizedProducts, IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' };
            });
            processedOrders = [...processedOrders, ...parsedChunk];
            setLoadingProgress(Math.round(((i + chunkSize) / rawOrders.length) * 100));
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        return processedOrders;
    };

    // Robust Date Parsing helper for sorting
    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        
        // Handle "YYYY-MM-DD H:mm" format explicitly
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
        return new Date(ts).getTime();
    };

    const fetchAllOrders = async () => {
        setLoading(true);
        setLoadingProgress(0);
        setFetchError(null);
        try {
            const [ordersRes, usersRes] = await Promise.all([
                fetch(`${WEB_APP_URL}/api/admin/all-orders`),
                fetch(`${WEB_APP_URL}/api/users`)
            ]);
            const ordersData = await ordersRes.json();
            const usersData = await usersRes.json();
            if (ordersData.status === 'success') {
                // Filter out Opening Balance (both formats)
                const rawData = (ordersData.data || []).filter((o: any) => 
                    o !== null && 
                    o['Order ID'] !== 'Opening Balance' && 
                    o['Order ID'] !== 'Opening_Balance'
                );
                const parsed = await parseOrdersInChunks(rawData);
                
                // Sort using the robust timestamp parser
                setAllOrders(parsed.sort((a: any, b: any) => getOrderTimestamp(b) - getOrderTimestamp(a)));
            } else {
                setFetchError(ordersData.message || "Failed to load orders");
            }
            if (usersData.status === 'success') setUsersList(usersData.data || []);
        } catch (e: any) { 
            console.error("Fetch Error:", e);
            setFetchError("មិនអាចទាញយកទិន្នន័យបានទេ។ សូមពិនិត្យ Internet របស់អ្នក។");
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchAllOrders(); }, [refreshTimestamp]);

    const enrichedOrders = useMemo(() => {
        return allOrders.map(order => {
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
    }, [allOrders, usersList, appData.pages]);

    const filteredOrders = useMemo(() => {
        return enrichedOrders.filter(order => {
            // 1. Date Filter
            if (filters.datePreset !== 'all') {
                // Use robust parsing for filtering as well
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

            // Helper for multi-select checking
            const isMatch = (filterValue: string, orderValue: string) => {
                if (!filterValue) return true;
                const selectedValues = filterValue.split(',').map(v => v.trim().toLowerCase());
                const val = (orderValue || '').trim().toLowerCase();
                return selectedValues.includes(val);
            };

            // 2. Fulfillment Store Filter (Multi)
            if (!isMatch(filters.fulfillmentStore, order['Fulfillment Store'] || 'Unassigned')) return false;

            // 3. Store Filter (Brand/Sales) (Multi)
            if (filters.store) {
                const pageConfig = appData.pages?.find(p => p.PageName === order.Page);
                const orderStore = pageConfig ? pageConfig.DefaultStore : null;
                const selectedStores = filters.store.split(',');
                if (!orderStore || !selectedStores.includes(orderStore)) {
                    return false;
                }
            }

            // 4. Other Filters (Multi where applicable)
            if (!isMatch(filters.team, order.Team)) return false;
            if (!isMatch(filters.user, order.User || '')) return false;
            if (!isMatch(filters.paymentStatus, order['Payment Status'])) return false;
            if (!isMatch(filters.shippingService, order['Internal Shipping Method'])) return false;
            if (!isMatch(filters.driver, order['Internal Shipping Details'])) return false;
            if (!isMatch(filters.bank, order['Payment Info'])) return false;
            if (!isMatch(filters.page, order.Page)) return false;
            if (!isMatch(filters.location, order.Location)) return false;
            if (!isMatch(filters.internalCost, String(order['Internal Cost']))) return false;

            // Customer Name Filter (Multi-Select Logic)
            if (!isMatch(filters.customerName, order['Customer Name'])) return false;

            // Product Filter (Special logic: "contains")
            if (filters.product && !order.Products.some(p => p.name === filters.product)) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return order['Order ID'].toLowerCase().includes(q) ||
                       (order['Customer Name'] || '').toLowerCase().includes(q) ||
                       (order['Customer Phone'] || '').includes(q);
            }
            return true;
        });
    }, [enrichedOrders, filters, searchQuery, appData.pages]);

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

    if (loading) return (
        <div className="flex flex-col h-96 items-center justify-center gap-5">
            <Spinner size="lg" />
            <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Syncing Operational Logs...</p>
                {loadingProgress > 0 && (
                    <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                    </div>
                )}
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
            <button onClick={fetchAllOrders} className="btn btn-primary px-10 py-4 shadow-lg shadow-blue-600/20">ព្យាយាមម្ដងទៀត</button>
        </div>
    );

    if (editingOrderId) {
        const order = enrichedOrders.find(o => o['Order ID'] === editingOrderId);
        return order ? (
            <EditOrderPage 
                order={order} 
                onSaveSuccess={() => { setEditingOrderId(''); fetchAllOrders(); refreshData(); }} 
                onCancel={() => setEditingOrderId('')} 
            />
        ) : (
            <div className="p-20 text-center text-gray-500 font-black uppercase italic tracking-widest">រកមិនឃើញ Order ID នេះទេ</div>
        );
    }

    return (
        <div className="w-full max-w-full mx-auto px-3 sm:px-6 lg:px-8 animate-fade-in relative pb-40 pt-6 overflow-x-hidden">
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={usersList} appData={appData} calculatedRange={calculatedRange} />
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
                            <OrderFilters filters={filters} setFilters={setFilters} orders={enrichedOrders} usersList={usersList} appData={appData} calculatedRange={calculatedRange} />
                        </div>
                        <div className="mt-12 flex justify-center relative z-10"><button onClick={() => setIsFilterModalOpen(false)} className="btn btn-primary w-full py-5 text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl active:scale-[0.98] transition-all">Apply Filter Configuration</button></div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                    </div>
                </Modal>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-6 px-1">
                <div>
                    <h1 className="hidden md:block text-3xl lg:text-5xl font-black text-white italic tracking-tighter leading-relaxed mb-3 py-1">គ្រប់គ្រងប្រតិបត្តិការណ៍</h1>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 rounded-full border border-blue-500/20">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">{filteredOrders.length} Entries Logged</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onBack} className="hidden md:flex group items-center gap-3 px-8 py-4 bg-gray-800/40 backdrop-blur-xl border border-white/5 hover:border-blue-500/30 text-gray-500 hover:text-blue-400 font-black uppercase tracking-widest text-[12px] rounded-2xl transition-all shadow-xl active:scale-95">
                        <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Core
                    </button>
                </div>
            </div>

            <div className="bg-gray-800/20 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-5 sm:p-6 mb-8 shadow-2xl relative z-20 group transition-all hover:bg-gray-800/30">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="relative w-full lg:max-w-2xl group">
                        <input type="text" placeholder="ស្វែងរក ID, ឈ្មោះ, ឬលេខទូរស័ព្ទ..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input !pl-16 !py-5 bg-black/40 border-gray-800 rounded-[1.8rem] text-[15px] font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" />
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-4 text-gray-700 group-focus-within:text-blue-500 transition-colors">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <div className="h-6 w-px bg-gray-800"></div>
                        </div>
                    </div>
                    <div className="flex items-stretch gap-3 w-full lg:w-auto h-16 sm:h-[68px]">
                        <button onClick={() => setIsFilterModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/30 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                        <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-950/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Export
                        </button>
                        <div className="hidden lg:block h-full"><ColumnToggler columns={availableColumns} visibleColumns={visibleColumns} onToggle={toggleColumn} /></div>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                <OrdersList orders={filteredOrders} onEdit={o => setEditingOrderId(o['Order ID'])} showActions={true} visibleColumns={visibleColumns} selectedIds={selectedIds} onToggleSelect={toggleSelection} onToggleSelectAll={toggleSelectAll} />
            </div>

            <BulkActionManager orders={enrichedOrders} selectedIds={selectedIds} onComplete={() => { setSelectedIds(new Set()); fetchAllOrders(); }} onClearSelection={() => setSelectedIds(new Set())} />
            {isPdfModalOpen && <PdfExportModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} orders={filteredOrders} />}
        </div>
    );
};

export default OrdersDashboard;
1