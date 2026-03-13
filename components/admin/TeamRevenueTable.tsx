
import React, { useMemo } from 'react';

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
    // គណនាសរុបរួម
    const grandTotals = useMemo(() => {
        return stats.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            orders: acc.orders + curr.orders
        }), { revenue: 0, orders: 0 });
    }, [stats]);

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center px-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                    <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
                ចំណូលសរុបតាមក្រុម
            </h3>
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-500 font-black uppercase tracking-widest bg-gray-900/50 border-b border-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">ក្រុម</th>
                                <th className="px-6 py-4 text-center">ការកម្មង់</th>
                                <th className="px-6 py-4 text-right">ចំណូល</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/30">
                            {stats.map((team, idx) => (
                                <tr key={team.name} className="hover:bg-blue-600/5 transition-colors group cursor-pointer" onClick={() => onStatClick(team.name)}>
                                    <td className="px-6 py-4 font-bold text-gray-100 flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-lg bg-gray-700 text-gray-400 flex items-center justify-center text-[10px] border border-gray-600">#{idx + 1}</span>
                                        <span className="group-hover:text-blue-300 transition-colors">{team.name}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-blue-400 font-black group-hover:underline">
                                        {team.orders}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-green-400 group-hover:text-green-300 transition-colors">
                                        ${team.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500 italic">មិនទាន់មានទិន្នន័យ</td>
                                </tr>
                            )}
                        </tbody>
                        {stats.length > 0 && (
                            <tfoot className="bg-gray-900/80 font-black border-t-2 border-gray-700">
                                <tr>
                                    <td className="px-6 py-4 uppercase tracking-widest text-gray-500 text-[10px]">សរុបរួម</td>
                                    <td className="px-6 py-4 text-center text-blue-300 text-base whitespace-nowrap tabular-nums">{grandTotals.orders}</td>
                                    <td className="px-6 py-4 text-right text-green-400 text-base whitespace-nowrap tabular-nums">
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
