
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
    const { advancedSettings, appData } = useContext(AppContext);
    
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

        const teamStats = Object.values(teamMap).sort((a, b) => b.revenue - a.revenue);
        const topUsers = Object.values(userMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const margin = revenue > 0 ? (totalProfit / revenue) * 100 : 0;

        const chartData = Object.keys(dateMap).sort().map(date => ({
            name: date,
            value: dateMap[date]
        }));

        return {
            revenue,
            totalOrders: orders.length,
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
                    cardBg: 'bg-[#1E2329] border-[#2B3139]',
                    accent: '#FCD535',
                    accentText: 'text-[#FCD535]',
                    secondaryText: 'text-[#848E9C]',
                    primaryText: 'text-[#EAECEF]',
                    chartBg: 'bg-[#1E2329] border-[#2B3139]',
                    barBg: 'bg-[#2B3139]',
                    activeBar: 'bg-[#FCD535]',
                    innerBg: 'bg-[#0B0E11]'
                };
            case 'netflix':
                return {
                    cardBg: 'bg-[#141414] border-white/5',
                    accent: '#e50914',
                    accentText: 'text-[#e50914]',
                    secondaryText: 'text-gray-400',
                    primaryText: 'text-white',
                    chartBg: 'bg-black/20 border-white/5',
                    barBg: 'bg-gray-800',
                    activeBar: 'bg-[#e50914]',
                    innerBg: 'bg-black/40'
                };
            default:
                return {
                    cardBg: 'bg-gray-900/40 border-white/5',
                    accent: '#3b82f6',
                    accentText: 'text-blue-400',
                    secondaryText: 'text-gray-500',
                    primaryText: 'text-white',
                    chartBg: 'bg-gray-900/40 border-white/5',
                    barBg: 'bg-gray-800',
                    activeBar: 'bg-blue-500',
                    innerBg: 'bg-black/40'
                };
        }
    };

    const styles = getThemeStyles();

    return (
        <div className="space-y-8 animate-fade-in pb-12 select-none">
            {/* Top Stat Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="ចំណូលសរុប" value={`$${stats.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon="💰" colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-blue-600 to-blue-400"} />
                <StatCard label="ការកម្មង់" value={stats.totalOrders} icon="📦" colorClass={uiTheme === 'binance' ? "from-[#2B3139] to-[#1E2329]" : "from-indigo-600 to-indigo-400"} />
                <StatCard label="ប្រាក់ចំណេញ" value={`$${stats.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon="📈" colorClass={uiTheme === 'binance' ? "from-[#0ECB81] to-[#059669]" : "from-emerald-600 to-emerald-400"} />
                <StatCard label="Margin (%)" value={`${stats.margin.toFixed(1)}%`} icon="⚖️" colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-amber-500 to-orange-400"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-8 space-y-6 lg:space-y-8">
                    <div className={`page-card p-4 sm:!p-8 ${styles.chartBg} h-full min-h-[300px] sm:min-h-[400px] flex flex-col justify-center rounded-md border`}>
                        <SimpleLineChart data={stats.chartData} title="និន្នាការចំណូល (Revenue Trends)" color={styles.accent} />
                    </div>

                    {/* Breakdown Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        {/* Team Performance */}
                        <div className={`page-card !p-6 ${styles.cardBg} rounded-md border`}>
                            <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] mb-6 flex items-center gap-2`}>
                                <div className={`w-1 h-4 ${styles.activeBar} rounded-full`}></div>
                                Performance by Team
                            </h3>
                            <div className="space-y-5">
                                {stats.teamStats.map(team => (
                                    <div key={team.name} className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <span className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-wider`}>{team.name}</span>
                                            <span className={`text-[11px] font-black ${styles.accentText} tabular-nums`}>${team.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className={`w-full h-1.5 ${styles.barBg} rounded-full overflow-hidden`}>
                                            <div 
                                                className={`h-full ${styles.activeBar} rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(252,213,53,0.3)]`} 
                                                style={{ width: `${(team.revenue / stats.revenue) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className={`flex justify-between text-[9px] font-bold ${styles.secondaryText} uppercase tracking-widest`}>
                                            <span>{team.orders} Executions</span>
                                            <span>{((team.revenue / stats.revenue) * 100).toFixed(1)}% weight</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Order Status Breakdown */}
                        <div className={`page-card !p-6 ${styles.cardBg} rounded-md border flex flex-col`}>
                            <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] mb-6 flex items-center gap-2`}>
                                <div className="w-1 h-4 bg-[#0ECB81] rounded-full"></div>
                                Settlement Status
                            </h3>
                            <div className="flex-grow flex flex-col justify-center gap-8">
                                <div className="flex justify-around items-center">
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-[#0ECB81] tabular-nums">{stats.paymentMap.Paid || 0}</div>
                                        <div className={`text-[9px] font-black ${styles.secondaryText} uppercase tracking-widest mt-2`}>Finalized</div>
                                    </div>
                                    <div className={`h-10 w-px ${styles.barBg}`}></div>
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-[#F6465D] tabular-nums">{stats.paymentMap.Unpaid || 0}</div>
                                        <div className={`text-[9px] font-black ${styles.secondaryText} uppercase tracking-widest mt-2`}>Outstanding</div>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className={`flex h-2 w-full rounded-full overflow-hidden ${styles.barBg}`}>
                                        <div className="bg-[#0ECB81]" style={{ width: `${(stats.paymentMap.Paid / stats.totalOrders) * 100}%` }}></div>
                                        <div className="bg-[#F6465D]" style={{ width: `${(stats.paymentMap.Unpaid / stats.totalOrders) * 100}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                                        <span className="text-[#0ECB81]">Ratio: {((stats.paymentMap.Paid / stats.totalOrders) * 100 || 0).toFixed(1)}%</span>
                                        <span className="text-[#F6465D]">Ratio: {((stats.paymentMap.Unpaid / stats.totalOrders) * 100 || 0).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: AI & Top Performers */}
                <div className="lg:col-span-4 space-y-6 lg:space-y-8">
                    {/* Top Performers (Users) */}
                    <div className={`page-card !p-6 ${styles.cardBg} rounded-md border`}>
                        <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] mb-6 flex items-center gap-2`}>
                            <div className={`w-1 h-4 ${styles.activeBar} rounded-full`}></div>
                            Top Nodes
                        </h3>
                        <div className="space-y-5">
                            {stats.topUsers.map((user, idx) => (
                                <div key={user.name} className="flex items-center gap-4 group cursor-pointer">
                                    <div className="relative">
                                        <div className={`w-10 h-10 rounded-lg overflow-hidden border ${styles.barBg} group-hover:border-[#FCD535]/50 transition-colors ${styles.innerBg}`}>
                                            {user.avatar ? (
                                                <img src={convertGoogleDriveUrl(user.avatar)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-[#848E9C] uppercase">{user.name.substring(0, 2)}</div>
                                            )}
                                        </div>
                                        <div className={`absolute -top-2 -left-2 w-5 h-5 ${styles.innerBg} rounded border ${styles.barBg} flex items-center justify-center text-[9px] font-black ${styles.accentText}`}>
                                            {idx + 1}
                                        </div>
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-[11px] font-black ${styles.primaryText} truncate uppercase tracking-wider group-hover:text-[#FCD535] transition-colors`}>{user.name}</h4>
                                            <span className={`text-[11px] font-black ${styles.accentText} tabular-nums`}>${user.revenue.toLocaleString()}</span>
                                        </div>
                                        <p className={`text-[8px] font-bold ${styles.secondaryText} uppercase tracking-widest mt-1`}>{user.orders} Executions</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Insights */}
                    <div className={`page-card !p-6 ${styles.cardBg} rounded-md border flex flex-col min-h-[350px]`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em]`}>Machine Intelligence</h3>
                            <GeminiButton onClick={handleAnalyze} isLoading={loadingAnalysis} variant={uiTheme === 'binance' ? 'primary' : 'default'}>Compute</GeminiButton>
                        </div>
                        <div className={`flex-grow ${styles.innerBg} rounded-xl p-5 border ${styles.barBg} overflow-y-auto custom-scrollbar`}>
                            {analysis ? (
                                <div className={`text-[11px] ${styles.secondaryText} leading-relaxed font-bold uppercase tracking-wide`}>{analysis}</div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-20">
                                    <svg className="w-10 h-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                    <p className="text-[9px] text-center uppercase font-black tracking-[0.2em]">Idle - Ready for Input</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
