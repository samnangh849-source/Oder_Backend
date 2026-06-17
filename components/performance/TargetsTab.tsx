import React, { useContext } from 'react';
import UserAvatar from '../common/UserAvatar';
import { AppContext } from '../../context/AppContext';

interface TargetsTabProps {
    data: any[];
}

const TargetsTab: React.FC<TargetsTabProps> = ({ data }) => {
    const { advancedSettings } = useContext(AppContext);
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
        borderColor: isLightMode ? 'border-slate-100' : 'border-white/5'
    };

    if (uiTheme === 'binance') {
        styles.cardBg = 'bg-[#1E2329] border-[#2B3139]';
        styles.innerBg = 'bg-[#0B0E11]';
        styles.primaryText = 'text-[#EAECEF]';
        styles.secondaryText = 'text-[#848E9C]';
        styles.borderColor = 'border-[#2B3139]';
    } else if (uiTheme === 'netflix') {
        styles.cardBg = 'bg-[#181818] border-white/5';
        styles.innerBg = 'bg-black/40';
        styles.primaryText = 'text-white';
        styles.secondaryText = 'text-gray-400';
        styles.borderColor = 'border-white/5';
    }

    return (
        <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.map(user => (
                <div key={user.userName} className={`relative overflow-hidden p-6 ${styles.cardBg} rounded-3xl border shadow-lg hover:shadow-2xl transition-all duration-500 group backdrop-blur-xl`}>
                    
                    {/* Background Glow on Success */}
                    {user.achievement >= 100 && (
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    )}
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <UserAvatar 
                                avatarUrl={user.profilePictureURL} 
                                name={user.fullName} 
                                size="lg" 
                                className={`shadow-md group-hover:scale-105 transition-transform duration-500`} 
                            />
                            <div>
                                <h4 className={`text-sm ${styles.primaryText} font-black uppercase tracking-tight leading-none mb-1.5 group-hover:text-blue-500 transition-colors`}>{user.fullName}</h4>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${styles.innerBg} border ${styles.borderColor} ${styles.secondaryText} uppercase tracking-widest`}>
                                    {user.team || 'No Team'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-6 relative z-10">
                        {/* Target Box */}
                        <div className={`p-4 rounded-2xl ${styles.innerBg} border ${styles.borderColor} flex justify-between items-center`}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                    <i className="fa-solid fa-flag-checkered text-xs"></i>
                                </div>
                                <span className={`text-[10px] ${styles.secondaryText} font-black uppercase tracking-widest`}>Monthly Target</span>
                            </div>
                            <span className={`${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-500'} font-black text-lg tracking-tighter`}>
                                ${user.target.toLocaleString(undefined, {minimumFractionDigits: 0})}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className={`text-[10px] font-black ${styles.secondaryText} uppercase tracking-widest`}>Completion Status</span>
                                <span className={`text-xs font-black uppercase tracking-widest ${getAchievementText(user.achievement)}`}>{user.achievement.toFixed(1)}%</span>
                            </div>
                            <div className={`w-full h-2 ${styles.innerBg} rounded-full overflow-hidden border ${styles.borderColor} shadow-inner`}>
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${getAchievementColor(user.achievement)} shadow-[0_0_10px_currentColor]`} 
                                    style={{ width: `${Math.min(user.achievement, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        
                        {/* Status Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className={`p-3.5 rounded-xl border ${styles.borderColor} ${styles.innerBg} flex flex-col justify-center`}>
                                <p className={`text-[9px] ${styles.secondaryText} font-black uppercase tracking-widest mb-1`}>Achieved</p>
                                <p className={`${styles.primaryText} font-black text-base`}>${user.revenue.toLocaleString(undefined, {minimumFractionDigits: 0})}</p>
                            </div>
                            <div className={`
                                p-3.5 rounded-xl border flex flex-col justify-center transition-colors duration-500
                                ${user.achievement >= 100 
                                    ? (isLightMode ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/10 border-emerald-500/30') 
                                    : (isLightMode ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/30')}
                            `}>
                                <p className={`text-[9px] ${user.achievement >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} font-black uppercase tracking-widest mb-1`}>Remaining</p>
                                <p className={`font-black text-base ${user.achievement >= 100 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'} tracking-tighter`}>
                                    {user.achievement >= 100 ? 'SUCCESS 🏆' : `$${Math.max(0, user.target - user.revenue).toLocaleString(undefined, {minimumFractionDigits: 0})}`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TargetsTab;