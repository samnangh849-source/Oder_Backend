import React, { useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import Spinner from '../components/common/Spinner';
import OrdersList from '../components/orders/OrdersList';
import EditOrderPage from './EditOrderPage'; 
import UserSalesPageReport from './UserSalesPageReport'; 
import DeliveryListGeneratorModal from '../components/orders/DeliveryListGeneratorModal';
import ShippingReport from '../components/reports/ShippingReport';
import { safeParseDate, getValidDate, getTimestamp } from '../utils/dateUtils';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom';

interface ReportFilterState {
    datePreset: DateRangePreset;
    customStart: string;
    customEnd: string;
}

const UserOrdersView: React.FC<{ team: string; onAdd: () => void }> = ({ team, onAdd }) => {
    const { currentUser, refreshData, appData, orders, isOrdersLoading, hasPermission } = useContext(AppContext);
    
    const permittedOrders = useMemo(() => {
        if (!currentUser) return [];
        const isInternalAdmin = currentUser.IsSystemAdmin || (currentUser.Role || '').toLowerCase() === 'admin';
        if (isInternalAdmin) return orders;
        const userAllowedTeams = (currentUser.Team || '').split(',').map(t => t.trim().toLowerCase());
        const requestedTeam = (team || '').trim().toLowerCase();
        if (!userAllowedTeams.includes(requestedTeam)) return [];
        return orders.filter(o => (o.Team || '').trim().toLowerCase() === requestedTeam);
    }, [orders, team, currentUser]);

    const [viewOrders, setViewOrders] = useState<ParsedOrder[]>([]);
    const [drilldownFilters, setDrilldownFilters] = useState<any>(null);
    const [drilldownData, setDrilldownData] = useState<ParsedOrder[]>([]);
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    const [processing, setProcessing] = useState(false); 
    const [searchQuery, setSearchQuery] = useState('');
    const [showReport, setShowReport] = useState(false);
    const [showShippingReport, setShowShippingReport] = useState(false); 
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRangePreset>('today');
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
    const [reportFilters, setReportFilters] = useState<ReportFilterState>({
        datePreset: 'this_month',
        customStart: new Date().toISOString().split('T')[0],
        customEnd: new Date().toISOString().split('T')[0]
    });

    const userVisibleColumns = useMemo(() => new Set([
        'index', 'orderId', 'customerName', 'productInfo', 'location', 'pageInfo', 'total', 'shippingService', 'status', 'date', 'print', 'actions'
    ]), []);

    const getDateBounds = (preset: DateRangePreset, cStart?: string, cEnd?: string) => {
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
    };

    const processDataForRange = useCallback((range: DateRangePreset) => {
        setProcessing(true);
        setTimeout(() => {
            const { start, end } = getDateBounds(range, customStart, customEnd);
            const filtered = permittedOrders.filter(o => {
                if (o['Order ID'] === 'Opening_Balance' || o['Order ID'] === 'Opening Balance') return false;
                if (!o.Timestamp) return false;
                const orderDate = safeParseDate(o.Timestamp);
                if (!orderDate) return false;
                if (start && orderDate < start) return false;
                if (end && orderDate > end) return false;
                return true;
            });
            setViewOrders(filtered.sort((a, b) => getTimestamp(b.Timestamp) - getTimestamp(a.Timestamp)));
            setProcessing(false);
        }, 10);
    }, [permittedOrders, customStart, customEnd]);

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
                    if (o['Order ID'] === 'Opening_Balance' || o['Order ID'] === 'Opening Balance') return false;
                    if (start || end) {
                        const d = safeParseDate(o.Timestamp);
                        if (!d || (start && d < start) || (end && d > end)) return false;
                    }
                    if (drilldownFilters.user && o.User !== drilldownFilters.user) return false;
                    if (drilldownFilters.page && o.Page !== drilldownFilters.page) return false;
                    return true;
                });
                setDrilldownData(filtered.sort((a, b) => getTimestamp(b.Timestamp) - getTimestamp(a.Timestamp)));
                setProcessing(false);
            }, 10);
        }
    }, [drilldownFilters, permittedOrders]);

    const filteredOrders = useMemo(() => {
        const source = drilldownFilters ? drilldownData : viewOrders;
        return source.filter(o => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return o['Order ID'].toLowerCase().includes(q) || (o['Customer Name'] || '').toLowerCase().includes(q) || (o['Customer Phone'] || '').includes(q);
            }
            return true;
        });
    }, [viewOrders, drilldownData, drilldownFilters, searchQuery]);

    const totalFilteredRevenue = useMemo(() => filteredOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0), [filteredOrders]);

    const topTeams = useMemo(() => {
        const teamStats: Record<string, number> = {};
        orders.forEach(o => {
            if (o['Order ID'] === 'Opening_Balance' || o['Order ID'] === 'Opening Balance') return;
            const tName = (o.Team || 'Unassigned').trim();
            const { start, end } = getDateBounds(dateRange, customStart, customEnd);
            const orderDate = safeParseDate(o.Timestamp);
            if (!orderDate || (start && orderDate < start) || (end && orderDate > end)) return;
            teamStats[tName] = (teamStats[tName] || 0) + (Number(o['Grand Total']) || 0);
        });
        return Object.entries(teamStats).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
    }, [orders, dateRange, customStart, customEnd]);

    const handleSaveEdit = () => { setEditingOrder(null); refreshData(); };

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
        <div className="flex flex-col justify-center items-center h-96 gap-4">
            <Spinner size="lg" />
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.3em] animate-pulse">Syncing Operational Team...</p>
        </div>
    );

    if (editingOrder) return <div className="animate-fade-in"><EditOrderPage order={editingOrder} onSaveSuccess={handleSaveEdit} onCancel={() => setEditingOrder(null)} /></div>;

    if (drilldownFilters) return (
        <div className="animate-fade-in min-h-screen flex flex-col space-y-6">
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
            {processing ? <div className="flex justify-center py-20"><Spinner size="md" /></div> : <OrdersList orders={filteredOrders} showActions={true} visibleColumns={userVisibleColumns} onEdit={setEditingOrder} />}
        </div>
    );

    if (showReport) return <div className="animate-fade-in"><UserSalesPageReport orders={permittedOrders} onBack={() => setShowReport(false)} team={team} onNavigate={(filters) => setDrilldownFilters(filters)} initialFilters={reportFilters} onFilterChange={setReportFilters} /></div>;

    if (showShippingReport) return <div className="animate-fade-in min-h-screen"><ShippingReport orders={permittedOrders} appData={appData} dateFilter={dateRange} startDate={customStart} endDate={customEnd} onNavigate={(filters) => { setDrilldownFilters(filters); setShowShippingReport(false); }} onBack={() => setShowShippingReport(false)} /></div>;

    return (
        <div className="flex flex-col space-y-4 pb-32">
            <style>{`
                .minimal-surface { background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.05); }
                .metric-box { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); }
                .minimal-pill { transition: all 0.2s ease; border: 1px solid transparent; }
                .minimal-pill:hover { background: rgba(255, 255, 255, 0.05); }
                .minimal-pill.active { background: white; color: black; }
                .modern-table-card { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 2rem; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
            `}</style>

            {/* Ultra Compact Metrics Row */}
            <div className="flex flex-col lg:flex-row items-stretch gap-3">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Compact Revenue */}
                    <div className="col-span-2 md:col-span-2 metric-box rounded-2xl p-4 flex items-center justify-between group overflow-hidden relative">
                        <div>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Revenue</p>
                            <h3 className="text-2xl font-bold text-white tracking-tight">
                                {hasPermission('view_revenue') ? `$${totalFilteredRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '••••••'}
                            </h3>
                        </div>
                        <div className="flex flex-col items-end relative z-10">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mb-1"></div>
                            <span className="text-[8px] font-bold text-emerald-500/80 uppercase">Live</span>
                        </div>
                    </div>

                    {/* Compact Orders */}
                    <div className="metric-box rounded-2xl p-4 flex flex-col justify-center">
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Orders</p>
                        <h3 className="text-xl font-bold text-white tracking-tight">{filteredOrders.length}</h3>
                    </div>

                    {/* Compact Team Rank */}
                    <div className="metric-box rounded-2xl p-4 flex flex-col justify-center overflow-hidden">
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Rankings</p>
                        <div className="flex gap-2">
                            {topTeams.slice(0, 2).map((t, i) => (
                                <div key={t.name} className="flex flex-col leading-none border-l border-white/10 pl-2">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase truncate w-12">{t.name}</span>
                                    <span className="text-[10px] font-bold text-white">${(t.revenue/1000).toFixed(1)}k</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Search & Date Controls Bar - Refined Sizes */}
                <div className="w-full lg:w-auto flex flex-col justify-center gap-3">
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="Search records..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="w-full lg:w-72 bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-xs font-medium text-white placeholder:text-gray-600 focus:bg-white/[0.06] focus:border-blue-500/30 transition-all outline-none" 
                        />
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-focus-within:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
                            {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                <button 
                                    key={p} 
                                    onClick={() => setDateRange(p)} 
                                    className={`px-4 py-2 text-[10px] font-bold uppercase rounded-xl whitespace-nowrap transition-all ${
                                        dateRange === p ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-gray-500 hover:text-white'
                                    }`}
                                >
                                    {p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : p}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5 ml-2">
                            {hasPermission('view_revenue') && (
                                <>
                                    <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5" title="Page Report">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        <span className="text-[9px] font-bold uppercase hidden xl:inline">Page Report</span>
                                    </button>
                                    <button onClick={() => setShowShippingReport(true)} className="flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5" title="Shipping Cost">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"/><path d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                                        <span className="text-[9px] font-bold uppercase hidden xl:inline">Shipping Cost</span>
                                    </button>
                                </>
                            )}
                            <button onClick={() => setIsDeliveryModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5" title="Delivery List">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                <span className="text-[9px] font-bold uppercase hidden xl:inline">Delivery List</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area - Refined Table Look with Auto Height */}
            <div className="relative">
                {processing ? (
                    <div className="flex justify-center items-center py-20"><Spinner size="md" /></div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white/[0.01] rounded-[2rem] border border-white/5">
                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.3em]">No Records Found</p>
                    </div>
                ) : (
                    <div className="animate-fade-in modern-table-card">
                        <OrdersList 
                            orders={filteredOrders} 
                            showActions={true} 
                            visibleColumns={userVisibleColumns} 
                            onEdit={setEditingOrder} 
                        />
                    </div>
                )}
            </div>

            <DeliveryListGeneratorModal isOpen={isDeliveryModalOpen} onClose={() => setIsDeliveryModalOpen(false)} orders={permittedOrders} appData={appData} team={team} />
        </div>
    );
};

export default UserOrdersView;
