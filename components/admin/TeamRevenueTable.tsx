
import React, { useMemo, useContext } from 'react';
import { AppContext } from '../../context/AppContext';

interface TeamStat {
    name: string;
    revenue: number;
    orders: number;
}

interface TeamRevenueTableProps {
    stats: TeamStat[];
    onStatClick: (teamName: string) => void;
}

const TeamRevenueTable: React.FC<TeamRevenueTableProps> = ({ stats, onStatClick }) => {
    const { advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    // គណនាសរុបរួម
    const grandTotals = useMemo(() => {
        return stats.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            orders: acc.orders + curr.orders
        }), { revenue: 0, orders: 0 });
    }, [stats]);

    const getAccentColor = () => {
        if (uiTheme === 'binance') return 'text-[#FCD535]';
        if (uiTheme === 'netflix') return 'text-[#e50914]';
        return 'text-green-400';
    };

    const getCardBg = () => {
        if (uiTheme === 'binance') return 'bg-[#1E2329] border-[#2B3139]';
        if (uiTheme === 'netflix') return isLightMode ? 'bg-white' : 'bg-[#181818]';
        return isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/40 backdrop-blur-sm border-gray-700/50';
    };

    const getHoverBg = () => {
        if (uiTheme === 'binance') return 'hover:bg-[#2B3139]/30';
        if (uiTheme === 'netflix') return 'hover:bg-white/5';
        return 'hover:bg-blue-600/5';
    };

    const isBinance = uiTheme === 'binance';

    return (
        <div className="space-y-3">
            <h3 className={`text-sm font-bold ${isLightMode ? 'text-slate-400' : 'text-slate-500'} flex items-center px-1 uppercase tracking-wider`}>
                <i className="fa-solid fa-clock-rotate-left mr-2 text-green-500 opacity-70"></i>
                ចំណូលតាមក្រុម
            </h3>
            <div className={`${isLightMode ? 'bg-white border-slate-200' : 'bg-[#1a1d27] border-white/[0.06]'} border rounded-xl overflow-hidden shadow-sm transition-all duration-300`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className={`text-[11px] ${isLightMode ? 'bg-slate-700 text-slate-300' : 'bg-[#141720] text-[#6b7280]'} font-bold uppercase tracking-[0.05em]`}>
                            <tr>
                                <th className="px-4 py-3">ក្រុម (Teams)</th>
                                <th className="px-4 py-3 text-center">ការកម្មង់</th>
                                <th className="px-4 py-3 text-right">ចំណូល</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                            {stats.map((team, idx) => (
                                <tr key={team.name} className={`${isLightMode ? 'hover:bg-slate-50' : 'even:bg-white/[0.02] hover:bg-white/[0.05]'} transition-colors group cursor-pointer`} onClick={() => onStatClick(team.name)}>
                                    <td className="px-4 py-3 flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                                            idx === 0 ? (isLightMode ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-[rgba(251,191,36,0.15)] text-[#fbbf24] border-[rgba(251,191,36,0.3)]')
                                            : idx === 1 ? (isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-[rgba(148,163,184,0.15)] text-[#94a3b8] border-[rgba(148,163,184,0.3)]')
                                            : idx === 2 ? (isLightMode ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-[rgba(205,124,50,0.15)] text-[#cd7c32] border-[rgba(205,124,50,0.3)]')
                                            : (isLightMode ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700')}`}>
                                            {idx + 1}
                                        </span>
                                        <span className={`font-bold ${isLightMode ? 'text-slate-600' : 'text-slate-200'}`}>{team.name}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-500 tabular-nums">
                                        {team.orders}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${isLightMode ? 'text-green-600' : 'text-green-500'}`}>
                                        ${team.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-10 text-center text-slate-400 italic text-xs uppercase tracking-widest">មិនទាន់មានទិន្នន័យ</td>
                                </tr>
                            )}
                        </tbody>
                        {stats.length > 0 && (
                            <tfoot className={`${isLightMode ? 'bg-slate-800 text-white' : 'bg-[rgba(59,130,246,0.08)] text-slate-200 border-t border-white/[0.06]'} font-semibold`}>
                                <tr>
                                    <td className="px-4 py-3 text-[11px] uppercase tracking-widest opacity-80">សរុបរួម</td>
                                    <td className="px-4 py-3 text-center text-blue-400">{grandTotals.orders}</td>
                                    <td className="px-4 py-3 text-right text-green-400">
                                        ${grandTotals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamRevenueTable;
