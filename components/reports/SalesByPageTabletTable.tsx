
import React from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SalesByPageTabletTableProps {
    data: any[];
    dataType: 'revenue' | 'profit';
    rowSpans: number[];
    displayRow: boolean[];
    MONTHS: string[];
    grandTotals: any;
    onNavigate: (key: string, value: string) => void;
    onPreviewImage: (url: string) => void;
    onMonthClick: (pageName: string, monthIndex: number) => void;
}

const SalesByPageTabletTable: React.FC<SalesByPageTabletTableProps> = ({ 
    data, dataType, rowSpans, displayRow, MONTHS, grandTotals, onNavigate, onPreviewImage, onMonthClick
}) => {
    return (
        <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl overflow-hidden shadow-2xl animate-fade-in flex flex-col w-full relative">
            <div className="overflow-x-auto custom-scrollbar w-full relative">
                <table className="w-max min-w-full text-sm border-separate border-spacing-0">
                    <thead>
                        <tr className="h-14 bg-[#0B0E11]">
                            <th className="sticky left-0 z-30 bg-[#0B0E11] px-2 text-center text-[#474D57] font-black border-b border-[#2B3139] w-[50px] min-w-[50px] border-r border-[#2B3139]">#</th>
                            <th className="sticky left-[50px] z-30 bg-[#0B0E11] px-4 text-left text-[#848E9C] font-black uppercase tracking-[0.1em] border-b border-[#2B3139] w-[110px] min-w-[110px] border-r border-[#2B3139]">Team</th>
                            <th className="sticky left-[160px] z-30 bg-[#0B0E11] px-4 text-left text-[#848E9C] font-black uppercase tracking-[0.1em] border-b border-[#2B3139] w-[200px] min-w-[200px] shadow-lg border-r border-[#2B3139]">Page Name</th>
                            <th className={`px-6 text-right font-black uppercase tracking-[0.1em] border-b border-[#2B3139] ${dataType === 'revenue' ? 'text-[#FCD535] bg-[#FCD535]/5' : 'text-[#0ECB81] bg-[#0ECB81]/5'} min-w-[140px]`}>
                                {dataType === 'revenue' ? 'Total Rev' : 'Total Profit'}
                            </th>
                            {MONTHS.map(m => (
                                <th key={m} className="px-4 text-right text-[#848E9C] font-black uppercase tracking-[0.1em] border-b border-[#2B3139] min-w-[90px]">{m}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B3139]">
                        {data.map((item: any, idx) => {
                            const teamColorIndex = Array.from(String(item.teamName)).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 5;
                            const groupColors = ['bg-[#FCD535]/[0.02]', 'bg-purple-500/[0.02]', 'bg-[#0ECB81]/[0.02]', 'bg-orange-500/[0.02]', 'bg-pink-500/[0.02]'];
                            const baseRowBg = groupColors[teamColorIndex];
                            
                            const stickyBg = 'bg-[#1E2329]'; 
                            const prefix = dataType === 'revenue' ? 'rev' : 'prof';

                            return (
                                <tr key={item.pageName} className={`${baseRowBg} hover:bg-white/5 transition-colors h-14 group`}>
                                    <td className={`sticky left-0 z-20 ${stickyBg} border-r border-[#2B3139] border-b border-[#2B3139] text-center font-bold text-[#474D57]`}>{idx + 1}</td>
                                    
                                    {displayRow[idx] ? (
                                        <td 
                                            rowSpan={rowSpans[idx]} 
                                            className={`sticky left-[50px] z-20 ${stickyBg} border-r border-[#2B3139] border-b border-[#2B3139] align-middle px-4 cursor-pointer hover:bg-white/5`}
                                            onClick={() => onNavigate('team', item.teamName)}
                                        >
                                            <div className="font-black text-white bg-[#0B0E11] border border-[#2B3139] px-2.5 py-1 rounded-lg inline-block shadow-sm text-[10px] tracking-widest truncate max-w-[90px] group-hover:border-[#FCD535]/30 group-hover:text-[#FCD535] transition-all">
                                                {item.teamName}
                                            </div>
                                        </td>
                                    ) : null}

                                    <td 
                                        className={`sticky left-[160px] z-20 ${stickyBg} border-r border-[#2B3139] border-b border-[#2B3139] shadow-lg px-4 cursor-pointer hover:bg-white/5`}
                                        onClick={() => onNavigate('page', item.pageName)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg p-0.5 bg-[#0B0E11] border border-[#2B3139] flex-shrink-0" onClick={(e) => { e.stopPropagation(); onPreviewImage(convertGoogleDriveUrl(item.logoUrl)); }}>
                                                <img src={convertGoogleDriveUrl(item.logoUrl)} className="w-full h-full rounded-md object-cover" alt="" />
                                            </div>
                                            <span className="truncate max-w-[140px] text-xs font-black text-[#EAECEF] group-hover:text-[#FCD535] transition-colors" title={item.pageName}>{item.pageName}</span>
                                        </div>
                                    </td>

                                    <td 
                                        className={`px-6 text-right font-black ${dataType === 'revenue' ? 'text-[#FCD535] bg-[#FCD535]/5 group-hover:bg-[#FCD535]/10' : 'text-[#0ECB81] bg-[#0ECB81]/5 group-hover:bg-[#0ECB81]/10'} border-r border-[#2B3139] border-b border-[#2B3139] text-sm tabular-nums cursor-pointer transition-colors`}
                                        onClick={() => onNavigate('page', item.pageName)}
                                    >
                                        ${(dataType === 'revenue' ? item.revenue : item.profit).toLocaleString()}
                                    </td>

                                    {MONTHS.map((m, mIdx) => {
                                        const val = item[`${prefix}_${m}`] || 0;
                                        const color = dataType === 'profit' ? (val > 0 ? 'text-[#0ECB81]' : val < 0 ? 'text-[#F6465D]' : 'text-[#474D57]') : (val > 0 ? 'text-[#EAECEF]' : 'text-[#474D57]');
                                        return (
                                            <td 
                                                key={m} 
                                                className={`px-4 text-right font-mono text-xs border-b border-[#2B3139] cursor-pointer hover:bg-white/5 transition-colors tabular-nums ${color} font-bold`}
                                                onClick={() => onMonthClick(item.pageName, mIdx)}
                                            >
                                                {val !== 0 ? val.toLocaleString() : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                    
                    {grandTotals && (
                        <tfoot className="bg-[#0B0E11] font-black border-t border-[#2B3139]">
                            <tr className="h-14">
                                <td className="sticky left-0 bg-[#0B0E11] z-30 border-r border-[#2B3139] border-b border-[#2B3139]"></td>
                                <td className="sticky left-[50px] bg-[#0B0E11] z-30 border-r border-[#2B3139] border-b border-[#2B3139]"></td>
                                <td className="sticky left-[160px] bg-[#0B0E11] z-30 px-4 text-right uppercase tracking-[0.2em] text-[#848E9C] shadow-lg border-r border-[#2B3139] border-b border-[#2B3139] text-[10px] flex items-center justify-end h-14">
                                    Grand Total
                                </td>
                                
                                <td className={`px-6 text-right ${dataType === 'revenue' ? 'text-[#FCD535] bg-[#FCD535]/10' : 'text-[#0ECB81] bg-[#0ECB81]/10'} border-r border-[#2B3139] border-b border-[#2B3139] text-sm tabular-nums`}>
                                    ${(dataType === 'revenue' ? grandTotals.revenue : grandTotals.profit).toLocaleString()}
                                </td>
                                
                                {MONTHS.map(m => {
                                    const prefix = dataType === 'revenue' ? 'rev' : 'prof';
                                    const val = grandTotals[`${prefix}_${m}`] || 0;
                                    return (
                                        <td key={m} className="px-4 text-right text-[#848E9C] font-mono text-[10px] border-b border-[#2B3139] bg-[#0B0E11] tabular-nums">
                                            {val !== 0 ? val.toLocaleString() : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default SalesByPageTabletTable;
