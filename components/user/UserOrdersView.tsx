import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import { ParsedOrder } from '../../types';
import Spinner from '../common/Spinner';
import OrdersList from '../orders/OrdersList';
import EditOrderPage from '../../pages/EditOrderPage'; 
import OrderDetailModal from '../orders/OrderDetailModal';
import UserSalesPageReport from '../../pages/UserSalesPageReport';
import ShippingReport from '../reports/ShippingReport';
import { safeParseDate, getValidDate, getTimestamp } from '../../utils/dateUtils';
import { FilterState } from '../orders/OrderFilters';
import { BarChart3, Truck, Settings, Search, Plus, X, Check, ShieldX } from 'lucide-react';
import { useOrder } from '../../context/OrderContext';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom';

interface ReportFilterState {
    datePreset: DateRangePreset;
    customStart: string;
    customEnd: string;
}

interface UserOrdersViewProps {
  onAdd: () => void;
  onStatsUpdate: (stats: { revenue: number; cost: number; paid: number; unpaid: number, count: number }) => void;
  showColumnSelectorToggle?: boolean;
  dateFilter?: any;
  customStart?: string;
  customEnd?: string;
}

const UserOrdersView: React.FC<UserOrdersViewProps> = ({ onAdd, onStatsUpdate, showColumnSelectorToggle = true, dateFilter: propDateFilter, customStart: propCustomStart, customEnd: propCustomEnd }) => {
    const { currentUser, language, refreshData, appData, orders, isOrdersLoading, hasPermission, selectedTeam, setAppState } = useContext(AppContext);
    const { ordersFetchError, fetchOrders } = useOrder();
    // State declarations
    const [viewOrders, setViewOrders] = useState<ParsedOrder[]>([]);
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [showShippingReport, setShowShippingReport] = useState(false);
    const [processing, setProcessing] = useState(false); 
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<DateRangePreset>('this_month');

    // Sync with external dateFilter prop (from Dashboard)
    useEffect(() => {
        if (propDateFilter) {
            let mappedFilter = propDateFilter;
            if (propDateFilter === 'month') mappedFilter = 'this_month';
            if (propDateFilter === 'year') mappedFilter = 'this_year';

            const finalRange = mappedFilter as DateRangePreset;
            setDateRange(finalRange);

            setAdvancedFilters(prev => ({
                ...prev,
                datePreset: finalRange,
                // When switching to custom, wire in the parent-supplied dates
                startDate: finalRange === 'custom' ? (propCustomStart ?? prev.startDate) : prev.startDate,
                endDate:   finalRange === 'custom' ? (propCustomEnd   ?? prev.endDate)   : prev.endDate,
            }));
        }
    }, [propDateFilter, propCustomStart, propCustomEnd]);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
        'index', 'customerName', 'productInfo', 'location', 'total', 'status', 'date', 'actions'
    ]));

    const [reportFilters, setReportFilters] = useState<ReportFilterState>({
        datePreset: 'this_month',
        customStart: new Date().toISOString().split('T')[0],
        customEnd: new Date().toISOString().split('T')[0]
    });

    const allColumns = [
        { key: 'index', label: language === 'km' ? 'លេខរៀង' : 'Index' },
        { key: 'actions', label: language === 'km' ? 'ប៊ូតុងសកម្មភាព' : 'Actions' },
        { key: 'customerName', label: language === 'km' ? 'អតិថិជន' : 'Customer' },
        { key: 'productInfo', label: language === 'km' ? 'ទំនិញ' : 'Products' },
        { key: 'location', label: language === 'km' ? 'ទីតាំង' : 'Location' },
        { key: 'pageInfo', label: language === 'km' ? 'Page' : 'Page' },
        { key: 'fulfillment', label: language === 'km' ? 'ឃ្លាំង' : 'Warehouse' },
        { key: 'total', label: language === 'km' ? 'តម្លៃសរុប' : 'Total' },
        { key: 'shippingService', label: language === 'km' ? 'សេវាដឹក' : 'Shipping' },
        { key: 'driver', label: language === 'km' ? 'អ្នកដឹក' : 'Driver' },
        { key: 'shippingCost', label: language === 'km' ? 'ថ្លៃដឹក' : 'Cost' },
        { key: 'status', label: language === 'km' ? 'ស្ថានភាព' : 'Status' },
        { key: 'date', label: language === 'km' ? 'កាលបរិច្ឆេទ' : 'Date' },
        { key: 'note', label: language === 'km' ? 'ចំណាំ' : 'Note' },
        { key: 'print', label: language === 'km' ? 'បោះពុម្ព' : 'Print' },
        { key: 'check', label: language === 'km' ? 'ផ្ទៀងផ្ទាត់' : 'Verify' },
        { key: 'orderId', label: language === 'km' ? 'ID' : 'Order ID' },
    ];

    const toggleColumn = (key: string) => {
        const next = new Set(visibleColumns);
        if (next.has(key)) {
            if (next.size > 1) next.delete(key);
        } else {
            next.add(key);
        }
        setVisibleColumns(next);
    };
    
    // Advanced Mobile Filtering
    const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
        datePreset: 'this_month', startDate: '', endDate: '', team: '', user: '',
        paymentStatus: '', shippingService: '', driver: '', product: '', bank: '',
        fulfillmentStore: '', store: '', page: '', location: '', internalCost: '',
        customerName: '', isVerified: 'All'
    });

    const getDateBounds = useCallback((preset: DateRangePreset, cStart?: string, cEnd?: string) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        
        let start: Date | null = null;
        let end: Date | null = endOfToday; // Default to end of today instead of 'now'

        switch (preset) {
            case 'today': 
                start = today; 
                end = endOfToday; 
                break;
            case 'yesterday': 
                start = new Date(today); 
                start.setDate(today.getDate() - 1); 
                end = new Date(today); 
                end.setMilliseconds(-1); 
                break;
            case 'this_week': 
                const d = now.getDay(); 
                start = new Date(today); 
                start.setDate(today.getDate() - (d === 0 ? 6 : d - 1)); 
                end = endOfToday; 
                break;
            case 'this_month': 
                start = new Date(now.getFullYear(), now.getMonth(), 1); 
                end = endOfToday; 
                break;
            case 'last_month': 
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); 
                break;
            case 'this_year': 
                start = new Date(now.getFullYear(), 0, 1); 
                end = endOfToday; 
                break;
            case 'last_year': 
                start = new Date(now.getFullYear() - 1, 0, 1); 
                end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999); 
                break;
            case 'all': 
                start = null; 
                end = null; 
                break;
            case 'custom': 
                if (cStart) start = getValidDate(cStart + 'T00:00:00'); 
                if (cEnd) end = getValidDate(cEnd + 'T23:59:59'); 
                break;
        }
        return { start, end };
    }, []);

    const enrichedOrders = useMemo(() => {
        if (!currentUser) return [];
        return orders.map(o => {
            let orderTeam = (o.Team || '').toString().trim();
            if (!orderTeam) {
                const userMatch = appData.users?.find(u => u.UserName === o.User);
                if (userMatch?.Team) orderTeam = userMatch.Team.split(',')[0].trim();
                else {
                    const pageMatch = appData.pages?.find(p => p.PageName === o.Page);
                    if (pageMatch?.Team) orderTeam = pageMatch.Team.trim();
                }
            }
            return { ...o, Team: orderTeam };
        });
    }, [orders, appData.users, appData.pages, currentUser]);

    const permittedOrders = useMemo(() => {
        const requestedTeam = (selectedTeam || '').trim().toLowerCase();
        if (!requestedTeam) return [];
        return enrichedOrders.filter(o => (o.Team || '').toLowerCase() === requestedTeam);
    }, [enrichedOrders, selectedTeam]);

    const processDataForRange = useCallback((range: DateRangePreset) => {
        setProcessing(true);
        const { start, end } = getDateBounds(range, advancedFilters.startDate, advancedFilters.endDate);
        
        // Log for debugging (optional: console.log("Filtering range:", range, start, end))
        
        const filtered = permittedOrders.filter(o => {
            const orderId = (o['Order ID'] || '').toString();
            // Skip opening balance entries
            if (orderId.includes('Opening_Balance') || orderId.includes('Opening Balance')) return false;
            
            if (range === 'all') return true;
            if (!o.Timestamp) return false;

            // Robust date parsing
            const orderDate = safeParseDate(o.Timestamp);
            if (!orderDate || isNaN(orderDate.getTime())) return range === 'all'; 

            // Check bounds
            if (start && orderDate < start) return false;
            if (end && orderDate > end) return false;
            
            return true;
        });

        // Sort by timestamp descending
        const sorted = [...filtered].sort((a, b) => {
            const timeA = safeParseDate(a.Timestamp)?.getTime() || 0;
            const timeB = safeParseDate(b.Timestamp)?.getTime() || 0;
            return timeB - timeA;
        });

        setViewOrders(sorted);
        setProcessing(false);
    }, [permittedOrders, getDateBounds, advancedFilters.startDate, advancedFilters.endDate]);

    // Ensure filtering runs whenever relevant data changes
    useEffect(() => { 
        processDataForRange(dateRange); 
    }, [dateRange, permittedOrders, processDataForRange]);

    const filteredOrders = useMemo(() => {
        return viewOrders.filter(o => {
            const isMatch = (fV: string, oV: string) => {
                if (!fV) return true;
                return fV.split(',').map(v => v.trim().toLowerCase()).includes((oV || '').toLowerCase());
            };
            if (!isMatch(advancedFilters.paymentStatus, o['Payment Status'])) return false;
            if (!isMatch(advancedFilters.fulfillmentStore, o['Fulfillment Store'] || 'Unassigned')) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (o['Order ID'] || '').toString().toLowerCase().includes(q) || 
                       (o['Customer Name'] || '').toLowerCase().includes(q) || 
                       (o['Customer Phone'] || '').toString().includes(q);
            }
            return true;
        });
    }, [viewOrders, searchQuery, advancedFilters]);

    const filteredMetrics = useMemo(() => {
        return filteredOrders.reduce((acc, curr) => ({
            revenue: acc.revenue + (Number(curr['Grand Total']) || 0),
            cost: acc.cost + (Number(curr['Internal Cost']) || 0),
            paid: acc.paid + (curr['Payment Status'] === 'Paid' ? 1 : 0),
            unpaid: acc.unpaid + (curr['Payment Status'] === 'Unpaid' ? 1 : 0),
            count: acc.count + 1
        }), { revenue: 0, cost: 0, paid: 0, unpaid: 0, count: 0 });
    }, [filteredOrders]);
    
    useEffect(() => {
        onStatsUpdate(filteredMetrics);
    }, [filteredMetrics, onStatsUpdate]);

    // Sync advanced filters with local dateRange
    useEffect(() => {
        if (advancedFilters.datePreset && advancedFilters.datePreset !== dateRange) {
            setDateRange(advancedFilters.datePreset as DateRangePreset);
        }
    }, [advancedFilters.datePreset, dateRange]);

    const handleClearFilters = () => {
        setSearchQuery('');
        setAdvancedFilters({
            datePreset: 'this_month', startDate: '', endDate: '', team: '', user: '',
            paymentStatus: '', shippingService: '', driver: '', product: '', bank: '',
            fulfillmentStore: '', store: '', page: '', location: '', internalCost: '',
            customerName: '', isVerified: 'All'
        });
        setDateRange('this_month');
    };

    const handleSaveEdit = () => { setEditingOrder(null); refreshData(); };

    const isFrontendDenied = !hasPermission('view_order_list');
    const isBackendDenied = ordersFetchError === 'permission_denied';

    // Auto-retry: frontend permission is now granted but a previous fetch got 403 (stale state).
    // This fixes the race where permissions load after the first fetch fires.
    useEffect(() => {
        if (isFrontendDenied || !isBackendDenied) return;
        const timer = setTimeout(() => fetchOrders(), 1500);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFrontendDenied, isBackendDenied]);

    // Auto-retry when frontend permission becomes available (transitions true → false).
    // Handles the case where OrderContext clears the backend error before the retry above
    // fires, leaving both flags false but orders still empty because no successful fetch ran.
    const prevFrontendDeniedRef = React.useRef(isFrontendDenied);
    useEffect(() => {
        const wasJustUnlocked = prevFrontendDeniedRef.current && !isFrontendDenied;
        prevFrontendDeniedRef.current = isFrontendDenied;
        if (wasJustUnlocked && orders.length === 0 && !isOrdersLoading) {
            fetchOrders();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFrontendDenied]);

    if (isFrontendDenied || isBackendDenied) {
        const userRole = currentUser?.Role || '(unknown)';
        console.warn(
            `[UserOrdersView] Access Denied — frontend=${isFrontendDenied}, backend403=${isBackendDenied}\n` +
            `  User role in JWT/session: "${userRole}"\n` +
            `  Admin must enable view_order_list for EXACTLY this role name in Permission Matrix.`
        );
        return (
            <div className="flex flex-col justify-center items-center h-96 gap-4 p-6 text-center">
                <div className="w-14 h-14 flex items-center justify-center rounded mb-1" style={{ backgroundColor: '#F6465D10', border: '1px solid #F6465D20' }}>
                    <ShieldX className="w-7 h-7 text-[#F6465D]" />
                </div>
                <h3 className="text-[#EAECEF] font-bold uppercase tracking-wider text-sm">
                    {language === 'km' ? 'បដិសេធសិទ្ធិចូល' : 'Access Denied'}
                </h3>
                <p className="text-[#848E9C] text-xs max-w-xs leading-relaxed">
                    {language === 'km'
                        ? `គណនីរបស់អ្នក (Role: "${userRole}") មិនមានសិទ្ធិ view_order_list ។ Admin ត្រូវបើកសិទ្ធិនេះសម្រាប់ Role ត្រឹមត្រូវ។`
                        : `Role "${userRole}" lacks view_order_list permission. Admin must enable it for exactly this role name.`}
                </p>
                {hasPermission('create_order') && (
                    <button
                        onClick={onAdd}
                        className="mt-2 flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-md active:scale-95 transition-all"
                        style={{ backgroundColor: '#F0B90B', color: '#181A20' }}
                    >
                        <Plus size={14} />
                        {language === 'km' ? 'បង្កើតការកម្មង់ថ្មី' : 'Create New Order'}
                    </button>
                )}
                {isBackendDenied && !isFrontendDenied && (
                    <>
                        <p className="text-[11px] mt-1 px-3 py-1.5 rounded" style={{ backgroundColor: '#F6465D15', color: '#F6465D', border: '1px solid #F6465D30' }}>
                            {language === 'km' ? '⚠ Server បដិសេធ (403) — ឈ្មោះ Role ក្នុង DB មិនត្រូវគ្នា' : '⚠ Server rejected (403) — Role name in DB may differ from your Role'}
                        </p>
                        <button
                            onClick={() => fetchOrders()}
                            className="mt-2 px-4 py-2 text-xs font-bold rounded-md active:scale-95 transition-all"
                            style={{ backgroundColor: '#F0B90B', color: '#181A20' }}
                        >
                            {language === 'km' ? 'ព្យាយាមម្ដងទៀត' : 'Retry'}
                        </button>
                    </>
                )}
            </div>
        );
    }

    if (isOrdersLoading && (!orders || orders.length === 0)) return (
        <div className="flex flex-col justify-center items-center h-[60vh] gap-6"><Spinner size="lg" /></div>
    );

    if (editingOrder) return <div className="fixed inset-0 z-[100] bg-[#0B0E11] animate-reveal overflow-y-auto"><EditOrderPage order={editingOrder} onSaveSuccess={handleSaveEdit} onCancel={() => setEditingOrder(null)} /></div>;

    if (showReport) return <div className="animate-fade-in h-full overflow-auto bg-[var(--cm-bg)]"><UserSalesPageReport orders={permittedOrders} onBack={() => setShowReport(false)} team={selectedTeam || ''} dateFilter={dateRange} customStart={advancedFilters.startDate} customEnd={advancedFilters.endDate} /></div>;

    if (showShippingReport) return <div className="animate-fade-in h-full overflow-auto bg-[var(--cm-bg)]"><ShippingReport orders={permittedOrders} appData={appData} dateFilter={dateRange} onBack={() => setShowShippingReport(false)} /></div>;

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 flex-shrink-0 border-b border-[var(--cm-border)]">
                {/* Simplified Filter/Search Bar */}
                 <div className="flex flex-wrap gap-2">
                    <div className="relative group flex-1 min-w-[200px]">
                        <input type="text" placeholder={language === 'km' ? 'ស្វែងរកការបញ្ជាទិញ...' : 'Scan orders...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[var(--cm-input-bg)] border border-[var(--cm-border)] rounded-md py-2.5 pl-9 pr-4 text-xs font-bold text-[#EAECEF] placeholder:text-secondary focus:border-primary transition-all outline-none" />
                        <div className="absolute left-3 top-0 bottom-0 flex items-center justify-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
                            <Search size={16} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Report Buttons */}
                        {hasPermission('view_revenue') && (
                            <>
                                <button onClick={() => setShowReport(true)} className="p-2.5 bg-[var(--cm-input-bg)] text-secondary border border-[var(--cm-border)] rounded-md active:scale-95 transition-all hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)]" title="Page Report">
                                    <BarChart3 size={18} />
                                </button>
                                <button onClick={() => setShowShippingReport(true)} className="p-2.5 bg-[var(--cm-input-bg)] text-secondary border border-[var(--cm-border)] rounded-md active:scale-95 transition-all hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)]" title="Shipping Cost">
                                    <Truck size={18} />
                                </button>
                            </>
                        )}

                        {showColumnSelectorToggle && (
                            <div className="relative">
                                <button onClick={() => setShowColumnSelector(!showColumnSelector)} className={`p-2.5 bg-[var(--cm-input-bg)] ${showColumnSelector ? 'text-[var(--cm-accent)] border-[var(--cm-accent)]' : 'text-secondary border-[var(--cm-border)]'} border rounded-md relative active:scale-95 transition-all hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)]`}>
                                    <Settings size={18} />
                                </button>
                                {showColumnSelector && (
                                    <>
                                        <div className="fixed inset-0 z-[55]" onClick={() => setShowColumnSelector(false)}></div>
                                        <div className="absolute right-0 mt-2 w-56 bg-[var(--cm-card-bg)] border border-[var(--cm-border)] rounded-lg shadow-2xl z-[60] overflow-hidden animate-fade-in-down">
                                            <div className="px-4 py-2 bg-[var(--cm-card-bg2)] border-b border-[var(--cm-border)]">
                                                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{language === 'km' ? 'កំណត់កឡោន' : 'Setup Columns'}</span>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto py-1 custom-scrollbar">
                                                {allColumns.map(col => (
                                                    <button key={col.key} onClick={() => toggleColumn(col.key)} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-[var(--cm-border)] transition-colors group">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${visibleColumns.has(col.key) ? 'bg-[var(--cm-accent)] border-[var(--cm-accent)]' : 'border-[var(--cm-border)] group-hover:border-[var(--cm-accent)]'}`}>
                                                            {visibleColumns.has(col.key) && <Check size={12} strokeWidth={4} />}
                                                        </div>
                                                        <span className={`text-xs font-medium ${visibleColumns.has(col.key) ? 'text-[var(--cm-text-primary)]' : 'text-secondary'}`}>{col.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {hasPermission('create_order') && (
                            <button onClick={onAdd} className="px-4 py-2.5 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] rounded-md active:scale-95 transition-all flex items-center gap-2 font-bold text-xs shadow-lg shadow-[var(--cm-accent)]/10">
                                <Plus size={16} /> {language === 'km' ? 'បង្កើតការកម្មង់' : 'Create Order'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto">
                {processing ? (
                    <div className="flex items-center justify-center h-full"><Spinner size="md" /></div>
                ) : filteredOrders.length === 0 ? (
                     <div className="flex flex-col items-center justify-center text-center h-full p-8">
                        <div className="w-16 h-16 bg-[var(--cm-card-bg2)] rounded-md flex items-center justify-center mb-6 border border-[var(--cm-border)]">
                           <X size={32} className="text-secondary opacity-40" />
                        </div>
                        <p className="text-xs font-bold text-[var(--cm-text-secondary)] uppercase tracking-wider">{language === 'km' ? 'រកមិនឃើញការបញ្ជាទិញទេ' : 'No Orders Found'}</p>
                        <p className="text-xs text-[var(--cm-text-muted)] mt-1 mb-6">{language === 'km' ? 'សូមព្យាយាមកែតម្រូវការចម្រោះ ឬចន្លោះកាលបរិច្ឆេទរបស់អ្នក។' : 'Try adjusting your filters or date range.'}</p>
                        <button onClick={handleClearFilters} className="px-6 py-2 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] text-xs font-bold rounded-md active:scale-95 transition-all">
                            {language === 'km' ? 'សម្អាតការចម្រោះ' : 'Clear Filters'}
                        </button>
                    </div>
                ) : (
                    <OrdersList orders={filteredOrders} onEdit={setEditingOrder} onView={setViewingOrder} viewMode='list' visibleColumns={visibleColumns} />
                )}
            </div>

            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default UserOrdersView;
