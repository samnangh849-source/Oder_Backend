
import React, { useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';

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
    const { playClick, playTransition } = useSoundEffects();

    useEffect(() => { 
        setChatVisibility(true); 
        if (selectedTeam) setMobilePageTitle('OPERATIONS');
        else setMobilePageTitle(null);
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setChatVisibility, setMobilePageTitle]);

    const handleCreateOrder = () => {
        if (!hasPermission('create_order')) return;
        playClick();
        setAppState('create_order');
    };

    const handleTeamSelect = (team: string) => {
        playTransition();
        setSelectedTeam(team);
    };

    const handleSwitchTeam = () => {
        playClick();
        setSelectedTeam('');
    };

    if (!selectedTeam) {
        return (
            <div className="min-h-full w-full flex flex-col items-center justify-start p-6 bg-[#020617] relative overflow-hidden">
                {/* Dynamic Background Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-[-5%] left-[-5%] w-[60%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                
                <div className="w-full max-w-sm flex flex-col items-center gap-10 pt-16 pb-10 relative z-10">
                    <div className="text-center space-y-5 animate-fade-in-up">
                        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/10 backdrop-blur-md">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <span className="text-[9px] font-black text-blue-400/80 uppercase tracking-[0.3em]">Operational Access</span>
                        </div>
                        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
                            Select <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500">Team</span>
                        </h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed opacity-60">Choose your operational unit to begin processing orders</p>
                    </div>

                    <div className="w-full grid grid-cols-1 gap-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        {userTeams.map((team, idx) => {
                            const colors = [
                                'from-blue-600 to-blue-400',
                                'from-indigo-600 to-purple-500',
                                'from-cyan-600 to-blue-500',
                                'from-violet-600 to-indigo-500'
                            ];
                            const gradient = colors[idx % colors.length];
                            
                            return (
                                <button 
                                    key={team}
                                    onClick={() => handleTeamSelect(team)}
                                    className="group relative p-[1px] rounded-[2.5rem] bg-gradient-to-b from-white/10 to-transparent active:scale-95 transition-all duration-500 shadow-2xl"
                                >
                                    <div className="relative flex items-center gap-5 p-5 rounded-[2.45rem] bg-[#0f172a]/40 backdrop-blur-3xl overflow-hidden border border-white/5">
                                        {/* Internal Glow */}
                                        <div className={`absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`}></div>
                                        
                                        <div className={`w-16 h-16 rounded-[1.5rem] bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-white italic text-2xl shadow-xl shadow-blue-900/20 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500`}>
                                            {team.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="text-left flex-grow">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-black text-white uppercase italic tracking-tight group-hover:text-blue-400 transition-colors">{team}</h3>
                                                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                            </div>
                                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] mt-1">Ready for Orders</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all text-gray-700">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5M6 7l5 5-5 5" /></svg>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <button 
                        onClick={onBackToRoleSelect}
                        className="mt-4 flex items-center gap-3 px-10 py-4 bg-white/[0.03] text-gray-500 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.25em] border border-white/5 active:scale-90 transition-all hover:text-gray-300"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                        {t.back}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full animate-fade-in pb-20">
            {/* Mobile Action Header */}
            <div className="px-4 py-4 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{selectedTeam}</span>
                </div>
                
                <div className="flex items-center gap-2">
                    {userTeams.length > 1 && (
                        <button onClick={handleSwitchTeam} className="p-2 bg-white/5 rounded-xl text-gray-500 active:scale-90 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </button>
                    )}
                    <button onClick={onBackToRoleSelect} className="p-2 bg-white/5 rounded-xl text-blue-400 active:scale-90 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>

            {/* Mobile Content Area */}
            <div className="flex-1 px-1">
                <UserOrdersView onAdd={handleCreateOrder} />
            </div>

            {/* Floating Create Button for Mobile */}
            {hasPermission('create_order') && (
                <div className="fixed bottom-24 right-6 z-40">
                    <button 
                        onClick={handleCreateOrder}
                        className="w-16 h-16 bg-blue-600 rounded-2xl shadow-[0_15px_30px_rgba(37,99,235,0.4)] flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 animate-bounce"
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default MobileUserJourney;
