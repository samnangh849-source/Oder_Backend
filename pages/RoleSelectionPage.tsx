import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import UserAvatar from '../components/common/UserAvatar';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';
import { translations } from '../translations';
import { useSoundEffects } from '../hooks/useSoundEffects';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey' | 'fulfillment') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    const { currentUser, hasPermission, logout, language } = useContext(AppContext);
    const [mounted, setMounted] = useState(false);
    const { playClick, playTransition, playHover } = useSoundEffects();

    const t = translations[language];

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!currentUser) return null;

    const userRoles = (currentUser.Role || '').split(',').map(r => r.trim().toLowerCase());
    const isInternalAdmin = currentUser.IsSystemAdmin || userRoles.includes('admin');
    
    const showAdmin = isInternalAdmin || hasPermission('view_admin_dashboard');
    const showFulfillment = hasPermission('access_fulfillment');
    const showSales = hasPermission('access_sales_portal');
    const showEntertainment = isInternalAdmin || hasPermission('view_entertainment');

    const visibleCount = (showAdmin ? 1 : 0) + (showFulfillment ? 1 : 0) + (showSales ? 1 : 0) + (showEntertainment ? 1 : 0);

    const handleUserPortalClick = () => {
        playTransition();
        onSelect('user_journey');
    };

    const handleAdminClick = () => {
        playTransition();
        onSelect('admin_dashboard');
    };

    const handleFulfillmentClick = () => {
        playTransition();
        onSelect('fulfillment');
    };

    const handleEntertainmentClick = () => {
        playTransition();
        onSelect('entertainment' as any);
    };

    return (
        <div className="min-h-full w-full flex flex-col items-center justify-center relative font-['Kantumruy_Pro'] py-12">
            <style>{`
                .selection-btn {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .selection-btn:hover {
                    background: rgba(255, 255, 255, 0.07);
                    border-color: rgba(255, 255, 255, 0.15);
                    transform: translateY(-4px) scale(1.01);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                }
                .selection-btn:active { transform: scale(0.97); }
                
                .shimmer {
                    position: absolute;
                    top: 0; left: -100%;
                    width: 50%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
                    transition: 0.5s;
                }
                .selection-btn:hover .shimmer { left: 100%; transition: 0.8s; }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
                    to { opacity: 1; transform: translateY(0); filter: blur(0); }
                }
                .animate-reveal { animation: fadeInUp 1s cubic-bezier(0.23, 1, 0.32, 1) forwards; }

                .glass-avatar-premium {
                    padding: 6px;
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
            `}</style>

            <div className="w-full max-w-xl z-10 flex flex-col items-center px-6 gap-10 sm:gap-12 my-auto py-10">
                
                {/* Profile Header Section - Premium Style */}
                <div className="flex flex-col items-center animate-reveal" style={{ animationDelay: '0.1s' }}>
                    <div className="relative mb-6 group">
                        <div className="glass-avatar-premium transition-transform duration-500 group-hover:scale-105">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-white/10 shadow-2xl relative z-10">
                                <UserAvatar 
                                    avatarUrl={currentUser.ProfilePictureURL} 
                                    name={currentUser.FullName} 
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            </div>
                        </div>
                        <div className="absolute bottom-1 right-1 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 border-4 border-[#020617] rounded-full shadow-lg z-20 animate-pulse"></div>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter mb-1 uppercase italic">
                            {currentUser.FullName}
                        </h1>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">
                                {currentUser.Role || (language === 'km' ? 'អ្នកប្រើប្រាស់' : 'System User')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Subtitle Section */}
                <div className="text-center animate-reveal" style={{ animationDelay: '0.2s' }}>
                    <h2 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tighter leading-none italic uppercase">
                        Select Your <span className="text-blue-500">Access</span>
                    </h2>
                    <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">{t.role_subtext}</p>
                </div>

                <div className="w-full grid grid-cols-1 gap-4 animate-reveal" style={{ animationDelay: '0.3s' }}>
                    {showAdmin && (
                        <button 
                            onClick={handleAdminClick}
                            onMouseEnter={playHover}
                            className="selection-btn group p-1 rounded-[2rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex items-center gap-4 p-4 sm:p-5 rounded-[1.9rem] bg-[#020617]/40 backdrop-blur-2xl border border-white/5 relative z-10">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-white/10 group-hover:bg-blue-600 transition-all duration-500 shadow-2xl">
                                    <svg className="w-7 h-7 text-blue-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors uppercase italic tracking-tight">{t.enter_admin}</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest truncate">{t.admin_desc}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all">
                                    <svg className="w-4 h-4 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showFulfillment && (
                        <button 
                            onClick={handleFulfillmentClick}
                            onMouseEnter={playHover}
                            className="selection-btn group p-1 rounded-[2rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex items-center gap-4 p-4 sm:p-5 rounded-[1.9rem] bg-[#020617]/40 backdrop-blur-2xl border border-white/5 relative z-10">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-amber-600/20 flex items-center justify-center border border-white/10 group-hover:bg-amber-600 transition-all duration-500 shadow-2xl">
                                    <svg className="w-7 h-7 text-amber-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors uppercase italic tracking-tight">{language === 'km' ? 'វេចខ្ចប់ & ដឹកជញ្ជូន' : 'Fulfillment Ops'}</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest truncate">{language === 'km' ? 'រៀបចំទំនិញ និងបញ្ជូនឥវ៉ាន់' : 'Warehouse & Logistics'}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-amber-600 transition-all">
                                    <svg className="w-4 h-4 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showSales && (
                        <button 
                            onClick={handleUserPortalClick}
                            onMouseEnter={playHover}
                            className="selection-btn group p-1 rounded-[2rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex items-center gap-4 p-4 sm:p-5 rounded-[1.9rem] bg-[#020617]/40 backdrop-blur-2xl border border-white/5 relative z-10">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-white/10 group-hover:bg-emerald-600 transition-all duration-500 shadow-2xl">
                                    <svg className="w-7 h-7 text-emerald-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <h3 className="text-base font-black text-white group-hover:text-emerald-400 transition-colors uppercase italic tracking-tight">{t.enter_user}</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest truncate">{t.user_desc}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-emerald-600 transition-all">
                                    <svg className="w-4 h-4 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showEntertainment && (
                        <button 
                            onClick={handleEntertainmentClick}
                            onMouseEnter={playHover}
                            className="selection-btn group p-1 rounded-[2rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex items-center gap-4 p-4 sm:p-5 rounded-[1.9rem] bg-[#020617]/40 backdrop-blur-2xl border border-white/5 relative z-10">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-red-600/20 flex items-center justify-center border border-white/10 group-hover:bg-red-600 transition-all duration-500 shadow-2xl">
                                    <svg className="w-7 h-7 text-red-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <h3 className="text-base font-black text-white group-hover:text-red-400 transition-colors uppercase italic tracking-tight">{t.entertainment}</h3>
                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest truncate">{t.entertainment_desc}</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-red-600 transition-all">
                                    <svg className="w-4 h-4 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                {/* Secure Footer */}
                <div className="animate-reveal opacity-20 hover:opacity-100 transition-opacity flex flex-col items-center gap-3" style={{ animationDelay: '0.6s' }}>
                    {!visibleCount && (
                        <p className="text-red-400 text-[10px] font-black uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-full mb-2">
                            {t.no_data}
                        </p>
                    )}
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <div className="inline-flex items-center gap-2">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-3 h-3 grayscale invert" />
                        <span className="text-[8px] text-white font-black uppercase tracking-[0.5em]">O-System Core 26.04-LTS</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelectionPage;
