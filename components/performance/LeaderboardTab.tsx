import React, { useContext } from 'react';
import RankMedal from './RankMedal';
import UserAvatar from '../common/UserAvatar';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { AppContext } from '../../context/AppContext';

interface LeaderboardTabProps {
    data: any[];
    metric: string;
    onMetricChange: (metric: any) => void;
    datePreset: string;
    previewImage: (url: string) => void;
}

const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ data, metric, onMetricChange, datePreset, previewImage }) => {
    const { advancedSettings, language } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    const getAchievementText = (percent: number) => {
        if (percent >= 100) return 'text-emerald-500';
        if (percent >= 70) return 'text-amber-500';
        return 'text-red-500';
    };

    const getAchievementColor = (percent: number) => {
        if (percent >= 100) return 'bg-emerald-500';
        if (percent >= 70) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const styles = {
        cardBg: isLightMode ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.08]',
        innerBg: isLightMode ? 'bg-slate-50' : 'bg-black/20',
        primaryText: isLightMode ? 'text-slate-900' : 'text-white',
        secondaryText: isLightMode ? 'text-slate-500' : 'text-slate-400',
        hoverBg: isLightMode ? 'hover:bg-blue-50/50' : 'hover:bg-white/[0.02]',
        borderColor: isLightMode ? 'border-slate-100' : 'border-white/5'
    };

    if (uiTheme === 'binance') {
        styles.cardBg = 'bg-[#1E2329] border-[#2B3139]';
        styles.innerBg = 'bg-[#0B0E11]';
        styles.primaryText = 'text-[#EAECEF]';
        styles.secondaryText = 'text-[#848E9C]';
        styles.hoverBg = 'hover:bg-[#2B3139]/30';
        styles.borderColor = 'border-[#2B3139]';
    } else if (uiTheme === 'netflix') {
        styles.cardBg = 'bg-[#181818] border-white/5';
        styles.innerBg = 'bg-black/40';
        styles.primaryText = 'text-white';
        styles.secondaryText = 'text-gray-400';
        styles.hoverBg = 'hover:bg-white/5';
        styles.borderColor = 'border-white/5';
    }

    return (
        <div className="animate-fade-in space-y-6 lg:space-y-8">
            <div className={`p-6 sm:p-8 ${styles.cardBg} rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h2 className={`text-xl font-black ${styles.primaryText} uppercase tracking-widest flex items-center gap-3`}>
                            <i className="fa-solid fa-trophy text-amber-500"></i>
                            Sales Leaderboard
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[10px] font-bold ${styles.secondaryText} uppercase tracking-widest`}>Based on:</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${styles.innerBg} text-blue-500 border ${styles.borderColor} uppercase tracking-widest`}>
                                {datePreset.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                    
                    <div className={`flex p-1 rounded-xl border ${styles.innerBg} ${styles.borderColor}`}>
                        {(['revenue', 'orderCount', 'achievement'] as const).map(m => (
                            <button 
                                key={m}
                                onClick={() => onMetricChange(m)}
                                className={`
                                    px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center gap-2
                                    ${metric === m 
                                        ? (isLightMode ? 'bg-white text-blue-600 shadow-md' : 'bg-white/10 text-white shadow-lg') 
                                        : `${styles.secondaryText} hover:text-blue-500`}
                                `}
                            >
                                <i className={`fa-solid ${m === 'revenue' ? 'fa-sack-dollar' : m === 'orderCount' ? 'fa-box-archive' : 'fa-bullseye'} ${metric === m ? '' : 'opacity-50'}`}></i>
                                {m === 'revenue' ? 'Revenue' : m === 'orderCount' ? 'Orders' : 'Progress'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile View - Cards */}
                <div className="block lg:hidden space-y-4">
                    {data.map((user, index) => (
                        <div key={user.userName} className={`p-4 rounded-2xl border ${styles.borderColor} ${styles.innerBg} ${styles.hoverBg} transition-all duration-300 flex flex-col gap-4`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <RankMedal rank={index + 1} />
                                    <UserAvatar avatarUrl={user.profilePictureURL} name={user.fullName} size="sm" className="shadow-sm" />
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-500'}`}>${user.revenue.toLocaleString()}</p>
                                    <p className={`text-[10px] font-black ${getAchievementText(user.achievement)} uppercase tracking-widest`}>{user.achievement.toFixed(1)}%</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-white/5 pt-3">
                                <div>
                                    <p className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-tight`}>{user.fullName}</p>
                                    <p className={`text-[9px] font-bold ${styles.secondaryText} uppercase tracking-widest`}>{user.team || 'No Team'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 w-1/2">
                                    <span className={`text-[8px] font-black ${styles.secondaryText} uppercase tracking-widest`}>{user.orderCount} Executions</span>
                                    <div className={`w-full h-1.5 ${styles.cardBg} rounded-full overflow-hidden`}>
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${getAchievementColor(user.achievement)}`} 
                                            style={{ width: `${Math.min(user.achievement, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop View - Table */}
                <div className="hidden lg:block overflow-hidden rounded-2xl border border-white/5">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className={`${styles.innerBg} border-b ${styles.borderColor}`}>
                                <th className={`px-6 py-4 text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] text-center w-24`}>Rank</th>
                                <th className={`px-6 py-4 text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em]`}>Sales Representative</th>
                                <th className={`px-6 py-4 text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] text-right`}>Total Revenue</th>
                                <th className={`px-6 py-4 text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] text-center`}>Orders Executed</th>
                                <th className={`px-6 py-4 text-[10px] font-black ${styles.secondaryText} uppercase tracking-[0.2em] text-right`}>Target Progress</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${styles.borderColor}`}>
                            {data.map((user, index) => (
                                <tr key={user.userName} className={`${styles.hoverBg} transition-all duration-300 group`}>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center transition-transform duration-300 group-hover:scale-110">
                                            <RankMedal rank={index + 1} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <UserAvatar 
                                                avatarUrl={user.profilePictureURL} 
                                                name={user.fullName} 
                                                size="md" 
                                                className="shadow-sm group-hover:shadow-md transition-shadow cursor-pointer"
                                                onClick={() => previewImage(convertGoogleDriveUrl(user.profilePictureURL))}
                                            />
                                            <div className="flex flex-col">
                                                <p className={`text-sm font-black ${styles.primaryText} uppercase tracking-tight group-hover:text-blue-500 transition-colors`}>{user.fullName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${styles.innerBg} border ${styles.borderColor} ${styles.secondaryText} uppercase tracking-widest`}>
                                                        {user.team || 'No Team'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-500'} text-lg tracking-tighter`}>
                                        ${user.revenue.toLocaleString(undefined, {minimumFractionDigits: 0})}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`text-sm font-black ${styles.primaryText} bg-white/5 px-3 py-1 rounded-lg border border-white/5`}>
                                            {user.orderCount}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`text-[11px] font-black uppercase tracking-widest ${getAchievementText(user.achievement)}`}>
                                                {user.achievement.toFixed(1)}%
                                            </span>
                                            <div className={`w-32 h-1.5 ${styles.innerBg} rounded-full overflow-hidden border ${styles.borderColor}`}>
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${getAchievementColor(user.achievement)} shadow-[0_0_10px_currentColor]`} 
                                                    style={{ width: `${Math.min(user.achievement, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LeaderboardTab;
