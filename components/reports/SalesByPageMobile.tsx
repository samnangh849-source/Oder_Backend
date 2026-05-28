
import React, { useState, useEffect } from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SalesByPageMobileProps {
    data: any[];
    onPreviewImage: (url: string) => void;
    onNavigate: (key: string, value: string) => void;
    onMonthClick?: (pageName: string, monthIndex: number) => void;
    sortConfig?: { key: string, direction: 'asc' | 'desc' };
    onToggleSort?: (key: any) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SalesByPageMobile: React.FC<SalesByPageMobileProps> = ({ 
    data, 
    onPreviewImage, 
    onNavigate, 
    onMonthClick,
    sortConfig,
    onToggleSort
}) => {
    // Initialize state from localStorage, default to 'table'
    const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
        const saved = localStorage.getItem('mobile_view_preference');
        return (saved === 'card' || saved === 'table') ? saved : 'table';
    });

    const handleViewChange = (mode: 'card' | 'table') => {
        setViewMode(mode);
        localStorage.setItem('mobile_view_preference', mode);
    };

    return (
        <div className="md:hidden space-y-4 pb-12 px-1 animate-fade-in">
            <div className="flex justify-between items-center px-2 mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-[#FCD535] rounded-full"></div>
                    <h3 className="text-lg font-black text-white uppercase tracking-[0.1em]">Page Report</h3>
                </div>
                
                {/* View Switcher - Binance Style */}
                <div className="flex bg-[#1E2329] p-1 rounded-xl border border-[#2B3139]">
                    <button 
                        onClick={() => handleViewChange('card')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-[#474D57] text-white shadow-md' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}
                        title="Card View"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                    </button>
                    <button 
                        onClick={() => handleViewChange('table')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[#474D57] text-white shadow-md' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}
                        title="Table View"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                    </button>
                </div>
            </div>

            {viewMode === 'card' ? (
                // CARD VIEW - Technical Style
                <div className="space-y-4">
                    {data.map((item: any) => {
                        const aov = item.orderCount > 0 ? item.revenue / item.orderCount : 0;
                        return (
                            <div 
                                key={item.pageName} 
                                className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-5 shadow-xl space-y-4 group relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                                onClick={() => onNavigate('page', item.pageName)}
                            >
                                <div className="flex justify-between items-center border-b border-[#2B3139] pb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-[#2B3139] bg-[#0B0E11] shadow-inner p-0.5 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onPreviewImage(convertGoogleDriveUrl(item.logoUrl)); }}>
                                            <img src={convertGoogleDriveUrl(item.logoUrl)} className="w-full h-full object-cover rounded-lg" alt="" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-base font-black text-[#EAECEF] truncate leading-tight uppercase tracking-tight group-hover:text-[#FCD535] transition-colors">{item.pageName}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p 
                                                    className="text-[9px] bg-[#2B3139] text-[#848E9C] px-2 py-0.5 rounded-md font-black uppercase tracking-[0.2em] group-hover:bg-[#FCD535]/10 group-hover:text-[#FCD535] transition-all"
                                                    onClick={(e) => { e.stopPropagation(); onNavigate('team', item.teamName); }}
                                                >
                                                    {item.teamName}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-[#0B0E11] rounded-xl border border-[#2B3139] group-hover:border-[#FCD535]/30 transition-all">
                                        <p className="text-[8px] font-black text-[#848E9C] uppercase tracking-widest mb-1.5">REVENUE</p>
                                        <p className="text-lg font-black text-[#FCD535] tabular-nums">${item.revenue.toLocaleString()}</p>
                                    </div>
                                    <div className="p-3 bg-[#0B0E11] rounded-xl border border-[#2B3139] group-hover:border-[#0ECB81]/30 transition-all">
                                        <p className="text-[8px] font-black text-[#848E9C] uppercase tracking-widest mb-1.5">PROFIT</p>
                                        <p className="text-lg font-black text-[#0ECB81] tabular-nums">${item.profit.toLocaleString()}</p>
                                    </div>
                                </div>

                                {/* Monthly Breakdown Section */}
                                {onMonthClick && (
                                    <div className="pt-3 border-t border-[#2B3139]">
                                        <p className="text-[8px] font-black text-[#474D57] uppercase tracking-[0.2em] mb-2 ml-1">Historical Data Nodes</p>
                                        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                                            {MONTHS.map((m, idx) => {
                                                const rev = item[`rev_${m}`] || 0;
                                                if (rev === 0) return null;
                                                
                                                return (
                                                    <button 
                                                        key={m}
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            onMonthClick(item.pageName, idx); 
                                                        }}
                                                        className="flex-shrink-0 bg-[#0B0E11] p-2 rounded-lg border border-[#2B3139] min-w-[65px] flex flex-col items-center hover:border-[#FCD535]/50 transition-all active:scale-95"
                                                    >
                                                        <span className="text-[8px] font-black text-[#474D57] uppercase mb-0.5">{m}</span>
                                                        <span className="text-[10px] font-black text-[#EAECEF] tabular-nums">${rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between px-1 pt-3 border-t border-[#2B3139]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#FCD535] animate-pulse"></div>
                                        <span className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest">{item.orderCount} Orders</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-black text-[#474D57] uppercase tracking-widest">AOV:</span>
                                        <span className="text-[9px] font-black text-white tabular-nums">${aov.toFixed(0)}</span>
                                    </div>
                                </div>
                                
                                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#FCD535]/5 to-transparent pointer-events-none"></div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // TABLE VIEW - Compact Technical Style
                <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#0B0E11] border-b border-[#2B3139] text-[10px] text-[#848E9C] font-black uppercase tracking-widest">
                                    <th 
                                        className="p-3 sticky left-0 z-20 bg-[#0B0E11] border-r border-[#2B3139] min-w-[130px] shadow-lg cursor-pointer hover:bg-white/5 transition-colors"
                                        onClick={() => onToggleSort && onToggleSort('pageName')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Page Node
                                            {sortConfig?.key === 'pageName' && (
                                                <span className="text-[#FCD535]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    
                                    <th 
                                        className="p-3 text-right min-w-[90px] text-[#FCD535] bg-[#FCD535]/5 cursor-pointer hover:bg-[#FCD535]/10 transition-colors"
                                        onClick={() => onToggleSort && onToggleSort('revenue')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            Rev
                                            {sortConfig?.key === 'revenue' && (
                                                <span className="text-white">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    
                                    {MONTHS.map(m => (
                                        <th key={m} className="p-3 text-right min-w-[70px]">{m}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2B3139] text-[11px]">
                                {data.map((item: any, idx: number) => (
                                    <tr key={item.pageName} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-3 sticky left-0 z-20 bg-[#1E2329] border-r border-[#2B3139] shadow-lg">
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-7 h-7 rounded-lg bg-[#0B0E11] border border-[#2B3139] overflow-hidden flex-shrink-0"
                                                    onClick={(e) => { e.stopPropagation(); onPreviewImage(convertGoogleDriveUrl(item.logoUrl)); }}
                                                >
                                                    <img src={convertGoogleDriveUrl(item.logoUrl)} className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div 
                                                        className="font-black text-[#EAECEF] truncate max-w-[90px] leading-tight group-hover:text-[#FCD535] transition-colors" 
                                                        onClick={() => onNavigate('page', item.pageName)}
                                                    >
                                                        {item.pageName}
                                                    </div>
                                                    <div 
                                                        className="text-[8px] text-[#474D57] font-black uppercase truncate max-w-[90px] tracking-widest" 
                                                        onClick={() => onNavigate('team', item.teamName)}
                                                    >
                                                        {item.teamName}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="p-3 text-right font-black text-[#FCD535] bg-[#FCD535]/5 tabular-nums">
                                            ${item.revenue.toLocaleString()}
                                        </td>

                                        {MONTHS.map((m, mIdx) => {
                                            const rev = item[`rev_${m}`] || 0;
                                            return (
                                                <td 
                                                    key={m} 
                                                    className={`p-3 text-right font-mono tabular-nums ${rev > 0 ? 'text-[#EAECEF] font-bold' : 'text-[#474D57]'}`}
                                                    onClick={() => onMonthClick && onMonthClick(item.pageName, mIdx)}
                                                >
                                                    {rev > 0 ? rev.toLocaleString() : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default SalesByPageMobile;
