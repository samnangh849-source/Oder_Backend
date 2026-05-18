
import React, { useState, useMemo, useContext } from 'react';
import { ParsedOrder, User } from '../../types';
import { AppContext } from '../../context/AppContext';
import { analyzeReportData } from '../../services/geminiService';
import GeminiButton from '../common/GeminiButton';
import SimpleLineChart from '../common/SimpleLineChart';
import StatCard from '../performance/StatCard';
import ShippingReport from '../reports/ShippingReport';
import { FilterState } from '../orders/OrderFilters';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';

interface ReportsViewProps {
    orders: ParsedOrder[];
    allOrders: ParsedOrder[];
    reportType: 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping';
    dateFilter: string;
    startDate?: string;
    endDate?: string;
    onNavigate?: (filters: any) => void;
    contextFilters?: FilterState;
}

const ReportsView: React.FC<ReportsViewProps> = ({ orders, reportType, dateFilter, startDate, endDate, onNavigate, contextFilters }) => {
    const { advancedSettings, appData, language } = useContext(AppContext);
    
    // Redirect to specialized Shipping Report if requested
    if (reportType === 'shipping') {
        return (
            <ShippingReport 
                orders={orders} 
                appData={appData} 
                dateFilter={dateFilter} 
                startDate={startDate} 
                endDate={endDate} 
                onNavigate={onNavigate}
                contextFilters={contextFilters}
            />
        );
    }

    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';

    const [analysis, setAnalysis] = useState<string>('');
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    const stats = useMemo(() => {
        let revenue = 0;
        let totalProfit = 0;
        let paymentMap: Record<string, number> = { Paid: 0, Unpaid: 0 };
        let teamMap: Record<string, { name: string, revenue: number, orders: number }> = {};
        let userMap: Record<string, { name: string, revenue: number, orders: number, avatar?: string }> = {};
        let dateMap: Record<string, number> = {};

        orders.forEach(o => {
            const fs = o.FulfillmentStatus || o['Fulfillment Status'] || 'Pending';
            if (fs === 'Cancelled') return;

            const rev = Number(o['Grand Total']) || 0;
            const cost = Number(o['Internal Cost']) || 0;
            revenue += rev;
            totalProfit += (rev - cost);
            
            const status = o['Payment Status'] === 'Paid' ? 'Paid' : 'Unpaid';
            paymentMap[status] = (paymentMap[status] || 0) + 1;

            if (o.Team) {
                if (!teamMap[o.Team]) teamMap[o.Team] = { name: o.Team, revenue: 0, orders: 0 };
                teamMap[o.Team].revenue += rev;
                teamMap[o.Team].orders += 1;
            }

            if (o.User) {
                if (!userMap[o.User]) {
                    const userMatch = appData.users?.find(u => u.FullName === o.User || u.UserName === o.User);
                    userMap[o.User] = { name: o.User, revenue: 0, orders: 0, avatar: userMatch?.ProfilePictureURL };
                }
                userMap[o.User].revenue += rev;
                userMap[o.User].orders += 1;
            }

            if (o.Timestamp) {
                const date = o.Timestamp.split(' ')[0];
                dateMap[date] = (dateMap[date] || 0) + rev;
            }
        });

        const activeOrdersCount = orders.filter(o => {
            const fs = o.FulfillmentStatus || o['Fulfillment Status'] || 'Pending';
            return fs !== 'Cancelled';
        }).length;

        const teamStats = Object.values(teamMap).sort((a, b) => b.revenue - a.revenue);
        const topUsers = Object.values(userMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const margin = revenue > 0 ? (totalProfit / revenue) * 100 : 0;

        const chartData = Object.keys(dateMap).sort().map(date => ({
            name: date,
            value: dateMap[date]
        }));

        return {
            revenue,
            totalOrders: activeOrdersCount,
            totalProfit,
            margin,
            chartData,
            teamStats,
            paymentMap,
            topUsers
        };
    }, [orders, appData.users]);

    const handleAnalyze = async () => {
        setLoadingAnalysis(true);
        try {
            const prompt = `Analyze this sales report for ${reportType}. Total Revenue: $${stats.revenue}, Orders: ${stats.totalOrders}, Margin: ${stats.margin}%. Top team: ${stats.teamStats[0]?.name}. Provide 3 short, high-impact business insights in uppercase KHMER language.`;
            const result = await analyzeReportData(prompt);
            setAnalysis(result);
        } catch (e) {
            setAnalysis("Analysis failed.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    // Theme-specific styles
    const getThemeStyles = () => {
        switch (uiTheme) {
            case 'binance':
                return {
                    container: 'bg-[#0B0E11]',
                    cardBg: 'bg-[#1E2329] border-[#2B3139]',
                    accent: '#FCD535',
                    accentText: 'text-[#FCD535]',
                    secondaryText: 'text-[#848E9C]',
                    primaryText: 'text-[#EAECEF]',
                    chartBg: 'bg-[#1E2329] border-[#2B3139]',
                    barBg: 'bg-[#2B3139]',
                    activeBar: 'bg-[#FCD535]',
                    innerBg: 'bg-[#0B0E11]',
                    indicator: 'bg-[#FCD535]'
                };
            case 'netflix':
                return {
                    container: 'bg-[#141414]',
                    cardBg: 'bg-[#181818] border-white/5',
                    accent: '#E50914',
                    accentText: 'text-[#E50914]',
                    secondaryText: 'text-gray-400',
                    primaryText: 'text-white',
                    chartBg: 'bg-[#181818] border-white/5',
                    barBg: 'bg-gray-800',
                    activeBar: 'bg-[#E50914]',
                    innerBg: 'bg-black/20',
                    indicator: 'bg-[#E50914]'
                };
            default:
                return {
                    container: isLightMode ? 'bg-slate-50' : 'bg-[#080b12]',
                    cardBg: isLightMode ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.08]',
                    accent: '#3b82f6',
                    accentText: isLightMode ? 'text-blue-600' : 'text-blue-400',
                    secondaryText: isLightMode ? 'text-slate-500' : 'text-slate-400',
                    primaryText: isLightMode ? 'text-slate-900' : 'text-white',
                    chartBg: isLightMode ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.08]',
                    barBg: isLightMode ? 'bg-slate-100' : 'bg-white/5',
                    activeBar: 'bg-blue-600',
                    innerBg: isLightMode ? 'bg-slate-50/50' : 'bg-black/20',
                    indicator: 'bg-blue-600'
                };
        }
    };

    const styles = getThemeStyles();

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12 select-none px-1">
            {/* Top Stat Row - Enhanced with better glassmorphism */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard 
                    label={language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'} 
                    value={`$${stats.revenue.toLocaleString(undefined, {minimumFractionDigits: 0})}`} 
                    icon={<i className="fa-solid fa-sack-dollar"></i>} 
                    colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-blue-600 to-indigo-600"} 
                    className="shadow-xl"
                />
                <StatCard 
                    label={language === 'km' ? 'ការកម្មង់សរុប' : 'Total Orders'} 
                    value={stats.totalOrders} 
                    icon={<i className="fa-solid fa-box-archive"></i>} 
                    colorClass={uiTheme === 'binance' ? "from-[#2B3139] to-[#1E2329]" : "from-indigo-600 to-purple-600"} 
                    className="shadow-xl"
                />
                <StatCard 
                    label={language === 'km' ? 'ប្រាក់ចំណេញ' : 'Total Profit'} 
                    value={`$${stats.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 0})}`} 
                    icon={<i className="fa-solid fa-chart-line"></i>} 
                    colorClass={uiTheme === 'binance' ? "from-[#0ECB81] to-[#059669]" : "from-emerald-600 to-teal-600"} 
                    className="shadow-xl"
                />
                <StatCard 
                    label={language === 'km' ? 'Margin (%)' : 'Profit Margin'} 
                    value={`${stats.margin.toFixed(1)}%`} 
                    icon={<i className="fa-solid fa-scale-balanced"></i>} 
                    colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-amber-500 to-orange-600"} 
                    className="shadow-xl"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Main Revenue Chart - More professional glass look */}
                <div className="lg:col-span-8 space-y-6 lg:space-y-8">
                    <div className={`p-6 sm:p-8 ${styles.chartBg} rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl flex flex-col`}>
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex flex-col">
                                <h2 className={`text-sm font-black ${styles.primaryText} uppercase tracking-widest`}>Revenue Performance</h2>
                                <span className={`text-[10px] font-bold ${styles.secondaryText} mt-1 uppercase tracking-tighter`}>Daily trend and volume analysis</span>
                            </div>
                            <div className={`px-3 py-1 rounded-full ${styles.innerBg} border ${styles.barBg} text-[10px] font-black ${styles.accentText} uppercase tracking-widest`}>
                                Live Data
                            </div>
                        </div>
                        <div className="h-[350px] sm:h-[400px]">
                            <SimpleLineChart data={stats.chartData} title="" color={styles.accent} />
                        </div>
                    </div>

                    {/* Breakdown Sections - Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        {/* Team Performance - Modern List */}
                        <div className={`p-6 ${styles.cardBg} rounded-3xl border shadow-sm backdrop-blur-xl`}>
                            <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.25em] mb-8 flex items-center gap-3`}>
                                <div className={`w-1.5 h-4 ${styles.indicator} rounded-full`}></div>
                                Team Efficiency
                            </h3>
                            <div className="space-y-6">
                                {stats.teamStats.map((team, idx) => (
                                    <div key={team.name} className="flex flex-col gap-2.5 group">
                                        <div className="flex justify-between items-end">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-5 h-5 rounded-md ${styles.innerBg} border ${styles.barBg} flex items-center justify-center text-[9px] font-black ${styles.secondaryText}`}>{idx + 1}</span>
                                                <span className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-tight`}>{team.name}</span>
                                            </div>
                                            <span className={`text-[11px] font-black ${styles.accentText} tabular-nums`}>${team.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className={`w-full h-2 ${styles.barBg} rounded-full overflow-hidden relative`}>
                                            <div 
                                                className={`h-full ${styles.activeBar} rounded-full transition-all duration-1000 ease-out`} 
                                                style={{ width: `${(team.revenue / stats.revenue) * 100}%` }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer"></div>
                                            </div>
                                        </div>
                                        <div className={`flex justify-between text-[8px] font-black ${styles.secondaryText} uppercase tracking-[0.15em] opacity-60`}>
                                            <span>{team.orders} Executed Orders</span>
                                            <span>{((team.revenue / stats.revenue) * 100).toFixed(1)}% Weight</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Status Breakdown - Visual Gauges */}
                        <div className={`p-6 ${styles.cardBg} rounded-3xl border shadow-sm backdrop-blur-xl flex flex-col`}>
                            <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.25em] mb-8 flex items-center gap-3`}>
                                <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                                Settlement Health
                            </h3>
                            <div className="flex-grow flex flex-col justify-center gap-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`p-4 rounded-2xl ${styles.innerBg} border ${styles.barBg} text-center group transition-all duration-300 hover:border-emerald-500/30`}>
                                        <div className="text-3xl font-black text-emerald-500 tabular-nums mb-1 group-hover:scale-110 transition-transform">{stats.paymentMap.Paid || 0}</div>
                                        <div className={`text-[9px] font-black ${styles.secondaryText} uppercase tracking-widest`}>Finalized</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl ${styles.innerBg} border ${styles.barBg} text-center group transition-all duration-300 hover:border-rose-500/30`}>
                                        <div className="text-3xl font-black text-rose-500 tabular-nums mb-1 group-hover:scale-110 transition-transform">{stats.paymentMap.Unpaid || 0}</div>
                                        <div className={`text-[9px] font-black ${styles.secondaryText} uppercase tracking-widest`}>Outstanding</div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className={`flex h-3 w-full rounded-full overflow-hidden ${styles.barBg} p-0.5`}>
                                        <div className="bg-emerald-500 rounded-full" style={{ width: `${(stats.paymentMap.Paid / stats.totalOrders) * 100}%` }}></div>
                                        <div className="bg-rose-500 rounded-full ml-0.5" style={{ width: `${(stats.paymentMap.Unpaid / stats.totalOrders) * 100}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                        <div className="flex items-center gap-2 text-emerald-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                            {((stats.paymentMap.Paid / stats.totalOrders) * 100 || 0).toFixed(1)}% Collected
                                        </div>
                                        <div className="flex items-center gap-2 text-rose-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                            {((stats.paymentMap.Unpaid / stats.totalOrders) * 100 || 0).toFixed(1)}% Risk
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: AI & Top Performers */}
                <div className="lg:col-span-4 space-y-6 lg:space-y-8">
                    {/* Top Performers (Users) - High end cards */}
                    <div className={`p-6 ${styles.cardBg} rounded-3xl border shadow-sm backdrop-blur-xl`}>
                        <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.25em] mb-8 flex items-center gap-3`}>
                            <div className={`w-1.5 h-4 ${styles.indicator} rounded-full`}></div>
                            Top Performers
                        </h3>
                        <div className="space-y-6">
                            {stats.topUsers.map((user, idx) => (
                                <div key={user.name} className="flex items-center gap-4 group cursor-pointer relative">
                                    <div className="relative">
                                        <UserAvatar 
                                            avatarUrl={user.avatar} 
                                            name={user.name} 
                                            size="md" 
                                            className={`border-2 ${isLightMode ? 'border-white shadow-sm' : 'border-white/10 shadow-lg'} group-hover:scale-110 group-hover:border-blue-500 transition-all duration-500`} 
                                        />
                                        <div className={`absolute -top-1 -left-1 w-5 h-5 ${styles.cardBg} rounded-lg border shadow-md flex items-center justify-center text-[9px] font-black ${styles.accentText} z-10`}>
                                            {idx + 1}
                                        </div>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <h4 className={`text-[11px] font-black ${styles.primaryText} truncate uppercase tracking-tight group-hover:text-blue-500 transition-colors`}>{user.name}</h4>
                                            <span className={`text-[11px] font-black ${styles.accentText} tabular-nums`}>${user.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-black ${styles.secondaryText} uppercase tracking-widest opacity-60`}>{user.orders} Orders</span>
                                            <span className={`h-1 w-1 rounded-full ${styles.indicator} opacity-30`}></span>
                                            <span className={`text-[8px] font-black ${styles.accentText} uppercase tracking-widest`}>TOP {idx + 1}</span>
                                        </div>
                                    </div>
                                    <div className={`absolute right-0 bottom-0 h-px w-0 bg-blue-500 transition-all duration-500 group-hover:w-full opacity-20`}></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Insights - Modern Terminal Look */}
                    <div className={`p-6 ${styles.cardBg} rounded-3xl border shadow-sm backdrop-blur-xl flex flex-col min-h-[350px] overflow-hidden group`}>
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div className="flex flex-col">
                                <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.25em]`}>AI Intel</h3>
                                <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse mt-0.5">Quantum Analysis Active</span>
                            </div>
                            <GeminiButton onClick={handleAnalyze} isLoading={loadingAnalysis} variant={uiTheme === 'binance' ? 'primary' : 'default'}>Compute</GeminiButton>
                        </div>
                        
                        <div className={`flex-grow ${styles.innerBg} rounded-2xl p-5 border ${styles.barBg} overflow-y-auto custom-scrollbar relative z-10`}>
                            {analysis ? (
                                <div className={`text-[12px] ${styles.secondaryText} leading-relaxed font-bold uppercase tracking-wide space-y-4`}>
                                    {analysis.split('\n').map((line, i) => (
                                        <div key={i} className="flex gap-3">
                                            <span className="text-emerald-500 mt-0.5">»</span>
                                            <p className="flex-1">{line}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-10 py-8">
                                    <div className="relative mb-6">
                                        <i className="fa-solid fa-brain text-5xl animate-bounce"></i>
                                        <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20"></div>
                                    </div>
                                    <p className="text-[10px] text-center uppercase font-black tracking-[0.3em]">System IDLE</p>
                                    <p className="text-[7px] text-center uppercase font-bold tracking-widest mt-2">Awaiting Data Processing</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Decorative elements */}
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-600/10 transition-all duration-700"></div>
                    </div>
                </div>
            </div>
        </div>
    );

};

export default ReportsView;
