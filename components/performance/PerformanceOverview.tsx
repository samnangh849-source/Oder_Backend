
import React, { useContext } from 'react';
import StatCard from './StatCard';
import GaugeChart from '../common/GaugeChart';
import SimpleLineChart from '../common/SimpleLineChart';
import { AppContext } from '../../context/AppContext';

interface PerformanceOverviewProps {
    summary: any;
    monthlyTrend: any[];
}

const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({ summary, monthlyTrend }) => {
    const { advancedSettings, language } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    const getThemeStyles = () => {
        switch (uiTheme) {
            case 'binance':
                return {
                    chartBg: 'bg-[#1E2329] border-[#2B3139]',
                    innerBg: 'bg-[#0B0E11]',
                    primaryText: 'text-[#EAECEF]',
                    secondaryText: 'text-[#848E9C]',
                    accent: '#FCD535',
                    barBg: 'bg-[#2B3139]'
                };
            case 'netflix':
                return {
                    chartBg: 'bg-[#181818] border-white/5',
                    innerBg: 'bg-black/40',
                    primaryText: 'text-white',
                    secondaryText: 'text-gray-400',
                    accent: '#E50914',
                    barBg: 'bg-gray-800'
                };
            default:
                return {
                    chartBg: isLightMode ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.08]',
                    innerBg: isLightMode ? 'bg-slate-50' : 'bg-black/20',
                    primaryText: isLightMode ? 'text-slate-900' : 'text-white',
                    secondaryText: isLightMode ? 'text-slate-500' : 'text-slate-400',
                    accent: '#3b82f6',
                    barBg: isLightMode ? 'bg-slate-100' : 'bg-white/5'
                };
        }
    };

    const styles = getThemeStyles();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        label={language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'} 
                        value={`$${summary.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 0})}`} 
                        icon={<i className="fa-solid fa-sack-dollar"></i>} 
                        colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-blue-600 to-indigo-600"} 
                        className="shadow-xl"
                    />
                    <StatCard 
                        label={language === 'km' ? 'ប្រាក់ចំណេញ' : 'Total Profit'} 
                        value={`$${summary.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 0})}`} 
                        icon={<i className="fa-solid fa-chart-line"></i>} 
                        colorClass={uiTheme === 'binance' ? "from-[#0ECB81] to-[#059669]" : "from-emerald-600 to-teal-600"} 
                        className="shadow-xl"
                    />
                    <StatCard 
                        label={language === 'km' ? 'ការកម្មង់' : 'Orders'} 
                        value={summary.totalOrders} 
                        icon={<i className="fa-solid fa-box-archive"></i>} 
                        colorClass={uiTheme === 'binance' ? "from-[#2B3139] to-[#1E2329]" : "from-purple-600 to-pink-600"} 
                        className="shadow-xl"
                    />
                    <StatCard 
                        label={language === 'km' ? 'គោលដៅរួម' : 'Overall Target'} 
                        value={summary.overallTarget > 0 ? `$${summary.overallTarget.toLocaleString(undefined, {minimumFractionDigits: 0})}` : 'N/A'} 
                        icon={<i className="fa-solid fa-bullseye"></i>} 
                        colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-amber-500 to-orange-600"} 
                        className="shadow-xl"
                    />
                </div>
                <div className={`p-6 sm:p-8 ${styles.chartBg} rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl flex flex-col min-h-[400px]`}>
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex flex-col">
                            <h2 className={`text-sm font-black ${styles.primaryText} uppercase tracking-widest`}>Revenue Trend</h2>
                            <span className={`text-[10px] font-bold ${styles.secondaryText} mt-1 uppercase tracking-tighter`}>Monthly performance history</span>
                        </div>
                    </div>
                    <div className="flex-grow h-full w-full">
                        <SimpleLineChart data={monthlyTrend} title="" color={styles.accent} />
                    </div>
                </div>
            </div>
            <div className="lg:col-span-4">
                <div className={`p-6 sm:p-8 ${styles.chartBg} rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl flex flex-col items-center h-full min-h-[400px]`}>
                    <div className="w-full flex justify-between items-center mb-8">
                        <h3 className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] flex items-center gap-2`}>
                            <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                            Overall Progress
                        </h3>
                    </div>
                    
                    <div className="flex-grow flex flex-col items-center justify-center w-full">
                        <GaugeChart value={summary.overallAchievement} label="Achievement" />
                        
                        <div className="mt-12 w-full space-y-4">
                            <div className={`flex items-center justify-between p-4 rounded-2xl ${styles.innerBg} border ${styles.barBg}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                        <i className="fa-solid fa-arrow-trend-up text-xs"></i>
                                    </div>
                                    <span className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-widest`}>Achieved</span>
                                </div>
                                <span className={`text-sm font-black text-emerald-500`}>${summary.totalRevenue.toLocaleString()}</span>
                            </div>
                            
                            <div className={`flex items-center justify-between p-4 rounded-2xl ${styles.innerBg} border ${styles.barBg}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                                        <i className="fa-solid fa-bullseye text-xs"></i>
                                    </div>
                                    <span className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-widest`}>Remaining</span>
                                </div>
                                <span className={`text-sm font-black text-red-500`}>${Math.max(0, summary.overallTarget - summary.totalRevenue).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceOverview;
