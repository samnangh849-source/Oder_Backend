import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import UserAvatar from '../components/common/UserAvatar';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { APP_LOGO_URL } from '../constants';
import { translations } from '../translations';

interface RoleSelectionPageProps {
    onSelect: (role: 'admin_dashboard' | 'user_journey' | 'fulfillment' | 'cambodia_map' | 'entertainment' | 'promotions') => void;
}

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelect }) => {
    const { currentUser, hasPermission, logout, language } = useContext(AppContext);
    const [mounted, setMounted] = useState(false);

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
    const showPromotions = isInternalAdmin || hasPermission('view_promotions');

    const visibleCount = (showAdmin ? 1 : 0) + (showFulfillment ? 1 : 0) + (showSales ? 1 : 0) + (showEntertainment ? 1 : 0) + (showPromotions ? 1 : 0) + 1; // +1 for Cambodia Map (always visible)

    const handleUserPortalClick = () => {
        onSelect('user_journey');
    };

    const handleAdminClick = () => {
        onSelect('admin_dashboard');
    };

    const handleFulfillmentClick = () => {
        onSelect('fulfillment');
    };

    const handleEntertainmentClick = () => {
        onSelect('entertainment' as any);
    };

    const handlePromotionClick = () => {
        onSelect('promotions');
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-start lg:justify-center relative font-['Kantumruy_Pro'] overflow-y-auto custom-scrollbar bg-[#050505] p-4 sm:p-6 lg:p-8">
            {/* Background Aesthetic Elements */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] lg:blur-[160px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[120px] lg:blur-[160px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]"></div>
            </div>

            <style>{`
                .selection-btn {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(20px);
                    transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .selection-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.25);
                    transform: translateY(-6px) scale(1.02);
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }
                .selection-btn:active { 
                    transform: scale(0.97) translateY(-2px);
                    background: rgba(255, 255, 255, 0.12);
                }
                
                .shimmer {
                    position: absolute;
                    top: 0; left: -100%;
                    width: 50%; height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
                    transition: 0.6s;
                }
                .selection-btn:hover .shimmer { left: 100%; transition: 0.8s; }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); filter: blur(10px); }
                    to { opacity: 1; transform: translateY(0); filter: blur(0); }
                }
                .animate-reveal { animation: fadeInUp 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

                .glass-avatar-premium {
                    padding: 6px;
                    background: rgba(255, 255, 255, 0.02);
                    backdrop-filter: blur(25px);
                    border-radius: 50%;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }

                .logout-btn {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    backdrop-filter: blur(12px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .logout-btn:hover { 
                    background: rgba(239, 68, 68, 0.1); 
                    border-color: rgba(239, 68, 68, 0.3); 
                    color: #fca5a5; 
                    transform: translateY(-2px);
                }
            `}</style>

            {/* Top Bar - Fixed Navigation */}
            <div className="absolute top-6 right-6 lg:top-10 lg:right-12 z-50 animate-reveal" style={{ animationDelay: '0.1s' }}>
                <button 
                    onClick={logout}
                    className="logout-btn flex items-center gap-2 px-5 py-2.5 rounded-full text-white/70 text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] shadow-lg"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className="hidden sm:inline">{t.logout}</span>
                </button>
            </div>

            <div className="w-full max-w-6xl 2xl:max-w-7xl z-10 flex flex-col items-center gap-8 lg:gap-14 py-12 lg:py-0">
                
                {/* Profile Header Section */}
                <div className="flex flex-col items-center animate-reveal shrink-0" style={{ animationDelay: '0.15s' }}>
                    <div className="relative mb-6 lg:mb-8 group">
                        <div className="glass-avatar-premium transition-all duration-1000 group-hover:scale-105 group-hover:border-white/30">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 2xl:w-40 2xl:h-40 rounded-full overflow-hidden border border-white/10 shadow-2xl relative z-10 bg-[#0a0a0a]">
                                <UserAvatar 
                                    avatarUrl={currentUser.ProfilePictureURL} 
                                    name={currentUser.FullName} 
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                />
                            </div>
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 lg:bottom-2 lg:right-2 w-5 h-5 lg:w-7 lg:h-7 bg-emerald-500 border-[3.5px] lg:border-[5px] border-[#050505] rounded-full shadow-xl z-20 animate-pulse"></div>
                    </div>
                    <div className="text-center px-4">
                        <h1 className="text-2xl sm:text-3xl lg:text-5xl 2xl:text-6xl font-black text-white tracking-tighter mb-2 lg:mb-3 uppercase italic leading-none">
                            {currentUser.FullName}
                        </h1>
                        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 lg:px-6 lg:py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[10px] lg:text-[11px] 2xl:text-[12px] font-black text-blue-400 uppercase tracking-[0.3em]">
                                {currentUser.Role || (language === 'km' ? 'អ្នកប្រើប្រាស់' : 'System User')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Subtitle Section */}
                <div className="text-center animate-reveal shrink-0 px-4" style={{ animationDelay: '0.25s' }}>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl 2xl:text-6xl font-black text-white mb-2 lg:mb-3 tracking-tighter leading-none italic uppercase">
                        Select <span className="text-blue-500">Access</span>
                    </h2>
                    <p className="text-white/20 text-[10px] lg:text-[12px] font-bold uppercase tracking-[0.4em] lg:tracking-[0.5em]">{t.role_subtext}</p>
                </div>

                {/* Grid Layout - Optimized for tall screens and Xiaomi 12T Pro */}
                <div className="w-full grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 animate-reveal px-2 sm:px-0" style={{ animationDelay: '0.35s' }}>
                    {showAdmin && (
                        <button 
                            onClick={handleAdminClick}
                            className="selection-btn group p-0.5 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-[1.4rem] lg:rounded-[2.4rem] bg-[#0a0a0a]/40 relative z-10 h-full">
                                <div className="w-12 h-12 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 shrink-0 rounded-2xl lg:rounded-3xl bg-blue-600/10 flex items-center justify-center border border-white/5 group-hover:bg-blue-600 transition-all duration-700 shadow-2xl">
                                    <svg className="w-6 h-6 lg:w-8 lg:h-8 2xl:w-10 2xl:h-10 text-blue-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                                </div>
                                <div className="text-center sm:text-left min-w-0 flex-grow">
                                    <h3 className="text-xs sm:text-sm lg:text-lg 2xl:text-2xl font-black text-white group-hover:text-blue-400 transition-colors uppercase italic tracking-tight leading-tight">{t.enter_admin}</h3>
                                    <p className="hidden lg:block text-[10px] 2xl:text-[11px] text-white/30 font-bold uppercase tracking-widest truncate mt-1">{t.admin_desc}</p>
                                </div>
                                <div className="hidden xl:flex w-10 h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-xl bg-white/5 items-center justify-center group-hover:bg-blue-600 transition-all">
                                    <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showFulfillment && (
                        <button 
                            onClick={handleFulfillmentClick}
                            className="selection-btn group p-0.5 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-[1.4rem] lg:rounded-[2.4rem] bg-[#0a0a0a]/40 relative z-10 h-full">
                                <div className="w-12 h-12 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 shrink-0 rounded-2xl lg:rounded-3xl bg-amber-600/10 flex items-center justify-center border border-white/5 group-hover:bg-amber-600 transition-all duration-700 shadow-2xl">
                                    <svg className="w-6 h-6 lg:w-8 lg:h-8 2xl:w-10 2xl:h-10 text-amber-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                </div>
                                <div className="text-center sm:text-left min-w-0 flex-grow">
                                    <h3 className="text-xs sm:text-sm lg:text-lg 2xl:text-2xl font-black text-white group-hover:text-amber-400 transition-colors uppercase italic tracking-tight leading-tight">{language === 'km' ? 'វេចខ្ចប់' : 'Fulfillment'}</h3>
                                    <p className="hidden lg:block text-[10px] 2xl:text-[11px] text-white/30 font-bold uppercase tracking-widest truncate mt-1">{language === 'km' ? 'រៀបចំទំនិញ និងបញ្ជូនឥវ៉ាន់' : 'Warehouse & Logistics'}</p>
                                </div>
                                <div className="hidden xl:flex w-10 h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-xl bg-white/5 items-center justify-center group-hover:bg-amber-600 transition-all">
                                    <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showSales && (
                        <button 
                            onClick={handleUserPortalClick}
                            className="selection-btn group p-0.5 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-[1.4rem] lg:rounded-[2.4rem] bg-[#0a0a0a]/40 relative z-10 h-full">
                                <div className="w-12 h-12 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 shrink-0 rounded-2xl lg:rounded-3xl bg-emerald-600/10 flex items-center justify-center border border-white/5 group-hover:bg-emerald-600 transition-all duration-700 shadow-2xl">
                                    <svg className="w-6 h-6 lg:w-8 lg:h-8 2xl:w-10 2xl:h-10 text-emerald-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                </div>
                                <div className="text-center sm:text-left min-w-0 flex-grow">
                                    <h3 className="text-xs sm:text-sm lg:text-lg 2xl:text-2xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase italic tracking-tight leading-tight">{t.enter_user}</h3>
                                    <p className="hidden lg:block text-[10px] 2xl:text-[11px] text-white/30 font-bold uppercase tracking-widest truncate mt-1">{t.user_desc}</p>
                                </div>
                                <div className="hidden xl:flex w-10 h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-xl bg-white/5 items-center justify-center group-hover:bg-emerald-600 transition-all">
                                    <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showEntertainment && (
                        <button 
                            onClick={handleEntertainmentClick}
                            className="selection-btn group p-0.5 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-[1.4rem] lg:rounded-[2.4rem] bg-[#0a0a0a]/40 relative z-10 h-full">
                                <div className="w-12 h-12 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 shrink-0 rounded-2xl lg:rounded-3xl bg-red-600/10 flex items-center justify-center border border-white/5 group-hover:bg-red-600 transition-all duration-700 shadow-2xl">
                                    <svg className="w-6 h-6 lg:w-8 lg:h-8 2xl:w-10 2xl:h-10 text-red-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <div className="text-center sm:text-left min-w-0 flex-grow">
                                    <h3 className="text-xs sm:text-sm lg:text-lg 2xl:text-2xl font-black text-white group-hover:text-red-400 transition-colors uppercase italic tracking-tight leading-tight">{language === 'km' ? 'កម្សាន្ត' : 'Entertainment'}</h3>
                                    <p className="hidden lg:block text-[10px] 2xl:text-[11px] text-white/30 font-bold uppercase tracking-widest truncate mt-1">{t.entertainment_desc}</p>
                                </div>
                                <div className="hidden xl:flex w-10 h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-xl bg-white/5 items-center justify-center group-hover:bg-red-600 transition-all">
                                    <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    {showPromotions && (
                        <button 
                            onClick={handlePromotionClick}
                            className="selection-btn group p-0.5 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden"
                        >
                            <div className="shimmer"></div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-[1.4rem] lg:rounded-[2.4rem] bg-[#0a0a0a]/40 relative z-10 h-full">
                                <div className="w-12 h-12 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 shrink-0 rounded-2xl lg:rounded-3xl bg-indigo-600/10 flex items-center justify-center border border-white/5 group-hover:bg-indigo-600 transition-all duration-700 shadow-2xl">
                                    <svg className="w-6 h-6 lg:w-8 lg:h-8 2xl:w-10 2xl:h-10 text-indigo-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M11 5.882V19.297A1.703 1.703 0 018.919 20.84l-5.066-2.533A1.703 1.703 0 013 16.784V4.703A1.703 1.703 0 015.081 3.16l5.066 2.533A1.703 1.703 0 0111 5.882zM11 5.882c0-.52.27-.999.71-1.272l5.066-3.132A1.703 1.703 0 0119.5 3.033v12.081c0 .52-.27.999-.71 1.272l-5.066 3.132A1.703 1.703 0 0111 18.118V5.882z" /></svg>
                                </div>
                                <div className="text-center sm:text-left min-w-0 flex-grow">
                                    <h3 className="text-xs sm:text-sm lg:text-lg 2xl:text-2xl font-black text-white group-hover:text-indigo-400 transition-colors uppercase italic tracking-tight leading-tight">{language === 'km' ? 'ប្រម៉ូសិន' : 'Promotions'}</h3>
                                    <p className="hidden lg:block text-[10px] 2xl:text-[11px] text-white/30 font-bold uppercase tracking-widest truncate mt-1">{t.promotions_desc}</p>
                                </div>
                                <div className="hidden xl:flex w-10 h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-xl bg-white/5 items-center justify-center group-hover:bg-indigo-600 transition-all">
                                    <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        </button>
                    )}

                    <button
                        onClick={() => onSelect('cambodia_map')}
                        className="selection-btn group p-0.5 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden"
                    >
                        <div className="shimmer"></div>
                        <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5 p-4 sm:p-5 lg:p-6 rounded-[1.4rem] lg:rounded-[2.4rem] bg-[#0a0a0a]/40 relative z-10 h-full">
                            <div className="w-12 h-12 lg:w-16 lg:h-16 2xl:w-20 2xl:h-20 shrink-0 rounded-2xl lg:rounded-3xl bg-yellow-600/10 flex items-center justify-center border border-white/5 group-hover:bg-yellow-500 transition-all duration-700 shadow-2xl">
                                <svg className="w-6 h-6 lg:w-8 lg:h-8 2xl:w-10 2xl:h-10 text-yellow-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            </div>
                            <div className="text-center sm:text-left min-w-0 flex-grow">
                                <h3 className="text-xs sm:text-sm lg:text-lg 2xl:text-2xl font-black text-white group-hover:text-yellow-400 transition-colors uppercase italic tracking-tight leading-tight">{language === 'km' ? 'ផែនទី' : 'Map'}</h3>
                                <p className="hidden lg:block text-[10px] 2xl:text-[11px] text-white/30 font-bold uppercase tracking-widest truncate mt-1">{language === 'km' ? 'ផែនទីខេត្ត និងទិន្នន័យ' : 'Provinces & Data'}</p>
                            </div>
                            <div className="hidden xl:flex w-10 h-10 2xl:w-12 2xl:h-12 shrink-0 rounded-xl bg-white/5 items-center justify-center group-hover:bg-yellow-500 transition-all">
                                <svg className="w-4 h-4 2xl:w-5 2xl:h-5 text-white/20 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" /></svg>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Secure Footer */}
                <div className="animate-reveal flex flex-col items-center gap-4 mt-8 pb-12 lg:pb-0 shrink-0" style={{ animationDelay: '0.6s' }}>
                    {!visibleCount && (
                        <p className="text-red-400 text-[10px] lg:text-[12px] font-black uppercase tracking-widest bg-red-500/10 px-8 py-3 rounded-full mb-2 border border-red-500/20">
                            {t.no_data}
                        </p>
                    )}
                    <div className="h-px w-32 sm:w-48 lg:w-64 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <div className="flex flex-col items-center gap-3">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-4 h-4 lg:w-5 lg:h-5 opacity-40 grayscale invert" />
                        <span className="text-[9px] lg:text-[10px] 2xl:text-[11px] text-white/30 font-black uppercase tracking-[0.5em] lg:tracking-[0.6em]">O-System Core v2.6.04-LTS</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleSelectionPage;
