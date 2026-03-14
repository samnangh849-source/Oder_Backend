import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';
import { useSoundEffects } from '../hooks/useSoundEffects';

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, setChatVisibility, setMobilePageTitle, language, setAppState, selectedTeam, setSelectedTeam, hasPermission, originalAdminUser } = useContext(AppContext);
    const userTeams = useMemo(() => (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean), [currentUser]);
    const t = translations[language];
    const [mounted, setMounted] = useState(false);
    const { playClick, playTransition, playHover } = useSoundEffects();

    useEffect(() => { setMounted(true); setChatVisibility(true); }, [setChatVisibility]);
    useEffect(() => { if (userTeams.length === 1 && !selectedTeam) setSelectedTeam(userTeams[0]); }, [userTeams, selectedTeam, setSelectedTeam]);

    useEffect(() => {
        if (selectedTeam) setMobilePageTitle('OPERATIONS');
        else setMobilePageTitle(null);
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setMobilePageTitle]);

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

    const handleBack = () => {
        playClick();
        onBackToRoleSelect();
    };

    if (!hasPermission('access_sales_portal')) return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-[#020617]">
            <div className="text-center p-12 max-w-lg w-full bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-3xl shadow-2xl animate-fade-in">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-6 mx-auto">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4 italic uppercase tracking-tight">Access Denied</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-10">អ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់ផ្នែកនេះទេ។ សូមទាក់ទង Admin។</p>
                <button onClick={onBackToRoleSelect} className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors shadow-xl">{t.back}</button>
            </div>
        </div>
    );

    if (userTeams.length === 0) return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-[#020617]">
            <div className="text-center p-12 max-w-lg w-full bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-3xl shadow-2xl animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-4 italic">Identification Error</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-10">គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។</p>
                <button onClick={onBackToRoleSelect} className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors shadow-xl">{t.back}</button>
            </div>
        </div>
    );

    if (!selectedTeam) return (
        <div className="min-h-full w-full flex flex-col items-center justify-center relative font-['Kantumruy_Pro']">
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
                .team-btn:active { transform: scale(0.97); }
                
                .shimmer {
                    position: absolute;
                    top: 0; left: -100%;
                    width: 50%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
                    transition: 0.5s;
                }
                .team-btn:hover .shimmer { left: 100%; transition: 0.8s; }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
                    to { opacity: 1; transform: translateY(0); filter: blur(0); }
                }
                .animate-reveal { animation: fadeInUp 1s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
            `}</style>

            {/* Back Button - Top Left */}
            <div className="fixed top-4 left-4 z-50">
                <button 
                    onClick={handleBack}
                    onMouseEnter={playHover}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-full border border-white/5 transition-all active:scale-95 group"
                >
                    <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg>
                    <span className="text-[10px] font-black uppercase tracking-widest">{t.back}</span>
                </button>
            </div>

            <div className="w-full max-w-xl z-10 flex flex-col items-center px-6 gap-12 sm:gap-16 my-auto py-10">
                <div className="text-center animate-reveal" style={{ animationDelay: '0.1s' }}>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Operational Access</span>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 tracking-tighter leading-none italic uppercase">
                        Select Your <span className="text-blue-500">Team</span>
                    </h2>
                    <p className="text-white/30 text-xs sm:text-sm font-medium max-w-sm mx-auto leading-relaxed uppercase tracking-[0.1em]">
                        {t.team_desc}
                    </p>
                </div>

                <div className="w-full grid grid-cols-1 gap-4 animate-reveal" style={{ animationDelay: '0.3s' }}>
                    {userTeams.map((team, idx) => (
                        <button 
                            key={team}
                            onClick={() => handleTeamSelect(team)}
                            onMouseEnter={playHover}
                            className="team-btn group p-1 rounded-[2.5rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex items-center gap-5 p-5 sm:p-6 rounded-[2.4rem] bg-[#020617]/40 backdrop-blur-2xl border border-white/5 relative z-10">
                                <div className="w-16 h-16 shrink-0 rounded-3xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 flex items-center justify-center border border-white/10 group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    <span className="relative z-10 text-2xl font-black text-white italic tracking-tighter group-hover:scale-110 transition-transform">{team.charAt(0).toUpperCase()}</span>
                                </div>
                                
                                <div className="text-left min-w-0 flex-grow">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors truncate tracking-tight uppercase italic">{team}</h3>
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30 group-hover:bg-blue-500 transition-colors"></div>
                                    </div>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] group-hover:text-white/50 transition-colors">
                                        {language === 'km' ? 'ចូលទៅក្នុងប្រតិបត្តិការក្រុម' : 'Establish secure connection'}
                                    </p>
                                </div>

                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-500 active:scale-90">
                                    <svg className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5-5 5M6 7l5 5-5 5" /></svg>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Secure Footer */}
                <div className="animate-reveal opacity-20 hover:opacity-100 transition-opacity flex flex-col items-center gap-3" style={{ animationDelay: '0.6s' }}>
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <span className="text-[8px] text-white font-black uppercase tracking-[0.5em]">Enterprise Team 26.04-LTS</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-full mx-auto px-2 sm:px-4 py-2 sm:py-4 animate-fade-in flex flex-col min-h-screen">
            <style>{`
                .btn-create {
                    background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
                    box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
                }
                .btn-create:hover {
                    box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.5);
                    transform: translateY(-2px);
                }
            `}</style>

            {/* Action Bar - Integrates with Global Header */}
            <div className="flex-shrink-0 flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    <div>
                        <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-widest">{selectedTeam} <span className="text-gray-600 ml-1">Portal</span></h2>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasPermission('create_order') && (
                        <button 
                            onClick={handleCreateOrder} 
                            className="btn-create flex px-4 sm:px-6 py-2 sm:py-2.5 text-white rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] transition-all active:scale-95 items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                            <span>{language === 'km' ? 'បង្កើតការកម្មង់' : 'Create'}</span>
                        </button>
                    )}

                    {userTeams.length > 1 && (
                        <button 
                            onClick={handleSwitchTeam} 
                            className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all"
                        >
                            {language === 'km' ? 'ប្ដូរក្រុម' : 'Switch'}
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex-1 h-auto"><UserOrdersView onAdd={handleCreateOrder} /></div>
        </div>
    );
};

export default UserJourney;
