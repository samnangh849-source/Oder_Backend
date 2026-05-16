
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import UserAvatar from '../common/UserAvatar';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { APP_LOGO_URL, WEB_APP_URL } from '../../constants';
import Spinner from '../common/Spinner';
import { translations } from '../../translations';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';

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
        setAppState, language, setLanguage, originalAdminUser, advancedSettings
    } = useContext(AppContext);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const t = translations[language];

    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refreshData();
            window.location.reload();
        } catch (err) {
            setIsRefreshing(false);
        }
    };

    const navGroups = useMemo(() => [
        {
            title: t.analysis || 'Analysis',
            items: [
                { id: 'dashboard', component: 'admin', label: t.dashboard, icon: <i className="fa-solid fa-chart-line"></i> },
                { id: 'performance', component: 'admin', label: t.performance, icon: <i className="fa-solid fa-gauge-high"></i> },
                { id: 'reports', component: 'reports', label: t.reports, icon: <i className="fa-solid fa-file-invoice"></i> },
            ]
        },
        {
            title: t.management || 'Management',
            items: [
                { id: 'orders', component: 'orders', label: t.orders, icon: <i className="fa-solid fa-receipt"></i> },
                { id: 'fulfillment', component: 'fulfillment', label: t.fulfillment || 'Operations', icon: <i className="fa-solid fa-truck-fast"></i> },
                { id: 'inventory', component: 'inventory', label: t.inventory, icon: <i className="fa-solid fa-box-open"></i> },
            ]
        },
        {
            title: t.system || 'System',
            items: [
                { id: 'incentives', component: 'incentives', label: t.incentives || 'Incentives', icon: <i className="fa-solid fa-gem"></i> },
                { id: 'settings', component: 'settings', label: t.settings, icon: <i className="fa-solid fa-sliders"></i> },
            ]
        }
    ], [t]);

    const reportSections = useMemo(() => [
        { id: 'overview', title: t.overview, icon: <i className="fa-solid fa-eye"></i> },
        { id: 'performance', title: t.performance, icon: <i className="fa-solid fa-chart-simple"></i> },
        { id: 'profitability', title: t.profitability, icon: <i className="fa-solid fa-dollar-sign"></i> },
        { id: 'forecasting', title: t.forecasting, icon: <i className="fa-solid fa-arrow-trend-up"></i> },
        { id: 'shipping', title: t.shipping_report, icon: <i className="fa-solid fa-truck"></i> },
        { id: 'sales_team', title: t.sales_team_report, icon: <i className="fa-solid fa-users"></i> },
        { id: 'sales_page', title: t.sales_page_report, icon: <i className="fa-solid fa-desktop"></i> },
    ], [t]);

    const getThemeStyles = () => {
        switch (uiTheme) {
            case 'binance':
                return {
                    container: isMobile ? "bg-[#0b0e11]" : `bg-[#0B0E11] border-[#2B3139] ${isSidebarCollapsed ? 'w-16' : 'w-[260px]'}`,
                    itemActive: "text-[#FCD535] bg-[#FCD535]/[0.05] border-r-2 border-[#FCD535] shadow-[inset_4px_0_15px_rgba(252,213,53,0.03)]",
                    itemHover: "text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]/40",
                    accent: "#FCD535",
                    textPrimary: "text-[#EAECEF]",
                    textSecondary: "text-[#848E9C]",
                    border: "border-[#2B3139]",
                    logoBg: "bg-[#0B0E11]",
                    groupTitle: "text-[#5E6673]"
                };
            default:
                return {
                    container: isMobile
                        ? (isLightMode ? "bg-white" : "bg-[#0d0f15]")
                        : `${isLightMode ? 'bg-white border-slate-200' : 'bg-[#080b12] border-white/[0.08]'} ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: isLightMode
                        ? "text-blue-600 bg-blue-50/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-blue-100"
                        : "text-white bg-blue-600/[0.1] shadow-[inset_0_0_20px_rgba(59,130,246,0.08)] border border-blue-500/20",
                    itemHover: isLightMode
                        ? "text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.03]",
                    accent: "#3b82f6",
                    textPrimary: isLightMode ? "text-slate-900" : "text-white",
                    textSecondary: isLightMode ? "text-slate-500" : "text-slate-400",
                    border: isLightMode ? "border-slate-200" : "border-white/[0.06]",
                    logoBg: isLightMode ? "bg-white" : "bg-[#080b12]",
                    groupTitle: isLightMode ? "text-slate-400" : "text-slate-500"
                };
        }
    };

    const styles = getThemeStyles();
    
    const sidebarLayerStyle: React.CSSProperties = uiTheme === 'binance'
        ? {
            backgroundImage: 'linear-gradient(180deg, rgba(252, 213, 53, 0.05) 0%, transparent 40%)',
        }
        : isLightMode
            ? {
                backgroundImage: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, transparent 60%), radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 50%)',
            }
            : {
                backgroundImage: 'linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, transparent 60%), radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.1) 0%, transparent 50%)',
            };

    const containerClasses = isMobile 
        ? `w-full flex flex-col h-full ${styles.container}`
        : `fixed left-0 top-0 h-screen border-r ${styles.border} z-50 transition-all duration-300 ease-in-out ${styles.container} flex flex-col shadow-[25px_0_60px_rgba(0,0,0,0.03)]`;

    return (
        <aside className={`${containerClasses} select-none backdrop-blur-2xl z-[100] ${!isMobile ? 'overflow-visible' : 'overflow-hidden'}`}>
            {/* Background Decorative Layers */}
            <div className="absolute inset-0 pointer-events-none opacity-40" style={sidebarLayerStyle} aria-hidden="true"></div>
            
            {/* Sidebar Toggle - Premium Handle */}
            {!isMobile && uiTheme !== 'binance' && (
                <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className={`
                        absolute -right-4 top-1/2 -translate-y-1/2 z-[200] h-9 w-9 rounded-full 
                        flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus:outline-none
                        ${isLightMode 
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_8px_20px_rgba(59,130,246,0.35)]' 
                            : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-[0_8px_25px_rgba(0,0,0,0.4)]'}
                        group hover:scale-110 active:scale-90 border-2 border-white/90 backdrop-blur-sm
                    `}
                    title={isSidebarCollapsed ? t.expand_sidebar || 'Expand' : t.collapse_sidebar || 'Collapse'}
                >
                    <div className="relative flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                        <i className={`
                            fa-solid ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'} 
                            text-[13px] font-black text-white transition-all duration-500
                            ${isSidebarCollapsed ? 'group-hover:translate-x-0.5' : 'group-hover:-translate-x-0.5'}
                        `}></i>
                    </div>
                    
                    {/* Visual Ring for better definition */}
                    <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"></div>

                    {/* Pulsing effect when collapsed to catch attention */}
                    {isSidebarCollapsed && (
                        <span className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping -z-10"></span>
                    )}
                </button>
            )}
            
            {/* Logo Area */}
            {!isMobile && (
                <div 
                    className={`h-24 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-6'} shrink-0 relative z-10`}
                >
                    <div className={`
                        flex items-center justify-center rounded-xl transition-all duration-700
                        ${isSidebarCollapsed ? 'w-12 h-12 shadow-blue-500/20 shadow-lg' : 'w-10 h-10 shadow-blue-500/20 shadow-md'}
                        ${uiTheme === 'binance' ? 'bg-[#FCD535]' : 'bg-gradient-to-br from-blue-600 to-indigo-700 border border-white/10'}
                    `}>
                        <img 
                            src={convertGoogleDriveUrl(APP_LOGO_URL)} 
                            alt="Logo" 
                            className={`w-6 h-6 object-contain transition-transform duration-700 ${isSidebarCollapsed ? 'scale-110' : ''} ${uiTheme === 'binance' ? 'brightness-0' : 'brightness-0 invert'}`} 
                        />
                    </div>
                    
                    {/* Custom Logo Tooltip */}
                    {isSidebarCollapsed && (
                        <div className={`
                            absolute left-[calc(100%+16px)] px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap shadow-xl pointer-events-none
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-x-2 group-hover:translate-x-0 transition-all duration-300 z-[100]
                            ${isLightMode ? 'bg-white border border-slate-200 text-slate-700' : 'bg-[#1E2329] border border-[#2B3139] text-[#EAECEF]'}
                        `}>
                            {t.admin_panel}
                        </div>
                    )}

                    {!isSidebarCollapsed && (
                        <div className="ml-3.5 flex flex-col min-w-0">
                            <h1 className={`text-[15px] font-black uppercase tracking-tighter leading-tight ${styles.textPrimary} italic`}>
                                O-System
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse`}></span>
                                <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${isLightMode ? 'text-blue-600' : 'text-blue-400'}`}>
                                    Terminal PRO
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation Section */}
            <nav className={`flex-grow ${isSidebarCollapsed && !isMobile ? 'overflow-visible' : 'overflow-y-auto custom-scrollbar overflow-x-hidden'} py-4 px-3 space-y-7 relative z-10`}>
                {navGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className="space-y-2">
                        {(!isSidebarCollapsed || isMobile) && (
                            <h3 className={`px-4 text-[9px] font-black uppercase tracking-[0.25em] opacity-60 ${styles.groupTitle}`}>
                                {group.title}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isReports = item.id === 'reports';
                                const isActive = (activeDashboard === item.component) && (item.component !== 'admin' || item.id === currentAdminView);
                                const isExpanded = isReports && isReportSubMenuOpen;
                                
                                return (
                                    <div key={item.id} className="relative group/nav">
                                        <button 
                                            onClick={() => onNavChange(item.id)} 
                                            className={`
                                                w-full flex items-center transition-all duration-500 group py-2.5 rounded-2xl relative
                                                ${isSidebarCollapsed && !isMobile ? 'px-0 justify-center h-12 mb-1' : 'px-4 mb-0.5'}
                                                ${isActive 
                                                    ? `${styles.itemActive}` 
                                                    : `${styles.itemHover}`
                                                }
                                            `}
                                        >
                                            {/* Active Visual Indicator - Floating Bar */}
                                            {isActive && (
                                                <div className={`
                                                    absolute rounded-full transition-all duration-500
                                                    ${isSidebarCollapsed && !isMobile 
                                                        ? 'inset-1.5 bg-blue-500/10 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                                                        : 'inset-y-2.5 left-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}
                                                `}></div>
                                            )}

                                            {/* Custom Tooltip - Premium Glassmorphism */}
                                            {isSidebarCollapsed && !isMobile && (
                                                <div className={`
                                                    absolute left-[calc(100%+20px)] px-3.5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.2)] pointer-events-none
                                                    opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible translate-x-3 group-hover/nav:translate-x-0 transition-all duration-500 z-[110]
                                                    ${isLightMode 
                                                        ? 'bg-white/90 border border-slate-200 text-slate-800' 
                                                        : 'bg-[#1a1d27]/95 border border-white/10 text-white'}
                                                    backdrop-blur-xl uppercase tracking-widest
                                                `}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={isActive ? 'text-blue-500' : 'text-slate-400'}>{item.icon}</span>
                                                        {item.label}
                                                    </div>
                                                    {/* Triangle pointer */}
                                                    <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] ${isLightMode ? 'border-r-white/90' : 'border-r-[#1a1d27]/95'}`}></div>
                                                </div>
                                            )}

                                            <div className={`flex items-center relative z-10 transition-all duration-500 ${(!isSidebarCollapsed || isMobile) ? 'gap-3.5 ' + (isActive ? 'translate-x-0.5' : 'group-hover:translate-x-1') : 'justify-center ' + (isActive ? 'scale-110 translate-y-[-1px]' : 'group-hover:scale-125 group-hover:translate-y-[-2px]')}`}>
                                                <div className="relative">
                                                    <span className={`text-[18px] flex items-center justify-center w-5 transition-all duration-500 ${isActive ? (uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-500') : (isLightMode ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-500 group-hover:text-blue-400')}`}>
                                                        {item.icon}
                                                    </span>
                                                    {/* Submenu Indicator Dot */}
                                                    {isReports && (
                                                        <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 ${isLightMode ? 'border-white' : 'border-[#080b12]'} ${isActive ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-400 opacity-60'}`}></span>
                                                    )}
                                                </div>
                                                {(isMobile || !isSidebarCollapsed) && (
                                                    <span className={`text-[13px] font-bold tracking-tight ${isActive ? styles.textPrimary : styles.textSecondary + ' group-hover:' + styles.textPrimary}`}>
                                                        {item.label}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {isReports && (isMobile || !isSidebarCollapsed) && (
                                                <div className="ml-auto flex items-center gap-2">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isLightMode ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'} uppercase tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity`}>
                                                        {reportSections.length}
                                                    </span>
                                                    <i className={`fa-solid fa-chevron-down text-[11px] transition-all duration-500 ${isExpanded ? 'rotate-180 text-blue-500 opacity-100' : 'opacity-30 group-hover:opacity-70 group-hover:text-blue-400'}`}></i>
                                                </div>
                                            )}
                                        </button>

                                        {/* Reports Submenu - Enhanced Nesting */}
                                        {(isMobile || !isSidebarCollapsed) && (
                                            <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'max-h-[500px] opacity-100 py-3' : 'max-h-0 opacity-0'} px-2`}>
                                                <div className={`space-y-0.5 border-l-2 ml-7 pl-3.5 relative ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                                                    {/* Connecting Line Visual Accent */}
                                                    <div className={`absolute left-[-2px] top-0 bottom-0 w-0.5 ${isLightMode ? 'bg-gradient-to-b from-blue-500/50 to-transparent' : 'bg-gradient-to-b from-blue-600/50 to-transparent'}`}></div>
                                                    
                                                    {reportSections.map(sub => (
                                                        <button 
                                                            key={sub.id}
                                                            onClick={() => onReportSubNav(sub.id)}
                                                            className={`w-full group/sub flex items-center gap-3 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide transition-all rounded-xl text-left ${uiTheme === 'binance' ? 'text-[#848E9C] hover:text-[#FCD535] hover:bg-[#2B3139]/30' : (isLightMode ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50/50' : 'text-slate-500 hover:text-white hover:bg-white/5')}`}
                                                        >
                                                            <span className={`text-[12px] opacity-40 group-hover/sub:opacity-100 transition-all duration-300 ${isLightMode ? 'text-slate-400 group-hover/sub:text-blue-500' : 'text-slate-500 group-hover/sub:text-blue-400'}`}>
                                                                {sub.icon}
                                                            </span>
                                                            <span className="truncate group-hover/sub:translate-x-0.5 transition-transform duration-300">{sub.title}</span>
                                                            <i className="fa-solid fa-arrow-right-long ml-auto text-[10px] opacity-0 -translate-x-2 group-hover/sub:opacity-100 group-hover/sub:translate-x-0 transition-all duration-300"></i>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom Profile Section */}
            <div className={`mt-auto border-t ${styles.border} p-4 transition-all duration-300 ${isLightMode ? 'bg-slate-50/80' : 'bg-black/20'}`}>
                {(!isMobile && isSidebarCollapsed) ? (
                    <div className="flex flex-col items-center gap-3 py-1">
                        <div className="group relative mb-2">
                            <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="sm" className={`border-2 ${isLightMode ? 'border-white' : 'border-slate-800'} shadow-lg group-hover:scale-110 transition-transform cursor-pointer`} />
                            <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[#0b0f18] shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
                        </div>
                        
                        <div className={`w-full flex flex-col gap-2 pt-3 border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                            {[
                                { id: 'lang', icon: 'fa-globe', onClick: () => setLanguage(language === 'en' ? 'km' : 'en'), label: language === 'en' ? 'ភាសាខ្មែរ' : 'English' },
                                { id: 'refresh', icon: `fa-arrows-rotate ${isRefreshing ? 'fa-spin text-blue-500' : ''}`, onClick: handleRefresh, label: t.refresh_data, disabled: isRefreshing },
                                { id: 'profile', icon: 'fa-user-gear', onClick: () => setEditProfileModalOpen(true), label: 'Profile Settings' },
                                { id: 'logout', icon: 'fa-right-from-bracket', onClick: logout, label: 'Logout', isDanger: true }
                            ].map(btn => (
                                <button 
                                    key={btn.id}
                                    onClick={btn.onClick}
                                    disabled={btn.disabled}
                                    className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 relative group/btn
                                        ${btn.isDanger 
                                            ? (isLightMode ? 'bg-white border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:shadow-red-500/10' : 'bg-white/5 border-white/5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20') 
                                            : (isLightMode ? 'bg-white border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-md' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10 hover:border-white/20')}
                                    `}
                                >
                                    <i className={`fa-solid ${btn.icon} text-[13px] transition-transform duration-300 group-hover/btn:scale-110`}></i>
                                    
                                    {/* Tooltip for bottom actions */}
                                    <div className={`
                                        absolute left-[calc(100%+20px)] px-3 py-2 rounded-xl text-[10px] font-black whitespace-nowrap shadow-xl pointer-events-none
                                        opacity-0 invisible group-hover/btn:opacity-100 group-hover/btn:visible translate-x-3 group-hover/btn:translate-x-0 transition-all duration-500 z-[110]
                                        ${isLightMode ? 'bg-white/90 border border-slate-200 text-slate-700' : 'bg-[#1a1d27]/95 border border-white/10 text-white'}
                                        backdrop-blur-xl uppercase tracking-widest
                                    `}>
                                        {btn.label}
                                        {/* Triangle pointer */}
                                        <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] ${isLightMode ? 'border-r-white/90' : 'border-r-[#1a1d27]/95'}`}></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Profile Card */}
                        <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-500 ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08]'}`}>
                            <div className="relative flex-shrink-0 group">
                                <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="md" className={`border-2 ${isLightMode ? 'border-slate-50' : 'border-white/5'} shadow-md group-hover:scale-105 transition-transform duration-500`} />
                                <span className="absolute bottom-0.5 right-0.5 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#0b0f18] shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></span>
                            </div>
                            <div className="min-w-0 flex-grow">
                                <p className={`text-[12px] font-black ${styles.textPrimary} truncate uppercase tracking-tight`}>
                                    {currentUser?.FullName}
                                </p>
                                <div className={`flex items-center gap-2 mt-0.5`}>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${isLightMode ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'} uppercase tracking-widest`}>
                                        {currentUser?.Role}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Language & Actions Row */}
                        <div className="flex flex-col gap-2.5">
                            <div className={`flex p-1 rounded-xl ${isLightMode ? 'bg-slate-200/50' : 'bg-black/40'} border ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                                <button 
                                    onClick={() => setLanguage('en')} 
                                    className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all duration-300 ${language === 'en' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-slate-500 hover:text-slate-400'}`}
                                >
                                    ENGLISH
                                </button>
                                <button 
                                    onClick={() => setLanguage('km')} 
                                    className={`flex-1 py-1.5 text-[9px] font-black rounded-lg transition-all duration-300 ${language === 'km' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-slate-500 hover:text-slate-400'}`}
                                >
                                    ភាសាខ្មែរ
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    className={`flex items-center justify-center p-2.5 rounded-xl border transition-all duration-300 ${isLightMode ? 'bg-white border-slate-200 hover:border-blue-300 hover:text-blue-600 shadow-sm hover:shadow-md' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10 text-slate-500 hover:text-white'}`}
                                    title={t.refresh_data}
                                >
                                    <i className={`fa-solid fa-arrows-rotate text-[13px] ${isRefreshing ? 'fa-spin text-blue-500' : ''}`}></i>
                                </button>
                                <button 
                                    onClick={() => setEditProfileModalOpen(true)}
                                    className={`flex items-center justify-center p-2.5 rounded-xl border transition-all duration-300 ${isLightMode ? 'bg-white border-slate-200 hover:border-blue-300 hover:text-blue-600 shadow-sm hover:shadow-md' : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10 text-slate-500 hover:text-white'}`}
                                    title="Profile Settings"
                                >
                                    <i className="fa-solid fa-user-gear text-[13px]"></i>
                                </button>
                                <button 
                                    onClick={logout}
                                    className={`flex items-center justify-center p-2.5 rounded-xl border transition-all duration-300 ${isLightMode ? 'bg-white border-slate-200 hover:border-red-300 hover:text-red-600 shadow-sm hover:shadow-md' : 'bg-white/5 border-white/5 hover:border-red-500/20 hover:bg-red-500/5 text-slate-500 hover:text-red-400'}`}
                                    title="Logout"
                                >
                                    <i className="fa-solid fa-right-from-bracket text-[13px]"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
