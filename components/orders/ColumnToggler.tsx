
import React, { useState, useRef, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';

export const availableColumns = [
    { key: 'index', labelKey: 'col_index' },
    { key: 'actions', labelKey: 'col_actions' },
    { key: 'customerName', labelKey: 'col_customer' },
    { key: 'productInfo', labelKey: 'col_products' },
    { key: 'location', labelKey: 'col_location' },
    { key: 'pageInfo', labelKey: 'col_page' },
    { key: 'brandSales', labelKey: 'col_store' },
    { key: 'fulfillment', labelKey: 'col_warehouse' },
    { key: 'total', labelKey: 'col_total' },
    { key: 'shippingService', labelKey: 'col_carrier' },
    { key: 'driver', labelKey: 'col_agent' },
    { key: 'shippingCost', labelKey: 'col_cost' },
    { key: 'status', labelKey: 'col_status' },
    { key: 'date', labelKey: 'col_date' },
    { key: 'note', labelKey: 'col_note' },
    { key: 'print', labelKey: 'col_output' },
    { key: 'check', labelKey: 'col_verify' },
    { key: 'orderId', labelKey: 'col_id' }
];

interface ColumnTogglerProps {
    visibleColumns: Set<string>;
    onToggle: (key: string) => void;
    columns?: { key: string; labelKey: string }[];
}

export const ColumnToggler: React.FC<ColumnTogglerProps> = ({ visibleColumns, onToggle, columns = availableColumns }) => {
    const { language } = useContext(AppContext);
    const t = translations[language];
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
                className="flex h-full items-center justify-center gap-2 px-3 py-2.5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/30 rounded-xl text-[9px] xl:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v12a1 1 0 002 0V4zM9 4a1 1 0 00-2 0v12a1 1 0 002 0V4zM13 4a1 1 0 00-2 0v12a1 1 0 002 0V4zM17 4a1 1 0 00-2 0v12a1 1 0 002 0V4z" /></svg>
                {t.columns}
                <svg className={`h-3 w-3 ml-0.5 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-[#1a2235]/95 border border-white/10 rounded-[1.8rem] shadow-[0_30px_70px_rgba(0,0,0,0.7)] z-[100] origin-top-right overflow-hidden backdrop-blur-3xl p-3 animate-fade-in-scale">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-3 py-2 mb-1 border-b border-white/5">{t.columns}</p>
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                            {columns.map(col => (
                                <label key={col.key} className={`flex items-center px-3 py-2.5 text-xs rounded-xl cursor-pointer transition-all group mb-0.5 ${visibleColumns.has(col.key) ? 'bg-blue-600/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                                    <input type="checkbox" className="sr-only" checked={visibleColumns.has(col.key)} onChange={() => onToggle(col.key)} />
                                    <div className={`w-4.5 h-4.5 rounded-md border-2 transition-all flex items-center justify-center ${visibleColumns.has(col.key) ? 'bg-blue-600 border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'border-gray-700 bg-black/20'}`}>
                                        {visibleColumns.has(col.key) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <span className="ml-3 font-bold group-hover:translate-x-1 transition-transform uppercase tracking-tighter text-[10px]">
                                        {(t as any)[col.labelKey] || col.key}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
