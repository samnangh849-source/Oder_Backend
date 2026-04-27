import React, { useContext, useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import { AppContext } from '../../context/AppContext';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { APP_LOGO_URL } from '../../constants';
import UserAvatar from '../common/UserAvatar';
import { translations } from '../../translations';
import Spinner from '../common/Spinner';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import BinanceLiveIndicator from './BinanceLiveIndicator';

interface DesktopAdminLayoutProps {
    children: React.ReactNode;
    activeDashboard: string;
    currentAdminView: string;
    isSidebarCollapsed: boolean;
    onNavChange: (id: string) => void;
    onReportSubNav: (id: any) => void;
    isReportSubMenuOpen: boolean;
    setIsReportSubMenuOpen: (open: boolean) => void;
    isProfileSubMenuOpen: boolean;
    setIsProfileSubMenuOpen: (open: boolean) => void;
    setEditProfileModalOpen: (open: boolean) => void;
    setAdvancedSettingsOpen: (open: boolean) => void;
}

const DesktopAdminLayout: React.FC<DesktopAdminLayoutProps> = ({ 
    children, 
    activeDashboard, 
    currentAdminView, 
    isSidebarCollapsed,
    onNavChange,
    onReportSubNav,
    isReportSubMenuOpen,
    setIsReportSubMenuOpen,
    isProfileSubMenuOpen,
    setIsProfileSubMenuOpen,
    setEditProfileModalOpen,
    setAdvancedSettingsOpen
}) => {
    const { currentUser, language, refreshData, setAppState, logout, originalAdminUser, advancedSettings, setIsSidebarCollapsed } = useContext(AppContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const t = translations[language];

    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';
    const isCustomUI = advancedSettings?.uiTheme && advancedSettings?.uiTheme !== 'default';
    const showHeader = uiTheme === 'default';

    const handleTestNotification = async () => {
        await requestNotificationPermission();
        await sendSystemNotification(t.test_notification, t.test_notification_body);
        setDropdownOpen(false);
    };

    // Theme-specific Background
    const getPageBg = () => {
        if (uiTheme === 'binance') return 'bg-[#0B0E11]';
        if (uiTheme === 'netflix') return 'bg-[#141414]';
        return isLightMode ? 'bg-slate-50' : 'bg-[#121318]';
    };

    return (
        <div className={`flex h-screen w-full ${getPageBg()} overflow-hidden ${isCustomUI ? 'custom-ui-active' : ''}`}>
            {/* Fixed Sidebar */}
            <Sidebar 
                activeDashboard={activeDashboard}
                currentAdminView={currentAdminView}
                isReportSubMenuOpen={isReportSubMenuOpen}
                isProfileSubMenuOpen={isProfileSubMenuOpen}
                onNavChange={onNavChange}
                onReportSubNav={onReportSubNav}
                setIsReportSubMenuOpen={setIsReportSubMenuOpen}
                setIsProfileSubMenuOpen={setIsProfileSubMenuOpen}
                setEditProfileModalOpen={setEditProfileModalOpen}
                setAdvancedSettingsOpen={setAdvancedSettingsOpen}
            />
            
            {/* Main Content with its own Header */}
            <main className={`flex-1 flex flex-col h-screen transition-all duration-300 ease-in-out ${isSidebarCollapsed ? (uiTheme === 'binance' ? 'pl-16' : 'pl-20') : (uiTheme === 'binance' ? 'pl-60' : 'pl-64')} overflow-hidden`}>
                
                {/* Binance Top Bar */}
                {uiTheme === 'binance' && (
                    <header className="flex-shrink-0 z-[60] bg-[#0B0E11] border-b border-[#2B3139] px-6 py-2 flex justify-between items-center" style={originalAdminUser ? { top: '40px' } : {}}>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="p-1.5 -ml-1.5 rounded-sm text-[#848E9C] hover:text-[#FCD535] hover:bg-[#2B3139]/50 transition-colors focus:outline-none"
                            >
                                <i className="fa-solid fa-bars"></i>
                            </button>
                            <h1 className="text-sm font-bold text-[#EAECEF] uppercase tracking-tight flex items-center gap-2">
                                <span>O-System</span>
                                <span className="text-[10px] bg-[#FCD535] text-[#181A20] px-1.5 py-0.5 font-black uppercase tracking-wider" style={{ borderRadius: '2px' }}>PRO</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <BinanceLiveIndicator isSyncing={false} language={language} />
                            <div className="flex items-center gap-2">
                                <UserAvatar
                                    avatarUrl={currentUser?.ProfilePictureURL}
                                    name={currentUser?.FullName || ''}
                                    className="w-7 h-7 border border-[#2B3139]"
                                />
                                <span className="text-[11px] font-semibold text-[#EAECEF]">{currentUser?.FullName}</span>
                            </div>
                            <button onClick={() => setAdvancedSettingsOpen(true)} className="text-[#848E9C] hover:text-[#FCD535] transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                        </div>
                    </header>
                )}

                {/* Desktop Header - Matches Template */}
                {showHeader && (
                    <header className={`h-16 ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0d0f15] border-white/[0.06]'} border-b flex items-center justify-between px-6 z-10 relative`} style={originalAdminUser ? { top: '40px' } : {}}>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className={`p-2 -ml-2 rounded-md ${isLightMode ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'} transition-colors focus:outline-none`}
                                title={isSidebarCollapsed ? t.expand_sidebar || "Expand Sidebar" : t.collapse_sidebar || "Collapse Sidebar"}
                            >
                                <i className="fa-solid fa-bars text-lg"></i>
                            </button>
                            <h1 className={`text-xl font-semibold ${isLightMode ? 'text-slate-900' : 'text-white'} truncate`}>Admin Dashboard - Order System</h1>
                        </div>

                        <div className="flex items-center space-x-6">
                            {/* Notifications */}
                            <button className={`relative p-2 ${isLightMode ? 'text-slate-400 hover:text-slate-500' : 'text-white/40 hover:text-white'} focus:outline-none transition-colors`}>
                                <i className="fa-regular fa-bell text-xl"></i>
                                <span className={`absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ${isLightMode ? 'ring-white' : 'ring-[#0d0f15]'}`}></span>
                            </button>

                            {/* Profile Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center space-x-2 cursor-pointer focus:outline-none"
                                >
                                    <UserAvatar
                                        avatarUrl={currentUser?.ProfilePictureURL}
                                        name={currentUser?.FullName || ''}
                                        className="h-8 w-8 rounded-full bg-slate-200"
                                    />
                                    <span className={`text-sm font-medium ${isLightMode ? 'text-slate-700' : 'text-white/80'} hidden sm:block`}>{currentUser?.FullName}</span>
                                    <i className={`fa-solid fa-chevron-down ${isLightMode ? 'text-slate-400' : 'text-white/30'} text-xs transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`}></i>
                                </button>

                                {dropdownOpen && (
                                    <div className={`absolute right-0 mt-3 w-64 ${isLightMode ? 'bg-white border-slate-200' : 'bg-[#1a1d27] border-white/[0.08]'} border rounded-lg shadow-xl py-2 z-[70] animate-in fade-in zoom-in-95 overflow-hidden`}>
                                        <div className={`px-4 py-3 border-b ${isLightMode ? 'border-slate-100 bg-slate-50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
                                            <p className={`text-sm font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{currentUser?.FullName}</p>
                                            <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-white/40'} truncate`}>{currentUser?.Role}</p>
                                        </div>

                                        <button onClick={() => { setEditProfileModalOpen(true); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-50' : 'text-white/70 hover:bg-white/[0.05] hover:text-white'} flex items-center gap-3 transition-colors`}>
                                            <i className={`fa-solid fa-user-gear ${isLightMode ? 'text-slate-400' : 'text-white/30'} w-5`}></i>
                                            {t.edit_profile}
                                        </button>

                                        <button onClick={() => { setAdvancedSettingsOpen(true); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-50' : 'text-white/70 hover:bg-white/[0.05] hover:text-white'} flex items-center gap-3 transition-colors`}>
                                            <i className={`fa-solid fa-sliders ${isLightMode ? 'text-slate-400' : 'text-white/30'} w-5`}></i>
                                            {t.advanced_settings}
                                        </button>

                                        <button onClick={handleTestNotification} className={`w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-50' : 'text-white/70 hover:bg-white/[0.05] hover:text-white'} flex items-center gap-3 transition-colors`}>
                                            <i className={`fa-solid fa-bell ${isLightMode ? 'text-slate-400' : 'text-white/30'} w-5`}></i>
                                            {t.test_notification}
                                        </button>

                                        <button onClick={async () => {
                                            setIsRefreshing(true);
                                            try { await refreshData(); window.location.reload(); } catch (err) { setIsRefreshing(false); }
                                        }} className={`w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-50' : 'text-white/70 hover:bg-white/[0.05] hover:text-white'} flex items-center justify-between group transition-colors`}>
                                            <div className="flex items-center gap-3">
                                                <i className={`fa-solid fa-arrows-rotate ${isLightMode ? 'text-slate-400' : 'text-white/30'} w-5 ${isRefreshing ? 'fa-spin' : ''}`}></i>
                                                {t.refresh_data}
                                            </div>
                                            {isRefreshing && <Spinner size="xs" />}
                                        </button>

                                        {!originalAdminUser && (
                                             <button onClick={() => { setAppState('role_selection'); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm ${isLightMode ? 'text-slate-700 hover:bg-slate-50 border-slate-100' : 'text-white/70 hover:bg-white/[0.05] hover:text-white border-white/[0.06]'} border-t mt-1 flex items-center gap-3 transition-colors`}>
                                                <i className="fa-solid fa-users-viewfinder text-yellow-600 w-5"></i>
                                                {t.change_team}
                                             </button>
                                        )}

                                        <button onClick={logout} className={`w-full text-left px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-500/[0.08] ${isLightMode ? 'border-slate-100' : 'border-white/[0.06]'} border-t mt-1 flex items-center gap-3 transition-colors`}>
                                            <i className="fa-solid fa-right-from-bracket w-5"></i>
                                            {t.logout}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                <div className={`flex-1 overflow-hidden relative ${!showHeader ? 'pt-4 sm:pt-6' : ''}`}>
                    {/* Ambient Background Effect - Adjusted for Binance */}
                    {uiTheme !== 'binance' && uiTheme !== 'netflix' && (
                        <div className="fixed inset-0 pointer-events-none opacity-50 overflow-hidden">
                            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
                        </div>
                    )}
                    
                    {/* Intelligent Layout Container */}
                    <div className={`${uiTheme === 'binance' ? 'p-2 md:p-3' : 'p-2 md:p-3 lg:p-4 xl:p-5 2xl:p-6'} max-w-[2400px] mx-auto h-full w-full relative z-10 transition-all duration-300 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar`}>
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DesktopAdminLayout;
