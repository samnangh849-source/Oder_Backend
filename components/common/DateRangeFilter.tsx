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
    variant?: 'default' | 'binance';
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
    dateRange, onRangeChange, customStart, onCustomStartChange, customEnd, onCustomEndChange, variant = 'default'
}) => {
    const { advancedSettings, language } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = variant === 'binance' ? 'binance' : (advancedSettings?.uiTheme || 'default');

    const t = (key: 'today' | 'this_week' | 'this_month' | 'custom' | 'from' | 'to') => {
        const translations = {
            today: { km: 'ថ្ងៃនេះ', en: 'Today' },
            this_week: { km: 'សប្តាហ៍នេះ', en: 'This Week' },
            this_month: { km: 'ខែនេះ', en: 'This Month' },
            custom: { km: 'កំណត់', en: 'Custom' },
            from: { km: 'ចាប់ពី', en: 'From' },
            to: { km: 'ដល់', en: 'To' }
        };
        return translations[key][language as 'km' | 'en'] || translations[key].en;
    };

    const getContainerBg = () => {
        if (uiTheme === 'binance') return 'bg-[#050505] border-[#1A1A1A]';
        if (uiTheme === 'netflix') return isLightMode ? 'bg-gray-100 border-gray-200' : 'bg-gray-900/80 border-gray-800';
        return isLightMode ? 'bg-gray-50 border-gray-200' : 'bg-gray-800/80 border-gray-700';
    };

    const getButtonClass = (active: boolean) => {
        if (uiTheme === 'binance') {
            if (active) return 'bg-[#F0B90B] text-[#000]';
            return 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#1A1A1A]';
        }
        if (uiTheme === 'netflix') {
            if (active) return 'bg-[#e50914] text-white shadow-lg';
            return isLightMode ? 'text-gray-600 hover:text-black hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-white/10';
        }
        if (active) return 'bg-blue-600 text-white shadow-lg';
        return isLightMode ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-500 hover:text-gray-300';
    };

    const isBinance = uiTheme === 'binance';

    return (
        <div className={isBinance ? "flex items-center gap-2 max-w-full" : "space-y-4"}>
            <div className={`flex items-center gap-2 ${isBinance ? 'overflow-x-auto scrollbar-hide' : 'flex-wrap'}`}>
                <div className={`flex items-center gap-0.5 p-0.5 ${isBinance ? 'rounded-lg' : 'rounded-2xl'} border shadow-inner transition-colors duration-500 ${getContainerBg()}`}>
                    {(['today', 'this_week', 'this_month', 'custom'] as const).map(p => (
                        <button 
                            key={p} 
                            onClick={() => onRangeChange(p)} 
                            className={`${isBinance ? 'px-3 py-1.5 text-[10px]' : 'px-5 py-2.5 text-[12px]'} font-black uppercase ${isBinance ? 'rounded' : 'rounded-xl'} transition-all active:scale-95 ${getButtonClass(dateRange === p)}`}
                        >
                            {t(p)}
                        </button>
                    ))}
                </div>
            </div>

            {dateRange === 'custom' && (
                <div className={`flex items-center gap-2 ${isBinance ? 'ml-2 p-1 border-[#2B3139]' : 'p-4 border shadow-sm'} rounded-xl border animate-fade-in-down transition-colors duration-500 ${isBinance ? 'bg-[#0B0E11]' : (isLightMode ? 'bg-white border-gray-200' : 'bg-gray-900/40 border-gray-800')}`}>
                    <div className="flex items-center gap-1.5">
                        {!isBinance && <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('from')}</span>}
                        <input type="date" value={customStart} onChange={e => onCustomStartChange(e.target.value)} className={`form-input !py-1 !px-2 border text-[10px] rounded-lg focus:ring-opacity-20 ${isBinance ? 'bg-[#1E2329] border-[#2B3139] text-[#EAECEF] focus:ring-[#F0B90B]' : (isLightMode ? 'bg-gray-50 border-gray-200 text-black focus:ring-black' : 'bg-gray-800 border-gray-700 text-white focus:ring-blue-500')}`} />
                    </div>
                    {isBinance ? <span className="text-[#848E9C] text-[10px]">-</span> : <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('to')}</span>
                        <input type="date" value={customEnd} onChange={e => onCustomEndChange(e.target.value)} className={`form-input !py-1.5 !px-3 border text-xs rounded-xl focus:ring-opacity-20 ${isLightMode ? 'bg-gray-50 border-gray-200 text-black focus:ring-black' : 'bg-gray-800 border-gray-700 text-white focus:ring-blue-500'}`} />
                    </div>}
                    {isBinance && <input type="date" value={customEnd} onChange={e => onCustomEndChange(e.target.value)} className="form-input !py-1 !px-2 border text-[10px] rounded-lg bg-[#1E2329] border-[#2B3139] text-[#EAECEF] focus:ring-[#F0B90B]" />}
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
