
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { ParsedOrder, User, Target } from '../types';
import { usePerformanceData } from '../hooks/usePerformanceData';
import { AppContext } from '../context/AppContext';
import Spinner from '../components/common/Spinner';

// Extracted Components
import PerformanceOverview from '../components/performance/PerformanceOverview';
import LeaderboardTab from '../components/performance/LeaderboardTab';
import TargetsTab from '../components/performance/TargetsTab';

interface PerformanceTrackingPageProps {
    orders: ParsedOrder[];
    users: User[];
    targets: Target[];
}

type PerformanceTab = 'overview' | 'leaderboard' | 'targets';
type DateRangePreset = 'this_month' | 'last_month' | 'quarter' | 'year' | 'all';
type LeaderboardMetric = 'revenue' | 'orderCount' | 'achievement';

const PerformanceTrackingPage: React.FC<PerformanceTrackingPageProps> = ({ orders, users, targets }) => {
    const { previewImage, setMobilePageTitle, advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const [activeTab, setActiveTab] = useState<PerformanceTab>('overview');
    const [filters, setFilters] = useState({
        datePreset: 'this_month' as DateRangePreset,
        team: '',
        store: '',
    });
    const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>('revenue');

    // Set Mobile Title
    useEffect(() => {
        setMobilePageTitle('PERFORMANCE');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle]);

    // Extract unique stores
    const stores = useMemo(() => {
        const unique = new Set<string>();
        orders.forEach(o => {
            if (o['Fulfillment Store']) unique.add(o['Fulfillment Store']);
        });
        return Array.from(unique).sort();
    }, [orders]);

    // Extract unique teams (optional, but good for completeness if we want to enable team filtering later)
    const teams = useMemo(() => {
        const unique = new Set<string>();
        orders.forEach(o => {
            if (o.Team) unique.add(o.Team);
        });
        return Array.from(unique).sort();
    }, [orders]);

    const filteredOrders = useMemo(() => {
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = new Date();

        switch (filters.datePreset) {
            case 'this_month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1); endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
            case 'quarter': const quarter = Math.floor(now.getMonth() / 3); startDate = new Date(now.getFullYear(), quarter * 3, 1); break;
            case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
            case 'all': startDate = null; endDate = null; break;
        }

        return orders.filter(order => {
            if (!order.Timestamp) return false;

            // Exclude Cancelled and Returned orders from performance tracking
            const fs = order.FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
            if (fs === 'Cancelled' || fs === 'Returned') return false;

            const orderDate = new Date(order.Timestamp);
            const dateMatch = (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
            const teamMatch = !filters.team || order.Team === filters.team;
            const storeMatch = !filters.store || order['Fulfillment Store'] === filters.store;
            return dateMatch && teamMatch && storeMatch;
        });
    }, [orders, filters]);

    const performanceData = usePerformanceData(filteredOrders, users, targets);
    
    const sortedLeaderboard = useMemo(() => {
        if (!performanceData) return [];
        return [...performanceData.byUser].sort((a, b) => b[leaderboardMetric] - a[leaderboardMetric]);
    }, [performanceData, leaderboardMetric]);

    if (!performanceData.hasData && users.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center h-64 ${isLightMode ? 'text-gray-400 bg-white shadow-md border-gray-100' : 'text-gray-500 bg-gray-800/20 border-gray-700'} border rounded-3xl p-6`}>
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                <p className={`text-lg font-bold ${isLightMode ? 'text-gray-700' : 'text-white'}`}>រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់</p>
                <p className="text-sm">សូមប្រាកដថាអ្នកបានបង្កើតគណនីអ្នកលក់ក្នុងប្រព័ន្ធ។</p>
            </div>
        );
    }

    const { summary, byUser, monthlyTrend } = performanceData;

    const EmptyDataPlaceholder = () => (
        <div className={`flex flex-col items-center justify-center p-12 text-center ${isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/20 border-2 border-dashed border-gray-700'} rounded-3xl animate-fade-in`}>
            <div className={`w-20 h-20 ${isLightMode ? 'bg-gray-100' : 'bg-gray-800'} rounded-full flex items-center justify-center mb-4`}>
                <svg className={`w-10 h-10 ${isLightMode ? 'text-gray-400' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3 className={`text-xl font-bold ${isLightMode ? 'text-gray-900' : 'text-white'} mb-2`}>មិនទាន់មានទិន្នន័យសម្រាប់ជម្រើសនេះ</h3>
            <p className="text-gray-400 max-w-xs mx-auto mb-6 text-sm">សូមសាកល្បងប្តូរ "កាលបរិច្ឆេទ" ឬ "ក្រុម/Store" ដើម្បីមើលទិន្នន័យផ្សេងទៀត។</p>
            <button onClick={() => setFilters({ ...filters, datePreset: 'all', team: '', store: '' })} className={`btn ${isLightMode ? 'bg-blue-600 text-white' : 'btn-secondary'} text-xs`}>បង្ហាញទិន្នន័យទាំងអស់ (All Time)</button>
        </div>
    );

    return (
        <div className="space-y-6 lg:space-y-8 animate-fade-in px-2 sm:px-0 pb-12">
            {/* Header Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Tabs */}
                <div className={`flex p-1.5 rounded-2xl border transition-all duration-500
                    ${isLightMode ? 'bg-slate-100 border-slate-200 shadow-inner' : 'bg-black/40 border-white/5'}
                `}>
                    {(['overview', 'leaderboard', 'targets'] as PerformanceTab[]).map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)} 
                            className={`
                                flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black rounded-xl transition-all duration-300 tracking-widest uppercase
                                ${activeTab === tab 
                                    ? (isLightMode ? 'bg-white text-blue-600 shadow-md' : 'bg-white/10 text-white shadow-xl') 
                                    : (isLightMode ? 'text-slate-500 hover:text-slate-800' : 'text-slate-500 hover:text-slate-300')}
                            `}
                        >
                            <i className={`fa-solid ${tab === 'overview' ? 'fa-chart-pie' : tab === 'leaderboard' ? 'fa-trophy' : 'fa-bullseye'} ${activeTab === tab ? '' : 'opacity-60'}`}></i>
                            {tab === 'overview' ? 'Overview' : tab === 'leaderboard' ? 'Leaderboard' : 'Targets'}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {/* Date Preset */}
                    <div className={`flex items-center rounded-xl px-3.5 py-2.5 border transition-all duration-300 ${isLightMode ? 'bg-white border-slate-200 shadow-sm hover:border-blue-200' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'} flex-1 sm:flex-none cursor-pointer group`}>
                        <i className={`fa-regular fa-calendar text-[10px] ${isLightMode ? 'text-slate-400' : 'text-slate-500'} mr-2 group-hover:text-blue-500 transition-colors`}></i>
                        <span className={`text-[9px] ${isLightMode ? 'text-slate-400' : 'text-slate-500'} font-black uppercase mr-2 tracking-widest`}>Period:</span>
                        <select className={`bg-transparent border-none focus:ring-0 text-[11px] font-black ${isLightMode ? 'text-blue-600' : 'text-blue-400'} cursor-pointer w-full sm:w-auto uppercase tracking-wide`} value={filters.datePreset} onChange={e => setFilters({...filters, datePreset: e.target.value as DateRangePreset})}>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="quarter">This Quarter</option>
                            <option value="year">This Year</option>
                            <option value="all">All Time</option>
                        </select>
                    </div>

                    {/* Store Filter */}
                    <div className={`flex items-center rounded-xl px-3.5 py-2.5 border transition-all duration-300 ${isLightMode ? 'bg-white border-slate-200 shadow-sm hover:border-emerald-200' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'} flex-1 sm:flex-none cursor-pointer group`}>
                        <i className={`fa-solid fa-store text-[10px] ${isLightMode ? 'text-slate-400' : 'text-slate-500'} mr-2 group-hover:text-emerald-500 transition-colors`}></i>
                        <span className={`text-[9px] ${isLightMode ? 'text-slate-400' : 'text-slate-500'} font-black uppercase mr-2 tracking-widest`}>Store:</span>
                        <select className={`bg-transparent border-none focus:ring-0 text-[11px] font-black ${isLightMode ? 'text-emerald-600' : 'text-emerald-400'} cursor-pointer w-full sm:w-auto uppercase tracking-wide`} value={filters.store} onChange={e => setFilters({...filters, store: e.target.value})}>
                            <option value="">All Stores</option>
                            {stores.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Team Filter */}
                    <div className={`flex items-center rounded-xl px-3.5 py-2.5 border transition-all duration-300 ${isLightMode ? 'bg-white border-slate-200 shadow-sm hover:border-purple-200' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'} flex-1 sm:flex-none cursor-pointer group`}>
                        <i className={`fa-solid fa-users text-[10px] ${isLightMode ? 'text-slate-400' : 'text-slate-500'} mr-2 group-hover:text-purple-500 transition-colors`}></i>
                        <span className={`text-[9px] ${isLightMode ? 'text-slate-400' : 'text-slate-500'} font-black uppercase mr-2 tracking-widest`}>Team:</span>
                        <select className={`bg-transparent border-none focus:ring-0 text-[11px] font-black ${isLightMode ? 'text-purple-600' : 'text-purple-400'} cursor-pointer w-full sm:w-auto uppercase tracking-wide`} value={filters.team} onChange={e => setFilters({...filters, team: e.target.value})}>
                            <option value="">All Teams</option>
                            {teams.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Render Tab Content */}
            {activeTab === 'overview' && (
                summary.totalRevenue === 0 ? <EmptyDataPlaceholder /> : <PerformanceOverview summary={summary} monthlyTrend={monthlyTrend} />
            )}

            {activeTab === 'leaderboard' && (
                <LeaderboardTab 
                    data={sortedLeaderboard} 
                    metric={leaderboardMetric} 
                    onMetricChange={setLeaderboardMetric} 
                    datePreset={filters.datePreset}
                    previewImage={previewImage}
                />
            )}

            {activeTab === 'targets' && (
                byUser.length === 0 ? <div className="col-span-full py-12 text-center text-gray-500">មិនមានព័ត៌មានគោលដៅអ្នកលក់សម្រាប់ជម្រើសនេះ</div> : <TargetsTab data={byUser} />
            )}
        </div>
    );
};

export default PerformanceTrackingPage;
