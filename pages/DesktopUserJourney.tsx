
import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import { ChevronLeft, ChevronRight, TrendingUp, Info, Plus, LogOut, ArrowLeftRight } from 'lucide-react';

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
            <div className="ui-binance min-h-full bg-bg-black text-[#EAECEF] font-sans relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                
                {/* Sticky Header */}
                <div className="sticky top-0 z-50 bg-[#1E2329]/80 border-b border-[#2B3139] backdrop-blur-xl px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between max-w-[1400px] mx-auto">
                        <div className="flex items-center gap-4">
                            <button onClick={onBackToRoleSelect} className="p-2 hover:bg-[#2B3139] rounded-lg transition-all text-secondary hover:text-primary border border-[#2B3139] hover:border-primary/30">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                                    <h1 className="text-sm font-black tracking-[0.2em] uppercase leading-none text-white">Command Center</h1>
                                </div>
                                <p className="text-[10px] text-secondary font-bold mt-1.5 uppercase tracking-widest opacity-60">Strategic Node Selection</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#2B3139]/50 rounded-md border border-[#2B3139]">
                                <span className="w-2 h-2 rounded-full bg-[#0ECB81]"></span>
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">System Online</span>
                            </div>
                            <span className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-[10px] font-bold text-primary uppercase tracking-wider">
                                {userTeams.length} Nodes Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-[1400px] mx-auto p-6 sm:p-10 lg:p-12 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        {/* Left: Team Cards */}
                        <div className="lg:col-span-8 space-y-8">
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Initialize Session</h2>
                                <p className="text-sm text-secondary font-medium max-w-md uppercase tracking-wider leading-relaxed opacity-70">Select an operational node to begin real-time order processing and performance tracking.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {userTeams.map((team) => (
                                    <button
                                        key={team}
                                        onClick={() => handleTeamSelect(team)}
                                        onMouseEnter={playHover}
                                        className="group relative bg-[#1E2329]/40 hover:bg-[#1E2329]/60 border border-[#2B3139] hover:border-primary/50 rounded-xl p-6 transition-all duration-300 text-left overflow-hidden flex flex-col gap-4"
                                    >
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <div className="text-6xl font-black italic">{team.charAt(0)}</div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br from-primary to-[#f0c51d] flex items-center justify-center text-bg-black font-black text-2xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                                                {team.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-grow">
                                                <h3 className="text-lg font-black text-[#EAECEF] group-hover:text-primary transition-colors uppercase tracking-wider">{team}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81]"></span>
                                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Active Node</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-[#2B3139]/50 flex items-center justify-between relative z-10">
                                            <span className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] group-hover:text-primary/70 transition-colors">Enter Terminal</span>
                                            <div className="w-8 h-8 rounded-lg bg-[#2B3139] flex items-center justify-center text-secondary group-hover:bg-primary group-hover:text-bg-black transition-all duration-300">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>

                                        {/* Hover Glow */}
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right: Ranking */}
                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-[#1E2329]/60 backdrop-blur-md border border-[#2B3139] rounded-2xl p-6 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <TrendingUp className="w-24 h-24" />
                                </div>

                                <div className="flex flex-col gap-6 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-5 bg-primary rounded-full"></div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Top Team Sales</h3>
                                        </div>
                                        <div className="flex bg-bg-black p-1 rounded-lg border border-[#2B3139]">
                                            {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setRankingPeriod(p)}
                                                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${rankingPeriod === p ? 'bg-primary text-bg-black shadow-md' : 'text-secondary hover:text-white'}`}
                                                >
                                                    {p === 'today' ? 'Day' : p === 'this_week' ? 'Wk' : p === 'this_month' ? 'Mo' : 'All'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {isRankingLoading ? (
                                            <div className="py-20 flex flex-col items-center justify-center gap-4">
                                                <Spinner size="md" />
                                                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest animate-pulse">Retrieving Data...</span>
                                            </div>
                                        ) : (globalRanking && globalRanking.length > 0) ? globalRanking.slice(0, 5).map((item, i) => (
                                            <div key={item.name} className="group bg-bg-black/40 hover:bg-bg-black/60 border border-[#2B3139] hover:border-primary/30 rounded-xl p-4 flex items-center justify-between transition-all duration-300">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm shadow-inner ${
                                                        i === 0 ? 'bg-gradient-to-br from-primary to-[#f0c51d] text-bg-black' :
                                                        i === 1 ? 'bg-[#EAECEF] text-bg-black' :
                                                        i === 2 ? 'bg-[#C99400] text-[#EAECEF]' :
                                                        'bg-[#2B3139] text-secondary'
                                                    }`}>
                                                        {i === 0 ? '1ST' : i === 1 ? '2ND' : i === 3 ? '3RD' : `#${i + 1}`}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-[#EAECEF] uppercase tracking-wider group-hover:text-primary transition-colors">{item.name}</h4>
                                                        <p className="text-[9px] text-secondary font-bold uppercase tracking-widest mt-1 opacity-60">Revenue Stream</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-base font-black text-white tracking-tighter">${(item.revenue/1000).toFixed(1)}K</p>
                                                    <div className="flex items-center justify-end gap-1 mt-1">
                                                        <TrendingUp className="w-3 h-3 text-[#0ECB81]" />
                                                        <span className="text-[9px] font-bold text-[#0ECB81]">Live</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="py-16 text-center bg-bg-black/20 border border-dashed border-[#2B3139] rounded-xl">
                                                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest opacity-40">No ranking data detected</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-5">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                <Info className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h5 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-2">Protocol Status</h5>
                                                <p className="text-[10px] text-secondary font-bold leading-relaxed uppercase tracking-wider opacity-80">All operational nodes are synchronized with the central database. Security protocols active.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-binance min-h-full bg-bg-black text-[#EAECEF] font-sans flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-[#1E2329]/95 border-b border-[#2B3139] backdrop-blur-md px-4 sm:px-6 py-3">
                <div className="flex items-center justify-between max-w-full">
                    <div className="flex items-center gap-3">
                        <button onClick={handleSwitchTeam} className="p-1.5 hover:bg-[#2B3139] rounded-md transition-all text-secondary hover:text-primary border border-transparent hover:border-[#2B3139]" title="Back to Team Select">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="w-1 h-3 bg-primary rounded-full"></div>
                        <div>
                            <h2 className="text-sm font-bold tracking-wider uppercase leading-none">{selectedTeam}</h2>
                            <div className="flex items-center gap-2 text-[10px] text-secondary font-bold mt-1 uppercase tracking-wider">
                                <span className="text-primary">OPS</span>
                                <span className="opacity-30">|</span>
                                <span>Active Session</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasPermission('create_order') && (
                            <button onClick={handleCreateOrder} className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-[#f0c51d] text-bg-black rounded-md font-bold uppercase tracking-wider text-[11px] transition-all active:scale-95">
                                <Plus className="w-4 h-4" />
                                <span>{language === 'km' ? 'បង្កើតការកម្មង់' : 'Create Order'}</span>
                            </button>
                        )}
                        {userTeams && userTeams.length > 1 && (
                            <button onClick={handleSwitchTeam} className="p-2 bg-[#2B3139]/50 hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md transition-all border border-[#2B3139]" title="Switch Team">
                                <ArrowLeftRight className="w-4 h-4" />
                            </button>
                        )}
                        <button onClick={onBackToRoleSelect} className="p-2 bg-[#2B3139]/50 hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md transition-all border border-[#2B3139]" title="Switch Role">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 sm:p-6">
                <UserOrdersView onAdd={handleCreateOrder} />
            </div>
        </div>
    );
};

export default DesktopUserJourney;
