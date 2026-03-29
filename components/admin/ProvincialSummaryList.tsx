
import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

interface ProvinceStat {
    name: string;
    revenue: number;
    orders: number;
}

interface ProvincialSummaryListProps {
    stats: ProvinceStat[];
    onProvinceClick?: (provinceName: string) => void;
}

const ProvincialSummaryList: React.FC<ProvincialSummaryListProps> = ({ stats, onProvinceClick }) => {
    const { advancedSettings, language } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    const isBinance = uiTheme === 'binance';

    // ── Binance Theme ─────────────────────────────────────────────────────────
    if (isBinance) {
        const getRankStyle = (idx: number): React.CSSProperties => {
            if (idx === 0) return { background: '#F0B90B', color: '#1E2329' };
            if (idx === 1) return { background: '#2B3139', color: '#B7BDC6', border: '1px solid #474D57' };
            if (idx === 2) return { background: 'rgba(14,203,129,0.15)', color: '#0ECB81', border: '1px solid rgba(14,203,129,0.3)' };
            return { background: '#2B3139', color: '#707A8A', border: '1px solid #363C45' };
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Inter', sans-serif" }}>
                {/* Header */}
                <div style={{
                    padding: '14px 20px 12px',
                    borderBottom: '1px solid #2B3139',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#1E2329',
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F0B90B" strokeWidth="2.5" aria-hidden="true">
                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                    </svg>
                    <span style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#EAECEF',
                        letterSpacing: '0.02em',
                    }}>
                        {language === 'km' ? 'សង្ខេបតាមខេត្ត/រាជធានី' : 'Province Summary'}
                    </span>
                </div>

                {/* Column Headers */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    padding: '7px 20px',
                    borderBottom: '1px solid #2B3139',
                    background: '#181A20',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#707A8A' }}>
                        {language === 'km' ? 'ខេត្ត/រាជធានី' : 'Province'}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#707A8A' }}>
                        {language === 'km' ? 'ចំណូលសរុប' : 'Revenue'}
                    </span>
                </div>

                {/* Rows */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {stats.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#707A8A', fontSize: 13 }}>
                            {language === 'km' ? 'មិនទាន់មានទិន្នន័យ' : 'No data available'}
                        </div>
                    ) : (
                        stats.map((prov: ProvinceStat, idx: number) => (
                            <div
                                key={prov.name}
                                onClick={() => onProvinceClick?.(prov.name)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    alignItems: 'center',
                                    padding: '10px 20px',
                                    borderBottom: '1px solid #2B3139',
                                    cursor: 'pointer',
                                    transition: 'background 0.1s',
                                    gap: 12,
                                }}
                                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = '#2B3139')}
                                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'transparent')}
                            >
                                {/* Left: rank + name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 22,
                                        height: 22,
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 800,
                                        flexShrink: 0,
                                        ...getRankStyle(idx),
                                    }}>
                                        {idx + 1}
                                    </span>
                                    <span style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: '#EAECEF',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {prov.name}
                                    </span>
                                </div>

                                {/* Right: revenue + orders */}
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: '#0ECB81',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}>
                                        ${prov.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: '#707A8A',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        marginTop: 1,
                                    }}>
                                        {prov.orders} {language === 'km' ? 'ការកម្មង់' : 'ORDERS'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // ── Other Themes ─────────────────────────────────────────────────────────

    const getAccentColor = () => {
        if (uiTheme === 'netflix') return 'text-[#e50914]';
        if (uiTheme === 'samsung') return 'text-[#0381fe]';
        return 'text-indigo-400';
    };

    const getRankBg = (idx: number) => {
        if (idx >= 3) return isLightMode ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-slate-800 border-slate-700 text-slate-500';
        if (uiTheme === 'netflix') return 'bg-[#e50914] text-white border-[#e50914]';
        if (uiTheme === 'samsung') return 'bg-[#0381fe] text-white border-[#0381fe]';
        return 'bg-gradient-to-br from-indigo-500 to-violet-600 border-indigo-400/50 text-white';
    };

    const getRevenueColor = () => {
        if (uiTheme === 'netflix') return 'text-[#e50914]';
        if (uiTheme === 'samsung') return 'text-[#0381fe]';
        return isLightMode ? 'text-indigo-600' : 'text-cyan-400';
    };

    const getHoverBg = () => {
        if (uiTheme === 'netflix') return 'hover:bg-[#e50914]/10';
        if (uiTheme === 'samsung') return 'hover:bg-[#0381fe]/10';
        return 'hover:bg-indigo-500/10';
    };

    return (
        <div className="space-y-4 provincial-summary-container">
            <h3 className={`text-lg font-black ${isLightMode ? 'text-gray-800' : 'text-slate-100'} flex items-center px-1 tracking-tight`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${getAccentColor()}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {language === 'km' ? 'សង្ខេបតាមខេត្ត/រាជធានី' : 'Province Summary'}
            </h3>
            <div className={`page-card ${isLightMode ? 'bg-white shadow-xl border-gray-100' : 'bg-slate-900/80 backdrop-blur-xl border-slate-700/50'} rounded-2xl border overflow-hidden h-[450px] lg:h-[550px] xl:h-[600px] p-0`}>
                <div className="overflow-y-auto h-full custom-scrollbar">
                    <table className="w-full text-sm text-left border-collapse admin-table">
                        <thead className={`text-[10px] ${isLightMode ? 'text-gray-500 bg-gray-50 border-gray-100' : 'text-slate-400 bg-slate-950/80 border-slate-700/50'} font-black uppercase tracking-widest border-b sticky top-0 z-20 backdrop-blur-md`}>
                            <tr>
                                <th className="px-5 py-4">{language === 'km' ? 'ខេត្ត/រាជធានី' : 'Province'}</th>
                                <th className="px-5 py-4 text-right">{language === 'km' ? 'ចំណូលសរុប' : 'Revenue'}</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isLightMode ? 'divide-gray-100' : 'divide-slate-800/50'}`}>
                            {stats.map((prov, idx) => (
                                <tr
                                    key={prov.name}
                                    className={`${getHoverBg()} transition-colors cursor-pointer group`}
                                    onClick={() => onProvinceClick?.(prov.name)}
                                >
                                    <td className={`px-5 py-3.5 font-bold ${isLightMode ? 'text-gray-700' : 'text-slate-200'} transition-colors`}>
                                        <div className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center border shadow-sm ${getRankBg(idx)}`}>
                                                {idx + 1}
                                            </span>
                                            <span className="truncate max-w-[150px] font-medium tracking-wide">{prov.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <span className={`${getRevenueColor()} font-black block group-hover:scale-105 transition-transform drop-shadow-sm text-base`}>
                                            ${prov.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                        <span className={`text-[9px] ${isLightMode ? 'text-gray-400' : 'text-slate-500'} uppercase tracking-wider font-semibold`}>
                                            {prov.orders} {language === 'km' ? 'ការកម្មង់' : 'orders'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-6 py-12 text-center text-slate-500 italic">
                                        {language === 'km' ? 'មិនទាន់មានទិន្នន័យ' : 'No data'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProvincialSummaryList;
