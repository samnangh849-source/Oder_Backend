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
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-2">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-white font-medium uppercase tracking-widest text-sm">Access Denied</h3>
            <p className="text-gray-500 text-xs max-w-xs">អ្នកមិនមានសិទ្ធិចូលមើលបញ្ជីការកម្មង់ឡើយ។ សូមទាក់ទង Admin។</p>
        </div>
    );

    if (isOrdersLoading && (!orders || orders.length === 0)) return (
        <div className="flex flex-col justify-center items-center h-[60vh] gap-6 animate-reveal">
            <div className="relative">
                <Spinner size="lg" />
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
            </div>
            <div className="text-center space-y-2">
                <p className="text-xs font-black text-white uppercase tracking-[0.4em] animate-pulse">Establishing Connection</p>
                <p className="text-[9px] font-bold text-blue-500/40 uppercase tracking-widest">Syncing Operational Node: {team}</p>
            </div>
        </div>
    );

    if (editingOrder) return <div className="animate-reveal"><EditOrderPage order={editingOrder} onSaveSuccess={handleSaveEdit} onCancel={() => setEditingOrder(null)} /></div>;

    if (drilldownFilters) return (
        <div className="animate-reveal min-h-full flex flex-col space-y-6">
            <div className="flex items-center justify-between bg-white/[0.03] border border-white/5 p-6 rounded-3xl backdrop-blur-xl">
                <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Operation Drilldown</h2>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">{drilldownFilters.page || drilldownFilters.shipping || 'Filtered View'}</span>
                        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">{drilldownData.length} Entries Found</span>
                    </div>
                </div>
                <button onClick={() => setDrilldownFilters(null)} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs font-bold transition-all border border-white/10">Return to Overview</button>
            </div>
            {processing ? <div className="flex justify-center py-20"><Spinner size="md" /></div> : <OrdersList orders={filteredOrders} showActions={true} visibleColumns={userVisibleColumns} onEdit={setEditingOrder} onView={setViewingOrder} />}
        </div>
    );

    if (showReport) return <div className="animate-reveal"><UserSalesPageReport orders={permittedOrders} onBack={() => setShowReport(false)} team={team} onNavigate={(filters) => setDrilldownFilters(filters)} initialFilters={reportFilters} onFilterChange={setReportFilters} /></div>;

    if (showShippingReport) return (
        <div className="animate-reveal min-h-full">
            {isShippingLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4 bg-[#020617]">
                    <Spinner size="lg" />
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] animate-pulse">Loading Global Costs...</p>
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
                    background: var(--card-bg-hover);
                }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="hidden md:flex items-center justify-between bg-binance p-6 rounded-xl border border-white/5 mb-2 relative overflow-hidden group">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-5 bg-accent rounded-full shadow-[0_0_10px_rgba(252,213,53,0.3)]"></div>
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Operational Node</h3>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${isSyncing ? 'bg-accent/10 border-accent/20' : 'bg-[#0ECB81]/10 border-[#0ECB81]/20'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-accent animate-pulse' : 'bg-[#0ECB81]'}`}></span>
                            <span className={`text-[10px] font-black uppercase tracking-tight ${isSyncing ? 'text-accent' : 'text-[#0ECB81]'}`}>{isSyncing ? 'Syncing Node' : 'Node Online'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4.5 mt-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-secondary font-bold uppercase tracking-widest">Active Team:</span>
                            <span className="text-[10px] font-black text-accent uppercase italic">{team}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-white/10"></div>
                        <span className="text-[10px] text-secondary font-bold uppercase tracking-widest leading-none">Last Sync: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end px-6 py-3 bg-white/[0.02] rounded-xl border border-white/5 backdrop-blur-md">
                    <span className="text-2xl font-black text-white italic tracking-tighter leading-none">{filteredOrders.length}</span>
                    <span className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] mt-2">Active Streams</span>
                </div>
            </div>

            {/* MOBILE PERFORMANCE OVERVIEW */}
            <div className="md:hidden grid grid-cols-12 gap-3 mb-4 animate-reveal">
                <div className="col-span-12 metric-card-pro rounded-2xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-accent"></div>
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex flex-col gap-1.5">
                            <h2 className="text-base font-black text-white italic uppercase tracking-tight truncate max-w-[180px] leading-none">{team}</h2>
                            <span className="text-[9px] font-black text-secondary uppercase tracking-[0.3em]">Operational Node</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                            <span className="text-lg font-black text-white italic tracking-tighter leading-none">{filteredOrders.length}</span>
                            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-accent animate-pulse' : 'bg-[#0ECB81]'}`}></div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-secondary uppercase tracking-[0.3em] mb-2 leading-none">Net Generated Revenue</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-accent italic">$</span>
                            <h3 className="text-4xl font-black text-white italic tracking-tighter leading-none">
                                {hasPermission('view_revenue') ? filteredMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '••••'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 metric-card-pro rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-accent rounded-full"></div>
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic">Market Leaders</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        {isRankingLoading ? (
                            <div className="py-4 flex items-center justify-center"><Spinner size="xs" /></div>
                        ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                            <div key={t.name} className="flex items-center justify-between gap-2 leading-none">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black italic shadow-inner ${
                                        i === 0 ? 'bg-accent text-[#181A20]' : 
                                        i === 1 ? 'bg-[#EAECEF] text-[#181A20]' : 
                                        'bg-[#C99400] text-white'
                                    }`}>{i+1}</div>
                                    <span className="text-xs font-black text-white italic truncate uppercase tracking-tight">{t.name}</span>
                                </div>
                                <span className="text-xs font-black text-white italic tracking-tighter">
                                    {`$${(t.revenue/1000).toFixed(1)}k`}
                                </span>
                            </div>
                        )) : (
                            <div className="py-2 text-center"><span className="text-[10px] font-black text-secondary uppercase italic tracking-widest animate-pulse">Synchronizing Data...</span></div>
                        )}
                    </div>
                </div>
            </div>

            {/* MOBILE ACTION BUTTONS */}
            <div className="md:hidden flex items-center gap-2.5 overflow-x-auto hide-scrollbar pb-1 mb-4">
                {hasPermission('view_revenue') && (
                    <>
                        <button onClick={() => { playClick(); setShowReport(true); }} className="flex items-center gap-2.5 px-6 py-3.5 bg-accent/5 active:bg-accent/10 text-accent rounded-xl border border-accent/10 transition-all shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 19V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Operational Report</span>
                        </button>
                        <button onClick={() => { playClick(); setShowShippingReport(true); }} className="flex items-center gap-2.5 px-6 py-3.5 bg-white/5 active:bg-white/10 text-secondary rounded-xl border border-white/5 transition-all shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Shipping Logic</span>
                        </button>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 hidden md:grid grid-cols-2 lg:grid-cols-4 gap-5">
                    <div className="col-span-2 metric-card-pro rounded-2xl p-6 group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-accent group-hover:w-2 transition-all"></div>
                        <p className="text-[11px] font-black text-secondary uppercase tracking-[0.3em] italic mb-3 leading-none">Net Generated Revenue</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-accent italic">$</span>
                            <h3 className="text-5xl font-black text-white italic tracking-tighter leading-none">
                                {hasPermission('view_revenue') ? filteredMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '••••••'}
                            </h3>
                        </div>
                        <div className="mt-6 flex items-center gap-2.5 bg-white/[0.02] inline-flex px-3 py-1.5 rounded-full border border-white/5">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-[#0ECB81] animate-pulse"></span>
                            <span className="text-[10px] font-black text-[#0ECB81] uppercase tracking-[0.2em] italic">Node Integrity Optimal</span>
                        </div>
                    </div>
                    <div className="metric-card-pro rounded-2xl p-6">
                        <p className="text-[11px] font-black text-secondary uppercase tracking-[0.3em] italic mb-4 leading-none text-accent">Active</p>
                        <h3 className="text-4xl font-black text-white italic tracking-tighter leading-none">{filteredOrders.length}</h3>
                        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] italic mt-4">Order Streams</p>
                    </div>
                    <div className="metric-card-pro rounded-2xl p-6">
                        <p className="text-[11px] font-black text-accent uppercase tracking-[0.3em] italic mb-4 leading-none">Market Vol.</p>
                        <div className="flex flex-col gap-3">
                            {isRankingLoading ? (
                                <div className="py-2 flex justify-center"><Spinner size="xs" /></div>
                            ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                                <div key={t.name} className="flex items-center justify-between border-l-2 border-white/5 pl-3 leading-none">
                                    <span className="text-[10px] font-black text-white uppercase italic truncate w-24 tracking-tighter">{t.name}</span>
                                    <span className="text-[11px] font-black text-accent italic tracking-tighter">
                                        {hasPermission('view_revenue') ? `$${(t.revenue/1000).toFixed(1)}k` : '•••'}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-[10px] font-black text-secondary italic tracking-widest animate-pulse uppercase">Syncing...</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="flex gap-2">
                        <div className="relative group flex-1">
                            <input type="text" placeholder="Scan orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-[#1E2329] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-xs font-black text-white italic placeholder:text-secondary focus:border-accent transition-all outline-none shadow-lg" />
                            <div className="absolute left-4 top-0 bottom-0 flex items-center justify-center pointer-events-none text-secondary group-focus-within:text-accent transition-colors">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { playClick(); setIsFilterPanelOpen(true); }} className="p-3.5 bg-[#1E2329] text-secondary border border-white/5 rounded-xl relative active:scale-95 transition-all hover:border-accent hover:text-accent shadow-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeWidth={2.5}/></svg>
                                {Object.values(advancedFilters).some(v => v && v !== 'all' && v !== 'this_month') && <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-[#1E2329]"></span>}
                            </button>
                            <div className="md:hidden flex bg-[#1E2329] p-1 rounded-xl border border-white/5 shadow-lg">
                                <button onClick={() => { playClick(); setViewMode('card'); }} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-accent text-[#181A20]' : 'text-secondary hover:text-white'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" /></svg>
                                </button>
                                <button onClick={() => { playClick(); setViewMode('list'); }} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent text-[#181A20]' : 'text-secondary hover:text-white'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                <button key={p} onClick={() => { playClick(); setDateRange(p); }} className={`px-5 py-2.5 text-[10px] font-black uppercase italic rounded-xl whitespace-nowrap transition-all border shadow-md ${dateRange === p ? 'bg-accent text-[#181A20] border-accent' : 'bg-[#1E2329] text-secondary border-white/5 hover:text-white hover:border-white/10'}`}>
                                    {p === 'today' ? 'Day' : p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All Logic'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                            <div className="flex-shrink-0 w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 text-secondary shadow-lg">
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
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all whitespace-nowrap border shadow-md ${
                                            sel 
                                            ? 'bg-accent border-accent text-[#181A20]' 
                                            : 'bg-[#1E2329] border-white/5 text-secondary hover:bg-white/5'
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
                        <button onClick={() => { playClick(); setShowReport(true); }} className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-accent/5 text-white rounded-2xl border border-white/10 transition-all active:scale-95 group shadow-lg">
                            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">Full Operational Report</span>
                        </button>
                        <button onClick={() => { playClick(); setShowShippingReport(true); }} className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all active:scale-95 group shadow-lg">
                            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">Shipping Logic Sync</span>
                        </button>
                    </>
                )}
            </div>

            <div className="relative animate-reveal">
                {processing ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-6">
                        <div className="relative">
                            <Spinner size="lg" />
                            <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full animate-pulse"></div>
                        </div>
                        <p className="text-[10px] font-black text-accent uppercase tracking-[0.4em] animate-pulse italic">Synchronizing Operational Nodes</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-48 bg-white/[0.01] rounded-3xl border border-white/5 border-dashed">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                            <svg className="w-10 h-10 text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <p className="text-[12px] font-black text-secondary uppercase tracking-[0.5em] italic">No Active Streams Detected</p>
                        {dateRange !== 'all' && (
                            <button onClick={() => { playClick(); setDateRange('all'); }} className="mt-8 px-10 py-3.5 bg-accent text-[#181A20] rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] italic hover:bg-accent/90 transition-all shadow-2xl active:scale-95">Open Global Streams</button>
                        )}
                    </div>
                ) : (
                    <div className="binance-card shadow-2xl overflow-hidden">
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
