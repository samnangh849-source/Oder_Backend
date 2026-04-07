
import React, { useEffect, useContext, useMemo } from 'react';
import { User, ParsedOrder } from '../../types';
import StatCard from '../performance/StatCard';
import TeamRevenueTable from './TeamRevenueTable';
import ProvincialMap from './ProvincialMap';
import ProvincialSummaryList from './ProvincialSummaryList';
import DateRangeFilter, { DateRangePreset } from '../common/DateRangeFilter';
import FulfillmentStoreTable from './FulfillmentStoreTable';
import SalesStoreTable from './SalesStoreTable';
import { AppContext } from '../../context/AppContext';
import BinanceKPIRow from './BinanceKPIRow';
import BinanceChartPanel from './BinanceChartPanel';
import BinanceLiveIndicator from './BinanceLiveIndicator';

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
    refreshTimestamp: number;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
    currentUser, parsedOrders, 
    dateFilter, setDateFilter,
    teamRevenueStats, provinceStats, storeStats, brandStats,
    onTeamClick, onProvinceClick, onStoreClick, onBrandClick,
    refreshTimestamp
}) => {
    // Note: We intentionally do NOT set a mobile page title here.
    // The requirement is to show the App Logo for the Dashboard view.
    
    const { advancedSettings, language, isSyncing } = useContext(AppContext);
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
    }, [parsedOrders, dateFilter, refreshTimestamp]);

    const metrics = {
        revenue: filteredMetricsOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0),
        orders: filteredMetricsOrders.length,
        unpaid: filteredMetricsOrders.filter(o => o['Payment Status'] === 'Unpaid').length
    };

    // Prepare chart data for Binance dashboard
    const revenueChartData = useMemo(() => {
        if (uiTheme !== 'binance') return [];
        const grouped: Record<string, number> = {};
        filteredMetricsOrders.forEach(o => {
            const d = new Date(o.Timestamp);
            const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
            grouped[key] = (grouped[key] || 0) + (Number(o['Grand Total']) || 0);
        });
        return Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, value]) => ({ name, value }));
    }, [filteredMetricsOrders, uiTheme]);

    const paymentChartData = useMemo(() => {
        if (uiTheme !== 'binance') return [];
        const grouped: Record<string, { paid: number; unpaid: number }> = {};
        filteredMetricsOrders.forEach(o => {
            const d = new Date(o.Timestamp);
            const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
            if (!grouped[key]) grouped[key] = { paid: 0, unpaid: 0 };
            if (o['Payment Status'] === 'Paid') grouped[key].paid++;
            else grouped[key].unpaid++;
        });
        return Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, { paid, unpaid }]) => ({ name, value: paid, value2: unpaid }));
    }, [filteredMetricsOrders, uiTheme]);

    if (uiTheme === 'binance') {
        const paidOrders = filteredMetricsOrders.filter(o => o['Payment Status'] === 'Paid').length;

        return (
            <div className="select-none pb-20" style={{ fontFamily: "'Inter', sans-serif" }}>
                {/* Section 1: Header Strip */}
                <div className="bg-[#1E2329] border-b border-[#2B3139] px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-5 bg-[#FCD535]" style={{ borderRadius: '1px' }}></div>
                        <h1 className="text-base font-bold text-[#EAECEF] uppercase tracking-wider">
                            {language === 'km' ? 'ទិដ្ឋភាពទីផ្សារ' : 'Market Overview'}
                        </h1>
                        <BinanceLiveIndicator isSyncing={isSyncing} language={language} />
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

                {/* Section 2: KPI Row */}
                <div className="mt-[1px]">
                    <BinanceKPIRow
                        metrics={{ revenue: metrics.revenue, orders: metrics.orders, paid: paidOrders, unpaid: metrics.unpaid }}
                        language={language}
                    />
                </div>

                {/* Section 3: Charts Row */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-[1px] bg-[#2B3139] mt-[1px]">
                    <div className="xl:col-span-8">
                        <BinanceChartPanel
                            title={language === 'km' ? 'និន្នាការចំណូល' : 'Revenue Trend'}
                            data={revenueChartData}
                            chartType="area"
                            height={240}
                            valueLabel="Revenue"
                        />
                    </div>
                    <div className="xl:col-span-4">
                        <BinanceChartPanel
                            title={language === 'km' ? 'ស្ថានភាពការទូទាត់' : 'Payment Status'}
                            data={paymentChartData}
                            chartType="bar"
                            height={240}
                            valueLabel="Paid"
                            value2Label="Unpaid"
                        />
                    </div>
                </div>

                {/* Section 4: Data Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-[1px] bg-[#2B3139] mt-[1px]">
                    <div className="bg-[#0B0E11]">
                        <TeamRevenueTable stats={teamRevenueStats} onStatClick={onTeamClick} />
                    </div>
                    <div className="bg-[#0B0E11]">
                        <SalesStoreTable stats={brandStats} onStatClick={onBrandClick} />
                    </div>
                    <div className="bg-[#0B0E11]">
                        <FulfillmentStoreTable stats={storeStats} onStatClick={onStoreClick} />
                    </div>
                </div>

                {/* Section 5: Map */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-[1px] bg-[#2B3139] mt-[1px]">
                    <div className="xl:col-span-8 bg-[#1E2329] border border-[#2B3139]">
                        <ProvincialMap data={provinceStats} onProvinceClick={onProvinceClick} />
                    </div>
                    <div className="xl:col-span-4 bg-[#1E2329] border border-[#2B3139]">
                        <ProvincialSummaryList stats={provinceStats} onProvinceClick={onProvinceClick} />
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
