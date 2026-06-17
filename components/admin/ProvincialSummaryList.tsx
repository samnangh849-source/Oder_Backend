
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

    const getRevenueColor = () => {
        if (uiTheme === 'netflix') return 'text-[#e50914]';
        return isLightMode ? 'text-green-600' : 'text-[#4ade80]';
    };

    return (
        <div className="overflow-y-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
                <thead className={`text-[10px] ${isLightMode ? 'text-gray-500 bg-gray-50' : 'bg-[#141720] text-[#6b7280]'} font-bold uppercase tracking-[0.05em] sticky top-0 z-20`}>
                    <tr>
                        <th className="px-5 py-3">{language === 'km' ? 'ខេត្ត/រាជធានី' : 'Province'}</th>
                        <th className="px-5 py-3 text-right">{language === 'km' ? 'ចំណូលសរុប' : 'Revenue'}</th>
                    </tr>
                </thead>
                <tbody className={`divide-y ${isLightMode ? 'divide-gray-100' : 'divide-white/[0.04]'}`}>
                    {stats.map((prov, idx) => (
                        <tr
                            key={prov.name}
                            className={`${isLightMode ? 'hover:bg-slate-50' : 'even:bg-white/[0.02] hover:bg-white/[0.05]'} transition-colors cursor-pointer group`}
                            onClick={() => onProvinceClick?.(prov.name)}
                        >
                            <td className={`px-5 py-3.5 ${isLightMode ? 'text-gray-700' : 'text-[#d1d5db]'} transition-colors`}>
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0 ${
                                        idx === 0 ? (isLightMode ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-[rgba(251,191,36,0.15)] text-[#fbbf24] border-[rgba(251,191,36,0.3)]')
                                        : idx === 1 ? (isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-[rgba(148,163,184,0.15)] text-[#94a3b8] border-[rgba(148,163,184,0.3)]')
                                        : idx === 2 ? (isLightMode ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-[rgba(205,124,50,0.15)] text-[#cd7c32] border-[rgba(205,124,50,0.3)]')
                                        : (isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700')}`}>
                                        {idx + 1}
                                    </span>
                                    <span className="truncate max-w-[150px] font-medium">{prov.name}</span>
                                </div>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                                <span className={`${getRevenueColor()} font-bold block text-sm tabular-nums`}>
                                    ${prov.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span className={`text-[9px] ${isLightMode ? 'text-gray-400' : 'text-[#6b7280]'} uppercase tracking-wider font-semibold`}>
                                    {prov.orders} {language === 'km' ? 'ការកម្មង់' : 'orders'}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {stats.length === 0 && (
                        <tr>
                            <td colSpan={2} className={`px-6 py-12 text-center ${isLightMode ? 'text-slate-400' : 'text-[#6b7280]'} italic`}>
                                {language === 'km' ? 'មិនទាន់មានទិន្នន័យ' : 'No data'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ProvincialSummaryList;
