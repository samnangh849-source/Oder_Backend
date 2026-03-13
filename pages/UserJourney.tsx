import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, setChatVisibility, setMobilePageTitle, language, setAppState, selectedTeam, setSelectedTeam, hasPermission, originalAdminUser } = useContext(AppContext);
    const userTeams = useMemo(() => (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean), [currentUser]);
    const t = translations[language];
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); setChatVisibility(true); }, [setChatVisibility]);
    useEffect(() => { if (userTeams.length === 1 && !selectedTeam) setSelectedTeam(userTeams[0]); }, [userTeams, selectedTeam, setSelectedTeam]);

    useEffect(() => {
        if (selectedTeam) setMobilePageTitle('OPERATIONS');
        else setMobilePageTitle(null);
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setMobilePageTitle]);

    const handleCreateOrder = () => {
        if (!hasPermission('create_order')) return;
        setAppState('create_order');
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
        <div className="h-[100dvh] w-full flex flex-col bg-[#020617] relative overflow-hidden font-['Kantumruy_Pro']">
            <style>{`
                .tahoe-glass { 
                    background: rgba(255, 255, 255, 0.03); 
                    backdrop-filter: blur(60px) saturate(200%); 
                    border: 1px solid rgba(255, 255, 255, 0.08); 
                    box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.3);
                }
                .tahoe-card { 
                    transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                }
                .tahoe-card::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    padding: 1px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent 40%, transparent 60%, rgba(255,255,255,0.05));
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    pointer-events: none;
                }
                .tahoe-card:hover { 
                    background: rgba(255, 255, 255, 0.06); 
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
                }
                .tahoe-card:active { transform: scale(0.95); }
                
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px); filter: blur(20px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
                .animate-tahoe-in { animation: slideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                .mesh-gradient {
                    background-image: 
                        radial-gradient(at 0% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
                        radial-gradient(at 50% 0%, hsla(225,39%,20%,1) 0, transparent 50%), 
                        radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%);
                    filter: blur(80px);
                    opacity: 0.5;
                }

                .squircle {
                    border-radius: 22%; /* macOS icon radius approximation */
                }
            `}</style>

            {/* macOS Tahoe Mesh Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 mesh-gradient"></div>
                <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
            </div>

            {/* Simulated macOS Menu Bar */}
            <div className="h-7 sm:h-8 w-full px-4 sm:px-6 flex items-center justify-between z-20 bg-black/10 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-4">
                    <svg className="w-3.5 h-3.5 text-white/90" fill="currentColor" viewBox="0 0 16 16"><path d="M11.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zm1 0a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0z"/></svg>
                    <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">O-System</span>
                </div>
                <div className="flex items-center gap-4 opacity-40">
                    <div className="w-3 h-3 rounded-full border border-white/40"></div>
                    <div className="w-4 h-2 rounded-sm border border-white/40"></div>
                    <span className="text-[10px] font-bold text-white/80">26.3.1</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 z-10">
                <div className="w-full max-w-lg flex flex-col items-center gap-12 sm:gap-16">
                    
                    {/* Header Section */}
                    <div className="text-center animate-tahoe-in" style={{ animationDelay: '0.1s' }}>
                        <div className="relative inline-block mb-8">
                            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
                            <div className="w-16 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-400 to-blue-600 rounded-full relative z-10"></div>
                        </div>
                        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tighter leading-tight mb-4">
                            Operational <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/30">Team Selection</span>
                        </h2>
                        <p className="text-white/20 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.5em] mt-2">Enterprise Core Architecture</p>
                    </div>

                    {/* Team Grid - Adaptive for Mobile (No Scroll) */}
                    <div className={`w-full grid ${userTeams.length > 3 ? 'grid-cols-2' : 'grid-cols-1'} gap-4 sm:gap-6 animate-tahoe-in`} style={{ animationDelay: '0.2s' }}>
                        {userTeams.map((team, idx) => (
                            <button 
                                key={team} 
                                onClick={() => setSelectedTeam(team)} 
                                className="tahoe-glass tahoe-card flex items-center gap-4 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] group"
                            >
                                <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 squircle bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-white border border-white/10 group-hover:border-blue-400/50 transition-all duration-700 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                    <span className="relative z-10 text-xl sm:text-2xl font-black italic tracking-tighter">{team.charAt(0)}</span>
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <h3 className="text-sm sm:text-lg font-bold text-white group-hover:text-blue-200 transition-colors tracking-tight truncate">{team}</h3>
                                    <p className="text-[9px] sm:text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Team 0{idx + 1}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Back Link */}
                    <div className="animate-tahoe-in" style={{ animationDelay: '0.4s' }}>
                        <button 
                            onClick={onBackToRoleSelect} 
                            className="group flex items-center gap-3 text-white/20 hover:text-white/80 text-[10px] font-bold uppercase tracking-[0.4em] transition-all py-3 px-8 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
                        >
                            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {t.back_to_role}
                        </button>
                    </div>
                </div>
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
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">Team: {selectedTeam}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasPermission('create_order') && (
                        <button 
                            onClick={handleCreateOrder} 
                            className="btn-create flex px-4 sm:px-8 py-2.5 sm:py-3 text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 items-center gap-2.5"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4"/></svg>
                            <span className="hidden sm:inline">Create New Order</span>
                            <span className="sm:hidden">Create</span>
                        </button>
                    )}

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
            
            <div className="flex-1 h-auto"><UserOrdersView onAdd={handleCreateOrder} /></div>
        </div>
    );
};

export default UserJourney;
