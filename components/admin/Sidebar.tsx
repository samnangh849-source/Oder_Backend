
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import UserAvatar from '../common/UserAvatar';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { APP_LOGO_URL, WEB_APP_URL } from '../../constants';
import Spinner from '../common/Spinner';
import { translations } from '../../translations';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import { CacheService, CACHE_KEYS } from '../../services/cacheService';

interface SidebarProps {
    activeDashboard: string;
    currentAdminView: string;
    isReportSubMenuOpen: boolean;
    isProfileSubMenuOpen: boolean;
    onNavChange: (id: string) => void;
    onReportSubNav: (id: any) => void;
    setIsReportSubMenuOpen: (open: boolean) => void;
    setIsProfileSubMenuOpen: (open: boolean) => void;
    setEditProfileModalOpen: (open: boolean) => void;
    setAdvancedSettingsOpen: (open: boolean) => void;
    isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
    activeDashboard, currentAdminView, isReportSubMenuOpen, isProfileSubMenuOpen,
    onNavChange, onReportSubNav, setIsReportSubMenuOpen, setIsProfileSubMenuOpen,
    setEditProfileModalOpen, setAdvancedSettingsOpen, isMobile = false
}) => {
    const { 
        currentUser, logout, refreshData, isSidebarCollapsed, setIsSidebarCollapsed, 
        setAppState, setIsChatOpen, unreadCount,
        language, setLanguage, showNotification, hasPermission, advancedSettings
    } = useContext(AppContext);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const t = translations[language];

    const isCustomUI = advancedSettings?.uiTheme && advancedSettings?.uiTheme !== 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';

    const isHybridAdmin = !!currentUser?.IsSystemAdmin && (currentUser?.Team || '').split(',').map(t => (t || '').trim()).filter(Boolean).length > 0;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshData();
            window.location.reload();
        } catch (err) {
            setIsRefreshing(false);
        }
    };

    const handleTestNotification = async () => {
        await requestNotificationPermission();
        await sendSystemNotification(t.test_notification, t.test_notification_body);
    };

    const navItems = useMemo(() => [
        { id: 'dashboard', component: 'admin', label: t.dashboard, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
        { id: 'performance', component: 'admin', label: t.performance, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'orders', component: 'orders', label: t.manage_orders, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
        { id: 'fulfillment', component: 'fulfillment', label: t.fulfillment || 'Ops', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
        { id: 'inventory', component: 'inventory', label: t.inventory, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg> },
        { id: 'reports', component: 'reports', label: t.reports, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg> },
        { id: 'incentives', component: 'incentives', label: t.incentives || 'Incentives', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'settings', component: 'settings', label: t.settings, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ], [t]);

    const reportSections = useMemo(() => [
        { id: 'overview', title: t.overview },
        { id: 'performance', title: t.performance },
        { id: 'profitability', title: t.profitability },
        { id: 'forecasting', title: t.forecasting },
        { id: 'shipping', title: t.shipping_report },
        { id: 'sales_team', title: t.sales_team_report },
        { id: 'sales_page', title: t.sales_page_report },
    ], [t]);

    const uiTheme = advancedSettings?.uiTheme || 'default';

    // Theme-specific styles logic
    const getThemeStyles = () => {
        switch (uiTheme) {
            case 'binance':
                return {
                    container: isMobile ? "bg-[#1E2329]" : `bg-[#1E2329] border-[#2B3139] ${isSidebarCollapsed ? 'w-16' : 'w-60'}`,
                    itemActive: "text-[#FCD535] bg-[#2B3139]/50 border-[#FCD535]",
                    itemHover: "text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]/30",
                    accent: "#FCD535",
                    textPrimary: "text-[#EAECEF]",
                    textSecondary: "text-[#848E9C]",
                    border: "border-[#2B3139]",
                    logoBg: "bg-[#FCD535]"
                };
            case 'netflix':
                return {
                    container: isMobile ? "bg-[#141414]" : `bg-[#141414] border-white/5 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: "text-white bg-white/10 border-[#e50914]",
                    itemHover: "text-gray-400 hover:text-white hover:bg-white/5",
                    accent: "#e50914",
                    textPrimary: "text-white",
                    textSecondary: "text-gray-400",
                    border: "border-white/5",
                    logoBg: "bg-[#e50914]"
                };
            default: // Default / Professional Blue
                return {
                    container: isMobile ? "bg-[#020617]/95" : `bg-[#020617]/95 ${isLightMode ? 'bg-white border-gray-200' : 'border-white/5'} ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: "text-white bg-gradient-to-r from-blue-600/30 to-transparent border-blue-500",
                    itemHover: isLightMode ? "text-gray-500 hover:text-blue-600 hover:bg-blue-50" : "text-gray-400 hover:text-white hover:bg-white/5",
                    accent: "#3b82f6",
                    textPrimary: isLightMode ? "text-gray-900" : "text-white",
                    textSecondary: "text-gray-400",
                    border: isLightMode ? "border-gray-100" : "border-white/5",
                    logoBg: "bg-blue-600"
                };
        }
    };

    const styles = getThemeStyles();

    const containerClasses = isMobile 
        ? `w-full flex flex-col h-full ${styles.container}`
        : `fixed left-0 top-0 h-screen border-r ${styles.border} z-50 transition-all duration-300 ease-in-out ${styles.container} flex flex-col shadow-2xl`;

    return (
        <aside className={`${containerClasses} select-none`}>
            
            {/* Desktop Header (Logo) */}
            {!isMobile && (
                <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-5'} border-b ${styles.border} overflow-hidden shrink-0`}>
                    <div className={`w-8 h-8 ${styles.logoBg} rounded-md flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-5 h-5 object-contain" />
                    </div>
                    
                    {!isSidebarCollapsed && (
                        <div className="ml-3 flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2">
                            <h1 className={`text-sm font-black ${styles.textPrimary} uppercase tracking-tighter leading-none`}>
                                {uiTheme === 'binance' ? 'Binance Cloud' : 'O-System'}
                            </h1>
                            <span className={`text-[9px] ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'} font-black uppercase tracking-[0.2em] mt-1`}>Admin Terminal</span>
                        </div>
                    )}
                </div>
            )}

            {/* Desktop Collapse Button */}
            {!isMobile && (
                <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className={`absolute top-20 -right-3 w-6 h-6 ${isLightMode ? 'bg-white border-gray-200' : 'bg-[#0f172a] border-[#474D57]'} border rounded-full flex items-center justify-center text-[#848E9C] hover:text-[#FCD535] z-[60] transition-all hover:scale-110 shadow-xl`}
                >
                    <svg className={`w-3 h-3 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                </button>
            )}

            {/* Navigation Section */}
            <div className="flex-grow overflow-y-auto custom-scrollbar py-4">
                {navItems.map((item) => {
                    const isReports = item.id === 'reports';
                    const isActive = (activeDashboard === item.component) && (item.component !== 'admin' || item.id === currentAdminView);
                    const isExpanded = isReports && isReportSubMenuOpen;
                    
                    return (
                        <div key={item.id} className="mb-1">
                            <button 
                                onClick={() => onNavChange(item.id)} 
                                className={`
                                    w-full flex items-center justify-between transition-all duration-150 group relative py-3
                                    ${isSidebarCollapsed && !isMobile ? 'px-0 justify-center' : 'px-5'}
                                    ${isActive 
                                        ? `${styles.itemActive} border-l-[3px]` 
                                        : `${styles.itemHover} border-l-[3px] border-transparent`
                                    }
                                `}
                                title={isSidebarCollapsed && !isMobile ? item.label : ''}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                                        {item.icon}
                                    </span>
                                    {(isMobile || !isSidebarCollapsed) && (
                                        <span className={`text-[11px] font-bold uppercase tracking-widest ${isActive ? styles.textPrimary : ''}`}>
                                            {item.label}
                                        </span>
                                    )}
                                </div>
                                
                                {isReports && (isMobile || !isSidebarCollapsed) && (
                                    <svg className={`w-3 h-3 transition-transform duration-300 opacity-40 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                )}
                            </button>

                            {/* Reports Submenu */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded && (isMobile || !isSidebarCollapsed) ? 'max-h-[350px] opacity-100 py-1' : 'max-h-0 opacity-0'} ${uiTheme === 'binance' ? 'bg-[#0B0E11]/30 border-y border-[#2B3139]/30 my-1' : 'bg-black/10'}`}>
                                {reportSections.map(sub => (
                                    <button 
                                        key={sub.id}
                                        onClick={() => onReportSubNav(sub.id)}
                                        className={`w-full flex items-center gap-3 px-12 py-2 text-[10px] font-bold uppercase tracking-widest transition-all text-left ${uiTheme === 'binance' ? 'text-[#848E9C] hover:text-[#FCD535] hover:bg-[#2B3139]/40' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <span className="truncate">{sub.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Section */}
            <div className={`border-t ${styles.border} p-3 shrink-0 ${uiTheme === 'binance' ? 'bg-[#1E2329]' : 'bg-black/20'}`}>
                <button 
                    onClick={() => setIsProfileSubMenuOpen(!isProfileSubMenuOpen)}
                    className={`
                        w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200
                        ${isProfileSubMenuOpen ? (uiTheme === 'binance' ? 'bg-[#2B3139]' : 'bg-white/10') : 'hover:bg-white/5'}
                        ${(!isMobile && isSidebarCollapsed) ? 'justify-center' : ''}
                    `}
                >
                    <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="sm" className={`border ${styles.border} flex-shrink-0`} />
                    {(isMobile || !isSidebarCollapsed) && (
                        <div className="min-w-0 flex-grow text-left">
                            <p className={`text-[11px] font-black ${styles.textPrimary} truncate leading-tight uppercase tracking-tight`}>{currentUser?.FullName}</p>
                            <p className={`text-[9px] ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'} font-black uppercase tracking-widest mt-0.5 truncate`}>Verified</p>
                        </div>
                    )}
                </button>

                {/* Account Menu */}
                <div className={`
                    overflow-hidden transition-all duration-300 ease-in-out
                    ${isProfileSubMenuOpen && (isMobile || !isSidebarCollapsed) ? 'max-h-[500px] mt-2 opacity-100' : 'max-h-0 opacity-0'}
                `}>
                    <div className="space-y-1 p-1">
                        <div className={`flex ${isLightMode ? 'bg-gray-100' : 'bg-[#0B0E11]'} p-1 rounded-md border ${styles.border} mb-2`}>
                            <button onClick={() => setLanguage('en')} className={`flex-1 py-1.5 text-[9px] font-black rounded transition-all ${language === 'en' ? (uiTheme === 'binance' ? 'bg-[#FCD535] text-[#1E2329]' : 'bg-blue-600 text-white') : 'text-[#848E9C] hover:text-[#EAECEF]'}`}>ENG</button>
                            <button onClick={() => setLanguage('km')} className={`flex-1 py-1.5 text-[9px] font-black rounded transition-all ${language === 'km' ? (uiTheme === 'binance' ? 'bg-[#FCD535] text-[#1E2329]' : 'bg-blue-600 text-white') : 'text-[#848E9C] hover:text-[#EAECEF]'}`}>KH</button>
                        </div>

                        <div className="grid grid-cols-1 gap-1">
                            <button onClick={() => setEditProfileModalOpen(true)} className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold ${styles.textSecondary} hover:text-[#EAECEF] hover:bg-[#2B3139] rounded transition-all uppercase tracking-wider`}>
                                <svg className={`w-4 h-4 ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Account Center
                            </button>
                            <button onClick={() => setAdvancedSettingsOpen(true)} className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold ${styles.textSecondary} hover:text-[#EAECEF] hover:bg-[#2B3139] rounded transition-all uppercase tracking-wider`}>
                                <svg className={`w-4 h-4 ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Preferences
                            </button>
                            <button onClick={handleRefresh} className={`w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold ${styles.textSecondary} hover:text-[#EAECEF] hover:bg-[#2B3139] rounded transition-all uppercase tracking-wider`}>
                                <svg className={`w-4 h-4 ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-emerald-400'} ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Sync Data
                            </button>
                            <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-[10px] font-bold text-[#F6465D] hover:bg-[#F6465D]/10 rounded transition-all uppercase tracking-wider mt-2 border-t border-[#2B3139] pt-3">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
