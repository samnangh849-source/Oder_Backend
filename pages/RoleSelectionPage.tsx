import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import UserAvatar from '../components/common/UserAvatar';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';
import { translations } from '../translations';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey' | 'fulfillment') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    const { currentUser, hasPermission, logout, language, setSelectedTeam } = useContext(AppContext);
    const [mounted, setMounted] = useState(false);
    const [showTeamSelection, setShowTeamSelection] = useState(false);

    const t = translations[language];

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!currentUser) return null;

    const userRoles = (currentUser.Role || '').split(',').map(r => r.trim().toLowerCase());
    const userTeams = (currentUser.Team || '').split(',').map(t => t.trim()).filter(t => t);
    const isInternalAdmin = currentUser.IsSystemAdmin || userRoles.includes('admin');
    
    const showAdmin = isInternalAdmin;
    const showFulfillment = hasPermission('access_fulfillment');
    const showSales = hasPermission('access_sales_portal');

    const visibleCount = (showAdmin ? 1 : 0) + (showFulfillment ? 1 : 0) + (showSales ? 1 : 0);

    const handleUserPortalClick = () => {
        if (userTeams.length > 1) {
            setShowTeamSelection(true);
        } else {
            if (userTeams.length === 1) {
                setSelectedTeam(userTeams[0]);
            }
            onSelect('user_journey');
        }
    };

    const handleTeamSelect = (team: string) => {
        setSelectedTeam(team);
        onSelect('user_journey');
    };

    if (showTeamSelection) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020617] relative overflow-hidden font-['Kantumruy_Pro']">
                {/* macOS Tahoe Dynamic Background */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[70%] bg-[#1e40af]/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[60%] bg-[#701a75]/20 rounded-full blur-[120px]" style={{ animationDelay: '3s' }}></div>
                    <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-[#0ea5e9]/10 rounded-full blur-[100px]" style={{ animationDelay: '1s' }}></div>
                </div>

                {/* Back Button */}
                <div className="fixed top-0 left-0 right-0 h-10 px-6 flex items-center justify-start z-50">
                    <button 
                        onClick={() => setShowTeamSelection(false)}
                        className="text-white/40 hover:text-white/90 text-xs font-medium transition-all active:scale-95 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg>
                        {language === 'km' ? 'ត្រឡប់ក្រោយ' : 'Back'}
                    </button>
                </div>

                <style>{`
                    .tahoe-glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); }
                    .tahoe-card { transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
                    .tahoe-card:active { transform: scale(0.94); background: rgba(255, 255, 255, 0.08); }
                    @keyframes slideIn { from { opacity: 0; transform: translateY(20px); filter: blur(10px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
                    .animate-tahoe { animation: slideIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                `}</style>

                <div className="w-full max-w-lg z-10 flex flex-col items-center px-6 gap-8 animate-tahoe">
                    <div className="text-center">
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{t.select_team_to_continue}</h2>
                        <p className="text-white/40 text-xs sm:text-sm">{t.team_desc}</p>
                    </div>

                    <div className="w-full grid grid-cols-1 gap-3">
                        {userTeams.map((team, idx) => (
                            <button 
                                key={team}
                                onClick={() => handleTeamSelect(team)}
                                className="tahoe-glass tahoe-card flex items-center gap-4 p-5 rounded-2xl group overflow-hidden relative border border-white/5 hover:border-white/20"
                                style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
                            >
                                <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner font-bold text-sm">
                                    {team.charAt(0).toUpperCase()}
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <h3 className="text-base font-bold text-white/90">{team}</h3>
                                    <p className="text-[10px] text-white/30 font-medium">{language === 'km' ? 'ចូលទៅក្នុងប្រតិបត្តិការក្រុម' : 'Enter team operations'}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                    <svg className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} /></svg>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020617] relative overflow-hidden font-['Kantumruy_Pro']">
            {/* macOS Tahoe Dynamic Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[100%] h-[70%] bg-[#1e40af]/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[60%] bg-[#701a75]/20 rounded-full blur-[120px]" style={{ animationDelay: '3s' }}></div>
                <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-[#0ea5e9]/10 rounded-full blur-[100px]" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Logout - Top Right (macOS Menu Bar Style) */}
            <div className="fixed top-0 left-0 right-0 h-8 sm:h-10 px-4 flex items-center justify-end z-50">
                <button 
                    onClick={logout}
                    className="text-white/40 hover:text-white/90 text-[10px] sm:text-xs font-medium transition-all active:scale-95"
                >
                    {t.logout}
                </button>
            </div>

            <style>{`
                .tahoe-glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); }
                .tahoe-card { transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
                .tahoe-card:active { transform: scale(0.94); background: rgba(255, 255, 255, 0.08); }
                
                /* Advanced Profile Glass Frame */
                .glass-avatar-frame {
                    position: relative;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border-radius: 50%;
                    border: 1.5px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 
                        0 20px 40px rgba(0,0,0,0.4),
                        inset 0 0 20px rgba(255,255,255,0.05);
                }
                .glass-avatar-frame::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    padding: 1.5px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.4), transparent 40%, transparent 60%, rgba(255,255,255,0.1));
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    pointer-events: none;
                }
                .avatar-reflection {
                    position: absolute;
                    top: 15%;
                    left: 15%;
                    width: 30%;
                    height: 15%;
                    background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
                    border-radius: 50%;
                    transform: rotate(-45deg);
                    filter: blur(4px);
                    pointer-events: none;
                    z-index: 30;
                }

                @keyframes slideIn { from { opacity: 0; transform: translateY(20px); filter: blur(10px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
                .animate-tahoe { animation: slideIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
            `}</style>

            <div className="w-full max-w-lg z-10 flex flex-col items-center px-6 gap-10 sm:gap-16">
                
                {/* 1. macOS User Profile Section with Glass Frame */}
                <div className="flex flex-col items-center animate-tahoe" style={{ animationDelay: '0.1s' }}>
                    <div className="relative mb-6">
                        <div className="glass-avatar-frame group transition-transform duration-500 hover:scale-105">
                            <div className="avatar-reflection"></div>
                            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden shadow-inner relative z-10 border border-black/20">
                                <UserAvatar 
                                    avatarUrl={currentUser.ProfilePictureURL} 
                                    name={currentUser.FullName} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            </div>
                        </div>
                        {/* Status Indicator */}
                        <div className="absolute bottom-2 right-2 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 border-4 border-[#020617] rounded-full shadow-lg z-40"></div>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
                            {currentUser.FullName}
                        </h1>
                        <p className="text-white/40 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em]">
                            {currentUser.Role || (language === 'km' ? 'អ្នកប្រើប្រាស់ប្រព័ន្ធ' : 'System User')}
                        </p>
                    </div>
                </div>

                {/* 2. Role Selector (macOS Dock/Control Center Style) */}
                <div className={`w-full grid grid-cols-1 gap-3 sm:gap-4 animate-tahoe`} style={{ animationDelay: '0.3s' }}>
                    {showAdmin && (
                        <button 
                            onClick={() => onSelect('admin_dashboard')}
                            className="tahoe-glass tahoe-card flex items-center gap-4 p-4 rounded-2xl group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                            </div>
                            <div className="text-left min-w-0 flex-grow">
                                <h3 className="text-sm font-bold text-white/90">{t.enter_admin}</h3>
                                <p className="text-[10px] text-white/30 font-medium truncate">{t.admin_desc}</p>
                            </div>
                            <svg className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} /></svg>
                        </button>
                    )}

                    {showFulfillment && (
                        <button 
                            onClick={() => onSelect('fulfillment')}
                            className="tahoe-glass tahoe-card flex items-center gap-4 p-4 rounded-2xl group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                            <div className="text-left min-w-0 flex-grow">
                                <h3 className="text-sm font-bold text-white/90">{language === 'km' ? 'វេចខ្ចប់ & ដឹកជញ្ជូន' : 'Fulfillment & Ops'}</h3>
                                <p className="text-[10px] text-white/30 font-medium truncate">{language === 'km' ? 'រៀបចំទំនិញ ស្កេនបាកូដ និងបញ្ជូនឥវ៉ាន់' : 'Packaging & Warehouse Ops'}</p>
                            </div>
                            <svg className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} /></svg>
                        </button>
                    )}

                    {showSales && (
                        <button 
                            onClick={handleUserPortalClick}
                            className="tahoe-glass tahoe-card flex items-center gap-4 p-4 rounded-2xl group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            </div>
                            <div className="text-left min-w-0 flex-grow">
                                <h3 className="text-sm font-bold text-white/90">{t.enter_user}</h3>
                                <p className="text-[10px] text-white/30 font-medium truncate">{t.user_desc}</p>
                            </div>
                            <svg className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} /></svg>
                        </button>
                    )}
                </div>

                {/* Footer Section */}
                <div className="text-center animate-tahoe" style={{ animationDelay: '0.6s' }}>
                    {!visibleCount && (
                        <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full mb-6">
                            {t.no_data}
                        </p>
                    )}
                    <div className="inline-flex items-center gap-2 opacity-20 hover:opacity-50 transition-opacity">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-3.5 h-3.5 grayscale invert" />
                        <span className="text-[8px] text-white font-bold uppercase tracking-[0.3em]">O-System Core Engine</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelectionPage;
