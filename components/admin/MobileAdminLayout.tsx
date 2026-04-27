
import React, { useContext, useState, useRef, useEffect } from 'react';
import SidebarDrawer from './SidebarDrawer';
import { AppContext } from '../../context/AppContext';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';
import { translations } from '../../translations';
import Spinner from '../common/Spinner';
import EditProfileModal from '../common/EditProfileModal';
import AdvancedSettingsModal from '../common/AdvancedSettingsModal';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import BottomNavBar from './BottomNavBar';
import { useUI } from '../../context/UIContext';

interface MobileAdminLayoutProps {
    children: React.ReactNode;
    activeDashboard: string;
    currentAdminView: string;
    onNavChange: (id: string) => void;
    onReportSubNav: (id: any) => void;
    isReportSubMenuOpen: boolean;
    setIsReportSubMenuOpen: (open: boolean) => void;
    isProfileSubMenuOpen: boolean;
    setIsProfileSubMenuOpen: (open: boolean) => void;
    setEditProfileModalOpen: (open: boolean) => void;
    setAdvancedSettingsOpen: (open: boolean) => void;
}

const MobileAdminLayout: React.FC<MobileAdminLayoutProps> = ({ 
    children, 
    activeDashboard, 
    currentAdminView,
    onNavChange,
    onReportSubNav,
    isReportSubMenuOpen,
    setIsReportSubMenuOpen,
    isProfileSubMenuOpen,
    setIsProfileSubMenuOpen,
    setEditProfileModalOpen,
    setAdvancedSettingsOpen
}) => {
    const { setIsMobileMenuOpen, currentUser, logout, language, refreshData, setAppState, originalAdminUser, isSyncing } = useContext(AppContext);
    const { isBottomNavHidden } = useUI();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const t = translations[language];

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

    return (
        <div className="h-screen bg-gray-950 flex flex-col selection:bg-blue-500/30 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
            </div>

            {/* Mobile Header - Styled like standard Header.tsx */}
            <header className="flex-shrink-0 z-[60] bg-[#0f172a]/80 backdrop-blur-2xl border-b border-white/5 px-4 py-2 flex justify-between items-center shadow-lg relative" style={originalAdminUser ? { top: "40px" } : {}}>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 active:scale-90 transition-all"
                    >
                        <i className="fa-solid fa-bars text-lg"></i>
                    </button>
                    
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center border border-white/10 shadow-xl overflow-hidden p-1">
                             <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xs font-black text-white italic uppercase tracking-tighter leading-none">O-System</h1>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className={`w-1 h-1 rounded-full ${isSyncing ? 'bg-blue-400 animate-spin' : 'bg-blue-500 opacity-50'}`}></span>
                                <span className="text-[7px] text-blue-500 font-black uppercase tracking-[0.2em] opacity-80">{isSyncing ? 'Syncing' : 'ADMIN PANEL'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Profile Dropdown Container */}
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setDropdownOpen(!dropdownOpen)} 
                            className="flex items-center gap-2 p-1 pr-2.5 rounded-2xl bg-gray-800/50 border border-white/10 hover:bg-gray-800 transition-all active:scale-95 shadow-md group"
                        >
                            <UserAvatar 
                                avatarUrl={currentUser?.ProfilePictureURL}
                                name={currentUser?.FullName || ''}
                                className={`w-8 h-8 border-2 shadow-xl transition-all ${dropdownOpen ? 'border-blue-500' : 'border-white/5'}`}
                            />
                            <svg className={`w-3 h-3 text-gray-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {/* Dropdown Menu - Identical to Header.tsx */}
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-[#1a2235] border border-white/10 rounded-[1.8rem] shadow-[0_30px_70px_rgba(0,0,0,0.8)] py-3 z-[70] animate-fade-in-scale backdrop-blur-3xl overflow-hidden">
                                <div className="px-5 py-3 border-b border-white/5 mb-2">
                                    <p className="font-black text-white text-sm truncate">{currentUser?.FullName}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{currentUser?.Role}</p>
                                </div>
                                
                                <button onClick={() => { setEditProfileModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                    <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    {t.edit_profile}
                                </button>

                                <button onClick={() => { setAdvancedSettingsOpen(true); setDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                    <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    {t.advanced_settings}
                                </button>

                                <button onClick={handleTestNotification} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                    <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                    {t.test_notification}
                                </button>

                                <button onClick={async () => {
                                    setIsRefreshing(true);
                                    try { await refreshData(); window.location.reload(); } catch (err) { setIsRefreshing(false); }
                                }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <svg className={`w-4 h-4 opacity-60 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        {t.refresh_data}
                                    </div>
                                    {isRefreshing && <Spinner size="xs" />}
                                </button>

                                {/* Switch Role */}
                                {!originalAdminUser && (
                                     <button onClick={() => { setAppState('role_selection'); setDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors border-t border-white/5 mt-2 flex items-center gap-3">
                                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        {t.change_team}
                                     </button>
                                )}

                                <button onClick={logout} className="w-full text-left px-5 py-3 text-sm font-black text-red-400 hover:bg-red-500 hover:text-white transition-colors border-t border-white/5 mt-2 flex items-center gap-3">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    {t.logout}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Sidebar Drawer Component */}
            <SidebarDrawer 
                activeDashboard={activeDashboard}
                currentAdminView={currentAdminView}
                onNavChange={onNavChange}
                onReportSubNav={onReportSubNav}
                isReportSubMenuOpen={isReportSubMenuOpen}
                setIsReportSubMenuOpen={setIsReportSubMenuOpen}
                isProfileSubMenuOpen={isProfileSubMenuOpen}
                setIsProfileSubMenuOpen={setIsProfileSubMenuOpen}
                setEditProfileModalOpen={setEditProfileModalOpen}
                setAdvancedSettingsOpen={setAdvancedSettingsOpen}
            />

            {/* Content Area */}
            <main className={`flex-1 ${isBottomNavHidden ? 'pb-4' : 'pb-20'} px-2 pt-1.5 overflow-y-auto no-scrollbar relative z-10`}>
                <div className="max-w-xl mx-auto">
                    {children}
                </div>
            </main>

            {/* Mobile Navigation Bar */}
            {!isBottomNavHidden && <BottomNavBar activeDashboard={activeDashboard} onNavChange={onNavChange} />}

            {/* Aesthetic Home Indicator Support */}
            <div className="h-1 w-24 bg-white/5 rounded-full mx-auto mb-2 flex-shrink-0 opacity-0"></div>
        </div>
    );
};

export default MobileAdminLayout;
