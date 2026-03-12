
import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder, FullOrder } from '../types';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import FloatingAlert from '../components/common/FloatingAlert';
import OrdersList from '../components/orders/OrdersList';
import CreateOrderPage from './CreateOrderPage';
import EditOrderPage from './EditOrderPage'; 
import { useUrlState } from '../hooks/useUrlState';
import UserSalesPageReport from './UserSalesPageReport'; 
import DeliveryListGeneratorModal from '../components/orders/DeliveryListGeneratorModal';
import ShippingReport from '../components/reports/ShippingReport';
import { sendSystemNotification, requestNotificationPermission } from '../utils/notificationUtils';
import { safeParseDate, getValidDate, getTimestamp } from '../utils/dateUtils';

type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all' | 'custom';

// Define the state shape for the report filters
interface ReportFilterState {
    datePreset: DateRangePreset;
    customStart: string;
    customEnd: string;
}

const UserOrdersView: React.FC<{ team: string; onAdd: () => void }> = ({ team, onAdd }) => {
    const { currentUser, refreshData, appData, orders, isOrdersLoading, hasPermission } = useContext(AppContext);
    
    // 0. Base Data Isolation: Filter all orders based on user team if not Admin
    const permittedOrders = useMemo(() => {
        if (!currentUser) return [];
        const isInternalAdmin = currentUser.IsSystemAdmin || (currentUser.Role || '').toLowerCase() === 'admin';
        
        if (isInternalAdmin) return orders;
        
        // Security Check: Verify user actually belongs to the requested team
        const userAllowedTeams = (currentUser.Team || '').split(',').map(t => t.trim().toLowerCase());
        const requestedTeam = (team || '').trim().toLowerCase();
        
        if (!userAllowedTeams.includes(requestedTeam)) {
            console.warn(`Access denied for user ${currentUser.UserName} to team ${team}`);
            return [];
        }
        
        // Strictly filter by the verified team context
        return orders.filter(o => (o.Team || '').trim().toLowerCase() === requestedTeam);
    }, [orders, team, currentUser]);

    // Stores parsed orders for the CURRENTLY SELECTED date range only
    const [viewOrders, setViewOrders] = useState<ParsedOrder[]>([]);
    const [globalViewOrders, setGlobalOrders] = useState<ParsedOrder[]>([]); // For stats restricted to permitted range
    
    // Drilldown State
    const [drilldownFilters, setDrilldownFilters] = useState<any>(null);
    const [drilldownData, setDrilldownData] = useState<ParsedOrder[]>([]);
    const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
    
    const [processing, setProcessing] = useState(false); 
    const [searchQuery, setSearchQuery] = useState('');
    
    // Feature States
    const [showReport, setShowReport] = useState(false);
    const [showShippingReport, setShowShippingReport] = useState(false); 
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

    // Dashboard Date State
    const [dateRange, setDateRange] = useState<DateRangePreset>('today');
    const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);

    // Report State (Lifted up to preserve on back)
    const [reportFilters, setReportFilters] = useState<ReportFilterState>({
        datePreset: 'this_month',
        customStart: new Date().toISOString().split('T')[0],
        customEnd: new Date().toISOString().split('T')[0]
    });

    const isSystemAdmin = !!currentUser?.IsSystemAdmin;

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
            case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'last_year': start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999); break;
            case 'all': start = null; end = null; break;
            case 'custom': if (cStart) start = getValidDate(cStart + 'T00:00:00'); if (cEnd) end = getValidDate(cEnd + 'T23:59:59'); break;
        }
        return { start, end };
    };

    const processDataForRange = (range: DateRangePreset) => {
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
            setGlobalOrders(filtered);
            setViewOrders(filtered.sort((a, b) => getTimestamp(b.Timestamp) - getTimestamp(a.Timestamp)));
            setProcessing(false);
        }, 10);
    };

    useEffect(() => {
        processDataForRange(dateRange);
    }, [dateRange, customStart, customEnd, team, permittedOrders]);

    useEffect(() => {
        if (drilldownFilters) {
            setProcessing(true);
            setTimeout(() => {
                const source = permittedOrders;
                
                let start: Date | null = null;
                let end: Date | null = null;

                if (drilldownFilters.isMonthlyDrilldown) {
                    const dStart = drilldownFilters.customStart || drilldownFilters.startDate;
                    const dEnd = drilldownFilters.customEnd || drilldownFilters.endDate;
                    if (dStart) start = getValidDate(dStart + 'T00:00:00');
                    if (dEnd) end = getValidDate(dEnd + 'T23:59:59');
                } else if (drilldownFilters.datePreset === 'custom') {
                    const dStart = drilldownFilters.customStart || drilldownFilters.startDate;
                    const dEnd = drilldownFilters.customEnd || drilldownFilters.endDate;
                    if (dStart) start = getValidDate(dStart + 'T00:00:00');
                    if (dEnd) end = getValidDate(dEnd + 'T23:59:59');
                } else if (drilldownFilters.datePreset) {
                    const bounds = getDateBounds(drilldownFilters.datePreset);
                    start = bounds.start;
                    end = bounds.end;
                }

                const filtered = source.filter(o => {
                    if (o['Order ID'] === 'Opening_Balance' || o['Order ID'] === 'Opening Balance') return false;

                    if (start || end) {
                        if (!o.Timestamp) return false;
                        const d = safeParseDate(o.Timestamp);
                        if (!d) return false;
                        if (start && d < start) return false;
                        if (end && d > end) return false;
                    }
                    
                    if (drilldownFilters.team) {
                        const oTeam = (o.Team || '').trim().toLowerCase();
                        const fTeam = drilldownFilters.team.trim().toLowerCase();
                        if (oTeam !== fTeam) return false;
                    }

                    if (drilldownFilters.page) {
                        const oPage = (o.Page || 'Unknown').trim().toLowerCase();
                        const fPage = drilldownFilters.page.trim().toLowerCase();
                        if (oPage !== fPage) return false;
                    }

                    if (drilldownFilters.shipping) {
                        const oShip = (o['Internal Shipping Method'] || 'Other').trim().toLowerCase();
                        const fShip = drilldownFilters.shipping.trim().toLowerCase();
                        if (oShip !== fShip) return false;
                    }
                    
                    if (drilldownFilters.driver) {
                        const oDriver = (o['Internal Shipping Details'] || 'N/A').trim().toLowerCase();
                        const fDriver = drilldownFilters.driver.trim().toLowerCase();
                        if (oDriver !== fDriver) return false;
                    }

                    if (drilldownFilters.fulfillmentStore) {
                        const oStore = (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase();
                        const fStore = drilldownFilters.fulfillmentStore.trim().toLowerCase();
                        if (oStore !== fStore) return false;
                    }

                    return true;
                });

                setDrilldownData(filtered.sort((a, b) => {
                    const tA = getTimestamp(a.Timestamp);
                    const tB = getTimestamp(b.Timestamp);
                    return tB - tA;
                }));
                setProcessing(false);
            }, 10);
        }
    }, [drilldownFilters, permittedOrders]);

    // Client-side search filtering
    const filteredOrders = useMemo(() => {
        const source = drilldownFilters ? drilldownData : viewOrders;
        return source.filter(o => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return o['Order ID'].toLowerCase().includes(q) || 
                       (o['Customer Name'] || '').toLowerCase().includes(q) || 
                       (o['Customer Phone'] || '').includes(q);
            }
            return true;
        });
    }, [viewOrders, drilldownData, drilldownFilters, searchQuery]);

    const totalFilteredRevenue = useMemo(() => {
        return filteredOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
    }, [filteredOrders]);

    const topTeams = useMemo(() => {
        const teamStats: Record<string, number> = {};
        // Aggregate statistics can use the full order set for the leaderboard context
        orders.forEach(o => {
            if (o['Order ID'] === 'Opening_Balance' || o['Order ID'] === 'Opening Balance') return;
            const tName = (o.Team || 'Unassigned').trim();
            
            // Apply current date range to the leaderboard
            const { start, end } = getDateBounds(dateRange, customStart, customEnd);
            if (!o.Timestamp) return;
            const orderDate = safeParseDate(o.Timestamp);
            if (!orderDate) return;
            if (start && orderDate < start) return;
            if (end && orderDate > end) return;

            teamStats[tName] = (teamStats[tName] || 0) + (Number(o['Grand Total']) || 0);
        });
        return Object.entries(teamStats)
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3);
    }, [orders, dateRange, customStart, customEnd]);

    const periodLabel = useMemo(() => {
        switch (dateRange) {
            case 'today': return 'ថ្ងៃនេះ';
            case 'yesterday': return 'ម្សិលមិញ';
            case 'this_week': return 'សប្តាហ៍នេះ';
            case 'this_month': return 'ខែនេះ';
            case 'custom': return `តាមកំណត់`;
            default: return '';
        }
    }, [dateRange]);

    const handleSaveEdit = () => { setEditingOrder(null); refreshData(); };

    if (!hasPermission('view_order_list')) return (
        <div className="flex flex-col justify-center items-center h-96 gap-4 p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-2">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h3 className="text-white font-black uppercase tracking-tight">ចូលមើលមិនបានទេ</h3>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest max-w-xs">អ្នកមិនមានសិទ្ធិចូលមើលបញ្ជីការកម្មង់ឡើយ។ សូមទាក់ទង Admin។</p>
        </div>
    );

    if (isOrdersLoading && orders.length === 0) return (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
            <Spinner size="lg" />
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">Initializing Data Stream...</p>
        </div>
    );

    // Render Edit Page
    if (editingOrder) {
        return (
            <div className="animate-fade-in p-2">
                <EditOrderPage 
                    order={editingOrder} 
                    onSaveSuccess={handleSaveEdit}
                    onCancel={() => setEditingOrder(null)} 
                />
            </div>
        );
    }

    // Render Drilldown View
    if (drilldownFilters) {
        return (
            <div className="animate-fade-in p-2 min-h-screen flex flex-col">
                <div className="flex items-center justify-between mb-6 bg-gray-900/50 p-4 rounded-3xl border border-white/5">
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-tight italic">ផ្ទាំងរបាយការណ៍ប្រតិបត្តិការណ៍</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-500/20">
                                {drilldownFilters.page || drilldownFilters.shipping || 'Filtered View'}
                            </span>
                            {drilldownFilters.isMonthlyDrilldown && (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-500/20">
                                    {drilldownFilters.customStart} - {drilldownFilters.customEnd}
                                </span>
                            )}
                            <span className="text-[10px] text-gray-500 font-bold">{drilldownData.length} entries</span>
                        </div>
                    </div>
                    <button onClick={() => setDrilldownFilters(null)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95">
                        Back
                    </button>
                </div>

                {processing ? (
                    <div className="flex justify-center py-20"><Spinner size="md" /></div>
                ) : (
                    <OrdersList 
                        orders={filteredOrders} 
                        showActions={true} 
                        visibleColumns={userVisibleColumns}
                        onEdit={(o) => setEditingOrder(o)}
                    />
                )}
            </div>
        );
    }

    if (showReport) {
        return (
            <div className="animate-fade-in p-2">
                <UserSalesPageReport 
                    orders={permittedOrders} 
                    onBack={() => setShowReport(false)} 
                    team={team}
                    onNavigate={(filters) => setDrilldownFilters(filters)}
                    // Pass the report state down so it can be controlled
                    initialFilters={reportFilters}
                    onFilterChange={setReportFilters}
                />
            </div>
        );
    }

    // Render Shipping Report View
    if (showShippingReport) {
        return (
            <div className="animate-fade-in p-2 min-h-screen">
                <ShippingReport 
                    orders={permittedOrders} 
                    appData={appData} 
                    dateFilter={dateRange}
                    startDate={customStart}
                    endDate={customEnd}
                    onNavigate={(filters) => {
                        setDrilldownFilters(filters);
                        setShowShippingReport(false);
                    }}
                    onBack={() => setShowShippingReport(false)}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 flex flex-col min-h-screen">
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Top Teams Horizontal Scroll */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">តារាងក្រុមឆ្នើម</h3>
                    </div>
                    <span className="text-[10px] font-black text-gray-500 uppercase">{periodLabel}</span>
                </div>

                <div className="flex overflow-x-auto gap-4 px-2 pb-4 hide-scrollbar snap-x">
                    {topTeams.length === 0 ? (
                        <div className="text-gray-500 text-xs p-4 italic">មិនមានទិន្នន័យសម្រាប់ {periodLabel}</div>
                    ) : (
                        topTeams.map((t, i) => (
                            <div key={t.name} className="flex-shrink-0 w-[240px] sm:w-[300px] snap-center bg-gray-900 border border-white/5 p-5 rounded-3xl flex items-center gap-4 relative overflow-hidden shadow-lg">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${
                                    i === 0 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' : 
                                    i === 1 ? 'bg-gray-400/20 text-gray-300 border-gray-400/30' : 
                                    'bg-orange-600/20 text-orange-500 border-orange-600/30'
                                }`}>
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-black text-white truncate uppercase tracking-tighter">{t.name}</h4>
                                    <p className="text-lg font-black text-blue-400">${t.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                                <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-3xl opacity-10 ${
                                    i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-600'
                                }`}></div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Compact Dashboard Filters & Actions - STICKY */}
            <div className="sticky top-2 z-[40] bg-[#020617]/80 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 space-y-4 shadow-2xl mx-1 ring-1 ring-white/5 transition-all hover:bg-gray-900/90">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar bg-black/40 p-1 rounded-xl border border-white/5">
                        {(['today', 'this_week', 'this_month', 'custom'] as const).map(p => (
                            <button 
                                key={p} 
                                onClick={() => setDateRange(p)} 
                                className={`flex-shrink-0 px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${dateRange === p ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'text-gray-500'}`}
                            >
                                {p === 'today' ? 'ថ្ងៃនេះ' : p === 'this_week' ? 'សប្តាហ៍នេះ' : p === 'this_month' ? 'ខែនេះ' : 'កំណត់'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between px-2">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">ប្រតិបត្តិការណ៍</span>
                            <span className="text-lg font-black text-white">{filteredOrders.length} <span className="text-[10px] text-gray-600 italic">Orders</span></span>
                        </div>
                        {hasPermission('view_revenue') && (
                            <div className="text-right">
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">ទឹកប្រាក់សរុប</span>
                                <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-blue-400">
                                    ${totalFilteredRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Report & Delivery Buttons Grid - Expanded to 4 columns */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {hasPermission('view_revenue') && (
                            <>
                                <button 
                                    onClick={() => setShowReport(true)}
                                    className="py-3 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    Page Report
                                </button>
                                <button 
                                    onClick={() => setShowShippingReport(true)}
                                    className="py-3 bg-orange-600/10 border border-orange-500/30 text-orange-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8h-2m2 4h-2m-2-4h.01M17 16h.01" /></svg>
                                    Shipping Cost
                                </button>
                            </>
                        )}
                        <button 
                            onClick={() => setIsDeliveryModalOpen(true)}
                            className={`py-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95 ${!hasPermission('view_revenue') ? 'col-span-2' : ''}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                            Delivery List
                        </button>
                    </div>
                </div>

                {dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 animate-fade-in-down">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-gray-800 border-none text-[10px] font-black text-white rounded-lg p-2" />
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-gray-800 border-none text-[10px] font-black text-white rounded-lg p-2" />
                    </div>
                )}
                
                <div className="relative group">
                    <input 
                        type="text" 
                        placeholder="ស្វែងរកតាម ID, ឈ្មោះ, ឬទូរស័ព្ទ..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full bg-black/40 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 transition-all" 
                    />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {/* List View */}
            <div className="px-1">
                {processing ? (
                    <div className="flex justify-center py-20">
                        <Spinner size="md" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20 bg-gray-800/10 rounded-[2rem] border-2 border-dashed border-gray-800/50">
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">រកមិនឃើញទិន្នន័យ</p>
                    </div>
                ) : (
                    <div className="animate-fade-in-up">
                        <OrdersList 
                            orders={filteredOrders} 
                            showActions={true} 
                            visibleColumns={userVisibleColumns}
                            onEdit={(o) => setEditingOrder(o)}
                        />
                    </div>                )}
            </div>

            {/* Mobile Sticky Action Bar */}
            <div className="md:hidden fixed bottom-6 left-6 right-6 z-40">
                <div className="bg-gray-900/95 backdrop-blur-3xl p-4 rounded-3xl shadow-2xl border border-white/10 flex justify-between items-center ring-1 ring-white/5">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em] mb-0.5">{hasPermission('view_revenue') ? 'Session Revenue' : 'Operational Mode'}</span>
                        <span className="text-white font-black text-xl tracking-tighter">
                            {hasPermission('view_revenue') ? `$${totalFilteredRevenue.toLocaleString()}` : team}
                        </span>
                    </div>
                    <button 
                        onClick={onAdd}
                        className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl shadow-lg shadow-blue-600/40 active:scale-90 transition-all"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                </div>
            </div>

            <div className="h-32 md:hidden"></div>

            <DeliveryListGeneratorModal 
                isOpen={isDeliveryModalOpen} 
                onClose={() => setIsDeliveryModalOpen(false)} 
                orders={permittedOrders} 
                appData={appData} 
                team={team}
            />        </div>
    );
};

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, setChatVisibility, setMobilePageTitle } = useContext(AppContext);
    const [view, setView] = useState<'list' | 'create'>('list');
    const [selectedTeam, setSelectedTeam] = useUrlState<string>('team', '');
    const userTeams = useMemo(() => (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean), [currentUser]);

    useEffect(() => { setChatVisibility(view !== 'create'); }, [view, setChatVisibility]);
    useEffect(() => { if (userTeams.length === 1 && !selectedTeam) setSelectedTeam(userTeams[0]); }, [userTeams, selectedTeam, setSelectedTeam]);

    // Update Header Title based on Team Selection
    useEffect(() => {
        if (selectedTeam) {
            setMobilePageTitle('MY ORDERS');
        } else {
            setMobilePageTitle(null);
        }
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setMobilePageTitle]);

    if (userTeams.length === 0) return (
        <div className="page-card text-center p-12 mt-20 max-w-lg mx-auto bg-gray-900/60 backdrop-blur-xl border border-white/5 rounded-[3rem]">
            <h2 className="text-xl font-black text-white mb-4">សួស្តី, {currentUser?.FullName}</h2>
            <p className="text-gray-500 text-sm">គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។</p>
            <button onClick={onBackToRoleSelect} className="btn btn-secondary mt-8 w-full rounded-2xl font-black">ត្រឡប់ក្រោយ</button>
        </div>
    );

    if (!selectedTeam) {
        return (
             <div className="w-full max-w-4xl mx-auto p-4 mt-6 animate-fade-in flex flex-col items-center">
                <div className="text-center space-y-3 mb-10">
                    <p className="text-blue-500 font-black uppercase tracking-[0.4em] text-[10px]">Access Identification</p>
                    <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter italic">ជ្រើសរើសក្រុមការងារ</h2>
                    <div className="w-16 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mx-auto shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                </div>

                <div className="w-full space-y-4 max-w-md">
                    {userTeams.map((team, idx) => (
                        <button 
                            key={team} 
                            onClick={() => setSelectedTeam(team)} 
                            className="group relative w-full overflow-hidden bg-gray-900/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 hover:border-blue-500/40 transition-all duration-500 active:scale-[0.97] shadow-xl flex items-center gap-6"
                        >
                            {/* Interactive Pulse Halo */}
                            <div className="absolute top-4 left-6">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                                <div className="absolute top-0 w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                            </div>
                            
                            <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 bg-gray-800 rounded-3xl flex items-center justify-center border border-white/5 shadow-inner group-hover:bg-blue-600/10 group-hover:border-blue-500/20 transition-all duration-500 group-hover:rotate-6">
                                 <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-blue-600">{team.charAt(0)}</span>
                            </div>
                            
                            <div className="relative z-10 flex-grow text-left">
                                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-1">{team}</h3>
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Team Operational Node {idx + 1}</p>
                            </div>

                            <div className="relative z-10 p-3 bg-white/5 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>

                            {/* Background Aesthetics */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500 opacity-0 group-hover:opacity-5 blur-[40px] transition-opacity"></div>
                        </button>
                    ))}
                </div>
                
                {currentUser?.IsSystemAdmin && (
                    <button 
                        onClick={onBackToRoleSelect} 
                        className="mt-12 flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest hover:text-blue-500 transition-all active:scale-95"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ត្រឡប់ទៅតួនាទី
                    </button>
                )}
            </div>
        );
    }

    if (view === 'create') return <CreateOrderPage team={selectedTeam} onSaveSuccess={() => setView('list')} onCancel={() => setView('list')} />;

    return (
        <div className="w-full max-w-full mx-auto p-2 sm:p-4 animate-fade-in min-h-screen relative overflow-x-hidden">
            {/* Optimized Header for Mobile */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
                <div className="space-y-2">
                    {/* Hidden on mobile, shown on desktop */}
                    <div className="hidden md:flex items-center gap-3">
                        <h1 className="text-2xl sm:text-4xl font-black text-white italic tracking-tighter leading-none">MY ORDERS</h1>
                        <div className="h-6 w-px bg-white/10"></div>
                        <span className="text-blue-500 font-black text-xs uppercase tracking-widest">{selectedTeam}</span>
                    </div>
                    {/* Mobile Only: Just the Team Badge */}
                    <div className="md:hidden flex items-center gap-2">
                        <span className="text-[10px] bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-black uppercase tracking-widest">
                            Team: {selectedTeam}
                        </span>
                    </div>

                    <div className="flex gap-2">
                         {userTeams.length > 1 && (
                            <button onClick={() => setSelectedTeam('')} className="text-[9px] font-black uppercase text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1.5 bg-gray-800/50 px-3 py-1.5 rounded-lg border border-white/5 active:scale-95">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth={3} /></svg>
                                Switch Team
                            </button>
                         )}
                    </div>
                </div>

                <button 
                    onClick={() => setView('create')} 
                    className="hidden md:flex px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-95 items-center gap-3 border border-blue-400/20"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                    Create Order
                </button>
            </div>
            
            <div className="relative">
                <UserOrdersView team={selectedTeam} onAdd={() => setView('create')} />
            </div>
        </div>
    );
};



export default UserJourney;
