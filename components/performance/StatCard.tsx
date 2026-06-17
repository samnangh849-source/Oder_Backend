
import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    colorClass: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, colorClass }) => {
    const { advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    if (uiTheme === 'binance') {
        return (
            <div className="bg-[#1E2329] border border-[#2B3139] p-4 sm:p-5 transition-all hover:border-[#474D57]" style={{ borderRadius: '2px' }}>
                <div className="flex justify-between items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] sm:text-[11px] text-[#848E9C] uppercase tracking-wider font-medium mb-1 sm:mb-2 truncate">{label}</p>
                        <h3 className="text-xl sm:text-3xl font-bold text-[#EAECEF] tabular-nums truncate leading-tight">{value}</h3>
                    </div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#2B3139] flex items-center justify-center text-[#FCD535] flex-shrink-0" style={{ borderRadius: '2px' }}>
                        <span className="text-base sm:text-xl">{icon}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative group overflow-hidden ${isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/30 border-white/5 backdrop-blur-xl'} border p-5 sm:p-6 rounded-2xl sm:rounded-[2rem] transition-all duration-500 hover:shadow-2xl ${isLightMode ? 'hover:bg-gray-50 hover:border-blue-100' : 'hover:bg-gray-800/50 hover:border-white/10'}`}>
            <div className="relative z-10 flex justify-between items-center gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                    <p className={`${isLightMode ? 'text-gray-500' : 'text-gray-400'} text-[9px] sm:text-xs lg:text-sm font-black uppercase tracking-widest mb-1 sm:mb-1.5 transition-all truncate`}>{label}</p>
                    <h3 className={`text-xl sm:text-3xl lg:text-4xl 2xl:text-5xl font-black ${isLightMode ? 'text-gray-900' : 'text-white'} tracking-tighter transition-all truncate leading-tight`}>{value}</h3>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white text-base sm:text-xl lg:text-2xl shadow-lg shadow-blue-900/20 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 flex-shrink-0`}>
                    {icon}
                </div>
            </div>
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full bg-gradient-to-br ${colorClass} opacity-0 group-hover:opacity-10 blur-[30px] sm:blur-[40px] transition-opacity duration-700`}></div>
        </div>
    );
};

export default StatCard;
