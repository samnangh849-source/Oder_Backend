
import React, { useEffect, useContext } from 'react';
import { User, ParsedOrder } from '../../types';
import StatCard from '../performance/StatCard';
import TeamRevenueTable from './TeamRevenueTable';
import ProvincialMap from './ProvincialMap';
import ProvincialSummaryList from './ProvincialSummaryList';
import DateRangeFilter, { DateRangePreset } from '../common/DateRangeFilter';
import FulfillmentStoreTable from './FulfillmentStoreTable';
import SalesStoreTable from './SalesStoreTable';
import { AppContext } from '../../context/AppContext';

interface DashboardOverviewProps {
    currentUser: User | null;
    parsedOrders: ParsedOrder[];
    
    // Updated props for flexible date filtering
    dateFilter: { preset: string, start: string, end: string };
    setDateFilter: (filter: { preset: string, start: string, end: string }) => void;

    teamRevenueStats: any[];
    provinceStats: any[];
    storeStats: any[];
    brandStats: any[];
    onTeamClick: (team: string) => void;
    onProvinceClick: (province: string) => void;
    onStoreClick: (store: string) => void;
    onBrandClick: (brand: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
    currentUser, parsedOrders, 
    dateFilter, setDateFilter,
    teamRevenueStats, provinceStats, storeStats, brandStats,
    onTeamClick, onProvinceClick, onStoreClick, onBrandClick
}) => {
    // Note: We intentionally do NOT set a mobile page title here.
    // The requirement is to show the App Logo for the Dashboard view.
    
    const { advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    const getOrderDate = (o: ParsedOrder) => new Date(o.Timestamp);
    
    const filteredMetricsOrders = parsedOrders.filter(o => {
        if (!o.Timestamp) return false;
        const d = getOrderDate(o);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateFilter.preset === 'today') {
            return d.toDateString() === now.toDateString();
        } else if (dateFilter.preset === 'this_week') {
            const day = now.getDay();
            const start = new Date(today);
            start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59);
            return d >= start && d <= end;
        } else if (dateFilter.preset === 'this_month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (dateFilter.preset === 'custom') {
            const start = dateFilter.start ? new Date(dateFilter.start + 'T00:00:00') : null;
            const end = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        }
        return true; // Fallback
    });

    const metrics = {
        revenue: filteredMetricsOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0),
        orders: filteredMetricsOrders.length,
        unpaid: filteredMetricsOrders.filter(o => o['Payment Status'] === 'Unpaid').length
    };

    if (uiTheme === 'binance') {
        return (
            <div className="space-y-6 animate-reveal pb-20 select-none">
                {/* Binance Terminal Header */}
                <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-md relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                        <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0l-12 12 12 12 12-12-12-12zm0 19.5l-7.5-7.5 7.5-7.5 7.5 7.5-7.5 7.5z"/></svg>
                    </div>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-5 bg-[#FCD535] rounded-full"></div>
                                <h1 className="text-xl font-black text-[#EAECEF] uppercase tracking-[0.1em] leading-none">Market Overview</h1>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0ECB81]/10 border border-[#0ECB81]/20 rounded text-[9px] font-black text-[#0ECB81] uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] animate-pulse"></span>
                                    Node Integrity Optimal
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="text-[10px] text-[#848E9C] font-black uppercase tracking-widest">Operator: <span className="text-[#EAECEF]">{currentUser?.FullName}</span></span>
                                <span className="text-[#2B3139]">|</span>
                                <span className="text-[10px] text-[#848E9C] font-black uppercase tracking-widest leading-none">Last Sync: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <DateRangeFilter 
                                dateRange={dateFilter.preset as DateRangePreset}
                                onRangeChange={(r) => setDateFilter({ ...dateFilter, preset: r })}
                                customStart={dateFilter.start}
                                onCustomStartChange={(v) => setDateFilter({ ...dateFilter, start: v })}
                                customEnd={dateFilter.end}
                                onCustomEndChange={(v) => setDateFilter({ ...dateFilter, end: v })}
                            />
                        </div>
                    </div>
                </div>

                {/* Performance Nodes - Binance Card Style */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 bg-[#1E2329] border border-[#2B3139] hover:border-[#474D57] p-6 rounded-md transition-all group">
                        <div className="flex justify-between items-start mb-6">
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em] group-hover:text-[#FCD535] transition-colors">Net Volume (USD)</p>
                            <div className="p-1.5 bg-[#0ECB81]/10 rounded border border-[#0ECB81]/20 text-[#0ECB81]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-[#FCD535]">$</span>
                            <h3 className="text-4xl font-black text-[#EAECEF] tracking-tighter tabular-nums leading-none">
                                {metrics.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </h3>
                        </div>
                        <div className="mt-6 pt-6 border-t border-[#2B3139]/50 flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#848E9C] uppercase tracking-widest">Aggregated Stream</span>
                            <span className="text-[10px] font-black text-[#0ECB81]">+12.5%</span>
                        </div>
                    </div>

                    <div className="md:col-span-4 bg-[#1E2329] border border-[#2B3139] hover:border-[#474D57] p-6 rounded-md transition-all group">
                        <div className="flex justify-between items-start mb-6">
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em] group-hover:text-[#FCD535] transition-colors">Execution Count</p>
                            <div className="p-1.5 bg-[#474D57]/20 rounded border border-[#474D57]/30 text-[#848E9C]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-black text-[#EAECEF] tracking-tighter tabular-nums leading-none">{metrics.orders}</h3>
                            <span className="text-xs font-black text-[#848E9C] uppercase tracking-widest">Nodes</span>
                        </div>
                        <div className="mt-6 pt-6 border-t border-[#2B3139]/50 flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#848E9C] uppercase tracking-widest">Transaction Velocity</span>
                            <span className="text-[10px] font-black text-[#0ECB81]">+5.2%</span>
                        </div>
                    </div>

                    <div className="md:col-span-4 bg-[#1E2329] border border-[#2B3139] hover:border-[#474D57] p-6 rounded-md transition-all group">
                        <div className="flex justify-between items-start mb-6">
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em] group-hover:text-[#F6465D] transition-colors">Risk Exposure</p>
                            <div className="p-1.5 bg-[#F6465D]/10 rounded border border-[#F6465D]/20 text-[#F6465D]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-black text-[#F6465D] tracking-tighter tabular-nums leading-none">{metrics.unpaid}</h3>
                            <span className="text-xs font-black text-[#848E9C] uppercase tracking-widest">Unpaid</span>
                        </div>
                        <div className="mt-6 pt-6 border-t border-[#2B3139]/50 flex items-center justify-between">
                            <span className="text-[9px] font-bold text-[#848E9C] uppercase tracking-widest">Settlement Latency</span>
                            <span className="text-[10px] font-black text-[#F6465D]">-2.1%</span>
                        </div>
                    </div>
                </div>

                {/* Core Analytics Blocks */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <TeamRevenueTable stats={teamRevenueStats} onStatClick={onTeamClick} />
                        <SalesStoreTable stats={brandStats} onStatClick={onBrandClick} />
                        <FulfillmentStoreTable stats={storeStats} onStatClick={onStoreClick} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                        <div className="xl:col-span-8">
                            <ProvincialMap data={provinceStats} onProvinceClick={onProvinceClick} />
                        </div>
                        <div className="xl:col-span-4">
                            <ProvincialSummaryList stats={provinceStats} onProvinceClick={onProvinceClick} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (uiTheme === 'netflix') {
        return (
            <div className="space-y-12 animate-fade-in pb-20">
                {/* Netflix Hero Header */}
                <div className="relative -mt-8 pt-8">
                    <div className="flex flex-col gap-6 max-w-2xl relative z-10">
                        <div className="flex items-center gap-3">
                            <span className="bg-[#e50914] text-white text-[10px] font-black px-2 py-0.5 rounded shadow-lg uppercase tracking-widest">Live Report</span>
                            <span className={`${isLightMode ? 'text-gray-500' : 'text-gray-400'} text-xs font-bold uppercase tracking-[0.2em]`}>Dashboard / Overview</span>
                        </div>
                        <h1 className={`text-5xl md:text-7xl font-black ${isLightMode ? 'text-black' : 'text-white'} leading-none tracking-tighter uppercase italic`}>
                            O-SYSTEM <span className="text-[#e50914]">PRO</span>
                        </h1>
                        <p className={`text-lg ${isLightMode ? 'text-gray-700' : 'text-gray-300'} font-medium leading-relaxed`}>
                            Welcome back, <span className={`${isLightMode ? 'text-black' : 'text-white'} font-bold`}>{currentUser?.FullName}</span>. 
                            The system is monitoring <span className="text-[#e50914] font-black">{metrics.orders}</span> active orders across all channels.
                        </p>
                        
                        <div className="flex flex-wrap gap-4 mt-4">
                            <button onClick={() => onTeamClick('')} className={`${isLightMode ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'} px-8 py-3 rounded font-black uppercase text-sm flex items-center gap-3 transition-all active:scale-95 shadow-xl`}>
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M7 6v10l10-5z"/></svg>
                                Analyze Performance
                            </button>
                            <button onClick={() => setDateFilter({ ...dateFilter, preset: 'today' })} className={`${isLightMode ? 'bg-gray-200 text-black border-gray-300' : 'bg-gray-500/40 text-white border-white/20'} border px-8 py-3 rounded font-black uppercase text-sm flex items-center gap-3 backdrop-blur-md hover:bg-opacity-80 transition-all active:scale-95 shadow-xl`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                Today's Feed
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Section - Styled as Netflix Category Row */}
                <div className="relative z-20">
                    <div className="mb-4">
                        <h3 className={`text-xl font-black ${isLightMode ? 'text-black' : 'text-white'} uppercase tracking-tight flex items-center gap-3`}>
                            <span className="w-1 h-6 bg-[#e50914]"></span>
                            Time Selection
                        </h3>
                    </div>
                    <div className={`${isLightMode ? 'bg-white border-gray-200 shadow-lg' : 'bg-black/20 border-white/5 backdrop-blur-sm'} border p-6 rounded-lg`}>
                        <DateRangeFilter 
                            dateRange={dateFilter.preset as DateRangePreset}
                            onRangeChange={(r) => setDateFilter({ ...dateFilter, preset: r })}
                            customStart={dateFilter.start}
                            onCustomStartChange={(v) => setDateFilter({ ...dateFilter, start: v })}
                            customEnd={dateFilter.end}
                            onCustomEndChange={(v) => setDateFilter({ ...dateFilter, end: v })}
                        />
                    </div>
                </div>

                {/* Metrics Row - Netflix Card Style */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Total Revenue', value: `$${metrics.revenue.toLocaleString()}`, icon: '💰', trend: '+12.5%', color: 'from-[#e50914] to-[#ff0a16]' },
                        { label: 'Active Orders', value: metrics.orders, icon: '📦', trend: '+5.2%', color: isLightMode ? 'from-gray-100 to-gray-200' : 'from-gray-800 to-gray-900' },
                        { label: 'Pending Payments', value: metrics.unpaid, icon: '⏳', trend: '-2.1%', color: isLightMode ? 'from-gray-100 to-gray-200' : 'from-gray-800 to-gray-900' }
                    ].map((m, i) => (
                        <div key={i} className={`group relative aspect-[16/9] overflow-hidden rounded-lg border ${isLightMode ? 'border-gray-200 shadow-md' : 'border-white/5 shadow-2xl'} transition-all duration-500 hover:scale-105 hover:z-30 hover:border-[#e50914]/50`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${m.color} ${isLightMode && i > 0 ? 'opacity-100' : 'opacity-80'} transition-opacity group-hover:opacity-100`}></div>
                            {!isLightMode && <div className="absolute inset-0 bg-black/40"></div>}
                            <div className="absolute bottom-0 left-0 p-6 w-full transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-2xl">{m.icon}</span>
                                    <span className={`text-xs font-black ${isLightMode && i > 0 ? 'text-gray-600' : 'text-[#e50914]'} uppercase tracking-widest`}>{m.trend}</span>
                                </div>
                                <h4 className={`text-4xl font-black ${isLightMode && i > 0 ? 'text-black' : 'text-white'} mb-1`}>{m.value}</h4>
                                <p className={`text-xs ${isLightMode && i > 0 ? 'text-gray-500' : 'text-gray-400'} font-bold uppercase tracking-[0.2em]`}>{m.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Rows Area */}
                <div className="space-y-16">
                    <section>
                        <h3 className={`text-2xl font-black ${isLightMode ? 'text-black' : 'text-white'} uppercase tracking-tighter mb-6 flex items-center gap-4`}>
                            <span className="w-1.5 h-8 bg-[#e50914]"></span>
                            Performance Breakdown
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <TeamRevenueTable stats={teamRevenueStats} onStatClick={onTeamClick} />
                            <SalesStoreTable stats={brandStats} onStatClick={onBrandClick} />
                            <FulfillmentStoreTable stats={storeStats} onStatClick={onStoreClick} />
                        </div>
                    </section>

                    <section>
                        <h3 className={`text-2xl font-black ${isLightMode ? 'text-black' : 'text-white'} uppercase tracking-tighter mb-6 flex items-center gap-4`}>
                            <span className="w-1.5 h-8 bg-[#e50914]"></span>
                            Regional Distribution
                        </h3>
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                            <div className="xl:col-span-8">
                                <ProvincialMap data={provinceStats} onProvinceClick={onProvinceClick} />
                            </div>
                            <div className="xl:col-span-4">
                                <ProvincialSummaryList stats={provinceStats} onProvinceClick={onProvinceClick} />
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 lg:space-y-8 animate-fade-in pb-10">
            {/* Header - More compact on mobile */}
            <div className={`flex flex-col gap-4 ${isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/10 border-white/5 backdrop-blur-md'} p-4 sm:p-6 rounded-[2rem] border`}>
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                            <h2 className={`text-lg sm:text-xl lg:text-2xl font-black ${isLightMode ? 'text-gray-900' : 'text-white'} leading-none`}>សួស្តី, {currentUser?.FullName} 👋</h2>
                        </div>
                        <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest ml-3.5">
                            {new Date().toLocaleDateString('km-KH', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className={`${isLightMode ? 'bg-blue-50 border-blue-100' : 'bg-white/5 border-white/10'} border px-3 py-1.5 rounded-xl hidden sm:flex`}>
                        <span className="text-[10px] font-black text-blue-400">
                            {metrics.orders} <span className={`${isLightMode ? 'text-blue-600/50' : 'text-gray-500'} ml-1`}>Processed</span>
                        </span>
                    </div>
                </div>
                
                {/* Date Filter Component */}
                <div className="w-full">
                    <DateRangeFilter 
                        dateRange={dateFilter.preset as DateRangePreset}
                        onRangeChange={(r) => setDateFilter({ ...dateFilter, preset: r })}
                        customStart={dateFilter.start}
                        onCustomStartChange={(v) => setDateFilter({ ...dateFilter, start: v })}
                        customEnd={dateFilter.end}
                        onCustomEndChange={(v) => setDateFilter({ ...dateFilter, end: v })}
                    />
                </div>
            </div>

            {/* Metrics - Compact on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-6">
                <StatCard label="ចំណូលសរុប" value={`$${metrics.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}`} icon="💰" colorClass="from-blue-600 to-blue-400" />
                <StatCard label="ចំនួនការកម្មង់" value={metrics.orders} icon="📦" colorClass="from-emerald-600 to-emerald-400" />
                <StatCard label="មិនទាន់ទូទាត់" value={metrics.unpaid} icon="⏳" colorClass="from-orange-500 to-yellow-400" />
            </div>
            
            {/* Main Tables */}
            {/* Top row with 3 main breakdown tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <TeamRevenueTable stats={teamRevenueStats} onStatClick={onTeamClick} />
                <SalesStoreTable stats={brandStats} onStatClick={onBrandClick} />
                <FulfillmentStoreTable stats={storeStats} onStatClick={onStoreClick} />
            </div>
            
            {/* Map and Summary row */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
                <div className="xl:col-span-8">
                    <ProvincialMap data={provinceStats} onProvinceClick={onProvinceClick} />
                </div>
                <div className="xl:col-span-4">
                    <ProvincialSummaryList stats={provinceStats} onProvinceClick={onProvinceClick} />
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
