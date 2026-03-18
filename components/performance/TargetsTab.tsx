
import React, { useContext } from 'react';
import UserAvatar from '../common/UserAvatar';
import { AppContext } from '../../context/AppContext';

interface TargetsTabProps {
    data: any[];
}

const TargetsTab: React.FC<TargetsTabProps> = ({ data }) => {
    const { advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';

    const getAchievementText = (percent: number) => {
        if (percent >= 100) return isLightMode ? 'text-emerald-600' : 'text-emerald-400';
        if (percent >= 70) return isLightMode ? 'text-amber-600' : 'text-yellow-400';
        return isLightMode ? 'text-red-600' : 'text-red-400';
    };

    const getAchievementColor = (percent: number) => {
        if (percent >= 100) return 'bg-emerald-500';
        if (percent >= 70) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.map(user => (
                <div key={user.userName} className={`${isLightMode ? 'bg-white shadow-xl border-gray-100' : 'bg-gray-800/40 border-gray-700/50 backdrop-blur-sm'} p-6 rounded-3xl border hover:border-blue-500/50 transition-all group shadow-xl`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <UserAvatar avatarUrl={user.profilePictureURL} name={user.fullName} size="md" className={`ring-4 ${isLightMode ? 'ring-blue-50' : 'ring-blue-500/10'} group-hover:ring-blue-500/20 transition-all`} />
                            <div>
                                <h4 className={`${isLightMode ? 'text-gray-900' : 'text-white'} font-black leading-none mb-1 group-hover:text-blue-500 transition-colors`}>{user.fullName}</h4>
                                <span className={`text-[9px] ${isLightMode ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-blue-900/40 text-blue-300 border-blue-500/20'} px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border`}>{user.team || 'No Team'}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">គោលដៅខែនេះ</p>
                            <p className={`${isLightMode ? 'text-blue-600' : 'text-blue-400'} font-black text-lg tracking-tight`}>${user.target.toLocaleString()}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">វឌ្ឍនភាពសម្រេចបាន</span>
                                <span className={`text-sm font-black ${getAchievementText(user.achievement)}`}>{user.achievement.toFixed(1)}%</span>
                            </div>
                            <div className={`w-full h-3.5 ${isLightMode ? 'bg-gray-100' : 'bg-gray-900'} rounded-full overflow-hidden border ${isLightMode ? 'border-gray-200' : 'border-gray-800'} shadow-inner p-0.5`}>
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${getAchievementColor(user.achievement)}`} 
                                    style={{ width: `${Math.min(user.achievement, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        
                        <div className={`grid grid-cols-2 gap-3 pt-4 border-t ${isLightMode ? 'border-gray-100' : 'border-gray-800/50'}`}>
                            <div className={`${isLightMode ? 'bg-gray-50 border-gray-100' : 'bg-gray-900/30 border-gray-800'} p-3 rounded-xl border`}>
                                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">លក់បាន</p>
                                <p className={`${isLightMode ? 'text-gray-900' : 'text-white'} font-black`}>${user.revenue.toLocaleString()}</p>
                            </div>
                            <div className={`p-3 rounded-xl border ${user.achievement >= 100 ? (isLightMode ? 'bg-emerald-50 border-emerald-100' : 'bg-emerald-900/10 border-emerald-900/30') : (isLightMode ? 'bg-red-50 border-red-100' : 'bg-red-900/10 border-red-900/30')}`}>
                                <p className="text-[10px] text-gray-500 font-black uppercase mb-1">នៅសល់</p>
                                <p className={`font-black ${user.achievement >= 100 ? (isLightMode ? 'text-emerald-600' : 'text-emerald-400') : (isLightMode ? 'text-red-600' : 'text-red-400')}`}>
                                    {user.achievement >= 100 ? 'SUCCESS 🏆' : `$${Math.max(0, user.target - user.revenue).toLocaleString()}`}
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
