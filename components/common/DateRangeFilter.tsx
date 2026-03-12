
import React from 'react';

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
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-800/80 p-1.5 rounded-2xl border border-gray-700 shadow-inner">
                    {(['today', 'this_week', 'this_month', 'custom'] as const).map(p => (
                        <button 
                            key={p} 
                            onClick={() => onRangeChange(p)} 
                            className={`px-5 py-2.5 text-[12px] font-black uppercase rounded-xl transition-all active:scale-95 ${dateRange === p ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            {p === 'today' ? 'ថ្ងៃនេះ' : p === 'this_week' ? 'សប្តាហ៍នេះ' : p === 'this_month' ? 'ខែនេះ' : 'កំណត់'}
                        </button>
                    ))}
                </div>
            </div>

            {dateRange === 'custom' && (
                <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-900/40 rounded-2xl border border-gray-800 animate-fade-in-down">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ចាប់ពី</span>
                        <input type="date" value={customStart} onChange={e => onCustomStartChange(e.target.value)} className="form-input !py-1.5 !px-3 bg-gray-800 border-gray-700 text-xs rounded-xl focus:ring-blue-500/20" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ដល់</span>
                        <input type="date" value={customEnd} onChange={e => onCustomEndChange(e.target.value)} className="form-input !py-1.5 !px-3 bg-gray-800 border-gray-700 text-xs rounded-xl focus:ring-blue-500/20" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
