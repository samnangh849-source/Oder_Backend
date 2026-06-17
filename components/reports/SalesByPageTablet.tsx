
import React, { useState, useMemo } from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import SalesByPageTabletTable from './SalesByPageTabletTable';

interface SalesByPageTabletProps {
    data: any[];
    grandTotals?: any;
    onPreviewImage: (url: string) => void;
    onNavigate: (key: string, value: string) => void;
    onMonthClick: (pageName: string, monthIndex: number) => void;
}

type ViewMode = 'table' | 'grid';
type DataType = 'revenue' | 'profit';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SalesByPageTablet: React.FC<SalesByPageTabletProps> = ({ data, grandTotals, onPreviewImage, onNavigate, onMonthClick }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [dataType, setDataType] = useState<DataType>('revenue');

    // Logic to calculate row spans for Table view (Adjacency Grouping)
    const { rowSpans, displayRow } = useMemo(() => {
        if (viewMode !== 'table') return { rowSpans: [], displayRow: [] };
        
        const spans: number[] = new Array(data.length).fill(0);
        const display: boolean[] = new Array(data.length).fill(true);
        
        let i = 0;
        while (i < data.length) {
            const currentTeam = data[i].teamName;
            let count = 1;
            while (i + count < data.length && data[i + count].teamName === currentTeam) {
                count++;
            }
            spans[i] = count;
            display[i] = true;
            for (let j = 1; j < count; j++) {
                spans[i + j] = 0;
                display[i + j] = false;
            }
            i += count;
        }
        return { rowSpans: spans, displayRow: display };
    }, [data, viewMode]);

    return (
        <div className="hidden md:block xl:hidden space-y-6 pb-12 px-1 animate-fade-in">
            {/* Header Control Panel - Binance Style */}
            <div className="bg-[#1E2329] border border-[#2B3139] p-5 rounded-2xl shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-16 z-40">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#FCD535]/10 rounded-xl flex items-center justify-center border border-[#FCD535]/20 shadow-lg shadow-[#FCD535]/5">
                        <svg className="w-6 h-6 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-[0.1em]">Tablet Report</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-1.5 h-1.5 bg-[#0ECB81] rounded-full animate-pulse"></div>
                            <p className="text-[10px] text-[#848E9C] font-black uppercase tracking-[0.2em]">{data.length} Nodes Active</p>
                        </div>
                    </div>
                </div>
                
                {/* Controls Group */}
                <div className="flex gap-3">
                    {/* Data Type Switcher */}
                    <div className="bg-[#0B0E11] p-1 rounded-xl border border-[#2B3139] flex">
                        <button onClick={() => setDataType('revenue')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dataType === 'revenue' ? 'bg-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}>Revenue</button>
                        <button onClick={() => setDataType('profit')} className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dataType === 'profit' ? 'bg-[#0ECB81] text-black shadow-lg shadow-[#0ECB81]/10' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}>Profit</button>
                    </div>

                    {/* View Switcher */}
                    <div className="bg-[#0B0E11] p-1 rounded-xl border border-[#2B3139] flex">
                        <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-[#474D57] text-white shadow-lg' : 'text-[#848E9C] hover:text-white'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#474D57] text-white shadow-lg' : 'text-[#848E9C] hover:text-white'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" /></svg>
                        </button>
                    </div>
                </div>
            </div>
            
            {viewMode === 'grid' ? (
                // GRID VIEW - Binance Technical Style
                <div className="grid grid-cols-2 gap-5 animate-fade-in">
                    {data.map((item: any) => (
                        <div key={item.pageName} className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden group hover:border-[#FCD535]/50 transition-all cursor-pointer" onClick={() => onNavigate('page', item.pageName)}>
                            {/* Technical Grid Overlay Decoration */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FCD535]/5 to-transparent pointer-events-none transition-opacity group-hover:opacity-100 opacity-30"></div>
                            
                            <div className="flex items-center gap-5 mb-5 relative z-10">
                                <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#2B3139] bg-[#0B0E11] p-0.5 flex-shrink-0 shadow-xl group-hover:scale-105 transition-transform" onClick={(e) => { e.stopPropagation(); onPreviewImage(convertGoogleDriveUrl(item.logoUrl)); }}>
                                    <img src={convertGoogleDriveUrl(item.logoUrl)} className="w-full h-full object-cover rounded-lg" alt="" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-base font-black text-white truncate leading-tight uppercase tracking-tight group-hover:text-[#FCD535] transition-colors">{item.pageName}</h4>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] bg-[#2B3139] text-[#848E9C] px-2.5 py-1 rounded-lg border border-white/5 font-black uppercase tracking-widest group-hover:bg-[#FCD535]/10 group-hover:text-[#FCD535] transition-all">{item.teamName}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3 flex-grow relative z-10">
                                <div className="flex justify-between items-center bg-[#0B0E11] p-4 rounded-xl border border-[#2B3139] group-hover:border-[#FCD535]/30 transition-all">
                                    <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">Revenue</span>
                                    <span className="text-base font-black text-[#FCD535] tabular-nums">${item.revenue.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center bg-[#0B0E11] p-4 rounded-xl border border-[#2B3139] group-hover:border-[#0ECB81]/30 transition-all">
                                    <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">Profit</span>
                                    <span className="text-base font-black text-[#0ECB81] tabular-nums">${item.profit.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // TABLE VIEW (Using Component)
                <SalesByPageTabletTable 
                    data={data}
                    dataType={dataType}
                    rowSpans={rowSpans}
                    displayRow={displayRow}
                    MONTHS={MONTHS}
                    grandTotals={grandTotals}
                    onNavigate={onNavigate}
                    onPreviewImage={onPreviewImage}
                    onMonthClick={onMonthClick}
                />
            )}
        </div>
    );
};

export default SalesByPageTablet;
