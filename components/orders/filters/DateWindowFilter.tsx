
import React from 'react';
import { DateRangePreset } from '../OrderFilters';

interface DateWindowFilterProps {
    datePreset: DateRangePreset;
    setDatePreset: (preset: DateRangePreset) => void;
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
    calculatedRange: string;
}

const datePresets: { label: string, value: DateRangePreset }[] = [
    { label: 'ទាំងអស់ (All Time)', value: 'all' },
    { label: 'ថ្ងៃនេះ (Today)', value: 'today' },
    { label: 'ម្សិលមិញ (Yesterday)', value: 'yesterday' },
    { label: 'សប្តាហ៍នេះ (This Week)', value: 'this_week' },
    { label: 'សប្តាហ៍មុន (Last Week)', value: 'last_week' },
    { label: 'ខែនេះ (This Month)', value: 'this_month' },
    { label: 'ខែមុន (Last Month)', value: 'last_month' },
    { label: 'ឆ្នាំនេះ (This Year)', value: 'this_year' },
    { label: 'ឆ្នាំមុន (Last Year)', value: 'last_year' },
    { label: 'កំណត់ខ្លួនឯង (Custom)', value: 'custom' },
];

const DateWindowFilter: React.FC<DateWindowFilterProps> = ({
    datePreset, setDatePreset, startDate, setStartDate, endDate, setEndDate, calculatedRange
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 shadow-inner group/date">
                <label className="text-[10px] font-black text-blue-500 mb-4 block uppercase tracking-[0.2em] ml-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Temporal Window
                </label>
                <div className="relative">
                    <select 
                        value={datePreset} 
                        onChange={e => setDatePreset(e.target.value as any)} 
                        className="form-select w-full !bg-gray-900 border-gray-800 !py-4 !px-6 rounded-2xl font-bold text-gray-200 focus:border-blue-500/50 transition-all appearance-none cursor-pointer hover:border-gray-700"
                    >
                        {datePresets.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <svg className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </div>
                <div className="mt-4 bg-black/40 p-3.5 rounded-xl text-center text-[11px] font-mono text-gray-400 border border-white/5 uppercase tracking-widest shadow-inner">
                    {calculatedRange}
                </div>
            </div>

            {datePreset === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in px-1">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 ml-3 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Start Date (ចាប់ពី)
                        </label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input !bg-gray-900 border-gray-800 rounded-2xl !py-4 !px-6 text-white focus:border-blue-500/50 transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 ml-3 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            End Date (ដល់ថ្ងៃ)
                        </label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input !bg-gray-900 border-gray-800 rounded-2xl !py-4 !px-6 text-white focus:border-blue-500/50 transition-all" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateWindowFilter;
