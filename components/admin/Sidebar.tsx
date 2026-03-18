
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

    // Styling logic based on Desktop/Mobile prop and Themes
    const containerClasses = isMobile 
        ? "w-full flex flex-col h-full bg-transparent" // Mobile: Fluid, transparent (uses drawer BG)
        : `fixed left-0 top-0 h-screen border-r ${isLightMode ? 'border-gray-200' : 'border-white/5'} z-50 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'} ${isLightMode ? 'bg-white' : 'bg-[#020617]/95'} backdrop-blur-3xl flex flex-col shadow-2xl`; // Desktop: Fixed, dark, blurred

    return (
        <aside className={`${containerClasses} ${isCustomUI ? `ui-sidebar-${advancedSettings.uiTheme}` : ''}`}>
            
            {/* Desktop Header (Logo) - Hidden on Mobile */}
            {!isMobile && (
                <div className={`h-20 flex items-center gap-4 px-6 border-b ${isLightMode ? 'border-gray-100' : 'border-white/5'} overflow-hidden relative group shrink-0`}>
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 flex-shrink-0 transition-all border border-white/10 z-10">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-5 h-5 object-contain" />
                    </div>
                    
                    {!isSidebarCollapsed && (
                        <div className="flex flex-col z-10 animate-fade-in min-w-0">
                            <h1 className={`text-base font-black ${isLightMode ? 'text-gray-900' : 'text-white'} italic uppercase tracking-tighter leading-none`}>O-System</h1>
                            <span className="text-[8px] text-blue-400 font-bold uppercase tracking-[0.25em]">Admin</span>
                        </div>
                    )}
                </div>
            )}

            {/* Desktop Collapse Button - Hidden on Mobile */}
            {!isMobile && (
                <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className={`absolute top-[4.5rem] -right-3 w-6 h-6 ${isLightMode ? 'bg-white border-gray-200 text-gray-400' : 'bg-[#0f172a] border-gray-700 text-gray-400'} border rounded-full flex items-center justify-center hover:text-blue-500 shadow-xl z-[60] transition-all hover:scale-110 hover:border-blue-500/50`}
                >
                    <svg className={`w-3 h-3 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                </button>
            )}

            {/* Navigation Section */}
            <div className="flex-grow overflow-hidden px-0 py-2 space-y-0">
                {/* Mobile Chat Button - Visible only on Mobile */}
                {isMobile && (
                    <div className="px-4 mb-2">
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-300 border border-blue-500/30 active:scale-[0.98] transition-all shadow-lg"
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative p-1 bg-blue-500/20 rounded-lg">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></span>}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">{t.chat_system}</span>
                            </div>
                            {unreadCount > 0 && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg">{unreadCount}</span>}
                        </button>
                    </div>
                )}

                {navItems.map((item) => {
                    const isReports = item.id === 'reports';
                    const isActive = (activeDashboard === item.component) && (item.component !== 'admin' || item.id === currentAdminView);
                    const isExpanded = isReports && isReportSubMenuOpen;
                    
                    return (
                        <div key={item.id}>
                            <button 
                                onClick={() => onNavChange(item.id)} 
                                className={`
                                    w-full flex items-center justify-between px-6 py-2.5 transition-all duration-200 group relative
                                    ${isActive 
                                        ? `text-white bg-gradient-to-r from-blue-600/30 to-transparent border-l-4 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.1)] sidebar-item-active` 
                                        : `${isLightMode ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:text-white hover:bg-white/5'} border-l-4 border-transparent`
                                    }
                                `}
                                title={isSidebarCollapsed && !isMobile ? item.label : ''}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <span className={`transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : isLightMode ? 'group-hover:text-blue-500' : 'group-hover:text-gray-200'}`}>
                                        {item.icon}
                                    </span>
                                    {(isMobile || !isSidebarCollapsed) && (
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? (isLightMode ? 'text-blue-600' : 'text-white') : ''}`}>
                                            {item.label}
                                        </span>
                                    )}
                                </div>
                                
                                {isReports && (isMobile || !isSidebarCollapsed) && (
                                    <svg className={`w-2.5 h-2.5 transition-transform duration-300 opacity-50 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                )}
                            </button>

                            {/* Reports Submenu */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded && (isMobile || !isSidebarCollapsed) ? 'max-h-[300px] opacity-100 py-1' : 'max-h-0 opacity-0'} ${isLightMode ? 'bg-gray-50' : 'bg-black/20'}`}>
                                {reportSections.map(sub => (
                                    <button 
                                        key={sub.id}
                                        onClick={() => onReportSubNav(sub.id)}
                                        className={`w-full flex items-center gap-3 px-6 pl-14 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all relative group ${isLightMode ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-100/50' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    >
                                        <div className={`absolute left-10 w-1 h-1 rounded-full ${isLightMode ? 'bg-gray-300' : 'bg-gray-700'} group-hover:bg-blue-500 transition-colors`}></div>
                                        <span className="truncate">{sub.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Profile Section */}
            <div className={`p-4 shrink-0 ${isMobile ? '' : `border-t ${isLightMode ? 'border-gray-100 bg-gray-50' : 'border-white/5 bg-black/20'}`}`}>
                <button 
                    onClick={() => setIsProfileSubMenuOpen(!isProfileSubMenuOpen)}
                    className={`
                        w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300
                        ${isProfileSubMenuOpen ? (isLightMode ? 'bg-blue-50' : 'bg-gray-800') : (isLightMode ? 'hover:bg-blue-50' : 'hover:bg-white/5')}
                        ${(!isMobile && isSidebarCollapsed) ? 'justify-center' : ''}
                    `}
                >
                    <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="md" className={`ring-2 ${isLightMode ? 'ring-blue-100' : 'ring-white/5'} shadow-md flex-shrink-0`} />
                    {(isMobile || !isSidebarCollapsed) && (
                        <div className="min-w-0 flex-grow text-left">
                            <p className={`text-xs font-black ${isLightMode ? 'text-gray-900' : 'text-white'} truncate leading-tight`}>{currentUser?.FullName}</p>
                            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-0.5 truncate">{currentUser?.Role}</p>
                        </div>
                    )}
                    {(isMobile || !isSidebarCollapsed) && (
                        <svg className={`w-3 h-3 text-gray-500 transition-transform duration-300 ${isProfileSubMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    )}
                </button>

                {/* Expanded Profile Menu */}
                <div className={`
                    overflow-hidden transition-all duration-300 ease-in-out
                    ${isProfileSubMenuOpen && (isMobile || !isSidebarCollapsed) ? 'max-h-[400px] mt-4 opacity-100' : 'max-h-0 opacity-0'}
                `}>
                    <div className="space-y-3">
                        <div className={`rounded-xl p-1 flex border ${isLightMode ? 'bg-gray-100 border-gray-200' : 'bg-gray-900 border-white/5'}`}>
                            <button onClick={() => setLanguage('en')} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>ENG</button>
                            <button onClick={() => setLanguage('km')} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'km' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>KH</button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Profile */}
                            <button onClick={() => setEditProfileModalOpen(true)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-gray-200 hover:bg-blue-50' : 'bg-gray-800/50 border-white/5 hover:bg-blue-600/20'}`}>
                                <svg className="w-4 h-4 text-blue-400 mb-1.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span className={`text-[8px] font-black uppercase ${isLightMode ? 'text-gray-500' : 'text-gray-400'} group-hover:text-blue-600`}>Profile</span>
                            </button>

                            {/* Advanced Settings */}
                            <button onClick={() => setAdvancedSettingsOpen(true)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-gray-200 hover:bg-purple-50' : 'bg-gray-800/50 border-white/5 hover:bg-purple-600/20'}`}>
                                <svg className="w-4 h-4 text-purple-400 mb-1.5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span className={`text-[8px] font-black uppercase ${isLightMode ? 'text-gray-500' : 'text-gray-400'} group-hover:text-purple-600`}>Settings</span>
                            </button>
                            {/* ... rest of buttons with similar logic ... */}


                            {/* Refresh Page */}
                            <button onClick={handleRefresh} disabled={isRefreshing} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-gray-200 hover:bg-emerald-50' : 'bg-gray-800/50 border-white/5 hover:bg-emerald-600/20'}`}>
                                {isRefreshing ? <Spinner size="sm" /> : <svg className="w-4 h-4 text-emerald-400 mb-1.5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                <span className={`text-[8px] font-black uppercase ${isLightMode ? 'text-gray-500' : 'text-gray-400'} group-hover:text-emerald-600 text-center leading-none`}>Refresh & Clear Cache</span>
                            </button>

                            {/* Test Notification */}
                            <button onClick={handleTestNotification} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-gray-200 hover:bg-indigo-50' : 'bg-gray-800/50 border-white/5 hover:bg-indigo-600/20'}`}>
                                <svg className="w-4 h-4 text-indigo-400 mb-1.5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                <span className={`text-[8px] font-black uppercase ${isLightMode ? 'text-gray-500' : 'text-gray-400'} group-hover:text-indigo-600`}>Notify</span>
                            </button>

                            {/* Switch Role */}
                            {isHybridAdmin && (
                                <button onClick={() => setAppState('role_selection')} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-gray-200 hover:bg-yellow-50' : 'bg-gray-800/50 border-white/5 hover:bg-yellow-600/20'}`}>
                                    <svg className="w-4 h-4 text-yellow-400 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    <span className={`text-[8px] font-black uppercase ${isLightMode ? 'text-gray-500' : 'text-gray-400'} group-hover:text-yellow-600`}>Switch</span>
                                </button>
                            )}

                            {/* Logout */}
                            <button onClick={logout} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all group ${isLightMode ? 'bg-white border-gray-200 hover:bg-red-50' : 'bg-gray-800/50 border-white/5 hover:bg-red-600/20'} ${!isHybridAdmin ? 'col-span-2' : ''}`}>
                                <svg className="w-4 h-4 text-red-400 mb-1.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                <span className={`text-[8px] font-black uppercase ${isLightMode ? 'text-gray-500' : 'text-gray-400'} group-hover:text-red-600`}>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
