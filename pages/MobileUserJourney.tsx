
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';

interface MobileUserJourneyProps {
    onBackToRoleSelect: () => void;
    userTeams: string[];
}

const MobileUserJourney: React.FC<MobileUserJourneyProps> = ({ onBackToRoleSelect, userTeams }) => {
    const { 
        setChatVisibility, 
        setMobilePageTitle, 
        language, 
        setAppState, 
        selectedTeam, 
        setSelectedTeam, 
        hasPermission 
    } = useContext(AppContext);
    
    const t = translations[language];
    const { playClick, playTransition, playTeamSelect } = useSoundEffects();

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
        if (selectedTeam) setMobilePageTitle('OPERATIONS');
        else {
            setMobilePageTitle(null);
            fetchRanking();
        }
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setChatVisibility, setMobilePageTitle, fetchRanking]);

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
            <div className="min-h-full w-full flex flex-col items-center justify-start p-6 bg-binance relative overflow-hidden pb-20">
                {/* Dynamic Background Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[40%] bg-accent/5 blur-[120px] rounded-full pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-[-5%] left-[-5%] w-[60%] h-[30%] bg-accent/5 blur-[100px] rounded-full pointer-events-none"></div>
                
                <div className="w-full max-w-sm flex flex-col items-center gap-8 pt-12 pb-10 relative z-10">
                    <div className="text-center space-y-4 animate-fade-in-up">
                        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-accent/5 border border-accent/10 backdrop-blur-md">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                            </span>
                            <span className="text-[9px] font-black text-accent/80 uppercase tracking-[0.3em]">Operational Access</span>
                        </div>
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                            Select <br/>
                            <span className="text-accent underline decoration-accent/20 underline-offset-8">Team</span>
                        </h2>
                    </div>

                    <div className="w-full grid grid-cols-1 gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        {userTeams.map((team, idx) => {
                            return (
                                <button 
                                    key={team}
                                    onClick={() => handleTeamSelect(team)}
                                    className="group relative p-[1px] rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent active:scale-95 transition-all duration-500"
                                >
                                    <div className="relative flex items-center gap-5 p-5 rounded-[1.95rem] bg-[#1E2329]/60 backdrop-blur-3xl overflow-hidden border border-white/5">
                                        <div className="w-14 h-14 rounded-[1.2rem] bg-accent flex items-center justify-center font-black text-[#181A20] italic text-2xl shadow-lg transform -rotate-3 transition-transform duration-500 group-hover:rotate-0">
                                            {team.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="text-left flex-grow">
                                            <h3 className="text-xl font-black text-white uppercase italic tracking-tight group-hover:text-accent transition-colors">{team}</h3>
                                            <p className="text-[9px] text-secondary font-black uppercase tracking-[0.2em] mt-1">Operational Node</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-secondary border border-transparent group-hover:border-accent/20 group-hover:bg-accent/5">
                                            <svg className="w-5 h-5 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5M6 7l5 5-5 5" /></svg>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Mobile Ranking Section */}
                    <div className="w-full space-y-5 mt-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                        <div className="flex items-center justify-between px-2 bg-white/[0.02] py-3 rounded-xl border border-white/5">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic ml-2">Market Vol.</h3>
                            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 scale-90 origin-right mr-1">
                                {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                    <button 
                                        key={p} 
                                        onClick={() => setRankingPeriod(p)}
                                        className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all ${rankingPeriod === p ? 'bg-accent text-[#181A20] shadow-lg' : 'text-secondary'}`}
                                    >
                                        {p === 'today' ? 'Day' : p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {isRankingLoading ? (
                                <div className="py-12 flex justify-center"><Spinner size="sm" /></div>
                            ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 3).map((t, i) => (
                                <div key={t.name} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl relative overflow-hidden transition-all active:bg-white/5">
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black italic shadow-inner ${
                                            i === 0 ? 'bg-accent text-[#181A20]' : 
                                            i === 1 ? 'bg-[#EAECEF] text-[#181A20]' : 
                                            'bg-[#C99400] text-white'
                                        }`}>{i+1}</div>
                                        <div>
                                            <span className="text-base font-black text-white italic uppercase tracking-tight block leading-none">{t.name}</span>
                                            <span className="text-[9px] text-secondary font-bold uppercase tracking-widest mt-1 block">Leader Node</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end relative z-10">
                                        <span className="text-[16px] font-black text-white italic tracking-tighter leading-none">${(t.revenue/1000).toFixed(1)}k</span>
                                        <span className="text-[8px] text-accent font-bold uppercase tracking-widest mt-1">Operational</span>
                                    </div>
                                    <div className="absolute right-[-5%] bottom-[-10%] text-white/[0.03] font-black italic text-7xl select-none pointer-events-none">{i+1}</div>
                                </div>
                            )) : (
                                <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl"><span className="text-[9px] font-bold text-secondary uppercase italic tracking-widest">Awaiting node synchronization...</span></div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={onBackToRoleSelect}
                        className="mt-6 flex items-center gap-3 px-12 py-4 bg-white/[0.03] text-secondary rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.25em] border border-white/5 active:scale-95 transition-all hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                        {t.back}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full animate-fade-in pb-20 bg-binance">
            {/* Mobile Action Header */}
            <div className="px-5 py-5 bg-[#0B0E11]/80 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_15px_rgba(252,213,53,0.3)]"></div>
                    <div className="flex flex-col">
                        <span className="text-[12px] font-black text-white uppercase tracking-wider leading-none">{selectedTeam}</span>
                        <span className="text-[8px] font-bold text-accent uppercase tracking-[0.3em] mt-1">Operational Session</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {userTeams && userTeams.length > 1 && (
                        <button onClick={handleSwitchTeam} className="p-3 bg-white/5 rounded-2xl text-secondary active:scale-90 transition-all border border-white/5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                    )}
                    <button onClick={onBackToRoleSelect} className="p-3 bg-accent/5 rounded-2xl text-accent active:scale-90 transition-all border border-accent/10">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>

            {/* Mobile Content Area */}
            <div className="flex-1 px-1">
                <UserOrdersView onAdd={handleCreateOrder} />
            </div>

            {/* Floating Create Button for Mobile */}
            {hasPermission('create_order') && createPortal(
                <div className="fixed bottom-24 right-6 z-[60] pointer-events-none">
                    <button 
                        onClick={handleCreateOrder}
                        className="w-18 h-18 bg-accent rounded-[2rem] shadow-[0_15px_40px_rgba(252,213,53,0.3)] flex items-center justify-center text-[#181A20] active:scale-90 transition-all border border-white/20 animate-bounce pointer-events-auto"
                        style={{ width: '4.5rem', height: '4.5rem' }}
                    >
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MobileUserJourney;
