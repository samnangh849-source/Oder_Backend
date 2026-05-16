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

    const defaultSurface = isLightMode
        ? 'bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow'
        : 'bg-[#0f172a]/95 border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl';
    const defaultHeaderSurface = isLightMode
        ? 'bg-white border-slate-200'
        : 'bg-[#0f172a]/98 border-white/10';

    return (
        <div className="w-full max-w-[1600px] mx-auto py-6 px-4 sm:px-6 space-y-8 animate-fade-in pb-12">
            {/* Header Section */}
            <div className={`${defaultHeaderSurface} border rounded-2xl p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6 shadow-sm`}>
                <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="relative flex h-3 w-3">
                            {isSyncing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${isSyncing ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {isSyncing ? (language === 'km' ? 'កំពុងធ្វើបច្ចុប្បន្នភាព' : 'Syncing Data...') : (language === 'km' ? 'ទិន្នន័យបច្ចុប្បន្ន' : 'Live Operations')}
                        </span>
                    </div>
                    <h2 className={`text-3xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'} tracking-tight`}>
                        Admin Dashboard
                    </h2>
                    <p className={`text-sm font-medium ${isLightMode ? 'text-slate-500' : 'text-slate-400'} mt-1`}>
                        {language === 'km' ? 'សង្ខេបប្រតិបត្តិការ ការលក់ និងតំបន់ចែកចាយប្រចាំថ្ងៃ' : 'Comprehensive overview of sales, orders, and regional performance'}
                    </p>
                </div>
                <div className="w-full xl:w-auto bg-black/5 p-2 rounded-xl dark:bg-white/5 border border-transparent dark:border-white/5">
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

            {/* BEGIN: Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Revenue */}
                <div className={`${defaultSurface} rounded-2xl border p-6 flex flex-col justify-between group overflow-hidden relative`}>
                    {/* Subtle Background Glow */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div className={`h-12 w-12 rounded-xl ${isLightMode ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center border ${isLightMode ? 'border-blue-100' : 'border-blue-500/30'} shadow-sm`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isLightMode ? 'text-green-600 bg-green-100' : 'text-emerald-400 bg-emerald-400/10'} px-2.5 py-1 rounded-lg`}>Trending</span>
                    </div>
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'}
                        </p>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-xl font-bold ${isLightMode ? 'text-blue-600' : 'text-blue-400'}`}>$</span>
                            <p className={`text-4xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'} tabular-nums tracking-tighter`}>
                                {metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 2: Orders */}
                <div className={`${defaultSurface} rounded-2xl border p-6 flex flex-col justify-between group overflow-hidden relative`}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div className={`h-12 w-12 rounded-xl ${isLightMode ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'} flex items-center justify-center border ${isLightMode ? 'border-emerald-100' : 'border-emerald-500/30'} shadow-sm`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isLightMode ? 'text-blue-600 bg-blue-100' : 'text-blue-400 bg-blue-400/10'} px-2.5 py-1 rounded-lg`}>Active</span>
                    </div>
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {language === 'km' ? 'ការកម្មង់សរុប' : 'Total Orders'}
                        </p>
                        <p className={`text-4xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'} tabular-nums tracking-tighter`}>
                            {metrics.orders.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Card 3: Unpaid */}
                <div className={`${defaultSurface} rounded-2xl border p-6 flex flex-col justify-between group overflow-hidden relative`}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-orange-500/20 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div className={`h-12 w-12 rounded-xl ${isLightMode ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/20 text-orange-400'} flex items-center justify-center border ${isLightMode ? 'border-orange-100' : 'border-orange-500/30'} shadow-sm`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        {metrics.unpaid > 0 && <span className="flex h-2.5 w-2.5 relative mt-2 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span></span>}
                    </div>
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {language === 'km' ? 'មិនទាន់ទូទាត់' : 'Pending Payment'}
                        </p>
                        <p className={`text-4xl font-black ${metrics.unpaid > 0 ? (isLightMode ? 'text-orange-600' : 'text-orange-400') : (isLightMode ? 'text-slate-900' : 'text-white')} tabular-nums tracking-tighter`}>
                            {metrics.unpaid.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Card 4: System */}
                <div className={`${defaultSurface} rounded-2xl border p-6 flex flex-col justify-between group overflow-hidden relative`}>
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                        <div className={`h-12 w-12 rounded-xl ${isLightMode ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/20 text-purple-400'} flex items-center justify-center border ${isLightMode ? 'border-purple-100' : 'border-purple-500/30'} shadow-sm`}>
                            <svg className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isSyncing ? (isLightMode ? 'text-blue-600 bg-blue-100' : 'text-blue-400 bg-blue-400/10') : (isLightMode ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-white/5')} px-2.5 py-1 rounded-lg`}>System</span>
                    </div>
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {language === 'km' ? 'ស្ថានភាពសម័យកាល' : 'Sync Status'}
                        </p>
                        <p className={`text-2xl font-black ${isLightMode ? 'text-slate-900' : 'text-white'} tabular-nums tracking-tight`}>
                            {isSyncing ? (language === 'km' ? 'កំពុងអាប់ដេត...' : 'Syncing...') : (language === 'km' ? 'ចុងក្រោយបំផុត' : 'Up to date')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Layout Row 2: Recent Orders & Team Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Recent Orders Table */}
                <div className={`xl:col-span-8 ${defaultSurface} rounded-2xl border overflow-hidden`}>
                    <div className={`px-6 py-5 flex justify-between items-center border-b ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                            <h3 className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>
                                {language === 'km' ? 'ការកម្មង់ចុងក្រោយ' : 'Recent Orders'}
                            </h3>
                        </div>
                        <button onClick={() => onTeamClick('')} className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isLightMode ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'}`}>
                            View All <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className={`min-w-full divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                            <thead className={isLightMode ? 'bg-slate-50/50' : 'bg-white/[0.02]'}>
                                <tr>
                                    {['Order ID', 'Customer', 'Status', 'Date', 'Amount'].map(header => (
                                        <th key={header} className={`px-6 py-4 text-left text-[10px] font-black ${isLightMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-[0.2em]`}>
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isLightMode ? 'divide-slate-100 bg-white' : 'divide-white/5 bg-transparent'}`}>
                                {filteredMetricsOrders.slice(0, 5).map((order, idx) => (
                                    <tr key={idx} className={`${isLightMode ? 'hover:bg-slate-50/80' : 'hover:bg-white/[0.02]'} transition-colors group cursor-default`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-xs font-black font-mono tracking-wider ${isLightMode ? 'text-blue-600 bg-blue-50' : 'text-blue-400 bg-blue-400/10'} px-2 py-1 rounded-md`}>
                                                #{String(order['Order ID']).substring(0, 8)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${isLightMode ? 'text-slate-900' : 'text-slate-200'}`}>{order['Customer Name'] || 'N/A'}</span>
                                                <span className={`text-xs font-medium ${isLightMode ? 'text-slate-500' : 'text-slate-500'}`}>{order['Customer Phone'] || ''}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                                order['Payment Status'] === 'Paid'
                                                    ? (isLightMode ? 'bg-green-50 text-green-700 border-green-200' : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20')
                                                    : order['Payment Status'] === 'Unpaid'
                                                    ? (isLightMode ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-400/10 text-red-400 border-red-400/20')
                                                    : (isLightMode ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-orange-400/10 text-orange-400 border-orange-400/20')
                                            }`}>
                                                {order['Payment Status'] || 'Pending'}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {order.Timestamp ? new Date(order.Timestamp).toLocaleDateString('en-GB') : 'N/A'}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                                            ${(Number(order['Grand Total']) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {filteredMetricsOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center opacity-50">
                                                <span className="text-4xl mb-3">📦</span>
                                                <p className={`text-sm font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>No recent orders</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className={`xl:col-span-4 ${defaultSurface} rounded-2xl border overflow-hidden`}>
                    <div className={`px-6 py-5 border-b ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                            <h3 className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>Team Performance</h3>
                        </div>
                    </div>
                    <div className="p-2">
                        <TeamRevenueTable stats={teamRevenueStats} onStatClick={onTeamClick} />
                    </div>
                </div>
            </div>

            {/* Layout Row 3: Stores */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className={`${defaultSurface} rounded-2xl border overflow-hidden`}>
                    <div className={`px-6 py-5 border-b ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                            <h3 className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>Brand Sales</h3>
                        </div>
                    </div>
                    <div className="p-2">
                        <SalesStoreTable stats={brandStats} onStatClick={onBrandClick} />
                    </div>
                </div>
                <div className={`${defaultSurface} rounded-2xl border overflow-hidden`}>
                    <div className={`px-6 py-5 border-b ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                            <h3 className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>Fulfillment Operations</h3>
                        </div>
                    </div>
                    <div className="p-2">
                        <FulfillmentStoreTable stats={storeStats} onStatClick={onStoreClick} />
                    </div>
                </div>
            </div>

            {/* Layout Row 4: Map */}
            <div className={`grid grid-cols-1 xl:grid-cols-12 gap-0 ${defaultSurface} rounded-2xl border overflow-hidden`}>
                <div className={`xl:col-span-8 border-b xl:border-b-0 xl:border-r ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                    <div className={`px-6 py-5 border-b ${isLightMode ? 'border-slate-200 bg-slate-50/50' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-cyan-500 rounded-full"></div>
                            <h3 className={`text-lg font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>Regional Heatmap</h3>
                        </div>
                    </div>
                    <div className="p-6">
                        <ProvincialMap data={provinceStats} onProvinceClick={onProvinceClick} />
                    </div>
                </div>
                <div className="xl:col-span-4 bg-black/5 dark:bg-white/[0.02]">
                    <div className={`px-6 py-5 border-b ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                        <h3 className={`font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>Provincial Summary</h3>
                    </div>
                    <div className="p-2">
                        <ProvincialSummaryList stats={provinceStats} onProvinceClick={onProvinceClick} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
