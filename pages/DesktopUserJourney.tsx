
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';

interface DesktopUserJourneyProps {
    onBackToRoleSelect: () => void;
    userTeams: string[];
}

const DesktopUserJourney: React.FC<DesktopUserJourneyProps> = ({ onBackToRoleSelect, userTeams }) => {
    const { 
        setChatVisibility, 
        language, 
        setAppState, 
        selectedTeam, 
        setSelectedTeam, 
        hasPermission 
    } = useContext(AppContext);
    
    const t = translations[language];
    const { playClick, playTransition, playHover, playTeamSelect } = useSoundEffects();

    const [globalRanking, setGlobalRanking] = useState<{name: string, revenue: number}[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    const [rankingPeriod, setRankingPeriod] = useState<'today' | 'this_week' | 'this_month' | 'all'>('today');

    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/teams/ranking?period=${rankingPeriod}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success' && result.data) {
                    setGlobalRanking(result.data.map((r: any) => ({ 
                        name: r.Team || 'Unknown', 
                        revenue: Number(r.Revenue) || 0 
                    })));
                }
            }
        } catch (err) {
            console.error("Failed to fetch team ranking:", err);
        } finally {
            setIsRankingLoading(false);
        }
    }, [rankingPeriod]);

    useEffect(() => {
        setChatVisibility(true);
        if (!selectedTeam) fetchRanking();
    }, [setChatVisibility, selectedTeam, fetchRanking]);
    const handleCreateOrder = () => {
        if (!hasPermission('create_order')) return;
        playClick();
        setAppState('create_order');
    };

    const handleTeamSelect = (team: string) => {
        playTeamSelect();
        setSelectedTeam(team);
    };

    const handleSwitchTeam = () => {
        playClick();
        setSelectedTeam('');
    };

    if (!selectedTeam) {
        return (
            <div className="min-h-full w-full flex flex-col items-center justify-center relative py-12 animate-fade-in">
                <style>{`
                    .team-btn {
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    }
                    .team-btn:hover {
                        background: rgba(255, 255, 255, 0.07);
                        border-color: rgba(255, 255, 255, 0.15);
                        transform: translateY(-4px) scale(1.01);
                        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                    }
                    .rank-card {
                        background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%);
                        border: 1px solid rgba(59, 130, 246, 0.2);
                    }
                `}</style>
                <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-12 px-6">
                    <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-10">
                        <div className="text-center lg:text-left">
                            <h2 className="text-5xl font-black text-white mb-4 italic uppercase tracking-tighter leading-tight">Select Your <br/><span className="text-blue-500">Operation Team</span></h2>
                            <p className="text-white/30 text-sm font-medium max-w-sm uppercase tracking-widest leading-relaxed">{t.team_desc}</p>
                        </div>
                        <div className="w-full grid grid-cols-1 gap-4">
                            {userTeams.map((team) => (
                                <button key={team} onClick={() => handleTeamSelect(team)} onMouseEnter={playHover} className="team-btn group p-1 rounded-[2.5rem] relative overflow-hidden">
                                    <div className="flex items-center gap-5 p-6 rounded-[2.4rem] bg-[#020617]/40 backdrop-blur-2xl border border-white/5 relative z-10">
                                        <div className="w-16 h-16 shrink-0 rounded-3xl bg-blue-600 flex items-center justify-center border border-white/10 group-hover:border-blue-500/50 transition-all shadow-2xl">
                                            <span className="text-2xl font-black text-white italic tracking-tighter">{team.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="text-left flex-grow">
                                            <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors uppercase italic">{team}</h3>
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Operational Access Portal</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all">
                                            <svg className="w-5 h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5M6 7l5 5-5 5" /></svg>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col gap-6 pt-4 lg:pt-20">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/20 text-amber-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-[0.3em] italic">Top 3 Teams</h3>
                            </div>
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 scale-90 origin-right">
                                {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => setRankingPeriod(p)}
                                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${rankingPeriod === p ? 'bg-amber-500 text-black shadow-xl' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {p === 'today' ? 'Today' : p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {isRankingLoading ? (
                                <div className="py-12 flex justify-center"><Spinner size="md" /></div>
                            ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                                <div key={t.name} className="rank-card group p-5 rounded-[2rem] flex items-center justify-between transition-all hover:scale-[1.02] active:scale-95 cursor-default relative overflow-hidden">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black italic text-sm ${
                                            i === 0 ? 'bg-amber-500 text-black shadow-xl shadow-amber-500/20' : 
                                            i === 1 ? 'bg-slate-300 text-black shadow-xl shadow-slate-300/20' : 
                                            'bg-orange-600 text-white shadow-xl shadow-orange-600/20'
                                        }`}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-white italic uppercase tracking-tight">{t.name}</h4>
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-0.5">Top Performer</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end relative z-10">
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 italic">Revenue</span>
                                        <span className="text-2xl font-black text-white italic tracking-tighter leading-none">${(t.revenue/1000).toFixed(1)}k</span>
                                    </div>
                                    {/* Decorative Rank Number background */}
                                    <div className="absolute right-[-10%] bottom-[-20%] text-white/[0.03] font-black italic text-[120px] select-none pointer-events-none leading-none">{i+1}</div>
                                </div>
                            )) : (
                                <div className="py-12 text-center bg-white/[0.02] rounded-[2rem] border border-white/5 border-dashed">
                                    <p className="text-xs font-bold text-white/20 uppercase tracking-widest italic">Syncing Ranking Data...</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 p-6 rounded-[2rem] bg-blue-600/5 border border-blue-500/10 backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <h5 className="text-[10px] font-black text-white uppercase tracking-widest mb-1 italic">Notice</h5>
                                    <p className="text-[10px] text-white/40 leading-relaxed font-bold uppercase tracking-tight">Select your assigned team to access orders, reports, and real-time operational metrics.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full mx-auto px-4 py-4 animate-fade-in flex flex-col min-h-full">
            <div className="flex-shrink-0 flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">{selectedTeam} <span className="text-gray-600 ml-1">Portal</span></h2>
                </div>
                <div className="flex items-center gap-3">
                    {hasPermission('create_order') && (
                        <button onClick={handleCreateOrder} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-900/20">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                            <span>{language === 'km' ? 'បង្កើតការកម្មង់' : 'Create Order'}</span>
                        </button>
                    )}
                    <button onClick={onBackToRoleSelect} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl border border-blue-500/10 active:scale-95 transition-all">
                        {language === 'km' ? 'ប្ដូរ Role' : 'Switch Role'}
                    </button>
                    {userTeams && userTeams.length > 1 && (
                        <button onClick={handleSwitchTeam} className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 active:scale-95 transition-all">
                            {language === 'km' ? 'ប្ដូរក្រុម' : 'Switch Team'}
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1"><UserOrdersView onAdd={handleCreateOrder} /></div>
        </div>
    );
};

export default DesktopUserJourney;
