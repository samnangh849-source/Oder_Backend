
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
            <div className="min-h-full w-full flex flex-col items-center justify-center relative py-12 animate-fade-in bg-binance">
                <style>{`
                    .team-btn {
                        background: var(--card-bg);
                        border: 1px solid var(--border-light);
                        transition: all 0.2s ease;
                        color: var(--text-primary);
                    }
                    .team-btn:hover {
                        border-color: var(--primary);
                        background: var(--card-bg-hover);
                        transform: translateY(-2px);
                    }
                    .rank-card {
                        background: var(--card-bg);
                        border: 1px solid var(--border-light);
                        color: var(--text-primary);
                    }
                `}</style>
                <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 px-6 relative z-10">
                    <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-8">
                        <div className="text-center lg:text-left">
                            <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Select <span className="text-accent">Team</span></h2>
                            <p className="text-secondary text-sm font-medium max-w-sm leading-relaxed">{t.team_desc}</p>
                        </div>
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {userTeams.map((team) => (
                                <button key={team} onClick={() => handleTeamSelect(team)} onMouseEnter={playHover} className="team-btn group p-6 rounded-xl relative overflow-hidden flex items-center gap-5 shadow-lg">
                                    <div className="w-14 h-14 shrink-0 rounded-xl bg-accent flex items-center justify-center text-[#181A20] font-black text-2xl shadow-inner transform -rotate-3 group-hover:rotate-0 transition-transform">
                                        {team.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left flex-grow">
                                        <h3 className="text-xl font-bold group-hover:text-accent transition-colors">{team}</h3>
                                        <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Operational Node</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-accent/10 transition-all border border-transparent group-hover:border-accent/20">
                                        <svg className="w-5 h-5 text-secondary group-hover:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col gap-6 pt-4 lg:pt-16">
                        <div className="flex items-center justify-between mb-2 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                </div>
                                <h3 className="text-xs font-black text-white uppercase tracking-wider">Top Performers</h3>
                            </div>
                            <div className="flex bg-white/5 p-1 rounded-lg scale-90 origin-right">
                                {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => setRankingPeriod(p)}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-md transition-all ${rankingPeriod === p ? 'bg-accent text-[#181A20] shadow-lg' : 'text-secondary hover:text-white'}`}
                                    >
                                        {p === 'today' ? 'Today' : p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {isRankingLoading ? (
                                <div className="py-12 flex justify-center"><Spinner size="md" /></div>
                            ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                                <div key={t.name} className="rank-card group p-5 rounded-xl flex items-center justify-between transition-all hover:bg-white/5 hover:border-accent/30 relative overflow-hidden">
                                    <div className="flex items-center gap-5 relative z-10">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm italic ${
                                            i === 0 ? 'bg-accent text-[#181A20]' : 
                                            i === 1 ? 'bg-[#EAECEF] text-[#181A20]' : 
                                            'bg-[#C99400] text-white'
                                        }`}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-white italic uppercase tracking-tight">{t.name}</h4>
                                            <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">Operational Leader</p>
                                        </div>
                                    </div>
                                    <div className="text-right relative z-10">
                                        <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-1">Revenue</p>
                                        <p className="text-2xl font-black text-white italic leading-none tracking-tighter">${(t.revenue/1000).toFixed(1)}k</p>
                                    </div>
                                    <div className="absolute right-[-5%] bottom-[-10%] text-white/[0.02] font-black italic text-8xl select-none pointer-events-none group-hover:text-accent/[0.03] transition-colors">{i+1}</div>
                                </div>
                            )) : (
                                <div className="py-16 text-center bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                                    <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.3em]">Establishing Data Nodes...</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-2 p-5 rounded-xl bg-accent/5 border border-accent/10 backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0 border border-accent/20">
                                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div className="pt-1">
                                    <h5 className="text-xs font-black text-accent uppercase tracking-widest mb-1.5">Terminal Notice</h5>
                                    <p className="text-[11px] text-secondary font-medium leading-relaxed">System is operational. Access your designated node to manage live order streams and performance analytics.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-full mx-auto px-6 py-6 animate-fade-in flex flex-col min-h-full bg-binance">
            <div className="flex-shrink-0 flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                <div className="flex items-center gap-5">
                    <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_15px_rgba(252,213,53,0.5)]"></div>
                    <div className="flex flex-col">
                        <h2 className="text-lg font-black text-white uppercase italic tracking-tighter leading-none">{selectedTeam} <span className="text-accent ml-2">TERMINAL</span></h2>
                        <span className="text-[9px] font-bold text-secondary uppercase tracking-[0.4em] mt-2">Active Operational Session</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {hasPermission('create_order') && (
                        <button onClick={handleCreateOrder} className="px-8 py-3 bg-accent text-[#181A20] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#f0c51d] hover:shadow-[0_8px_20px_rgba(252,213,53,0.25)] transition-all active:scale-95 flex items-center gap-3">
                            <div className="w-5 h-5 rounded-lg bg-[#181A20]/10 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                            </div>
                            <span>{language === 'km' ? 'បង្កើតការកម្មង់' : 'Create Order'}</span>
                        </button>
                    )}
                    <div className="h-8 w-[1px] bg-white/5 mx-2"></div>
                    <button onClick={onBackToRoleSelect} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-accent bg-accent/5 hover:bg-accent/10 rounded-xl border border-accent/10 transition-all active:scale-95">
                        {language === 'km' ? 'ប្ដូរ Role' : 'Switch Role'}
                    </button>
                    {userTeams && userTeams.length > 1 && (
                        <button onClick={handleSwitchTeam} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-secondary bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all active:scale-95">
                            {language === 'km' ? 'ប្ដូរក្រុម' : 'Switch Team'}
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 transition-all duration-500"><UserOrdersView onAdd={handleCreateOrder} /></div>
        </div>
    );
};

export default DesktopUserJourney;
