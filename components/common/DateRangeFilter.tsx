import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export type DateRangePreset = 'today' | 'this_week' | 'this_month' | 'custom';

interface DateRangeFilterProps {
    dateRange: DateRangePreset;
    onRangeChange: (range: DateRangePreset) => void;
    customStart: string;
    onCustomStartChange: (val: string) => void;
    customEnd: string;
    onCustomEndChange: (val: string) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
    dateRange, onRangeChange, customStart, onCustomStartChange, customEnd, onCustomEndChange
}) => {
    const { advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    const getContainerBg = () => {
        if (uiTheme === 'netflix') return isLightMode ? 'bg-gray-100 border-gray-200' : 'bg-gray-900/80 border-gray-800';
        return isLightMode ? 'bg-gray-50 border-gray-200' : 'bg-gray-800/80 border-gray-700';
    };

    const getButtonClass = (active: boolean) => {
        if (uiTheme === 'netflix') {
            if (active) return 'bg-[#e50914] text-white shadow-lg';
            return isLightMode ? 'text-gray-600 hover:text-black hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-white/10';
        }
        if (active) return 'bg-blue-600 text-white shadow-lg';
        return isLightMode ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-500 hover:text-gray-300';
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-inner transition-colors duration-500 ${getContainerBg()}`}>
                    {(['today', 'this_week', 'this_month', 'custom'] as const).map(p => (
                        <button 
                            key={p} 
                            onClick={() => onRangeChange(p)} 
                            className={`px-5 py-2.5 text-[12px] font-black uppercase rounded-xl transition-all active:scale-95 ${getButtonClass(dateRange === p)}`}
                        >
                            {p === 'today' ? 'ថ្ងៃនេះ' : p === 'this_week' ? 'សប្តាហ៍នេះ' : p === 'this_month' ? 'ខែនេះ' : 'កំណត់'}
                        </button>
                    ))}
                </div>
            </div>

            {dateRange === 'custom' && (
                <div className={`flex flex-wrap items-center gap-4 p-4 rounded-2xl border animate-fade-in-down transition-colors duration-500 ${isLightMode ? 'bg-white border-gray-200' : 'bg-gray-900/40 border-gray-800'}`}>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ចាប់ពី</span>
                        <input type="date" value={customStart} onChange={e => onCustomStartChange(e.target.value)} className={`form-input !py-1.5 !px-3 border text-xs rounded-xl focus:ring-opacity-20 ${isLightMode ? 'bg-gray-50 border-gray-200 text-black focus:ring-black' : 'bg-gray-800 border-gray-700 text-white focus:ring-blue-500'}`} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ដល់</span>
                        <input type="date" value={customEnd} onChange={e => onCustomEndChange(e.target.value)} className={`form-input !py-1.5 !px-3 border text-xs rounded-xl focus:ring-opacity-20 ${isLightMode ? 'bg-gray-50 border-gray-200 text-black focus:ring-black' : 'bg-gray-800 border-gray-700 text-white focus:ring-blue-500'}`} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
