
import React, { useContext, useState } from 'react';
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
        language, setLanguage, showNotification
    } = useContext(AppContext);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const t = translations[language];

    const reportSections = [
        { id: 'overview', title: t.overview, icon: '📊' },
        { id: 'sales_team', title: t.sales_team_report, icon: '👥' },
        { id: 'sales_page', title: t.sales_page_report, icon: '📄' },
        { id: 'performance', title: t.performance, icon: '📈' },
        { id: 'profitability', title: t.profitability, icon: '💰' },
        { id: 'forecasting', title: t.forecasting, icon: '🔮' },
        { id: 'shipping', title: t.shipping_report, icon: '🚚' },
    ];

    const navItems = [
        { id: 'dashboard', label: t.dashboard, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>, component: 'admin' },
        { id: 'fulfillment', label: 'Fulfillment', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2} /></svg>, component: 'fulfillment' },
        { id: 'packaging', label: 'Packaging', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, component: 'packaging' },
        { id: 'delivery', label: 'Delivery', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, component: 'delivery' },
        { id: 'inventory', label: 'Inventory', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>, component: 'inventory' },
        { id: 'orders', label: t.orders, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>, component: 'orders' },
        { id: 'reports', label: t.reports, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, component: 'reports' },
        { id: 'incentives', label: 'Incentives', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>, component: 'incentives' },
        { id: 'settings', label: t.settings, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, component: 'settings' },
    ];

    const isHybridAdmin = currentUser?.IsSystemAdmin && (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean).length > 0;

    const handleRefresh = async () => {
        if (window.confirm("Refresh Page & Clear Cache?")) {
            setIsRefreshing(true);
            try {
                // Clear only data caches, preserving the session to avoid logging out
                await CacheService.remove(CACHE_KEYS.APP_DATA);
                await CacheService.remove(CACHE_KEYS.CHAT_HISTORY);
                window.location.reload();
            } catch (err) {
                setIsRefreshing(false);
            }
        }
    };

    const handleTestNotification = async () => {
        await requestNotificationPermission();
        await sendSystemNotification(t.test_notification, t.test_notification_body);
        showNotification(t.test_notification_body, 'success');
    };

    // Styling logic based on Desktop/Mobile prop
    const containerClasses = isMobile 
        ? "w-full flex flex-col h-full bg-transparent" // Mobile: Fluid, transparent (uses drawer BG)
        : `fixed left-0 top-0 h-screen border-r border-white/5 z-50 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-[#020617]/95 backdrop-blur-3xl flex flex-col shadow-2xl`; // Desktop: Fixed, dark, blurred

    return (
        <aside className={containerClasses}>
            
            {/* Desktop Header (Logo) - Hidden on Mobile */}
            {!isMobile && (
                <div className={`h-20 flex items-center gap-4 px-6 border-b border-white/5 overflow-hidden relative group shrink-0`}>
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 flex-shrink-0 transition-all border border-white/10 z-10">
                        <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-5 h-5 object-contain" />
                    </div>
                    
                    {!isSidebarCollapsed && (
                        <div className="flex flex-col z-10 animate-fade-in min-w-0">
                            <h1 className="text-base font-black text-white italic uppercase tracking-tighter leading-none">O-System</h1>
                            <span className="text-[8px] text-blue-400 font-bold uppercase tracking-[0.25em]">Admin</span>
                        </div>
                    )}
                </div>
            )}

            {/* Desktop Collapse Button - Hidden on Mobile */}
            {!isMobile && (
                <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute top-[4.5rem] -right-3 w-6 h-6 bg-[#0f172a] border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white shadow-xl z-[60] transition-all hover:scale-110 hover:border-blue-500/50"
                >
                    <svg className={`w-3 h-3 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M15 19l-7-7 7-7" /></svg>
                </button>
            )}

            {/* Navigation Section */}
            <div className="flex-grow overflow-y-auto custom-scrollbar px-0 py-6 space-y-1">
                {/* Mobile Chat Button - Visible only on Mobile */}
                {isMobile && (
                    <div className="px-4 mb-6">
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 text-blue-300 border border-blue-500/30 active:scale-[0.98] transition-all shadow-lg"
                        >
                            <div className="flex items-center gap-3">
                                <div className="relative p-1.5 bg-blue-500/20 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></span>}
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest">{t.chat_system}</span>
                            </div>
                            {unreadCount > 0 && <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg">{unreadCount}</span>}
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
                                    w-full flex items-center justify-between px-6 py-4 transition-all duration-200 group relative
                                    ${isActive 
                                        ? 'text-white bg-gradient-to-r from-blue-600/30 to-transparent border-l-4 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.1)]' 
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
                                    }
                                `}
                                title={isSidebarCollapsed && !isMobile ? item.label : ''}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <span className={`transition-transform duration-300 ${isActive ? 'scale-110 text-blue-400' : 'group-hover:text-gray-200'}`}>
                                        {item.icon}
                                    </span>
                                    {(isMobile || !isSidebarCollapsed) && (
                                        <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-white' : ''}`}>
                                            {item.label}
                                        </span>
                                    )}
                                </div>
                                
                                {isReports && (isMobile || !isSidebarCollapsed) && (
                                    <svg className={`w-3 h-3 transition-transform duration-300 opacity-50 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                )}
                            </button>

                            {/* Reports Submenu */}
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out bg-black/20 ${isExpanded && (isMobile || !isSidebarCollapsed) ? 'max-h-[500px] opacity-100 py-2' : 'max-h-0 opacity-0'}`}>
                                {reportSections.map(sub => (
                                    <button 
                                        key={sub.id}
                                        onClick={() => onReportSubNav(sub.id)}
                                        className="w-full flex items-center gap-3 px-6 pl-14 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-white hover:bg-white/5 transition-all relative group"
                                    >
                                        <div className="absolute left-10 w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-blue-500 transition-colors"></div>
                                        <span className="truncate">{sub.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Profile Section */}
            <div className={`p-4 shrink-0 ${isMobile ? '' : 'border-t border-white/5 bg-black/20'}`}>
                <button 
                    onClick={() => setIsProfileSubMenuOpen(!isProfileSubMenuOpen)}
                    className={`
                        w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300
                        ${isProfileSubMenuOpen ? 'bg-gray-800' : 'hover:bg-white/5'}
                        ${(!isMobile && isSidebarCollapsed) ? 'justify-center' : ''}
                    `}
                >
                    <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="md" className="ring-2 ring-white/5 shadow-md flex-shrink-0" />
                    {(isMobile || !isSidebarCollapsed) && (
                        <div className="min-w-0 flex-grow text-left">
                            <p className="text-xs font-black text-white truncate leading-tight">{currentUser?.FullName}</p>
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
                        <div className="bg-gray-900 rounded-xl p-1 flex border border-white/5">
                            <button onClick={() => setLanguage('en')} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>ENG</button>
                            <button onClick={() => setLanguage('km')} className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${language === 'km' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}>KH</button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Profile */}
                            <button onClick={() => setEditProfileModalOpen(true)} className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:bg-blue-600/20 hover:border-blue-500/30 transition-all group">
                                <svg className="w-4 h-4 text-blue-400 mb-1.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-white">Profile</span>
                            </button>

                            {/* Advanced Settings */}
                            <button onClick={() => setAdvancedSettingsOpen(true)} className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:bg-purple-600/20 hover:border-purple-500/30 transition-all group">
                                <svg className="w-4 h-4 text-purple-400 mb-1.5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-white">Settings</span>
                            </button>

                            {/* Refresh Page */}
                            <button onClick={handleRefresh} disabled={isRefreshing} className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:bg-emerald-600/20 hover:border-emerald-500/30 transition-all group">
                                {isRefreshing ? <Spinner size="sm" /> : <svg className="w-4 h-4 text-emerald-400 mb-1.5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-white text-center leading-none">Refresh & សម្អាត Cache</span>
                            </button>

                            {/* Test Notification */}
                            <button onClick={handleTestNotification} className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:bg-indigo-600/20 hover:border-indigo-500/30 transition-all group">
                                <svg className="w-4 h-4 text-indigo-400 mb-1.5 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-white">Notify</span>
                            </button>

                            {/* Switch Role */}
                            {isHybridAdmin && (
                                <button onClick={() => setAppState('role_selection')} className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:bg-yellow-600/20 hover:border-yellow-500/30 transition-all group">
                                    <svg className="w-4 h-4 text-yellow-400 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                    <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-white">Switch</span>
                                </button>
                            )}

                            {/* Logout */}
                            <button onClick={logout} className={`flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:bg-red-600/20 hover:border-red-500/30 transition-all group ${!isHybridAdmin ? 'col-span-2' : ''}`}>
                                <svg className="w-4 h-4 text-red-400 mb-1.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                <span className="text-[8px] font-black uppercase text-gray-400 group-hover:text-white">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
