import React, { useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { useUrlState } from '../hooks/useUrlState';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, setChatVisibility, setMobilePageTitle, language, setAppState } = useContext(AppContext);
    const [selectedTeam, setSelectedTeam] = useUrlState<string>('team', '');
    const userTeams = useMemo(() => (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean), [currentUser]);
    const t = translations[language];

    useEffect(() => { setChatVisibility(true); }, [setChatVisibility]);
    useEffect(() => { if (userTeams.length === 1 && !selectedTeam) setSelectedTeam(userTeams[0]); }, [userTeams, selectedTeam, setSelectedTeam]);

    useEffect(() => {
        if (selectedTeam) setMobilePageTitle('OPERATIONS');
        else setMobilePageTitle(null);
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setMobilePageTitle]);

    const handleCreateOrder = () => {
        // App.tsx uses 'team' URL param for CreateOrderPage, 
        // which is already synced with selectedTeam here.
        setAppState('create_order');
    };

    if (userTeams.length === 0) return (
        <div className="flex items-center justify-center min-h-screen p-6">
            <div className="text-center p-12 max-w-lg w-full bg-white/[0.02] border border-white/5 rounded-[3rem] backdrop-blur-3xl shadow-2xl animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-4 italic">Identification Error</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-10">គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។</p>
                <button onClick={onBackToRoleSelect} className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors shadow-xl">{t.back}</button>
            </div>
        </div>
    );

    if (!selectedTeam) return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto py-12 px-4 sm:p-8 no-scrollbar">
            <style>{`
                @keyframes float { 0%, 100% { transform: translateY(0px) scale(1); opacity: 0.3; } 50% { transform: translateY(-20px) scale(1.1); opacity: 0.6; } }
                .glow-orb { position: absolute; border-radius: 50%; filter: blur(80px); z-index: 0; animation: float 10s infinite ease-in-out; }
                .portal-card-pro { 
                    background: rgba(255, 255, 255, 0.03); 
                    border: 1px solid rgba(255, 255, 255, 0.08); 
                    backdrop-filter: blur(20px);
                    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .portal-card-pro:hover { 
                    background: rgba(255, 255, 255, 0.06); 
                    border-color: rgba(255, 255, 255, 0.2);
                    transform: translateY(-8px) scale(1.02);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(59, 130, 246, 0.1);
                }
                .portal-card-pro:active { transform: translateY(-2px) scale(0.98); }
                .stagger-in { opacity: 0; transform: translateY(20px); animation: staggerIn 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
                @keyframes staggerIn { to { opacity: 1; transform: translateY(0); } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Dynamic Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="glow-orb w-[400px] h-[400px] bg-blue-600/20 -top-20 -left-20" style={{ animationDelay: '0s' }}></div>
                <div className="glow-orb w-[300px] h-[300px] bg-purple-600/20 bottom-20 -right-10" style={{ animationDelay: '-2s' }}></div>
                <div className="glow-orb w-[250px] h-[250px] bg-emerald-600/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '-5s' }}></div>
            </div>

            <div className="w-full max-w-4xl flex flex-col items-center relative z-10 my-auto">
                <div className="text-center space-y-4 mb-10 sm:mb-16 stagger-in" style={{ animationDelay: '0.1s' }}>
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-6 shadow-[0_0_20px_rgba(37,99,235,0.4)]"></div>
                        <p className="text-blue-500 font-black uppercase tracking-[0.5em] text-[9px] mb-2 opacity-80">Connected Node Portal</p>
                        <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tighter italic text-center uppercase leading-none">
                            Select <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Team</span>
                        </h2>
                    </div>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium tracking-widest uppercase opacity-40 max-w-md mx-auto">{t.role_subtext}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
                    {userTeams.map((team, idx) => (
                        <button 
                            key={team} 
                            onClick={() => setSelectedTeam(team)} 
                            className="portal-card-pro group relative overflow-hidden rounded-[1.5rem] p-5 flex flex-col gap-6 text-left stagger-in"
                            style={{ animationDelay: `${0.2 + (idx * 0.1)}s` }}
                        >
                            <div className="flex items-center justify-between relative z-10">
                                <div className="w-10 h-10 bg-gradient-to-br from-white/5 to-white/[0.01] rounded-xl flex items-center justify-center border border-white/10 group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:border-transparent transition-all duration-500 shadow-xl">
                                    <span className="text-lg font-black italic text-white group-hover:scale-110 transition-transform">{team.charAt(0)}</span>
                                </div>
                                <div className="p-2 rounded-full bg-white/5 border border-white/10 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-4 transition-all duration-500 shadow-inner">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                                </div>
                            </div>
                            
                            <div className="relative z-10">
                                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight leading-none mb-2 group-hover:text-blue-400 transition-colors">{team}</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">Operational Node 0{idx + 1}</p>
                                </div>
                            </div>

                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.07] pointer-events-none transition-opacity duration-700" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                            
                            {/* Hover Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 via-transparent to-indigo-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/10 transition-all duration-700"></div>
                        </button>
                    ))}
                </div>

                {currentUser?.IsSystemAdmin && (
                    <button 
                        onClick={onBackToRoleSelect} 
                        className="mt-12 text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] hover:text-white transition-all flex items-center gap-3 group px-6 py-3 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 stagger-in"
                        style={{ animationDelay: '0.5s' }}
                    >
                        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {t.change_team}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in flex flex-col min-h-screen">
            <style>{`
                .header-glass {
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .btn-create {
                    background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
                    box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
                }
                .btn-create:hover {
                    box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.5);
                    transform: translateY(-2px);
                }
            `}</style>

            {/* Modern Global Header */}
            <div className="flex-shrink-0 flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-base sm:text-xl font-black text-white tracking-tighter uppercase italic leading-none">Operational <span className="text-blue-500">Portal</span></h1>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">Node: {selectedTeam}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleCreateOrder} 
                        className="btn-create flex px-4 sm:px-8 py-2.5 sm:py-3 text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 items-center gap-2.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                        <span className="hidden sm:inline">Create New Order</span>
                        <span className="sm:hidden">Create</span>
                    </button>

                    {userTeams.length > 1 && (
                        <button 
                            onClick={() => setSelectedTeam('')} 
                            className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white rounded-2xl border border-white/5 active:scale-95 transition-all"
                        >
                            Switch
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex-1 h-auto"><UserOrdersView team={selectedTeam} onAdd={handleCreateOrder} /></div>
        </div>
    );
};

export default UserJourney;
