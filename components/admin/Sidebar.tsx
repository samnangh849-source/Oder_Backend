
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
        language, setLanguage, showNotification, hasPermission, advancedSettings, originalAdminUser
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
        { id: 'dashboard', component: 'admin', label: t.dashboard, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
        { id: 'performance', component: 'admin', label: t.performance, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'orders', component: 'orders', label: t.manage_orders, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
        { id: 'fulfillment', component: 'fulfillment', label: t.fulfillment || 'Ops', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
        { id: 'inventory', component: 'inventory', label: t.inventory, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg> },
        { id: 'reports', component: 'reports', label: t.reports, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg> },
        { id: 'incentives', component: 'incentives', label: t.incentives || 'Incentives', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12V8a2 2 0 00-2-2h-3.93a2 2 0 01-1.66-.9l-.82-1.2C11.17 3.34 10.57 3 9.82 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-4M7 8h10M7 12h10M7 16h6" /></svg> },
        { id: 'settings', component: 'settings', label: t.settings, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
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
                    container: isMobile ? "bg-[#1E2329]" : `bg-[#1E2329] border-[#2B3139] rounded-none ${isSidebarCollapsed ? 'w-16' : 'w-60'}`,
                    itemActive: "text-[#FCD535] bg-[#FCD535]/[0.08] border-[#FCD535] rounded-none",
                    itemHover: "text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]/30 rounded-none",
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
            default: // Default / Professional Blue (Matches Template)
                return {
                    container: isMobile
                        ? (isLightMode ? "bg-slate-50" : "bg-[#0d0f15]")
                        : `${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-[#0d0f15] border-white/[0.06]'} ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: isLightMode
                        ? "text-blue-600 bg-blue-50 border-l-[3px] border-l-blue-600"
                        : "text-white bg-[rgba(59,130,246,0.1)] border-l-[3px] border-l-[#3b82f6]",
                    itemHover: isLightMode
                        ? "text-slate-700 hover:bg-slate-100"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.05]",
                    accent: "#3b82f6",
                    textPrimary: isLightMode ? "text-slate-900" : "text-white",
                    textSecondary: isLightMode ? "text-slate-500" : "text-slate-400",
                    border: isLightMode ? "border-slate-200" : "border-white/[0.06]",
                    logoBg: "bg-[#264b96]"
                };
        }
    };

    const styles = getThemeStyles();

    const containerClasses = isMobile 
        ? `w-full flex flex-col h-full ${styles.container}`
        : `fixed left-0 top-0 h-screen border-r ${styles.border} z-50 transition-all duration-300 ease-in-out ${styles.container} flex flex-col shadow-sm`;

    return (
        <aside className={`${containerClasses} select-none`}>
            
            {/* Desktop Header (Logo Area) */}
            {!isMobile && (
                <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-6'} ${styles.logoBg} overflow-hidden shrink-0`}>
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-6 h-6 object-contain brightness-0 invert" />
                    </div>
                    
                    {!isSidebarCollapsed && (
                        <div className="ml-3 flex flex-col min-w-0">
                            <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">
                                O-System
                            </h1>
                            <span className="text-[9px] text-blue-200 font-black uppercase tracking-[0.2em] mt-1">Admin Terminal</span>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Section */}
            <div className="flex-grow overflow-y-auto custom-scrollbar py-4 px-3 space-y-1">
                {navItems.map((item) => {
                    const isReports = item.id === 'reports';
                    const isActive = (activeDashboard === item.component) && (item.component !== 'admin' || item.id === currentAdminView);
                    const isExpanded = isReports && isReportSubMenuOpen;
                    
                    return (
                        <div key={item.id}>
                            <button 
                                onClick={() => onNavChange(item.id)} 
                                className={`
                                    w-full flex items-center transition-all duration-150 group relative py-2.5 rounded-md
                                    ${isSidebarCollapsed && !isMobile ? 'px-0 justify-center' : 'px-3'}
                                    ${isActive 
                                        ? `${styles.itemActive} font-semibold` 
                                        : `${styles.itemHover}`
                                    }
                                `}
                                title={isSidebarCollapsed && !isMobile ? item.label : ''}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <span className={`transition-colors duration-200 ${isActive ? (isLightMode ? 'text-blue-600' : 'text-blue-400') : (isLightMode ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-500 group-hover:text-white')}`}>
                                        {item.icon}
                                    </span>
                                    {(isMobile || !isSidebarCollapsed) && (
                                        <span className={`text-sm font-medium ${isActive ? (isLightMode ? 'text-blue-600' : 'text-white') : (isLightMode ? 'text-slate-700' : 'text-slate-400 group-hover:text-white')}`}>
                                            {item.label}
                                        </span>
                                    )}
                                </div>
                                
                                {isReports && (isMobile || !isSidebarCollapsed) && (
                                    <svg className={`w-3 h-3 transition-transform duration-300 opacity-40 ml-auto ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
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

            {/* Bottom Section - Matches 1.png Profile Card */}
            <div className={`mt-auto border-t ${styles.border} p-4 space-y-4 ${isLightMode ? 'bg-slate-200/50' : 'bg-[#0a0c12]'}`}>
                {(!isMobile && isSidebarCollapsed) ? (
                    <div className="flex justify-center">
                        <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="sm" className={`border-2 ${isLightMode ? 'border-white' : 'border-slate-700'} shadow-md`} />
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                            <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="md" className={`border-2 ${isLightMode ? 'border-white' : 'border-slate-700'} shadow-md`} />
                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-[#0a0c12]"></span>
                        </div>
                        <div className="min-w-0 flex-grow">
                            <p className={`text-[11px] font-black ${styles.textPrimary} truncate uppercase tracking-tight`}>
                                {currentUser?.FullName}
                            </p>
                            <span className={`text-[9px] font-bold ${isLightMode ? 'text-blue-500' : 'text-green-400'} uppercase tracking-widest flex items-center gap-1`}>
                                <i className="fa-solid fa-circle text-[6px]"></i>
                                Online
                            </span>
                        </div>
                    </div>
                )}

                {/* Language Switcher - 1.png Style */}
                {(!isSidebarCollapsed || isMobile) && (
                    <div className={`flex ${isLightMode ? 'bg-slate-900' : 'bg-slate-950'} p-1 rounded-md shadow-inner`}>
                        <button 
                            onClick={() => setLanguage('en')} 
                            className={`flex-1 py-1 text-[9px] font-black rounded transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            ENG
                        </button>
                        <button 
                            onClick={() => setLanguage('km')} 
                            className={`flex-1 py-1 text-[9px] font-black rounded transition-all ${language === 'km' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            KH
                        </button>
                    </div>
                )}

                {/* Action Menu - 1.png Style */}
                {(!isSidebarCollapsed || isMobile) && (
                    <div className="space-y-1">
                        {[
                            { id: 'profile', icon: 'fa-user-gear', label: t.edit_profile || 'Account Center' },
                            { id: 'settings', icon: 'fa-sliders', label: t.advanced_settings || 'Preferences' },
                            { id: 'sync', icon: 'fa-arrows-rotate', label: t.refresh_data || 'Sync Data' },
                        ].map((menu) => (
                            <button 
                                key={menu.id}
                                onClick={() => {
                                    if (menu.id === 'profile') setEditProfileModalOpen(true);
                                    if (menu.id === 'settings') setAdvancedSettingsOpen(true);
                                    if (menu.id === 'sync') handleRefresh();
                                }}
                                className={`w-full flex items-center gap-3 px-2 py-2 text-[10px] font-bold ${isLightMode ? 'text-slate-500 hover:text-blue-600' : 'text-slate-400 hover:text-white'} transition-colors uppercase tracking-wider group text-left`}
                            >
                                <i className={`fa-solid ${menu.icon} w-4 opacity-50 group-hover:opacity-100 transition-opacity`}></i>
                                {menu.label}
                            </button>
                        ))}
                        
                        <div className={`my-2 border-t ${isLightMode ? 'border-slate-300' : 'border-slate-800'}`}></div>

                        {!originalAdminUser && (
                            <button onClick={() => setAppState('role_selection')} className="w-full flex items-center gap-3 px-2 py-2 text-[10px] font-bold text-yellow-600 hover:text-yellow-500 transition-colors uppercase tracking-wider text-left">
                                <i className="fa-solid fa-users-viewfinder w-4"></i>
                                {language === 'km' ? 'ប្តូរតួនាទី' : 'Switch Role'}
                            </button>
                        )}
                        <button onClick={logout} className="w-full flex items-center gap-3 px-2 py-2 text-[10px] font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-wider text-left">
                            <i className="fa-solid fa-right-from-bracket w-4"></i>
                            {language === 'km' ? 'ចាកចេញ' : 'Logout'}
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
