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
    const { currentUser, language, refreshData, setAppState, logout, originalAdminUser, advancedSettings, setIsSidebarCollapsed, isSyncing } = useContext(AppContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const t = translations[language];

    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';
    const isCustomUI = advancedSettings?.uiTheme && advancedSettings?.uiTheme !== 'default';
    const showHeader = uiTheme === 'default';

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTestNotification = async () => {
        await requestNotificationPermission();
        await sendSystemNotification(t.test_notification, t.test_notification_body);
        setDropdownOpen(false);
    };

    // Sidebar widths based on theme and state
    const getSidebarWidth = () => {
        if (uiTheme === 'binance') return isSidebarCollapsed ? '64px' : '260px';
        return isSidebarCollapsed ? '80px' : '256px';
    };

    // Theme-specific Background
    const getPageBg = () => {
        if (uiTheme === 'binance') return 'bg-[#090B0F]';
        if (uiTheme === 'netflix') return 'bg-[#141414]';
        return isLightMode ? 'bg-slate-50' : 'bg-[#080b12]';
    };

    const pageLayerStyle: React.CSSProperties = uiTheme === 'binance'
        ? {
            backgroundImage: 'linear-gradient(180deg, rgba(252, 213, 53, 0.035), transparent 32%), linear-gradient(135deg, rgba(20, 184, 166, 0.028), transparent 42%), linear-gradient(90deg, rgba(255, 255, 255, 0.023) 1px, transparent 1px), linear-gradient(180deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
        }
        : isLightMode
            ? {
                backgroundImage: 'linear-gradient(180deg, rgba(37, 99, 235, 0.04), transparent 38%), linear-gradient(135deg, rgba(20, 184, 166, 0.035), transparent 42%), linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(180deg, rgba(15, 23, 42, 0.025) 1px, transparent 1px)',
                backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
            }
            : {
                backgroundImage: 'linear-gradient(180deg, rgba(37, 99, 235, 0.055), transparent 34%), linear-gradient(135deg, rgba(20, 184, 166, 0.04), transparent 44%), linear-gradient(90deg, rgba(255, 255, 255, 0.023) 1px, transparent 1px), linear-gradient(180deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px)',
                backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
            };

    return (
        <div className={`relative flex h-screen w-full ${getPageBg()} overflow-hidden ${isCustomUI ? 'custom-ui-active' : ''}`}>
            <div className="absolute inset-0 pointer-events-none" style={pageLayerStyle} aria-hidden="true"></div>
            <div className={`absolute inset-0 pointer-events-none ${isLightMode ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.40),rgba(248,250,252,0.72))]' : 'bg-[linear-gradient(180deg,rgba(5,8,14,0.18),rgba(5,8,14,0.62))]'}`} aria-hidden="true"></div>
            
            {/* Immersive Sidebar Integration */}
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
            
            {/* Main Content Area */}
            <main 
                className="relative z-10 flex-1 flex flex-col h-screen transition-all duration-300 ease-in-out overflow-hidden"
                style={{ marginLeft: getSidebarWidth() }}
            >
                {/* Binance Style Top Header */}
                {uiTheme === 'binance' && (
                    <header className="flex-shrink-0 z-[60] bg-[#090B0F]/90 backdrop-blur-xl border-b border-[#2B3139] px-6 py-2.5 flex justify-between items-center shadow-[0_12px_40px_rgba(0,0,0,0.3)]" style={originalAdminUser ? { top: '40px' } : {}}>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className="group relative p-2 -ml-1.5 rounded-md text-[#848E9C] hover:text-[#FCD535] transition-all focus:outline-none"
                            >
                                <div className="relative z-10">
                                    <i className={`fa-solid ${isSidebarCollapsed ? 'fa-arrow-right' : 'fa-arrow-left'} text-base transition-all duration-300 group-hover:scale-110`}></i>
                                </div>
                                <div className="absolute inset-0 bg-[#FCD535]/0 group-hover:bg-[#FCD535]/10 rounded-md transition-all duration-300"></div>
                            </button>
                            <div className="h-4 w-px bg-[#2B3139]"></div>
                            <h1 className="text-xs font-bold text-[#EAECEF] uppercase tracking-widest flex items-center gap-2">
                                <span>Terminal</span>
                                <span className="text-[9px] bg-[#FCD535]/10 text-[#FCD535] px-1.5 py-0.5 border border-[#FCD535]/30 font-black uppercase tracking-wider" style={{ borderRadius: '2px' }}>PRO</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-6">
                            <BinanceLiveIndicator isSyncing={isSyncing} language={language} />
                            
                            <div className="flex items-center gap-3 border-l border-[#2B3139] pl-6">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-bold text-[#EAECEF] leading-tight">{currentUser?.FullName}</p>
                                    <p className="text-[9px] text-[#848E9C] font-semibold">{currentUser?.Role}</p>
                                </div>
                                <UserAvatar
                                    avatarUrl={currentUser?.ProfilePictureURL}
                                    name={currentUser?.FullName || ''}
                                    className="w-8 h-8 rounded-sm border border-[#2B3139] shadow-inner"
                                />
                            </div>
                        </div>
                    </header>
                )}

                {/* Professional Default Header */}
                {showHeader && (
                    <header className={`h-16 flex-shrink-0 ${isLightMode ? 'bg-white/80 border-slate-200' : 'bg-[#090c12]/90 border-white/[0.08]'} backdrop-blur-2xl border-b flex items-center justify-between px-6 z-20 relative transition-all duration-300`} style={originalAdminUser ? { top: '40px' } : {}}>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                className={`
                                    group relative p-2.5 -ml-2 rounded-xl transition-all duration-300 focus:outline-none overflow-hidden
                                    ${isLightMode ? 'text-slate-500 hover:text-blue-600' : 'text-slate-400 hover:text-white'}
                                `}
                                title={isSidebarCollapsed ? t.expand_sidebar || "Expand" : t.collapse_sidebar || "Collapse"}
                            >
                                <div className="relative z-10 flex items-center justify-center">
                                    <i className={`
                                        fa-solid ${isSidebarCollapsed ? 'fa-arrow-right' : 'fa-arrow-left'} 
                                        text-xl transition-all duration-500 ease-out
                                        group-hover:scale-110
                                    `}></i>
                                </div>
                                {/* Animated background glow on hover */}
                                <div className={`
                                    absolute inset-0 transition-all duration-300 opacity-0 group-hover:opacity-100
                                    ${isLightMode ? 'bg-blue-50' : 'bg-white/5'}
                                `}></div>
                                <div className={`
                                    absolute bottom-0 left-0 h-0.5 w-0 bg-blue-500 transition-all duration-300 group-hover:w-full
                                `}></div>
                            </button>
                            
                            <div className="flex flex-col">
                                <h1 className={`text-lg font-bold ${isLightMode ? 'text-slate-900' : 'text-white'} truncate leading-tight`}>
                                    {activeDashboard === 'admin' ? (currentAdminView === 'dashboard' ? t.dashboard : t.performance) : (t[activeDashboard] || activeDashboard)}
                                </h1>
                                <div className={`text-[10px] font-medium uppercase tracking-[0.2em] ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    System Console
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Sync Status */}
                            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'} text-[10px] font-bold uppercase tracking-wider`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                                {isSyncing ? 'Syncing' : 'Connected'}
                            </div>

                            {/* Notifications */}
                            <button className={`relative p-2.5 rounded-xl ${isLightMode ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600' : 'text-white/40 hover:bg-white/5 hover:text-white'} focus:outline-none transition-all`}>
                                <i className="fa-regular fa-bell text-xl"></i>
                                <span className="absolute top-2.5 right-2.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-transparent"></span>
                            </button>

                            {/* Profile Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className={`flex items-center gap-3 p-1.5 rounded-xl border transition-all ${isLightMode ? (dropdownOpen ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300') : (dropdownOpen ? 'bg-white/10 border-blue-500/50' : 'bg-[#1a1d27]/50 border-white/[0.08] hover:border-white/20')} focus:outline-none`}
                                >
                                    <UserAvatar
                                        avatarUrl={currentUser?.ProfilePictureURL}
                                        name={currentUser?.FullName || ''}
                                        className="h-7 w-7 rounded-lg bg-slate-200 shadow-sm"
                                    />
                                    <div className="hidden sm:block text-left mr-1">
                                        <p className={`text-xs font-bold ${isLightMode ? 'text-slate-700' : 'text-white/90'} leading-none`}>{currentUser?.FullName}</p>
                                    </div>
                                    <i className={`fa-solid fa-chevron-down ${isLightMode ? 'text-slate-400' : 'text-white/30'} text-[10px] transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`}></i>
                                </button>

                                {dropdownOpen && (
                                    <div className={`absolute right-0 mt-3 w-64 ${isLightMode ? 'bg-white border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)]' : 'bg-[#1a1d27] border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.4)]'} border rounded-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden`}>
                                        <div className={`px-4 py-3 mb-1 border-b ${isLightMode ? 'border-slate-100 bg-slate-50/50' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                                            <p className={`text-sm font-black ${isLightMode ? 'text-slate-900' : 'text-white'} uppercase tracking-tight`}>{currentUser?.FullName}</p>
                                            <p className={`text-[10px] font-bold ${isLightMode ? 'text-blue-600' : 'text-blue-400'} uppercase tracking-widest mt-0.5`}>{currentUser?.Role}</p>
                                        </div>

                                        {[
                                            { id: 'profile', icon: 'fa-user-gear', label: t.edit_profile, action: () => setEditProfileModalOpen(true) },
                                            { id: 'settings', icon: 'fa-sliders', label: t.advanced_settings, action: () => setAdvancedSettingsOpen(true) },
                                            { id: 'notification', icon: 'fa-bell', label: t.test_notification, action: handleTestNotification },
                                            { id: 'refresh', icon: 'fa-arrows-rotate', label: t.refresh_data, action: async () => {
                                                setIsRefreshing(true);
                                                try { await refreshData(); window.location.reload(); } catch (err) { setIsRefreshing(false); }
                                            }, spinner: isRefreshing },
                                        ].map((item) => (
                                            <button 
                                                key={item.id}
                                                onClick={() => { item.action(); if(item.id !== 'refresh') setDropdownOpen(false); }} 
                                                className={`w-full text-left px-4 py-2.5 text-sm ${isLightMode ? 'text-slate-600 hover:bg-slate-50 hover:text-blue-600' : 'text-white/60 hover:bg-white/[0.05] hover:text-white'} flex items-center justify-between transition-all group`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <i className={`fa-solid ${item.icon} ${isLightMode ? 'text-slate-400 group-hover:text-blue-500' : 'text-white/30 group-hover:text-white'} w-5 transition-colors ${item.spinner ? 'fa-spin' : ''}`}></i>
                                                    <span className="font-medium">{item.label}</span>
                                                </div>
                                                {item.spinner && <Spinner size="xs" />}
                                            </button>
                                        ))}

                                        {!originalAdminUser && (
                                             <button onClick={() => { setAppState('role_selection'); setDropdownOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm ${isLightMode ? 'text-slate-600 hover:bg-yellow-50 hover:text-yellow-700 border-slate-100' : 'text-white/60 hover:bg-yellow-500/10 hover:text-yellow-500 border-white/[0.06]'} border-t mt-1 flex items-center gap-3 transition-all`}>
                                                <i className="fa-solid fa-users-viewfinder w-5"></i>
                                                <span className="font-medium">{t.change_team}</span>
                                             </button>
                                        )}

                                        <button onClick={logout} className={`w-full text-left px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/[0.08] ${isLightMode ? 'border-slate-100' : 'border-white/[0.06]'} border-t mt-1 flex items-center gap-3 transition-all`}>
                                            <i className="fa-solid fa-right-from-bracket w-5"></i>
                                            <span>{t.logout}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                )}

                {/* Main Dashboard Content */}
                <div className={`flex-1 overflow-hidden relative flex flex-col ${!showHeader && uiTheme !== 'binance' ? 'pt-4' : ''}`}>
                    <div className={`absolute inset-0 pointer-events-none ${isLightMode ? 'bg-white/20' : 'bg-[#05070c]/10'}`} aria-hidden="true"></div>
                    
                    {/* Content Wrapper with Intelligent Scrollbar */}
                    <div className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative z-10 ${uiTheme === 'binance' ? 'p-1.5' : 'p-3 md:p-4 lg:p-5'}`}>
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DesktopAdminLayout;
