
import React, { useState, useMemo } from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';

interface SalesByPageDesktopProps {
    data: any[];
    grandTotals: any;
    sortConfig: { key: string, direction: 'asc' | 'desc' };
    onToggleSort: (key: any) => void;
    showAllPages: boolean;
    setShowAllPages: (show: boolean) => void;
    onlyTelegram?: boolean;
    setOnlyTelegram?: (show: boolean) => void;
    onExportPDF: () => void;
    isExporting: boolean;
    onPreviewImage: (url: string) => void;
    onNavigate: (key: string, value: string) => void;
    onMonthClick: (pageName: string, monthIndex: number) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SalesByPageDesktop: React.FC<SalesByPageDesktopProps> = ({ 
    data, grandTotals, sortConfig, onToggleSort,
    showAllPages, setShowAllPages, onlyTelegram, setOnlyTelegram, onExportPDF, isExporting, onPreviewImage, onNavigate, onMonthClick
}) => {
    const [showBorders, setShowBorders] = useState(true);
    const [isFrozen, setIsFrozen] = useState(false);
    const [showFillColor, setShowFillColor] = useState(true);
    const [isMerged, setIsMerged] = useState(true);

    // Calculate row spans based on data
    const { rowSpans, displayRow } = useMemo(() => {
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
    }, [data]);

    const renderTable = (type: 'Revenue' | 'Profit', prefix: string) => {
        const columns = [
            { key: 'index', label: '#' },
            { key: 'teamName', label: 'ក្រុម (Team)', sortable: true, sortKey: 'teamName' },
            { key: 'logo', label: 'Logo' },
            { key: 'pageName', label: 'ឈ្មោះ Page', sortable: true, sortKey: 'pageName' },
            { key: `total${type}`, label: `សរុប (${type})`, sortable: true, sortKey: type.toLowerCase() },
            ...MONTHS.map(m => ({ key: `${prefix}_${m}`, label: m }))
        ];
        
        return (
            <div className="hidden xl:flex flex-col mb-8 p-6 overflow-hidden bg-[#1E2329]">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-6 rounded-full ${type === 'Revenue' ? 'bg-[#FCD535]' : 'bg-[#0ECB81]'}`}></div>
                        <h3 className="text-lg font-black text-white uppercase tracking-[0.1em]">
                            តារាង{type === 'Revenue' ? 'ចំណូល' : 'ប្រាក់ចំណេញ'}តាម Page
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {type === 'Revenue' && (
                             <>
                                <button 
                                    onClick={() => setShowAllPages(!showAllPages)} 
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-widest ${showAllPages ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#2B3139] border-[#474D57] text-[#848E9C]'}`}
                                >
                                    {showAllPages ? 'ALL PAGES' : 'ACTIVE ONLY'}
                                </button>
                                <button 
                                    onClick={() => setOnlyTelegram && setOnlyTelegram(!onlyTelegram)} 
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-widest flex items-center gap-1.5 ${onlyTelegram ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-500/10' : 'bg-[#2B3139] border-[#474D57] text-[#848E9C]'}`}
                                >
                                    TELEGRAM
                                </button>
                             </>
                        )}
                        <button onClick={() => setIsMerged(!isMerged)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-widest ${isMerged ? 'bg-purple-500 border-purple-400 text-white shadow-lg' : 'bg-[#2B3139] border-[#474D57] text-[#848E9C]'}`}>MERGE</button>
                        <button onClick={() => setShowFillColor(!showFillColor)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-widest ${showFillColor ? 'bg-orange-500 border-orange-400 text-white shadow-lg' : 'bg-[#2B3139] border-[#474D57] text-[#848E9C]'}`}>COLOR</button>
                        <button onClick={() => setIsFrozen(!isFrozen)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-widest ${isFrozen ? 'bg-blue-500 border-blue-400 text-white shadow-lg' : 'bg-[#2B3139] border-[#474D57] text-[#848E9C]'}`}>FREEZE</button>
                        <button onClick={() => setShowBorders(!showBorders)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-widest ${showBorders ? 'bg-[#474D57] border-[#474D57] text-white' : 'bg-[#2B3139] border-[#474D57] text-[#848E9C]'}`}>BORDER</button>
                    </div>
                </div>

                <div className={`overflow-x-auto custom-scrollbar pb-2 ${showBorders ? 'border border-[#2B3139] rounded-xl' : ''}`}>
                    <table className={`w-full border-separate border-spacing-0 text-sm`}>
                        <thead className="bg-[#0B0E11]">
                            <tr>
                                {columns.map(col => {
                                    let stickyClass = "";
                                    let stickyStyle: React.CSSProperties = {};
                                    if (isFrozen) {
                                        if (col.key === 'index') { stickyClass = "sticky left-0 z-30 bg-[#0B0E11]"; stickyStyle = { width: '45px', minWidth: '45px' }; }
                                        else if (col.key === 'teamName') { stickyClass = "sticky left-[45px] z-30 bg-[#0B0E11] border-r border-[#2B3139]"; stickyStyle = { minWidth: '130px' }; }
                                        else if (col.key === 'logo') { stickyClass = `sticky z-30 bg-[#0B0E11]`; stickyStyle = { left: '175px', width: '50px', minWidth: '50px' }; }
                                        else if (col.key === 'pageName') { stickyClass = `sticky z-30 bg-[#0B0E11] shadow-lg`; stickyStyle = { left: '225px', minWidth: '160px' }; }
                                        else if (col.key.includes('total')) { stickyClass = `sticky z-30 bg-[#0B0E11] border-r border-[#2B3139] shadow-xl`; stickyStyle = { left: '385px', width: '100px', minWidth: '100px' }; }
                                    }
                                    const isSorting = sortConfig.key === col.sortKey;
                                    const headerColor = col.key.includes('total') 
                                        ? (type === 'Revenue' ? 'text-[#FCD535]' : 'text-[#0ECB81]') 
                                        : isSorting ? 'text-white' : 'text-[#848E9C]';
                                    return (
                                        <th 
                                            key={col.key} 
                                            onClick={() => col.sortable && onToggleSort(col.sortKey!)} 
                                            className={`px-4 py-4 whitespace-nowrap text-left font-black uppercase tracking-[0.1em] border-b border-[#2B3139] transition-colors ${showBorders ? 'border-x border-[#2B3139]' : ''} ${stickyClass} ${col.sortable ? 'cursor-pointer hover:bg-white/5' : ''}`} 
                                            style={stickyStyle}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className={headerColor}>{col.label}</span>
                                                {col.sortable && isSorting && (
                                                    <span className="text-[#FCD535] animate-pulse">
                                                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2B3139]">
                            {data.map((item: any, idx) => {
                                const shouldDisplayTeam = isMerged ? displayRow[idx] : true;
                                const currentSpan = isMerged ? rowSpans[idx] : 1;
                                
                                const teamColorIndex = Array.from(String(item.teamName)).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 5;
                                const groupColors = [
                                    { bg: 'bg-[#FCD535]/5', border: 'border-l-2 border-l-[#FCD535]' }, 
                                    { bg: 'bg-purple-500/5', border: 'border-l-2 border-l-purple-500' }, 
                                    { bg: 'bg-[#0ECB81]/5', border: 'border-l-2 border-l-[#0ECB81]' }, 
                                    { bg: 'bg-orange-500/5', border: 'border-l-2 border-l-orange-500' }, 
                                    { bg: 'bg-pink-500/5', border: 'border-l-2 border-l-pink-500' }
                                ];
                                const colorSet = groupColors[teamColorIndex];
                                const rowBgClass = showFillColor ? colorSet.bg : 'hover:bg-white/5';
                                return (
                                    <tr key={item.pageName} className={`${rowBgClass} transition-colors group`}>
                                        {columns.map(col => {
                                            const cellClass = `px-4 py-4 whitespace-nowrap border-[#2B3139] ${showBorders ? 'border-x border-[#2B3139]' : ''}`;
                                            let stickyClass = "";
                                            let stickyStyle: React.CSSProperties = {};
                                            if (isFrozen) {
                                                if (col.key === 'index') { stickyClass = "sticky left-0 z-10 bg-[#1E2329]"; stickyStyle = { width: '45px', minWidth: '45px' }; }
                                                else if (col.key === 'teamName') { stickyClass = "sticky left-[45px] z-10 bg-[#1E2329] border-r border-[#2B3139] shadow-md"; stickyStyle = { width: '130px', minWidth: '130px' }; }
                                                else if (col.key === 'logo') { stickyClass = `sticky z-10 bg-[#1E2329]`; stickyStyle = { left: '175px', width: '50px', minWidth: '50px' }; }
                                                else if (col.key === 'pageName') { stickyClass = `sticky z-10 bg-[#1E2329] shadow-lg`; stickyStyle = { left: '225px', minWidth: '160px' }; }
                                                else if (col.key.includes('total')) { stickyClass = `sticky z-10 bg-[#1E2329] border-r border-[#2B3139] shadow-xl`; stickyStyle = { left: '385px', width: '100px', minWidth: '100px' }; }
                                            }
                                            if (col.key === 'index') return <td key={col.key} className={`${cellClass} text-center font-bold text-[#474D57] ${stickyClass}`} style={stickyStyle}>{idx + 1}</td>;
                                            
                                            // Handle Merged Cells
                                            if (col.key === 'teamName') {
                                                if (!shouldDisplayTeam) return null;
                                                return <td 
                                                    key={col.key} 
                                                    rowSpan={currentSpan} 
                                                    className={`${cellClass} font-black text-white bg-[#0B0E11]/40 align-middle text-center ${stickyClass} ${showFillColor ? colorSet.border : ''} cursor-pointer hover:text-[#FCD535] group/team`} 
                                                    style={stickyStyle}
                                                    onClick={() => onNavigate('team', item.teamName)}
                                                >
                                                    <div className="bg-[#2B3139] py-1.5 px-3 rounded-lg border border-white/5 shadow-inner inline-block group-hover/team:bg-[#FCD535] group-hover/team:text-black transition-all">
                                                        {item.teamName}
                                                    </div>
                                                </td>;
                                            }
                                            
                                            if (col.key === 'logo') return <td key={col.key} className={`${cellClass} text-center ${stickyClass}`} style={stickyStyle}><img src={convertGoogleDriveUrl(item.logoUrl)} className="w-8 h-8 rounded-lg border border-[#2B3139] mx-auto shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all" alt="logo" onClick={() => onPreviewImage(convertGoogleDriveUrl(item.logoUrl))} /></td>;
                                            
                                            if (col.key === 'pageName') {
                                                return <td 
                                                    key={col.key} 
                                                    className={`${cellClass} font-black text-[#EAECEF] ${stickyClass} cursor-pointer hover:text-[#FCD535] transition-colors`} 
                                                    style={stickyStyle}
                                                    onClick={() => onNavigate('page', item.pageName)}
                                                >
                                                    {item.pageName}
                                                </td>;
                                            }
                                            
                                            if (col.key.includes('total')) {
                                                return <td 
                                                    key={col.key} 
                                                    className={`${cellClass} text-right font-black ${stickyClass} ${type === 'Revenue' ? 'text-[#FCD535] bg-[#FCD535]/5' : 'text-[#0ECB81] bg-[#0ECB81]/5'} cursor-pointer transition-colors`} 
                                                    style={stickyStyle}
                                                    onClick={() => onNavigate('page', item.pageName)}
                                                >
                                                    ${(type === 'Revenue' ? item.revenue : item.profit).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>;
                                            }
                                            
                                            if (col.key.startsWith(prefix)) {
                                                const val = item[col.key] || 0;
                                                const color = type === 'Profit' ? (val > 0 ? 'text-[#0ECB81]' : val < 0 ? 'text-[#F6465D]' : 'text-[#474D57]') : (val > 0 ? 'text-[#EAECEF]' : 'text-[#474D57]');
                                                const monthIndex = MONTHS.indexOf(col.key.split('_')[1]);
                                                return (
                                                    <td 
                                                        key={col.key} 
                                                        className={`${cellClass} text-right font-bold font-mono ${color} cursor-pointer hover:bg-white/5 transition-colors`}
                                                        onClick={() => onMonthClick(item.pageName, monthIndex)}
                                                    >
                                                        {val !== 0 ? `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                                                    </td>
                                                );
                                            }
                                            return <td key={col.key} className={`${cellClass}`}>-</td>;
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-[#0B0E11] font-black border-t border-[#2B3139]">
                            <tr>
                                {columns.map((col, idx) => {
                                    const cellClass = `px-4 py-5 whitespace-nowrap border-t border-[#2B3139] ${showBorders ? 'border-x border-[#2B3139]' : ''}`;
                                    let stickyClass = "";
                                    let stickyStyle: React.CSSProperties = {};
                                    if (isFrozen) {
                                        if (col.key === 'index') { stickyClass = "sticky left-0 z-30 bg-[#0B0E11]"; stickyStyle = { width: '45px', minWidth: '45px' }; }
                                        else if (col.key === 'teamName') { stickyClass = "sticky left-[45px] z-30 bg-[#0B0E11] border-r border-[#2B3139]"; stickyStyle = { minWidth: '130px' }; }
                                        else if (col.key === 'logo') { stickyClass = `sticky z-30 bg-[#0B0E11]`; stickyStyle = { left: '175px', width: '50px', minWidth: '50px' }; }
                                        else if (col.key === 'pageName') { stickyClass = `sticky z-30 bg-[#0B0E11] shadow-lg`; stickyStyle = { left: '225px', minWidth: '160px' }; }
                                        else if (col.key.includes('total')) { stickyClass = `sticky z-30 bg-[#0B0E11] border-r border-[#2B3139] shadow-xl`; stickyStyle = { left: '385px', width: '100px', minWidth: '100px' }; }
                                    }
                                    if (idx === 0) return <td key={col.key} className={`${cellClass} uppercase tracking-[0.2em] text-[#848E9C] font-black ${stickyClass}`} style={stickyStyle} colSpan={4}>សរុបរួម (GRAND TOTAL)</td>;
                                    if (['teamName', 'logo', 'pageName'].includes(col.key)) return null;
                                    if (col.key.includes('total')) return <td key={col.key} className={`${cellClass} text-right ${stickyClass} ${type === 'Revenue' ? 'text-[#FCD535] bg-[#FCD535]/10' : 'text-[#0ECB81] bg-[#0ECB81]/10'}`} style={stickyStyle}>${(type === 'Revenue' ? grandTotals.revenue : grandTotals.profit).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                    if (col.key.startsWith(prefix)) return <td key={col.key} className={`${cellClass} text-right text-[#848E9C] font-mono`}>${grandTotals[col.key].toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                    return <td key={col.key} className={cellClass}></td>;
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">PAGES COUNT:</span>
                            <span className="text-sm font-black text-white">{data.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-[#0B0E11] py-2 px-5 rounded-xl border border-[#2B3139]">
                        <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">AVG/{type === 'Revenue' ? 'REV' : 'PROFIT'}:</span>
                        <span className={`text-sm font-black ${type === 'Revenue' ? 'text-[#FCD535]' : 'text-[#0ECB81]'}`}>
                            ${(grandTotals[type.toLowerCase() === 'revenue' ? 'revenue' : 'profit'] / (data.length || 1)).toLocaleString(undefined, {maximumFractionDigits: 2})}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            {renderTable('Revenue', 'rev')}
            {renderTable('Profit', 'prof')}
        </div>
    );
};

export default SalesByPageDesktop;
