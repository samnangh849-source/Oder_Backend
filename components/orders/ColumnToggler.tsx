
import React, { useState, useRef, useEffect } from 'react';

export const availableColumns = [
    { key: 'index', label: 'លេខរៀង' },
    { key: 'actions', label: 'ប៊ូតុង' },
    { key: 'customerName', label: 'អតិថិជន' },
    { key: 'productInfo', label: 'ទំនិញ' },
    { key: 'location', label: 'ទីតាំង' },
    { key: 'pageInfo', label: 'Page' },
    {key: 'fulfillment', label: 'ឃ្លាំង' },
    { key: 'total', label: 'តម្លៃសរុប' },
    { key: 'shippingService', label: 'សេវាដឹក' },
    { key: 'driver', label: 'អ្នកដឹក' },
    { key: 'shippingCost', label: 'ថ្លៃដឹក' },
    { key: 'status', label: 'ស្ថានភាពបង់ប្រាក់' },
    { key: 'date', label: 'កាលបរិច្ឆេទ' },
    { key: 'note', label: 'ចំណាំ (Note)' },
    { key: 'print', label: 'Print' },
    { key: 'check', label: 'ផ្ទៀងផ្ទាត់' },
    { key: 'orderId', label: 'ID' }
];

interface ColumnTogglerProps {
    visibleColumns: Set<string>;
    onToggle: (key: string) => void;
    columns?: { key: string; label: string }[];
}

export const ColumnToggler: React.FC<ColumnTogglerProps> = ({ visibleColumns, onToggle, columns = availableColumns }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { 
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); 
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative inline-block text-left h-full" ref={ref}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="flex h-full items-center justify-center gap-3 px-8 py-5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/30 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v12a1 1 0 002 0V4zM9 4a1 1 0 00-2 0v12a1 1 0 002 0V4zM13 4a1 1 0 00-2 0v12a1 1 0 002 0V4zM17 4a1 1 0 00-2 0v12a1 1 0 002 0V4z" /></svg>
                Columns
                <svg className={`h-3.5 w-3.5 ml-1 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-[#1a2235]/95 border border-white/10 rounded-[1.8rem] shadow-[0_30px_70px_rgba(0,0,0,0.7)] z-[100] origin-top-right overflow-hidden backdrop-blur-3xl p-3 animate-fade-in-scale">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-3 py-2 mb-1">កំណត់ការបង្ហាញ</p>
                        {columns.map(col => (
                            <label key={col.key} className="flex items-center px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group">
                                <input type="checkbox" className="h-4 w-4 rounded-md border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500/20" checked={visibleColumns.has(col.key)} onChange={() => onToggle(col.key)} />
                                <span className="ml-3 font-bold group-hover:text-white transition-colors">{col.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
