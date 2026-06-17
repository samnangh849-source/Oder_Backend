
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
    activeReport?: string;
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
    activeDashboard, currentAdminView, activeReport, isReportSubMenuOpen, isProfileSubMenuOpen,
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
                { id: 'dashboard', component: 'admin', label: t.dashboard, icon: <i className="fa-solid fa-table-columns"></i> },
                { id: 'performance', component: 'admin', label: t.performance, icon: <i className="fa-solid fa-chart-pie"></i> },
                { id: 'reports', component: 'reports', label: t.reports, icon: <i className="fa-solid fa-file-invoice-dollar"></i> },
            ]
        },
        {
            title: t.management || 'Sittings',
            items: [
                { id: 'orders', component: 'orders', label: t.orders, icon: <i className="fa-solid fa-receipt"></i> },
                { id: 'fulfillment', component: 'fulfillment', label: t.fulfillment || 'Operations', icon: <i className="fa-solid fa-truck-fast"></i> },
                { id: 'inventory', component: 'inventory', label: t.inventory, icon: <i className="fa-solid fa-boxes-stacked"></i> },
            ]
        },
        {
            title: t.system || 'System',
            items: [
                { id: 'incentives', component: 'incentives', label: t.incentives || 'Incentives', icon: <i className="fa-solid fa-award"></i> },
                { id: 'audit', component: 'audit', label: t.audit || 'Audit Logs', icon: <i className="fa-solid fa-shield-halved"></i> },
                { id: 'settings', component: 'settings', label: t.settings, icon: <i className="fa-solid fa-gears"></i> },
            ]
        }
    ], [t]);

    const reportSections = useMemo(() => [
        { id: 'overview', title: t.overview, icon: <i className="fa-solid fa-eye"></i> },
        { id: 'performance', title: t.performance, icon: <i className="fa-solid fa-chart-simple"></i> },
        { id: 'profitability', title: t.profitability, icon: <i className="fa-solid fa-hand-holding-dollar"></i> },
        { id: 'forecasting', title: t.forecasting, icon: <i className="fa-solid fa-arrow-trend-up"></i> },
        { id: 'shipping', title: t.shipping_report, icon: <i className="fa-solid fa-truck-ramp-box"></i> },
        { id: 'sales_team', title: t.sales_team_report, icon: <i className="fa-solid fa-user-group"></i> },
        { id: 'sales_page', title: t.sales_page_report, icon: <i className="fa-solid fa-window-restore"></i> },
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
            case 'netflix':
                return {
                    container: isMobile ? "bg-[#141414]" : `bg-[#141414] border-black ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: "text-white bg-white/10 border-l-4 border-red-600 shadow-[inset_10px_0_20px_rgba(229,9,20,0.05)]",
                    itemHover: "text-gray-400 hover:text-white hover:bg-white/5",
                    accent: "#E50914",
                    textPrimary: "text-white",
                    textSecondary: "text-gray-500",
                    border: "border-transparent",
                    logoBg: "bg-[#141414]",
                    groupTitle: "text-gray-600"
                };
            case 'neumorphism':
                return {
                    container: isMobile ? "bg-[#e0e5ec]" : `bg-[#e0e5ec] border-transparent ${isSidebarCollapsed ? 'w-24' : 'w-72'}`,
                    itemActive: "text-blue-600 shadow-[inset_6px_6px_12px_#b8bec5,inset_-6px_-6px_12px_#ffffff] rounded-2xl",
                    itemHover: "text-gray-500 hover:text-blue-500",
                    accent: "#3b82f6",
                    textPrimary: "text-gray-700",
                    textSecondary: "text-gray-400",
                    border: "border-transparent",
                    logoBg: "bg-[#e0e5ec]",
                    groupTitle: "text-gray-400"
                };
            case 'samsung':
                return {
                    container: isMobile ? "bg-white" : `bg-white/80 border-transparent ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: "text-black bg-gray-100 rounded-[28px] shadow-sm",
                    itemHover: "text-gray-500 hover:text-black hover:bg-gray-50",
                    accent: "#000000",
                    textPrimary: "text-black",
                    textSecondary: "text-gray-500",
                    border: "border-transparent",
                    logoBg: "bg-white",
                    groupTitle: "text-gray-400"
                };
            case 'finance':
                return {
                    container: isMobile ? "bg-[#1a1c1e]" : `bg-[#1a1c1e] border-[#2c2e33] ${isSidebarCollapsed ? 'w-20' : 'w-64'}`,
                    itemActive: "text-[#00ffcc] bg-[#00ffcc]/10 border-r-2 border-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.1)]",
                    itemHover: "text-gray-400 hover:text-[#00ffcc] hover:bg-white/5",
                    accent: "#00ffcc",
                    textPrimary: "text-white",
                    textSecondary: "text-gray-500",
                    border: "border-[#2c2e33]",
                    logoBg: "bg-[#1a1c1e]",
                    groupTitle: "text-gray-600"
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
    
    const getSidebarLayerStyle = (): React.CSSProperties => {
        switch (uiTheme) {
            case 'binance':
                return { backgroundImage: 'linear-gradient(180deg, rgba(252, 213, 53, 0.05) 0%, transparent 40%)' };
            case 'netflix':
                return { backgroundImage: 'linear-gradient(180deg, rgba(229, 9, 20, 0.05) 0%, transparent 50%)' };
            case 'neumorphism':
                return {};
            case 'samsung':
                return { backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.02) 0%, transparent 40%)' };
            case 'finance':
                return { backgroundImage: 'linear-gradient(180deg, rgba(0, 255, 204, 0.03) 0%, transparent 40%)' };
            default:
                return isLightMode
                    ? { backgroundImage: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, transparent 60%), radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 50%)' }
                    : { backgroundImage: 'linear-gradient(180deg, rgba(37, 99, 235, 0.15) 0%, transparent 60%), radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.1) 0%, transparent 50%)' };
        }
    };

    const sidebarLayerStyle = getSidebarLayerStyle();

    const containerClasses = isMobile 
        ? `w-full flex flex-col h-full ${styles.container}`
        : `fixed left-0 top-0 h-screen border-r ${styles.border} z-50 transition-all duration-300 ease-in-out ${styles.container} flex flex-col ${uiTheme === 'neumorphism' ? 'shadow-[10px_10px_20px_#bebebe,-10px_-10px_20px_#ffffff]' : 'shadow-[25px_0_60px_rgba(0,0,0,0.03)]'}`;

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
                    className={`h-24 flex items-center justify-center shrink-0 relative z-10 group w-full`}
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
                            absolute left-[calc(100%-8px)] px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap shadow-xl pointer-events-none
                            opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-x-2 group-hover:translate-x-0 transition-all duration-300 z-[100]
                            ${isLightMode ? 'bg-white border border-slate-200 text-slate-700' : 'bg-[#1E2329] border border-[#2B3139] text-[#EAECEF]'}
                            after:content-[''] after:absolute after:top-1/2 after:-left-1 after:-translate-y-1/2 after:w-2 after:h-2 after:rotate-45 
                            ${isLightMode ? 'after:bg-white after:border-l after:border-b after:border-slate-200' : 'after:bg-[#1E2329] after:border-l after:border-b after:border-[#2B3139]'}
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
            <nav className={`flex-grow ${isSidebarCollapsed && !isMobile ? 'overflow-visible px-0 items-center' : 'overflow-y-auto custom-scrollbar overflow-x-hidden px-3'} py-4 space-y-7 relative z-10 flex flex-col`}>
                {navGroups.map((group, groupIdx) => (
                    <div key={groupIdx} className={`space-y-2 w-full flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
                        {(!isSidebarCollapsed || isMobile) && (
                            <h3 className={`px-4 text-[9px] font-black uppercase tracking-[0.25em] opacity-60 ${styles.groupTitle}`}>
                                {group.title}
                            </h3>
                        )}
                        <div className="space-y-1 w-full flex flex-col items-center">
                            {group.items.map((item) => {
                                const isReports = item.id === 'reports';
                                const isActive = (activeDashboard === item.component) && (item.component !== 'admin' || item.id === currentAdminView);
                                const isExpanded = isReports && isReportSubMenuOpen;
                                
                                return (
                                    <div key={item.id} className={`${isSidebarCollapsed && !isMobile ? 'relative group/nav' : 'w-full flex flex-col'} w-full flex justify-center`}>
                                        <button 
                                            onClick={() => {
                                                onNavChange(item.id);
                                                if (isSidebarCollapsed && !isMobile && item.id === 'reports') {
                                                    setIsSidebarCollapsed(false);
                                                }
                                            }} 
                                            className={`
                                                flex items-center transition-all duration-500 group relative
                                                ${isSidebarCollapsed && !isMobile ? 'w-14 h-14 justify-center mb-3 px-0' : 'w-full px-4 py-2.5 mb-1'}
                                                ${uiTheme === 'samsung' ? 'rounded-[24px]' : 'rounded-2xl'}
                                                ${isActive 
                                                    ? `${styles.itemActive}` 
                                                    : `${styles.itemHover}`
                                                }
                                                ${uiTheme === 'neumorphism' && !isActive ? 'shadow-[6px_6px_12px_#bebebe,-6px_-6px_12px_#ffffff] hover:shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff]' : ''}
                                            `}
                                        >
                                            {/* Active Visual Indicator - Theme Specific */}
                                            {isActive && (
                                                <div className={`
                                                    absolute transition-all duration-500
                                                    ${uiTheme === 'netflix' 
                                                        ? 'hidden' 
                                                        : isSidebarCollapsed && !isMobile 
                                                            ? 'inset-1 bg-blue-500/20 rounded-2xl border border-blue-500/30' 
                                                            : 'inset-y-2.5 left-0 w-1 bg-current opacity-100 rounded-r-full'}
                                                `}></div>
                                            )}

                                            {/* Custom Tooltip - Premium Glassmorphism */}
                                            {isSidebarCollapsed && !isMobile && (
                                                <div className={`
                                                    absolute left-[calc(100%-4px)] px-3.5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap shadow-xl pointer-events-none
                                                    opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible translate-x-3 group-hover/nav:translate-x-0 transition-all duration-500 z-[110]
                                                    ${isLightMode 
                                                        ? 'bg-white border border-slate-200 text-slate-800' 
                                                        : 'bg-[#1a1d27] border border-white/10 text-white'}
                                                    backdrop-blur-xl uppercase tracking-widest
                                                `}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={isActive ? 'text-blue-500' : 'opacity-60'}>{item.icon}</span>
                                                        {item.label}
                                                    </div>
                                                    <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] ${isLightMode ? 'border-r-white' : 'border-r-[#1a1d27]'}`}></div>
                                                </div>
                                            )}

                                            <div className={`flex items-center relative z-10 transition-all duration-500 ${(!isSidebarCollapsed || isMobile) ? 'gap-3.5 ' + (isActive ? 'translate-x-0.5' : 'group-hover:translate-x-1') : 'w-full justify-center'}`}>
                                                <div className={`relative flex items-center justify-center ${isSidebarCollapsed && !isMobile ? 'w-14 h-14' : 'min-w-[32px] h-8'} transition-all duration-500`}>
                                                    <span className={`text-[28px] flex items-center justify-center transition-all duration-500 ${isActive ? (isLightMode ? 'text-blue-600' : 'text-white') : (isLightMode ? 'text-slate-700' : 'text-slate-100 group-hover:text-white')} ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                                        {item.icon}
                                                    </span>
                                                    {isReports && (
                                                        <span className={`absolute ${isSidebarCollapsed && !isMobile ? 'top-2 right-2' : '-top-0.5 -right-0.5'} w-3 h-3 rounded-full border-2 ${isLightMode ? 'border-white' : 'border-[#080b12]'} ${isActive ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.9)]' : 'bg-slate-400 opacity-90'}`}></span>
                                                    )}
                                                </div>
                                                {(isMobile || !isSidebarCollapsed) && (
                                                    <span className={`text-[13.5px] font-bold tracking-tight ${isActive ? styles.textPrimary : styles.textSecondary + ' group-hover:' + styles.textPrimary}`}>
                                                        {item.label}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {isReports && (isMobile || !isSidebarCollapsed) && (
                                                <div className="ml-auto flex items-center gap-2">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isLightMode ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-slate-500'} uppercase tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity`}>
                                                        {reportSections.length}
                                                    </span>
                                                    <i className={`fa-solid fa-chevron-down text-[11px] transition-all duration-500 ${isExpanded ? 'rotate-180 opacity-100 text-current' : 'opacity-30 group-hover:opacity-70 group-hover:text-current'}`}></i>
                                                </div>
                                            )}
                                        </button>

                                        {/* Reports Submenu - Enhanced Nesting */}
                                        {(isMobile || !isSidebarCollapsed) && isReports && (
                                            <div className={`w-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'max-h-[500px] opacity-100 py-3' : 'max-h-0 opacity-0'} px-2`}>
                                                <div className={`space-y-0.5 border-l-2 ml-7 pl-3.5 relative ${isLightMode ? 'border-slate-100' : 'border-white/5'}`}>
                                                    {/* Connecting Line Visual Accent */}
                                                    <div className={`absolute left-[-2px] top-0 bottom-0 w-0.5 ${isLightMode ? 'bg-gradient-to-b from-blue-500/50 to-transparent' : 'bg-gradient-to-b from-blue-600/50 to-transparent'}`}></div>
                                                    
                                                    {reportSections.map(sub => {
                                                        const isSubActive = activeDashboard === 'reports' && activeReport === sub.id;
                                                        return (
                                                        <button 
                                                            key={sub.id}
                                                            onClick={() => {
                                                                onReportSubNav(sub.id);
                                                                if (isSidebarCollapsed && !isMobile) setIsReportSubMenuOpen(false);
                                                            }}
                                                            className={`
                                                                w-full group/sub flex items-center gap-3 py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide transition-all rounded-xl text-left 
                                                                ${uiTheme === 'binance' 
                                                                    ? (isSubActive ? 'text-[#FCD535] bg-[#2B3139]/50' : 'text-[#848E9C] hover:text-[#FCD535] hover:bg-[#2B3139]/30')
                                                                    : (isLightMode 
                                                                        ? (isSubActive ? 'text-blue-600 bg-blue-50 shadow-sm border border-blue-100/50' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100/50') 
                                                                        : (isSubActive ? 'text-white bg-white/10 shadow-lg border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5')
                                                                      )
                                                                }
                                                            `}
                                                        >
                                                            <span className={`text-[12px] transition-all duration-300 ${isSubActive ? 'opacity-100 text-current scale-110' : 'opacity-40 group-hover/sub:opacity-100 group-hover/sub:text-current'}`}>
                                                                {sub.icon}
                                                            </span>
                                                            <span className={`truncate transition-transform duration-300 ${isSubActive ? 'translate-x-0.5' : 'group-hover/sub:translate-x-0.5'}`}>{sub.title}</span>
                                                            {isSubActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor] animate-pulse"></div>}
                                                        </button>
                                                        );
                                                    })}
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
            <div className={`mt-auto border-t ${styles.border} p-4 transition-all duration-500 ${isLightMode ? 'bg-slate-50/50' : 'bg-black/10'} backdrop-blur-md`}>
                {(!isMobile && isSidebarCollapsed) ? (
                    <div className="flex flex-col items-center gap-4 py-2">
                        {/* Compact Profile Trigger */}
                        <div className="group relative">
                            <button onClick={() => setIsSidebarCollapsed(false)} className={`
                                p-0.5 rounded-full border-2 transition-all duration-500 group-hover:scale-110 focus:outline-none
                                ${isLightMode ? 'border-white bg-white shadow-md' : 'border-white/10 bg-white/5 shadow-xl'}
                            `}>
                                <UserAvatar 
                                    avatarUrl={currentUser?.ProfilePictureURL} 
                                    name={currentUser?.FullName || ''} 
                                    size="sm" 
                                />
                            </button>
                            <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#0b0f18] shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse pointer-events-none"></span>
                            
                            {/* Simple Tooltip for Profile */}
                            <div className={`
                                absolute left-[calc(100%+16px)] top-1/2 -translate-y-1/2 px-3 py-2 rounded-xl text-[11px] font-black whitespace-nowrap shadow-xl pointer-events-none
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-x-2 group-hover:translate-x-0 transition-all duration-300 z-[110]
                                ${isLightMode ? 'bg-white border border-slate-200 text-slate-700' : 'bg-[#1a1d27]/95 border border-white/10 text-white'}
                                uppercase tracking-widest
                            `}>
                                {currentUser?.FullName}
                                <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] ${isLightMode ? 'border-r-white' : 'border-r-[#1a1d27]/95'}`}></div>
                            </div>
                        </div>
                        
                        {/* Compact Action Buttons */}
                        <div className={`w-full flex flex-col items-center gap-2.5 pt-4 border-t ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                            {[
                                { id: 'lang', icon: 'fa-globe', onClick: () => setLanguage(language === 'en' ? 'km' : 'en'), label: language === 'en' ? 'ភាសាខ្មែរ' : 'English' },
                                { id: 'refresh', icon: `fa-arrows-rotate ${isRefreshing ? 'fa-spin text-blue-500' : ''}`, onClick: handleRefresh, label: t.refresh_data, disabled: isRefreshing },
                                { id: 'profile', icon: 'fa-user-gear', onClick: () => setEditProfileModalOpen(true), label: 'Settings' },
                                { id: 'switch', icon: 'fa-users-gear', onClick: () => setAppState('role_selection'), label: 'Switch Role', hide: originalAdminUser },
                                { id: 'logout', icon: 'fa-right-from-bracket', onClick: logout, label: 'Logout', isDanger: true }
                            ].filter(btn => !btn.hide).map(btn => (
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
                                    <i className={`fa-solid ${btn.icon} text-[14px] transition-transform duration-300 group-hover/btn:scale-110`}></i>
                                    
                                    {/* Tooltip for bottom actions */}
                                    <div className={`
                                        absolute left-[calc(100%+16px)] px-3.5 py-2 rounded-xl text-[10px] font-black whitespace-nowrap shadow-xl pointer-events-none
                                        opacity-0 invisible group-hover/btn:opacity-100 group-hover/btn:visible translate-x-3 group-hover/btn:translate-x-0 transition-all duration-500 z-[110]
                                        ${isLightMode ? 'bg-white/90 border border-slate-200 text-slate-700' : 'bg-[#1a1d27]/95 border border-white/10 text-white'}
                                        backdrop-blur-xl uppercase tracking-widest
                                    `}>
                                        {btn.label}
                                        <div className={`absolute left-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] ${isLightMode ? 'border-r-white/90' : 'border-r-[#1a1d27]/95'}`}></div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-0 relative z-50 bg-inherit">
                        {/* Profile Card / Toggle Button */}
                        <button 
                            onClick={() => setIsProfileSubMenuOpen(!isProfileSubMenuOpen)}
                            className={`
                                w-full group relative overflow-hidden flex items-center gap-3.5 p-3 rounded-2xl border transition-all duration-500 text-left focus:outline-none
                                ${isProfileSubMenuOpen ? (isLightMode ? 'bg-slate-100 border-blue-200' : 'bg-white/10 border-blue-500/30') : ''}
                                ${!isProfileSubMenuOpen && (isLightMode 
                                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200' 
                                    : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.12] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]')}
                            `}
                        >
                            {/* Gradient Background Decoration */}
                            <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none bg-gradient-to-r from-blue-500 to-indigo-600 ${isProfileSubMenuOpen ? 'opacity-10' : 'opacity-0 group-hover:opacity-10'}`}></div>
                            
                            <div className="relative flex-shrink-0 z-10">
                                <div className={`
                                    p-0.5 rounded-full border-2 transition-transform duration-500 ${isProfileSubMenuOpen ? 'rotate-6 scale-105' : 'group-hover:rotate-6'}
                                    ${isLightMode ? 'border-blue-100 bg-white' : 'border-blue-500/20 bg-blue-500/5'}
                                `}>
                                    <UserAvatar 
                                        avatarUrl={currentUser?.ProfilePictureURL} 
                                        name={currentUser?.FullName || ''} 
                                        size="md" 
                                        className="shadow-sm" 
                                    />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center">
                                    <span className="absolute h-4 w-4 rounded-full bg-green-500/30 animate-ping"></span>
                                    <span className={`relative block h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ${isLightMode ? 'ring-white' : 'ring-[#0b0f18]'} shadow-sm`}></span>
                                </div>
                            </div>
                            
                            <div className="min-w-0 flex-grow z-10">
                                <p className={`text-[14px] font-black ${styles.textPrimary} truncate uppercase tracking-tight leading-none mb-1.5`}>
                                    {currentUser?.FullName}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className={`
                                        text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-[0.1em]
                                        ${isLightMode 
                                            ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}
                                    `}>
                                        {currentUser?.Role}
                                    </span>
                                    {originalAdminUser && (
                                        <span className="h-1 w-1 rounded-full bg-yellow-500"></span>
                                    )}
                                </div>
                            </div>
                            
                            <div className={`
                                flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 z-10
                                ${isProfileSubMenuOpen ? (isLightMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]') : (isLightMode ? 'bg-slate-100 text-slate-400 group-hover:bg-blue-500 group-hover:text-white' : 'bg-white/5 text-slate-500 group-hover:bg-blue-600 group-hover:text-white')}
                            `}>
                                <i className={`fa-solid fa-chevron-up text-[10px] transition-transform duration-500 ${isProfileSubMenuOpen ? 'rotate-180' : ''}`}></i>
                            </div>
                        </button>

                        {/* Controls Container */}
                        <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isProfileSubMenuOpen ? 'max-h-[500px] opacity-100 pt-3' : 'max-h-0 opacity-0'}`}>
                            <div className="space-y-3 pb-1">
                                {/* Language Switcher - Premium Segmented Control */}
                                <div className={`
                                    flex p-1 rounded-xl border transition-all duration-500
                                    ${isLightMode ? 'bg-slate-100 border-slate-200 shadow-inner' : 'bg-black/40 border-white/5'}
                                `}>
                                    <button 
                                        onClick={() => setLanguage('en')} 
                                        className={`
                                            flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all duration-500 flex items-center justify-center gap-2
                                            ${language === 'en' 
                                                ? (isLightMode ? 'bg-white text-blue-600 shadow-md' : 'bg-white/10 text-blue-400 shadow-lg') 
                                                : 'text-slate-500 hover:text-slate-400'}
                                        `}
                                    >
                                        English
                                    </button>
                                    <button 
                                        onClick={() => setLanguage('km')} 
                                        className={`
                                            flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all duration-500 flex items-center justify-center gap-2
                                            ${language === 'km' 
                                                ? (isLightMode ? 'bg-white text-blue-600 shadow-md' : 'bg-white/10 text-blue-400 shadow-lg') 
                                                : 'text-slate-500 hover:text-slate-400'}
                                        `}
                                    >
                                        ភាសាខ្មែរ
                                    </button>
                                </div>

                                {/* Main Action Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        className={`
                                            flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-300
                                            ${isLightMode 
                                                ? 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50' 
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10'}
                                        `}
                                    >
                                        <i className={`fa-solid fa-arrows-rotate text-xs ${isRefreshing ? 'fa-spin text-blue-500' : ''}`}></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{t.refresh_data}</span>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setEditProfileModalOpen(true)}
                                        className={`
                                            flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-300
                                            ${isLightMode 
                                                ? 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50' 
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10'}
                                        `}
                                    >
                                        <i className="fa-solid fa-user-gear text-xs"></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Settings</span>
                                    </button>
                                </div>
                                
                                {/* Secondary Action Grid */}
                                <div className={`grid ${!originalAdminUser ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                    {!originalAdminUser && (
                                        <button 
                                            onClick={() => setAppState('role_selection')}
                                            className={`
                                                flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-300
                                                ${isLightMode 
                                                    ? 'bg-white border-slate-200 text-blue-600 hover:border-blue-300 hover:bg-blue-50' 
                                                    : 'bg-white/5 border-white/5 text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10'}
                                            `}
                                        >
                                            <i className="fa-solid fa-users-gear text-xs"></i>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Switch Role</span>
                                        </button>
                                    )}
                                    <button 
                                        onClick={logout}
                                        className={`
                                            flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border transition-all duration-300
                                            ${isLightMode 
                                                ? 'bg-white border-slate-200 text-red-500 hover:border-red-200 hover:bg-red-50' 
                                                : 'bg-white/5 border-white/5 text-red-400 hover:border-red-500/20 hover:bg-red-500/10'}
                                        `}
                                    >
                                        <i className="fa-solid fa-right-from-bracket text-xs"></i>
                                        <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
