import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import { ParsedOrder, User } from '../../types';
import Spinner from '../common/Spinner';
import OrdersList from '../orders/OrdersList';
import EditOrderPage from '../../pages/EditOrderPage'; 
import OrderDetailModal from '../orders/OrderDetailModal';
import UserSalesPageReport from '../../pages/UserSalesPageReport'; 
import ShippingReport from '../reports/ShippingReport';
import { safeParseDate, getValidDate, getTimestamp } from '../../utils/dateUtils';
import { translations } from '../../translations';
import { WEB_APP_URL } from '../../constants';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { FilterPanel } from '../orders/FilterPanel';
import MobileFilterEngine from '../orders/MobileFilterEngine';
import { FilterState } from '../orders/OrderFilters';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom';

interface ReportFilterState {
    datePreset: DateRangePreset;
    customStart: string;
    customEnd: string;
}

const UserOrdersView: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
    const { currentUser, refreshData, appData, orders, isOrdersLoading, isSyncing, hasPermission, language, selectedTeam: team, previewImage } = useContext(AppContext);
    const { playClick, playPop, playTransition } = useSoundEffects();
    const t = translations[language];
    
    // 1. STATE DECLARATIONS
    const [viewOrders, setViewOrders] = useState<ParsedOrder[]>([]);
    const [drilldownFilters, setDrilldownFilters] = useState<any>(null);
    const [drilldownData, setDrilldownData] = useState<ParsedOrder[]>([]);
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [processing, setProcessing] = useState(false); 
    const [searchQuery, setSearchQuery] = useState('');
    const [showReport, setShowReport] = useState(false);
    const [showShippingReport, setShowShippingReport] = useState(false); 
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [lastSync, setLastSync] = useState<Date>(new Date());
    
    const [dateRange, setDateRange] = useState<DateRangePreset>('this_month');
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [reportFilters, setReportFilters] = useState<ReportFilterState>({
        datePreset: 'this_month',
        customStart: new Date().toISOString().split('T')[0],
        customEnd: new Date().toISOString().split('T')[0]
    });

    const [globalRanking, setGlobalRanking] = useState<{name: string, revenue: number}[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(true);
    const [globalShippingOrders, setGlobalShippingOrders] = useState<any[]>([]);
    const [isShippingLoading, setIsShippingLoading] = useState(false);

    // Advanced Mobile Filtering
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
        datePreset: 'this_month', startDate: '', endDate: '', team: '', user: '',
        paymentStatus: '', shippingService: '', driver: '', product: '', bank: '',
        fulfillmentStore: '', store: '', page: '', location: '', internalCost: '',
        customerName: '', isVerified: 'All'
    });

    // 2. HELPERS
    const getDateBounds = useCallback((preset: DateRangePreset, cStart?: string, cEnd?: string) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date | null = null;
        let end: Date | null = new Date();
        switch (preset) {
            case 'today': start = today; end = new Date(today); end.setHours(23, 59, 59, 999); break;
            case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': const d = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (d === 0 ? 6 : d - 1)); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999); break;
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
            case 'all': start = null; end = null; break;
            case 'custom': if (cStart) start = getValidDate(cStart + 'T00:00:00'); if (cEnd) end = getValidDate(cEnd + 'T23:59:59'); break;
        }
        return { start, end };
    }, []);

    // 3. MEMOIZED DATA
    const enrichedOrders = useMemo(() => {
        if (!currentUser) return [];
        return orders.map(o => {
            let orderTeam = (o.Team || '').toString().trim();
            if (!orderTeam) {
                const userMatch = appData.users?.find(u => u.UserName === o.User);
                if (userMatch?.Team) {
                    orderTeam = userMatch.Team.split(',')[0].trim();
                } else {
                    const pageMatch = appData.pages?.find(p => p.PageName === o.Page);
                    if (pageMatch?.Team) {
                        orderTeam = pageMatch.Team.trim();
                    }
                }
            }
            return { ...o, Team: orderTeam };
        });
    }, [orders, appData.users, appData.pages, currentUser]);

    const permittedOrders = useMemo(() => {
        const requestedTeam = (team || '').trim().toLowerCase();
        if (!requestedTeam) return [];
        return enrichedOrders.filter(o => (o.Team || '').toLowerCase() === requestedTeam);
    }, [enrichedOrders, team]);

    const calculatedRange = useMemo(() => {
        const { start, end } = getDateBounds(advancedFilters.datePreset as any, advancedFilters.startDate, advancedFilters.endDate);
        if (!start || !end) return 'All time';
        const format = (d: Date) => d.toISOString().split('T')[0];
        return `${format(start)} to ${format(end)}`;
    }, [advancedFilters.datePreset, advancedFilters.startDate, advancedFilters.endDate, getDateBounds]);

    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/teams/ranking`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success' && result.data) {
                    setGlobalRanking(result.data.map((r: any) => ({ 
                        name: r.Team || 'Unknown', 
                        revenue: Number(r.Revenue) || 0 
                    })));
                }
            } else {
                console.error("Ranking API returned non-ok status:", response.status);
            }
        } catch (err) {
            console.error("Failed to fetch team ranking:", err);
        } finally {
            setIsRankingLoading(false);
        }
    }, []);

    const fetchGlobalShippingCosts = useCallback(async () => {
        setIsShippingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/teams/shipping-costs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') setGlobalShippingOrders(result.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch global shipping costs:", err);
        } finally {
            setIsShippingLoading(false);
        }
    }, []);

    useEffect(() => {
        if (showShippingReport && globalShippingOrders.length === 0) {
            fetchGlobalShippingCosts();
        }
    }, [showShippingReport, globalShippingOrders.length, fetchGlobalShippingCosts]);

    // 4. EFFECTS
    useEffect(() => {
        if (!hasPermission('view_order_list')) return;
        fetchRanking();
        const interval = setInterval(() => {
            refreshData();
            fetchRanking();
            setLastSync(new Date());
        }, 30000);
        return () => clearInterval(interval);
    }, [hasPermission, refreshData, fetchRanking]);

    const userVisibleColumns = useMemo(() => new Set([
        'index', 'orderId', 'customerName', 'productInfo', 'location', 'pageInfo', 'total', 'shippingService', 'status', 'date', 'print', 'actions'
    ]), []);

    const processDataForRange = useCallback((range: DateRangePreset) => {
        setProcessing(true);
        setTimeout(() => {
            const { start, end } = getDateBounds(range, customStart, customEnd);
            const filtered = permittedOrders.filter(o => {
                const orderId = (o['Order ID'] || '').toString();
                if (orderId.includes('Opening_Balance') || orderId.includes('Opening Balance')) return false;
                if ((range as string) === 'all') return true;
                if (!o.Timestamp) return false;
                const orderDate = safeParseDate(o.Timestamp);
                if (!orderDate) return range === 'all'; 
                if (start && orderDate < start) return false;
                if (end && orderDate > end) return false;
                return true;
            });
            setViewOrders(filtered.sort((a, b) => getTimestamp(b.Timestamp) - getTimestamp(a.Timestamp)));
            setProcessing(false);
        }, 10);
    }, [permittedOrders, customStart, customEnd, getDateBounds]);

    useEffect(() => { processDataForRange(dateRange); }, [dateRange, processDataForRange]);

    useEffect(() => {
        if (drilldownFilters) {
            setProcessing(true);
            setTimeout(() => {
                let start: Date | null = null;
                let end: Date | null = new Date();
                if (drilldownFilters.isMonthlyDrilldown || drilldownFilters.datePreset === 'custom') {
                    const dStart = drilldownFilters.customStart || drilldownFilters.startDate;
                    const dEnd = drilldownFilters.customEnd || drilldownFilters.endDate;
                    if (dStart) start = getValidDate(dStart + 'T00:00:00');
                    if (dEnd) end = getValidDate(dEnd + 'T23:59:59');
                } else if (drilldownFilters.datePreset) {
                    const bounds = getDateBounds(drilldownFilters.datePreset);
                    start = bounds.start;
                    end = bounds.end;
                }
                const filtered = permittedOrders.filter(o => {
                    const orderId = (o['Order ID'] || '').toString();
                    if (orderId.includes('Opening_Balance') || orderId.includes('Opening Balance')) return false;
                    
                    if (start || end) {
                        const d = safeParseDate(o.Timestamp);
                        if (!d || (start && d < start) || (end && d > end)) return false;
                    }
                    
                    if (drilldownFilters.user && o.User !== drilldownFilters.user) return false;
                    if (drilldownFilters.page && o.Page !== drilldownFilters.page) return false;
                    
                    // Add Warehouse Filter Logic
                    if (drilldownFilters.fulfillmentStore) {
                        const selectedStores = drilldownFilters.fulfillmentStore.split(',').map((s: string) => s.trim().toLowerCase());
                        const orderStore = (o['Fulfillment Store'] || 'Unassigned').toLowerCase();
                        if (!selectedStores.includes(orderStore)) return false;
                    }
                    
                    return true;
                });
                setDrilldownData(filtered.sort((a, b) => getTimestamp(b.Timestamp) - getTimestamp(a.Timestamp)));
                setProcessing(false);
            }, 10);
        }
    }, [drilldownFilters, permittedOrders, getDateBounds]);

    const filteredOrders = useMemo(() => {
        const source = drilldownFilters ? drilldownData : viewOrders;
        return source.filter(o => {
            // Advanced Filters
            const isMatch = (fV: string, oV: string) => {
                if (!fV) return true;
                const sVs = fV.split(',').map(v => v.trim().toLowerCase());
                return sVs.includes((oV || '').toLowerCase());
            };

            if (isFilterPanelOpen || Object.values(advancedFilters).some(v => v && v !== 'all' && v !== 'this_month')) {
                if (!isMatch(advancedFilters.paymentStatus, o['Payment Status'])) return false;
                if (!isMatch(advancedFilters.fulfillmentStore, o['Fulfillment Store'] || 'Unassigned')) return false;
                if (advancedFilters.product) {
                    const sP = advancedFilters.product.split(',').map(v => v.trim().toLowerCase());
                    if (!o.Products.some(p => sP.includes((p.name || '').toLowerCase()))) return false;
                }
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (o['Order ID'] || '').toString().toLowerCase().includes(q) || 
                       (o['Customer Name'] || '').toLowerCase().includes(q) || 
                       (o['Customer Phone'] || '').toString().includes(q);
            }
            return true;
        });
    }, [viewOrders, drilldownData, drilldownFilters, searchQuery, advancedFilters, isFilterPanelOpen]);

    const filteredMetrics = useMemo(() => {
        return filteredOrders.reduce((acc, curr) => ({
            revenue: acc.revenue + (Number(curr['Grand Total']) || 0),
            cost: acc.cost + (Number(curr['Internal Cost']) || 0),
            paid: acc.paid + (curr['Payment Status'] === 'Paid' ? 1 : 0),
            unpaid: acc.unpaid + (curr['Payment Status'] === 'Unpaid' ? 1 : 0)
        }), { revenue: 0, cost: 0, paid: 0, unpaid: 0 });
    }, [filteredOrders]);

    const handleSaveEdit = () => { setEditingOrder(null); refreshData(); };

    // 5. RENDER LOGIC
    if (!hasPermission('view_order_list')) return (
        <div className="flex flex-col justify-center items-center h-96 gap-4 p-6 text-center">
            <div className="w-16 h-16 bg-[#F6465D]/10 rounded-lg flex items-center justify-center border border-[#F6465D]/20 mb-2">
                <svg className="w-8 h-8 text-[#F6465D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-[#EAECEF] font-bold uppercase tracking-wider text-sm">Access Denied</h3>
            <p className="text-secondary text-[11px] font-bold uppercase tracking-widest max-w-xs">អ្នកមិនមានសិទ្ធិចូលមើលបញ្ជីការកម្មង់ឡើយ។ សូមទាក់ទង Admin។</p>
        </div>
    );

    if (isOrdersLoading && (!orders || orders.length === 0)) return (
        <div className="flex flex-col justify-center items-center h-[60vh] gap-6 animate-reveal">
            <div className="relative">
                <Spinner size="lg" />
            </div>
            <div className="text-center space-y-2">
                <p className="text-[10px] font-bold text-[#EAECEF] uppercase tracking-widest animate-pulse">Establishing Connection</p>
                <p className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">Syncing Operational Node: {team}</p>
            </div>
        </div>
    );

    if (editingOrder) return <div className="animate-reveal"><EditOrderPage order={editingOrder} onSaveSuccess={handleSaveEdit} onCancel={() => setEditingOrder(null)} /></div>;

    if (drilldownFilters) return (
        <div className="animate-reveal min-h-full flex flex-col space-y-6">
            <div className="flex items-center justify-between bg-card-bg border border-[#2B3139] p-6 rounded-md">
                <div>
                    <h2 className="text-lg font-bold text-[#EAECEF] tracking-tight uppercase">Operation Drilldown</h2>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-sm border border-primary/20 uppercase">{drilldownFilters.page || drilldownFilters.shipping || 'Filtered View'}</span>
                        <span className="text-[10px] text-secondary font-bold uppercase tracking-widest">{drilldownData.length} Entries Found</span>
                    </div>
                </div>
                <button onClick={() => setDrilldownFilters(null)} className="px-6 py-2.5 bg-[#2B3139] hover:bg-[#474D57] text-[#EAECEF] rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border border-[#2B3139]">Return to Overview</button>
            </div>
            {processing ? <div className="flex justify-center py-20"><Spinner size="md" /></div> : <OrdersList orders={filteredOrders} showActions={true} visibleColumns={userVisibleColumns} onEdit={setEditingOrder} onView={setViewingOrder} />}
        </div>
    );

    if (showReport) return <div className="animate-reveal"><UserSalesPageReport orders={permittedOrders} onBack={() => setShowReport(false)} team={team} onNavigate={(filters) => setDrilldownFilters(filters)} initialFilters={reportFilters} onFilterChange={setReportFilters} /></div>;

    if (showShippingReport) return (
        <div className="animate-reveal min-h-full">
            {isShippingLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4 bg-bg-black">
                    <Spinner size="lg" />
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">Loading Global Costs...</p>
                </div>
            ) : (
                <ShippingReport orders={globalShippingOrders as any} appData={appData} dateFilter={dateRange} startDate={customStart} endDate={customEnd} onNavigate={(filters) => { setDrilldownFilters(filters); setShowShippingReport(false); }} onBack={() => setShowShippingReport(false)} />
            )}
        </div>
    );

    return (
        <div className="flex flex-col space-y-6 pb-10">
            <style>{`
                .metric-card-pro {
                    background: var(--card-bg);
                    border: 1px solid var(--border-light);
                    transition: all 0.2s ease;
                }
                .metric-card-pro:hover {
                    border-color: var(--primary);
                }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="hidden md:flex items-center justify-between bg-[#1E2329] p-6 rounded-md border border-[#2B3139] mb-2 relative overflow-hidden group">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-4 bg-primary rounded-full"></div>
                        <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider">Operational Node</h3>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-sm border transition-all ${isSyncing ? 'bg-primary/10 border-primary/20' : 'bg-[#0ECB81]/10 border-[#0ECB81]/20'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-primary animate-pulse' : 'bg-[#0ECB81]'}`}></span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isSyncing ? 'text-primary' : 'text-[#0ECB81]'}`}>{isSyncing ? 'Syncing Node' : 'Node Online'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4 mt-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-secondary font-bold uppercase tracking-widest">Active Team:</span>
                            <span className="text-[10px] font-bold text-primary uppercase">{team}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-[#2B3139]"></div>
                        <span className="text-[10px] text-secondary font-bold uppercase tracking-widest leading-none">Last Sync: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end px-6 py-3 bg-[#2B3139]/30 rounded-md border border-[#2B3139]">
                    <span className="text-2xl font-bold text-[#EAECEF] tracking-tight leading-none">{filteredOrders.length}</span>
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-widest mt-2">Active Streams</span>
                </div>
            </div>

            {/* MOBILE PERFORMANCE OVERVIEW */}
            <div className="md:hidden grid grid-cols-12 gap-3 mb-4 animate-reveal">
                <div className="col-span-12 metric-card-pro rounded-md p-5 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex flex-col gap-1.5">
                            <h2 className="text-base font-bold text-[#EAECEF] uppercase tracking-wider truncate max-w-[180px] leading-none">{team}</h2>
                            <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">Operational Node</span>
                        </div>
                        <div className="flex items-center gap-2 bg-[#2B3139] px-3 py-1.5 rounded-md border border-[#2B3139]">
                            <span className="text-lg font-bold text-[#EAECEF] tracking-tight leading-none">{filteredOrders.length}</span>
                            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-primary animate-pulse' : 'bg-[#0ECB81]'}`}></div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-secondary uppercase tracking-widest mb-2 leading-none">Net Generated Revenue</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-bold text-primary">$</span>
                            <h3 className="text-4xl font-bold text-[#EAECEF] tracking-tight leading-none">
                                {hasPermission('view_revenue') ? filteredMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '••••'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 metric-card-pro rounded-md p-5">
                    <div className="flex items-center justify-between pb-4 border-b border-[#2B3139] mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-primary rounded-full"></div>
                            <span className="text-[10px] font-bold text-[#EAECEF] uppercase tracking-widest">Market Leaders</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        {isRankingLoading ? (
                            <div className="py-4 flex items-center justify-center"><Spinner size="xs" /></div>
                        ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                            <div key={t.name} className="flex items-center justify-between gap-2 leading-none">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shadow-inner ${
                                        i === 0 ? 'bg-primary text-bg-black' : 
                                        i === 1 ? 'bg-[#EAECEF] text-bg-black' : 
                                        'bg-[#C99400] text-[#EAECEF]'
                                    }`}>{i+1}</div>
                                    <span className="text-xs font-bold text-[#EAECEF] truncate uppercase tracking-wider">{t.name}</span>
                                </div>
                                <span className="text-xs font-bold text-[#EAECEF] tracking-tight">
                                    {`$${(t.revenue/1000).toFixed(1)}k`}
                                </span>
                            </div>
                        )) : (
                            <div className="py-2 text-center"><span className="text-[10px] font-bold text-secondary uppercase tracking-widest animate-pulse">Synchronizing Data...</span></div>
                        )}
                    </div>
                </div>
            </div>

            {/* MOBILE ACTION BUTTONS */}
            <div className="md:hidden flex items-center gap-2.5 overflow-x-auto hide-scrollbar pb-1 mb-4">
                {hasPermission('view_revenue') && (
                    <>
                        <button onClick={() => { playClick(); setShowReport(true); }} className="flex items-center gap-2.5 px-6 py-3.5 bg-primary/5 active:bg-primary/10 text-primary rounded-md border border-primary/10 transition-all shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Operational Report</span>
                        </button>
                        <button onClick={() => { playClick(); setShowShippingReport(true); }} className="flex items-center gap-2.5 px-6 py-3.5 bg-[#2B3139]/5 active:bg-[#2B3139]/10 text-secondary rounded-md border border-[#2B3139]/10 transition-all shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Shipping Logic</span>
                        </button>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 hidden md:grid grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="col-span-2 metric-card-pro rounded-md p-6 group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary group-hover:w-1.5 transition-all"></div>
                        <p className="text-[11px] font-bold text-secondary uppercase tracking-widest mb-3 leading-none">Net Generated Revenue</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-primary">$</span>
                            <h3 className="text-5xl font-bold text-[#EAECEF] tracking-tight leading-none">
                                {hasPermission('view_revenue') ? filteredMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '••••••'}
                            </h3>
                        </div>
                        <div className="mt-6 flex items-center gap-2.5 bg-primary/5 inline-flex px-3 py-1.5 rounded-sm border border-primary/10">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-[#0ECB81] animate-pulse"></span>
                            <span className="text-[10px] font-bold text-[#0ECB81] uppercase tracking-wider">Node Integrity Optimal</span>
                        </div>
                    </div>
                    <div className="metric-card-pro rounded-md p-6">
                        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-4 leading-none">Active</p>
                        <h3 className="text-4xl font-bold text-[#EAECEF] tracking-tight leading-none">{filteredOrders.length}</h3>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mt-4">Order Streams</p>
                    </div>
                    <div className="metric-card-pro rounded-md p-6">
                        <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-4 leading-none">Market Vol.</p>
                        <div className="flex flex-col gap-3">
                            {isRankingLoading ? (
                                <div className="py-2 flex justify-center"><Spinner size="xs" /></div>
                            ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                                <div key={t.name} className="flex items-center justify-between border-l-2 border-[#2B3139] pl-3 leading-none">
                                    <span className="text-[10px] font-bold text-[#EAECEF] uppercase truncate w-24 tracking-wider">{t.name}</span>
                                    <span className="text-[11px] font-bold text-primary tracking-tight">
                                        {hasPermission('view_revenue') ? `$${(t.revenue/1000).toFixed(1)}k` : '•••'}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest animate-pulse">Syncing...</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="flex gap-2">
                        <div className="relative group flex-1">
                            <input type="text" placeholder="Scan orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#1E2329] border border-[#2B3139] rounded-md py-3.5 pl-11 pr-4 text-xs font-bold text-[#EAECEF] placeholder:text-secondary focus:border-primary transition-all outline-none" />
                            <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none text-secondary group-focus-within:text-primary transition-colors">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { playClick(); setIsFilterPanelOpen(true); }} className="p-3.5 bg-[#1E2329] text-secondary border border-[#2B3139] rounded-md relative active:scale-95 transition-all hover:border-primary hover:text-primary">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeWidth={2.5}/></svg>
                                {Object.values(advancedFilters).some(v => v && v !== 'all' && v !== 'this_month') && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-[#1E2329]"></span>}
                            </button>
                            <div className="md:hidden flex bg-[#1E2329] p-1 rounded-md border border-[#2B3139]">
                                <button onClick={() => { playClick(); setViewMode('card'); }} className={`p-2 rounded-sm transition-all ${viewMode === 'card' ? 'bg-primary text-bg-black' : 'text-secondary hover:text-[#EAECEF]'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" /></svg>
                                </button>
                                <button onClick={() => { playClick(); setViewMode('list'); }} className={`p-2 rounded-sm transition-all ${viewMode === 'list' ? 'bg-primary text-bg-black' : 'text-secondary hover:text-[#EAECEF]'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                <button key={p} onClick={() => { playClick(); setDateRange(p); }} className={`px-4 py-2 text-[10px] font-bold uppercase rounded-md whitespace-nowrap transition-all border ${dateRange === p ? 'bg-primary text-bg-black border-primary' : 'bg-[#1E2329] text-secondary border-[#2B3139] hover:text-[#EAECEF] hover:border-[#474D57]'}`}>
                                    {p === 'today' ? 'Day' : p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All Logic'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                            <div className="flex-shrink-0 w-8 h-8 bg-[#2B3139]/30 rounded-md flex items-center justify-center border border-[#2B3139] text-secondary">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            {Array.from(new Set(appData.stores?.map(s => s.StoreName) || [])).map(s => {
                                const sel = (advancedFilters.fulfillmentStore || '').split(',').map(v => v.trim().toLowerCase()).includes(s.toLowerCase());
                                return (
                                    <button 
                                        key={s} 
                                        onClick={() => {
                                            playClick();
                                            const current = (advancedFilters.fulfillmentStore || '').split(',').map(v => v.trim()).filter(v => v);
                                            const next = sel ? current.filter(v => (v as string).toLowerCase() !== s.toLowerCase()) : [...current, s];
                                            setAdvancedFilters(prev => ({ ...prev, fulfillmentStore: next.join(',') }));
                                        }} 
                                        className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap border ${
                                            sel 
                                            ? 'bg-primary border-primary text-bg-black' 
                                            : 'bg-[#1E2329] border-[#2B3139] text-secondary hover:bg-[#2B3139]'
                                        }`}
                                    >
                                        {s as string}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden md:flex flex-wrap items-center gap-4">
                {hasPermission('view_revenue') && (
                    <>
                        <button onClick={() => { playClick(); setShowReport(true); }} className="flex items-center gap-3 px-6 py-3 bg-[#2B3139]/50 hover:bg-[#2B3139] text-[#EAECEF] rounded-md border border-[#2B3139] transition-all active:scale-95 group">
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span className="text-[11px] font-bold uppercase tracking-wider">Full Operational Report</span>
                        </button>
                        <button onClick={() => { playClick(); setShowShippingReport(true); }} className="flex items-center gap-3 px-6 py-3 bg-[#2B3139]/50 hover:bg-[#2B3139] text-[#EAECEF] rounded-md border border-[#2B3139] transition-all active:scale-95 group">
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                            <span className="text-[11px] font-bold uppercase tracking-wider">Shipping Logic Sync</span>
                        </button>
                    </>
                )}
            </div>

            <div className="relative animate-reveal">
                {processing ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-6">
                        <div className="relative">
                            <Spinner size="lg" />
                        </div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">Synchronizing Operational Nodes</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-48 bg-[#1E2329]/30 rounded-md border border-[#2B3139] border-dashed">
                        <div className="w-16 h-16 bg-[#2B3139]/50 rounded-md flex items-center justify-center mb-6 border border-[#2B3139]">
                            <svg className="w-8 h-8 text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <p className="text-[12px] font-bold text-secondary uppercase tracking-widest">No Active Streams Detected</p>
                        {dateRange !== 'all' && (
                            <button onClick={() => { playClick(); setDateRange('all'); }} className="mt-8 px-8 py-3 bg-primary text-bg-black rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-all active:scale-95">Open Global Streams</button>
                        )}
                    </div>
                ) : (
                    <div className="bg-card-bg border border-[#2B3139] rounded-md overflow-hidden">
                        <OrdersList orders={filteredOrders} showActions={true} visibleColumns={userVisibleColumns} onEdit={setEditingOrder} onView={setViewingOrder} viewMode={viewMode} />
                    </div>
                )}
            </div>

            {isFilterPanelOpen && (
                <FilterPanel isOpen={isFilterPanelOpen} onClose={() => setIsFilterPanelOpen(false)}>
                    <MobileFilterEngine 
                        filters={advancedFilters}
                        setFilters={setAdvancedFilters}
                        orders={permittedOrders}
                        usersList={appData.users || []}
                        appData={appData}
                        calculatedRange={calculatedRange}
                        onApply={() => setIsFilterPanelOpen(false)}
                    />
                </FilterPanel>
            )}

            {/* View Order Detail Modal */}
            {viewingOrder && (
                <OrderDetailModal 
                    order={viewingOrder} 
                    onClose={() => setViewingOrder(null)} 
                />
            )}
        </div>
    );
};

export default UserOrdersView;
