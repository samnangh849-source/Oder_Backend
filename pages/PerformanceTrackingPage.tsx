
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
        <div className="space-y-6 animate-fade-in px-2 sm:px-0 pb-12">
            <style>{`
                @keyframes bounce-slow { 0%, 100% { transform: translateY(-5%); } 50% { transform: translateY(0); } }
                .animate-bounce-slow { animation: bounce-slow 3s infinite ease-in-out; }
                .glass-card { background: ${isLightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(31, 41, 55, 0.4)'}; backdrop-filter: blur(12px); border: 1px solid ${isLightMode ? 'rgba(229, 231, 235, 0.5)' : 'rgba(75, 85, 99, 0.3)'}; }
                .progress-glow { filter: drop-shadow(0 0 4px currentColor); }
            `}</style>

            {/* Header Controls */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className={`flex ${isLightMode ? 'bg-white border-gray-200' : 'bg-gray-800/80 border-gray-700'} p-1.5 rounded-2xl border backdrop-blur-md shadow-inner`}>
                    {(['overview', 'leaderboard', 'targets'] as PerformanceTab[]).map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)} 
                            className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : isLightMode ? 'text-gray-500 hover:text-blue-600 hover:bg-gray-50' : 'text-gray-400 hover:text-white'}`}
                        >
                            {tab === 'overview' ? 'ទិន្នន័យសង្ខេប' : tab === 'leaderboard' ? 'ចំណាត់ថ្នាក់' : 'គោលដៅ'}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {/* Date Preset */}
                    <div className={`flex items-center ${isLightMode ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-800/50 border-gray-700'} rounded-xl px-3 py-1.5 border flex-1 sm:flex-none`}>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mr-2">កាលបរិច្ឆេទ:</span>
                        <select className={`bg-transparent border-none focus:ring-0 text-xs font-bold ${isLightMode ? 'text-blue-600' : 'text-blue-400'} cursor-pointer w-full sm:w-auto`} value={filters.datePreset} onChange={e => setFilters({...filters, datePreset: e.target.value as DateRangePreset})}>
                            <option value="this_month">ខែនេះ</option>
                            <option value="last_month">ខែមុន</option>
                            <option value="quarter">ត្រីមាសនេះ</option>
                            <option value="year">ឆ្នាំនេះ</option>
                            <option value="all">ទាំងអស់</option>
                        </select>
                    </div>

                    {/* Store Filter */}
                    <div className={`flex items-center ${isLightMode ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-800/50 border-gray-700'} rounded-xl px-3 py-1.5 border flex-1 sm:flex-none`}>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mr-2">Store:</span>
                        <select className={`bg-transparent border-none focus:ring-0 text-xs font-bold ${isLightMode ? 'text-emerald-600' : 'text-emerald-400'} cursor-pointer w-full sm:w-auto`} value={filters.store} onChange={e => setFilters({...filters, store: e.target.value})}>
                            <option value="">All Stores</option>
                            {stores.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Team Filter */}
                    <div className={`flex items-center ${isLightMode ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-800/50 border-gray-700'} rounded-xl px-3 py-1.5 border flex-1 sm:flex-none`}>
                        <span className="text-[10px] text-gray-500 font-bold uppercase mr-2">Team:</span>
                        <select className={`bg-transparent border-none focus:ring-0 text-xs font-bold ${isLightMode ? 'text-purple-600' : 'text-purple-400'} cursor-pointer w-full sm:w-auto`} value={filters.team} onChange={e => setFilters({...filters, team: e.target.value})}>
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
