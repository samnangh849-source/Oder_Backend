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
                if (range === 'all') return true;
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

    if (isOrdersLoading && orders.length === 0) return (
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
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(16px);
                    transition: all 0.3s ease;
                }
                .metric-card-pro:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.15);
                    transform: translateY(-2px);
                }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="hidden md:flex items-center justify-between bg-white/[0.02] p-2.5 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-xl mb-2.5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/5 to-blue-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
                        <h3 className="text-[10px] md:text-lg font-black text-white uppercase tracking-widest leading-none">Operational Portal</h3>
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all duration-500 ${isSyncing ? 'bg-blue-500/20 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/10'}`}>
                            <span className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-blue-400 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                            <span className={`text-[7px] font-black uppercase tracking-widest ${isSyncing ? 'text-blue-400' : 'text-emerald-500'}`}>{isSyncing ? 'Syncing' : 'Live'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 ml-3.5">
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-blue-400/40 uppercase tracking-tighter">Team:</span>
                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{team}</span>
                        </div>
                        <span className="text-[7px] text-gray-600 font-bold uppercase tracking-tight">Synced {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end px-3 py-1 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-[11px] font-black text-blue-400 leading-none">{filteredOrders.length}</span>
                    <span className="text-[6px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Orders</span>
                </div>
            </div>

            {/* MOBILE PERFORMANCE OVERVIEW */}
            <div className="md:hidden grid grid-cols-12 gap-2 mb-3 animate-reveal">
                <div className="col-span-7 metric-card-pro rounded-[2rem] p-3.5 flex flex-col justify-between relative overflow-hidden border-white/10 bg-white/[0.02] backdrop-blur-2xl shadow-xl shadow-blue-500/5">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px] -mr-12 -mt-12 pointer-events-none"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex flex-col gap-0.5">
                            <h2 className="text-[12px] font-black text-white uppercase tracking-widest leading-none truncate max-w-[100px] italic">{team}</h2>
                            <span className="text-[7px] font-black text-blue-500/60 uppercase tracking-[0.2em]">Operational Node</span>
                        </div>
                        <div className="flex flex-col items-end leading-none">
                            <div className="flex items-center gap-1">
                                <span className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-blue-400 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
                                <span className="text-[11px] font-black text-white">{filteredOrders.length}</span>
                            </div>
                            <span className="text-[6px] font-bold text-gray-600 uppercase tracking-widest mt-0.5">Records</span>
                        </div>
                    </div>
                    <div className="flex flex-col relative z-10">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">Generated Revenue</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-[10px] font-black text-blue-500 italic">$</span>
                            <h3 className="text-3xl font-black text-white tracking-tighter italic leading-none drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                                {hasPermission('view_revenue') ? filteredMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '••••'}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="col-span-5 metric-card-pro rounded-[2rem] p-3.5 relative overflow-hidden border-white/10 bg-white/[0.02] backdrop-blur-2xl">
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest leading-none">Ranking</span>
                            <div className="w-1 h-1 rounded-full bg-amber-500/20"></div>
                        </div>
                        {isRankingLoading ? (
                            <div className="py-4 flex items-center justify-center"><Spinner size="xs" /></div>
                        ) : globalRanking.length > 0 ? globalRanking.slice(0, 3).map((t, i) => (
                            <div key={t.name} className="flex items-center justify-between gap-2 relative z-10 leading-none group/rank">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-4 h-4 rounded-lg flex items-center justify-center text-[8px] font-black italic transition-all group-hover/rank:scale-110 ${
                                        i === 0 ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 
                                        i === 1 ? 'bg-slate-300 text-black' : 
                                        'bg-orange-600/50 text-white'
                                    }`}>{i+1}</div>
                                    <span className="text-[10px] font-bold text-white/70 truncate uppercase tracking-tighter group-hover/rank:text-white transition-colors">{t.name}</span>
                                </div>
                                <span className="text-[10px] font-black text-white italic">
                                    {`${(t.revenue/1000).toFixed(1)}k`}
                                </span>
                            </div>
                        )) : (
                            <div className="py-2 text-center"><span className="text-[7px] font-bold text-gray-600 uppercase italic">No Data</span></div>
                        )}
                    </div>
                </div>
            </div>

            {/* MOBILE ACTION BUTTONS */}
            <div className="md:hidden flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 mb-2">
                {hasPermission('view_revenue') && (
                    <>
                        <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 active:bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/10 transition-all shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span className="text-[9px] font-black uppercase tracking-widest">Page Report</span>
                        </button>
                        <button onClick={() => setShowShippingReport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/10 active:bg-amber-600/20 text-amber-400 rounded-xl border border-amber-500/10 transition-all shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                            <span className="text-[9px] font-black uppercase tracking-widest">Shipping Cost</span>
                        </button>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 hidden md:grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2 metric-card-pro rounded-3xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[50px] -mr-16 -mt-16 group-hover:bg-blue-600/20 transition-colors"></div>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Total Revenue</p>
                        <h3 className="text-3xl font-black text-white tracking-tighter italic">
                            {hasPermission('view_revenue') ? `$${filteredMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '••••••'}
                        </h3>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[9px] font-bold text-emerald-500/80 uppercase">Live Processing</span>
                        </div>
                    </div>
                    <div className="metric-card-pro rounded-3xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 blur-[40px] -mr-12 -mt-12 group-hover:bg-purple-600/20 transition-colors"></div>
                        <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] mb-1">Orders</p>
                        <h3 className="text-2xl font-black text-white tracking-tighter">{filteredOrders.length}</h3>
                        <p className="text-[9px] font-bold text-gray-600 uppercase mt-2">Active Volume</p>
                    </div>
                    <div className="metric-card-pro rounded-3xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/10 blur-[40px] -mr-12 -mt-12 group-hover:bg-amber-600/20 transition-colors"></div>
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Top 3 Teams</p>
                        <div className="flex flex-col gap-1.5 mt-1">
                            {isRankingLoading ? (
                                <div className="py-2 flex justify-center"><Spinner size="xs" /></div>
                            ) : globalRanking.length > 0 ? globalRanking.slice(0, 3).map((t, i) => (
                                <div key={t.name} className="flex items-center justify-between border-l-2 border-white/10 pl-2">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase truncate w-16">{t.name}</span>
                                    <span className="text-[10px] font-black text-white">
                                        {hasPermission('view_revenue') ? `$${(t.revenue/1000).toFixed(1)}k` : '•••'}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-[9px] font-bold text-gray-600 uppercase italic">No Data</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-3">
                    <div className="flex gap-2">
                        <div className="relative group flex-1">
                            <input type="text" placeholder="Search records..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-[12px] font-bold text-white placeholder:text-gray-600 focus:bg-white/[0.06] focus:border-blue-500/30 transition-all outline-none" />
                            <div className="absolute left-3 top-0 bottom-0 flex items-center justify-center pointer-events-none text-gray-600 group-focus-within:text-blue-500 transition-colors">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => { playClick(); setIsFilterPanelOpen(true); }} className="p-3 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl relative active:scale-95 transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" strokeWidth={2}/></svg>
                                {Object.values(advancedFilters).some(v => v && v !== 'all' && v !== 'this_month') && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#020617]"></span>}
                            </button>
                            {/* View Mode Toggle for Mobile */}
                            <div className="md:hidden flex bg-white/5 p-1 rounded-xl border border-white/10">
                                <button onClick={() => setViewMode('card')} className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" /></svg>
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                <button key={p} onClick={() => setDateRange(p)} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg whitespace-nowrap transition-all border ${dateRange === p ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40' : 'bg-white/5 text-gray-500 border-white/5 hover:text-white'}`}>
                                    {p === 'today' ? 'Today' : p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            <div className="flex-shrink-0 w-7 h-7 bg-purple-600/20 rounded-lg flex items-center justify-center border border-purple-500/20 text-purple-400 shadow-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            {Array.from(new Set(appData.stores?.map(s => s.StoreName) || [])).map(s => {
                                const sel = (advancedFilters.fulfillmentStore || '').split(',').map(v => v.trim().toLowerCase()).includes(s.toLowerCase());
                                return (
                                    <button 
                                        key={s} 
                                        onClick={() => {
                                            playClick();
                                            const current = (advancedFilters.fulfillmentStore || '').split(',').map(v => v.trim()).filter(v => v);
                                            const next = sel ? current.filter(v => v.toLowerCase() !== s.toLowerCase()) : [...current, s];
                                            setAdvancedFilters(prev => ({ ...prev, fulfillmentStore: next.join(',') }));
                                        }} 
                                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap border ${
                                            sel 
                                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40' 
                                            : 'bg-white/5 border-white/5 text-gray-500 active:bg-white/10'
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

            <div className="hidden md:flex flex-wrap items-center gap-3">
                {hasPermission('view_revenue') && (
                    <>
                        <button onClick={() => setShowReport(true)} className="flex items-center gap-2.5 px-5 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/20 transition-all active:scale-95 group">
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Page Report</span>
                        </button>
                        <button onClick={() => setShowShippingReport(true)} className="flex items-center gap-2.5 px-5 py-3 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-2xl border border-amber-500/20 transition-all active:scale-95 group">
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Shipping Cost</span>
                        </button>
                    </>
                )}
            </div>

            <div className="relative animate-reveal">
                {processing ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <Spinner size="lg" />
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Syncing Operational Team</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 bg-white/[0.01] rounded-none border border-white/5 border-dashed">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.4em]">No Records in Team</p>
                        {dateRange !== 'all' && (
                            <button onClick={() => setDateRange('all')} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95">Show All Records</button>
                        )}
                    </div>
                ) : (
                    <OrdersList orders={filteredOrders} showActions={true} visibleColumns={userVisibleColumns} onEdit={setEditingOrder} onView={setViewingOrder} viewMode={viewMode} />
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
