
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';

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
    const { playClick, playTransition, playHover } = useSoundEffects();

    useEffect(() => { setChatVisibility(true); }, [setChatVisibility]);

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
                `}</style>
                <div className="w-full max-w-xl flex flex-col items-center px-6 gap-12">
                    <div className="text-center">
                        <h2 className="text-5xl font-black text-white mb-4 italic uppercase tracking-tighter">Select Your <span className="text-blue-500">Team</span></h2>
                        <p className="text-white/30 text-sm font-medium max-w-sm mx-auto uppercase tracking-widest">{t.team_desc}</p>
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
                    {userTeams.length > 1 && (
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
