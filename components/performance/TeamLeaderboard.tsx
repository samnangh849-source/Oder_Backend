
import React, { useMemo } from 'react';
import { ParsedOrder } from '../../types';

interface TeamLeaderboardProps {
    globalOrders: ParsedOrder[];
    startDate: Date | null;
    endDate: Date | null;
    periodLabel: string;
}

const TeamLeaderboard: React.FC<TeamLeaderboardProps> = ({ globalOrders, startDate, endDate, periodLabel }) => {
    const topTeams = useMemo(() => {
        const periodOrders = globalOrders.filter(o => {
            const orderDate = new Date(o.Timestamp);
            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;
            return true;
        });

        const teamStats: Record<string, number> = {};
        periodOrders.forEach(o => {
            const tName = o.Team || 'Unassigned';
            teamStats[tName] = (teamStats[tName] || 0) + (Number(o['Grand Total']) || 0);
        });

        return Object.entries(teamStats)
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3);
    }, [globalOrders, startDate, endDate]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <div className="h-6 w-1.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    ចំណាត់ថ្នាក់ក្រុមលក់ដាច់បំផុត ({periodLabel})
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topTeams.length > 0 ? topTeams.map((t, i) => (
                    <div key={t.name} className="relative group overflow-hidden bg-gray-800/40 backdrop-blur-md border border-white/5 p-5 rounded-[2rem] flex items-center gap-5 transition-all duration-500 hover:bg-gray-800/60 hover:shadow-2xl hover:border-white/10">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg transform transition-transform group-hover:scale-110 group-hover:rotate-6 ${
                            i === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 shadow-yellow-500/10' : 
                            i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/50 shadow-gray-400/10' : 
                            'bg-orange-600/20 text-orange-500 border border-orange-600/50 shadow-orange-600/10'
                        }`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">TOP {i+1} TEAM</p>
                            <h4 className="text-base font-black text-white truncate group-hover:text-blue-400 transition-colors">{t.name}</h4>
                        </div>
                        <div className="text-right">
                            <p className="text-blue-400 font-black text-lg">${t.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-700 ${
                            i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-orange-600'
                        }`}></div>
                    </div>
                )) : (
                    <div className="col-span-full py-10 text-center bg-gray-800/20 rounded-[2rem] border-2 border-dashed border-gray-700">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">មិនទាន់មានទិន្នន័យលក់សម្រាប់ {periodLabel}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamLeaderboard;
