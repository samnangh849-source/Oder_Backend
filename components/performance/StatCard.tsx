
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
            <div className="bg-[#1E2329] border border-[#2B3139] p-5 transition-all hover:border-[#474D57]" style={{ borderRadius: '2px' }}>
                <div className="flex justify-between items-center gap-4">
                    <div>
                        <p className="text-[11px] text-[#848E9C] uppercase tracking-wider font-medium mb-2">{label}</p>
                        <h3 className="text-3xl font-bold text-[#EAECEF] tabular-nums">{value}</h3>
                    </div>
                    <div className="w-10 h-10 bg-[#2B3139] flex items-center justify-center text-[#FCD535] flex-shrink-0" style={{ borderRadius: '2px' }}>
                        {icon}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative group overflow-hidden ${isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/30 border-white/5 backdrop-blur-xl'} border p-6 rounded-[2rem] transition-all duration-500 hover:shadow-2xl ${isLightMode ? 'hover:bg-gray-50 hover:border-blue-100' : 'hover:bg-gray-800/50 hover:border-white/10'}`}>
            <div className="relative z-10 flex justify-between items-center gap-4">
                <div>
                    <p className={`${isLightMode ? 'text-gray-500' : 'text-gray-400'} text-xs lg:text-sm font-black uppercase tracking-widest mb-1.5 transition-all`}>{label}</p>
                    <h3 className={`text-3xl lg:text-4xl 2xl:text-5xl font-black ${isLightMode ? 'text-gray-900' : 'text-white'} tracking-tighter transition-all`}>{value}</h3>
                </div>
                <div className={`w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-white text-xl lg:text-2xl shadow-lg shadow-blue-900/20 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 flex-shrink-0`}>
                    {icon}
                </div>
            </div>
            <div className={`absolute -right-6 -bottom-6 w-32 h-32 lg:w-40 lg:h-40 rounded-full bg-gradient-to-br ${colorClass} opacity-0 group-hover:opacity-10 blur-[40px] transition-opacity duration-700`}></div>
        </div>
    );
};

export default StatCard;
