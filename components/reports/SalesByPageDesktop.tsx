
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
            <div className="hidden xl:flex page-card flex-col mb-8 !p-6 border-gray-700/50 shadow-xl overflow-hidden bg-gray-900/40">
                <div className="flex justify-between items-center mb-6">
                    <h3 className={`text-xl font-black flex items-center gap-2 ${type === 'Revenue' ? 'text-blue-300' : 'text-green-400'}`}>
                        <span className={`w-2 h-6 rounded-full ${type === 'Revenue' ? 'bg-blue-600' : 'bg-green-600'}`}></span>
                        តារាង{type === 'Revenue' ? 'ចំណូល' : 'ប្រាក់ចំណេញ'}តាម Page (Desktop)
                    </h3>
                    <div className="flex items-center gap-2">
                        {type === 'Revenue' && (
                             <>
                                <button onClick={() => setShowAllPages(!showAllPages)} className={`btn !py-1 !px-3 text-[10px] font-black border transition-all ${showAllPages ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/20' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                                    {showAllPages ? 'ALL PAGES' : 'ACTIVE ONLY'}
                                </button>
                                <button 
                                    onClick={() => setOnlyTelegram && setOnlyTelegram(!onlyTelegram)} 
                                    className={`btn !py-1 !px-3 text-[10px] font-black border transition-all flex items-center gap-1.5 ${onlyTelegram ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-900/20' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42l10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701l-.33 4.955c.488 0 .704-.223.977-.485l2.344-2.279l4.875 3.597c.897.494 1.54.24 1.763-.83l3.194-15.048c.326-1.308-.496-1.898-1.352-1.547z"/>
                                    </svg>
                                    TELEGRAM
                                </button>
                                <button 
                                    onClick={onExportPDF}
                                    disabled={isExporting}
                                    className="btn !py-1 !px-4 text-[10px] font-black bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                                >
                                    {isExporting ? <Spinner size="sm"/> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
                                    EXPORT PDF
                                </button>
                             </>
                        )}
                        <button onClick={() => setIsMerged(!isMerged)} className={`btn !py-1 !px-3 text-[10px] font-black border transition-all ${isMerged ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>MERGE</button>
                        <button onClick={() => setShowFillColor(!showFillColor)} className={`btn !py-1 !px-3 text-[10px] font-black border transition-all ${showFillColor ? 'bg-orange-600 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>COLOR</button>
                        <button onClick={() => setIsFrozen(!isFrozen)} className={`btn !py-1 !px-3 text-[10px] font-black border transition-all ${isFrozen ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>FREEZE</button>
                        <button onClick={() => setShowBorders(!showBorders)} className={`btn !py-1 !px-3 text-[10px] font-black border transition-all ${showBorders ? 'bg-gray-700 border-gray-600 text-white shadow-lg' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>BORDER</button>
                    </div>
                </div>

                <div className={`overflow-x-auto custom-scrollbar pb-2 ${showBorders ? 'border-2 border-white/20 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)]' : ''}`}>
                    <table className={`report-table w-full border-separate border-spacing-0 text-sm ${showBorders ? 'border-collapse' : ''}`}>
                        <thead className="bg-[#0f172a] backdrop-blur-md">
                            <tr className="border-b-2 border-white/20">
                                {columns.map(col => {
                                    let stickyClass = "";
                                    let stickyStyle: React.CSSProperties = {};
                                    if (isFrozen) {
                                        if (col.key === 'index') { stickyClass = "sticky left-0 z-30 bg-[#0f172a]"; stickyStyle = { width: '45px', minWidth: '45px' }; }
                                        else if (col.key === 'teamName') { stickyClass = "sticky left-[45px] z-30 bg-[#0f172a] border-r border-white/20 shadow-md"; stickyStyle = { minWidth: '130px' }; }
                                        else if (col.key === 'logo') { stickyClass = `sticky z-30 bg-[#0f172a]`; stickyStyle = { left: '175px', width: '50px', minWidth: '50px' }; }
                                        else if (col.key === 'pageName') { stickyClass = `sticky z-30 bg-[#0f172a] shadow-md`; stickyStyle = { left: '225px', minWidth: '160px' }; }
                                        else if (col.key.includes('total')) { stickyClass = `sticky z-30 bg-[#0f172a] border-r border-white/20 shadow-lg`; stickyStyle = { left: '385px', width: '100px', minWidth: '100px' }; }
                                    }
                                    const isSorting = sortConfig.key === col.sortKey;
                                    const headerBg = col.key.includes('total') 
                                        ? (type === 'Revenue' ? 'bg-blue-900/80' : 'bg-green-900/80') 
                                        : isSorting ? 'bg-white/5' : '';
                                    return (
                                        <th key={col.key} onClick={() => col.sortable && onToggleSort(col.sortKey!)} className={`px-4 py-5 whitespace-nowrap text-left font-black uppercase tracking-wider border-b-2 border-white/20 transition-colors ${showBorders ? 'border-x border-white/10' : ''} ${stickyClass} ${headerBg} ${col.sortable ? 'cursor-pointer hover:bg-gray-800' : ''}`} style={stickyStyle}>
                                            <div className="flex items-center gap-1.5">
                                                <span className={isSorting ? 'text-blue-400' : 'text-gray-400'}>{col.label}</span>
                                                {col.sortable && isSorting && (
                                                    <span className="text-blue-500 animate-pulse">
                                                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {data.map((item: any, idx) => {
                                const shouldDisplayTeam = isMerged ? displayRow[idx] : true;
                                const currentSpan = isMerged ? rowSpans[idx] : 1;
                                
                                const teamColorIndex = Array.from(String(item.teamName)).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 5;
                                const groupColors = [{ bg: 'bg-blue-500/5', border: 'border-l-4 border-l-blue-500' }, { bg: 'bg-purple-500/5', border: 'border-l-4 border-l-purple-500' }, { bg: 'bg-emerald-500/5', border: 'border-l-4 border-l-emerald-500' }, { bg: 'bg-orange-500/5', border: 'border-l-4 border-l-orange-500' }, { bg: 'bg-pink-500/5', border: 'border-l-4 border-l-pink-500' }];
                                const colorSet = groupColors[teamColorIndex];
                                const rowBgClass = showFillColor ? colorSet.bg : 'hover:bg-blue-500/5';
                                return (
                                    <tr key={item.pageName} className={`${rowBgClass} transition-colors group border-b border-white/10`}>
                                        {columns.map(col => {
                                            const cellClass = `px-4 py-4 lg:py-5 whitespace-nowrap border-white/10 ${showBorders ? 'border-x border-white/10' : ''}`;
                                            let stickyClass = "";
                                            let stickyStyle: React.CSSProperties = {};
                                            if (isFrozen) {
                                                if (col.key === 'index') { stickyClass = "sticky left-0 z-10 bg-[#020617]"; stickyStyle = { width: '45px', minWidth: '45px' }; }
                                                else if (col.key === 'teamName') { stickyClass = "sticky left-[45px] z-10 bg-[#020617] border-r border-white/20 shadow-md"; stickyStyle = { width: '130px', minWidth: '130px' }; }
                                                else if (col.key === 'logo') { stickyClass = `sticky z-10 bg-[#020617]`; stickyStyle = { left: '175px', width: '50px', minWidth: '50px' }; }
                                                else if (col.key === 'pageName') { stickyClass = `sticky z-10 bg-[#020617] shadow-md`; stickyStyle = { left: '225px', minWidth: '160px' }; }
                                                else if (col.key.includes('total')) { stickyClass = `sticky z-10 bg-[#020617] border-r border-white/20 shadow-lg`; stickyStyle = { left: '385px', width: '100px', minWidth: '100px' }; }
                                            }
                                            if (col.key === 'index') return <td key={col.key} className={`${cellClass} text-center font-bold text-gray-500 ${stickyClass}`} style={stickyStyle}>{idx + 1}</td>;
                                            
                                            // Handle Merged Cells
                                            if (col.key === 'teamName') {
                                                if (!shouldDisplayTeam) return null;
                                                return <td 
                                                    key={col.key} 
                                                    rowSpan={currentSpan} 
                                                    className={`${cellClass} font-black text-white bg-gray-900/95 align-middle text-center ${stickyClass} ${showFillColor ? colorSet.border : ''} border-b border-white/10 cursor-pointer hover:text-blue-400 group/team`} 
                                                    style={stickyStyle}
                                                    onClick={() => onNavigate('team', item.teamName)}
                                                >
                                                    <div className="bg-gray-800/80 py-1.5 px-4 rounded-xl border border-white/5 shadow-inner inline-block group-hover/team:bg-blue-600 transition-all">
                                                        {item.teamName}
                                                    </div>
                                                </td>;
                                            }
                                            
                                            if (col.key === 'logo') return <td key={col.key} className={`${cellClass} text-center ${stickyClass} border-b border-white/10`} style={stickyStyle}><img src={convertGoogleDriveUrl(item.logoUrl)} className="w-9 h-9 rounded-full border border-gray-700 mx-auto shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all" alt="logo" onClick={() => onPreviewImage(convertGoogleDriveUrl(item.logoUrl))} /></td>;
                                            
                                            if (col.key === 'pageName') {
                                                return <td 
                                                    key={col.key} 
                                                    className={`${cellClass} font-black text-white ${stickyClass} border-b border-white/10 cursor-pointer hover:text-blue-400 hover:underline transition-colors`} 
                                                    style={stickyStyle}
                                                    onClick={() => onNavigate('page', item.pageName)}
                                                >
                                                    {item.pageName}
                                                </td>;
                                            }
                                            
                                            if (col.key.includes('total')) {
                                                return <td 
                                                    key={col.key} 
                                                    className={`${cellClass} text-right font-black ${stickyClass} ${type === 'Revenue' ? 'text-blue-100 bg-blue-600/10 group-hover:text-blue-300' : 'text-green-100 bg-green-600/10 group-hover:text-green-300'} border-b border-white/10 cursor-pointer transition-colors`} 
                                                    style={stickyStyle}
                                                    onClick={() => onNavigate('page', item.pageName)}
                                                >
                                                    ${(type === 'Revenue' ? item.revenue : item.profit).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>;
                                            }
                                            
                                            if (col.key.startsWith(prefix)) {
                                                const val = item[col.key] || 0;
                                                const color = type === 'Profit' ? (val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-500') : (val > 0 ? 'text-blue-300' : 'text-gray-500');
                                                const monthIndex = MONTHS.indexOf(col.key.split('_')[1]);
                                                return (
                                                    <td 
                                                        key={col.key} 
                                                        className={`${cellClass} text-right font-bold font-mono ${color} border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors`}
                                                        onClick={() => onMonthClick(item.pageName, monthIndex)}
                                                    >
                                                        {val !== 0 ? `$${val.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                                                    </td>
                                                );
                                            }
                                            return <td key={col.key} className={`${cellClass} border-b border-white/10`}>-</td>;
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-[#0f172a] font-black border-t-2 border-white/20">
                            <tr className="border-t-2 border-white/20">
                                {columns.map((col, idx) => {
                                    const cellClass = `px-4 py-5 whitespace-nowrap border-t-2 border-white/20 ${showBorders ? 'border-x border-white/10' : ''}`;
                                    let stickyClass = "";
                                    let stickyStyle: React.CSSProperties = {};
                                    if (isFrozen) {
                                        if (col.key === 'index') { stickyClass = "sticky left-0 z-30 bg-[#0f172a]"; stickyStyle = { width: '45px', minWidth: '45px' }; }
                                        else if (col.key === 'teamName') { stickyClass = "sticky left-[45px] z-30 bg-[#0f172a] border-r border-white/20 shadow-md"; stickyStyle = { minWidth: '130px' }; }
                                        else if (col.key === 'logo') { stickyClass = `sticky z-30 bg-[#0f172a]`; stickyStyle = { left: '175px', width: '50px', minWidth: '50px' }; }
                                        else if (col.key === 'pageName') { stickyClass = `sticky z-30 bg-[#0f172a] shadow-md`; stickyStyle = { left: '225px', minWidth: '160px' }; }
                                        else if (col.key.includes('total')) { stickyClass = `sticky z-30 bg-[#0f172a] border-r border-white/20 shadow-lg`; stickyStyle = { left: '385px', width: '100px', minWidth: '100px' }; }
                                    }
                                    if (idx === 0) return <td key={col.key} className={`${cellClass} uppercase tracking-widest text-white font-black ${stickyClass}`} style={stickyStyle} colSpan={4}>សរុបរួម (GRAND TOTAL)</td>;
                                    if (['teamName', 'logo', 'pageName'].includes(col.key)) return null;
                                    if (col.key.includes('total')) return <td key={col.key} className={`${cellClass} text-right ${stickyClass} ${type === 'Revenue' ? 'text-blue-300 bg-blue-600/10' : 'text-green-300 bg-green-600/10'}`} style={stickyStyle}>${(type === 'Revenue' ? grandTotals.revenue : grandTotals.profit).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                    if (col.key.startsWith(prefix)) return <td key={col.key} className={`${cellClass} text-right text-gray-300 font-mono`}>${grandTotals[col.key].toLocaleString(undefined, {minimumFractionDigits: 2})}</td>;
                                    return <td key={col.key} className={cellClass}></td>;
                                })}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ចំនួន Page សរុប:</span>
                            <span className="text-sm font-black text-white">{data.length}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 py-2 px-4 rounded-xl border border-white/5 shadow-inner">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">មធ្យមភាគ/{type === 'Revenue' ? 'ចំណូល' : 'ចំណេញ'}:</span>
                        <span className="text-sm font-black text-white">
                            ${(grandTotals[type.toLowerCase() === 'revenue' ? 'revenue' : 'profit'] / (data.length || 1)).toLocaleString(undefined, {maximumFractionDigits: 2})}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {renderTable('Revenue', 'rev')}
            {renderTable('Profit', 'prof')}
        </>
    );
};

export default SalesByPageDesktop;
