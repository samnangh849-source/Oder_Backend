
import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import EditProfileModal from './EditProfileModal';
import AdvancedSettingsModal from './AdvancedSettingsModal';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from './UserAvatar';
import { APP_LOGO_URL } from '../../constants';
import Spinner from './Spinner';
import { translations } from '../../translations';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface HeaderProps {
    onBackToRoleSelect: () => void;
    appState: string;
}

const Header: React.FC<HeaderProps> = ({ onBackToRoleSelect, appState }) => {
    const { 
        currentUser, logout, refreshData, originalAdminUser, 
        setIsChatOpen, unreadCount,
        isMobileMenuOpen, setIsMobileMenuOpen,
        language, setLanguage,
        mobilePageTitle, // Consuming the new state
        advancedSettings,
        showNotification
    } = useContext(AppContext);
    
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
    const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
    const { playNotify } = useSoundEffects();
    
    // FIX: Safely initialize notification permission to prevent crash on browsers without Notification support
    const [notificationPermission, setNotificationPermission] = useState(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return Notification.permission;
        }
        return 'denied'; // Default to denied/hidden if not supported
    });

    const dropdownRef = useRef<HTMLDivElement>(null);

    const t = translations[language];

    const isSystemAdmin = !!currentUser?.IsSystemAdmin;
    const isHybridAdmin = isSystemAdmin && (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean).length > 0;
    const isMobileAdmin = appState === 'admin_dashboard' && window.innerWidth < 768;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleLanguage = (lang: 'en' | 'km') => {
        setLanguage(lang);
    };

    const handleEnableNotifications = async () => {
        const granted = await requestNotificationPermission();
        if (granted && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    };

    const handleTestNotification = async () => {
        playNotify();
        await requestNotificationPermission();
        await sendSystemNotification(t.test_notification, t.test_notification_body);
        showNotification(t.test_notification_body, 'success');
        setDropdownOpen(false);
    };

    const handleDropdownToggle = () => {
        setDropdownOpen(!dropdownOpen);
    };

    const handleHomeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isSystemAdmin) return;
        try {
            const params = new URLSearchParams();
            params.set('view', 'admin_dashboard');
            params.set('tab', 'admin');
            params.set('subview', 'dashboard');
            const newUrl = window.location.pathname + '?' + params.toString();
            window.history.pushState(null, '', newUrl);
            window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
        } catch (err) {
            console.warn("Navigation failed:", err);
            window.location.reload();
        }
    };

    const handleLogout = () => {
        logout();
    };

    const handleBackClick = () => {
        onBackToRoleSelect();
    };

    if (!currentUser) return null;

    return (
        <>
            <header className="fixed top-0 left-0 right-0 bg-[#0f172a]/80 backdrop-blur-2xl border-b border-white/5 z-[60] p-2 sm:p-3 shadow-2xl transition-all duration-300"
                    style={originalAdminUser ? { top: '40px' } : {}}>
                <div className="w-full max-w-full mx-auto flex justify-between items-center px-2 sm:px-6">
                    
                    {/* Branding Section - Updated for Mobile Title Swap */}
                    <div 
                        className={`flex items-center gap-3 select-none ${isSystemAdmin ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all transform' : 'cursor-default'}`}
                        onClick={handleHomeClick}
                    >
                        {/* Custom Mobile Title (If set) */}
                        <div className={`md:hidden ${mobilePageTitle ? 'block' : 'hidden'}`}>
                             <h1 className="text-lg font-black text-white leading-tight truncate uppercase tracking-tight italic">
                                {mobilePageTitle}
                             </h1>
                        </div>

                        {/* Standard Logo (Hidden on mobile if title exists) */}
                        <div className={`flex items-center gap-3 ${mobilePageTitle ? 'hidden md:flex' : 'flex'}`}>
                            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center border border-white/10 shadow-xl overflow-hidden flex-shrink-0 relative group">
                                <img 
                                    src={convertGoogleDriveUrl(APP_LOGO_URL)} 
                                    alt="Logo" 
                                    className="w-full h-full object-contain p-1.5 relative z-10"
                                />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-sm sm:text-lg font-black text-white leading-tight truncate uppercase tracking-tighter italic">
                                    O-SYSTEM
                                </h1>
                                <p className="text-[8px] sm:text-[9px] text-blue-500 font-black uppercase tracking-[0.2em] opacity-80">
                                    CORE ENGINE
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="hidden md:block text-right mr-1">
                            <p className="font-black text-white text-sm truncate leading-none mb-1">
                                {advancedSettings?.enablePrivacyMode 
                                    ? 'User ****' 
                                    : currentUser.FullName}
                            </p>
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest opacity-70">{currentUser.Role}</p>
                        </div>
                        
                        {/* Notification Permission Bell (Visible if permission not granted) */}
                        {notificationPermission === 'default' && (
                            <button 
                                onClick={handleEnableNotifications}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-all active:scale-95 animate-pulse"
                                title="Enable Notifications"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            </button>
                        )}

                        <div className="relative" ref={dropdownRef}>
                            <button 
                                onClick={handleDropdownToggle} 
                                className="flex items-center gap-2 p-1 pr-3 rounded-2xl bg-gray-800/50 border border-white/10 hover:bg-gray-800 transition-all active:scale-95 shadow-md group"
                            >
                                <UserAvatar 
                                    avatarUrl={currentUser.ProfilePictureURL}
                                    name={currentUser.FullName}
                                    className="w-9 h-9 border-2 border-white/5 shadow-xl group-hover:scale-105 transition-transform"
                                />
                                <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {/* Dropdown Menu */}
                            {dropdownOpen && (
                                <div className="absolute right-0 mt-4 w-64 bg-[#1a2235] border border-white/10 rounded-[1.8rem] shadow-[0_30px_70px_rgba(0,0,0,0.7)] py-3 z-50 animate-fade-in-scale backdrop-blur-3xl overflow-hidden">
                                    <div className="px-5 py-3 border-b border-white/5 mb-2">
                                        <p className="font-black text-white text-sm truncate">
                                            {advancedSettings?.enablePrivacyMode 
                                                ? 'User ****' 
                                                : currentUser.FullName}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{currentUser.Role}</p>
                                    </div>
                                    
                                    {/* Edit Profile */}
                                    <button onClick={() => { setEditProfileModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                        <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        {t.edit_profile}
                                    </button>

                                    {/* Advanced Settings */}
                                    <button onClick={() => { setAdvancedSettingsOpen(true); setDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                        <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        {t.advanced_settings}
                                    </button>

                                    {/* Test Notification */}
                                    <button onClick={handleTestNotification} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                        <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                        {t.test_notification}
                                    </button>

                                    {/* Refresh Data */}
                                    <button onClick={async () => {
                                        setIsRefreshing(true);
                                        try { await refreshData(); window.location.reload(); } catch (err) { setIsRefreshing(false); }
                                    }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <svg className={`w-4 h-4 opacity-60 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            {t.refresh_data}
                                        </div>
                                        {isRefreshing && <Spinner size="sm" />}
                                    </button>

                                    {/* Language Switcher Section */}
                                    <div className="px-5 py-3 border-t border-white/5 mt-2 bg-black/20">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">{t.language}</p>
                                        <div className="flex bg-gray-900 rounded-xl p-1 border border-white/5">
                                            <button 
                                                onClick={() => toggleLanguage('en')}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-gray-500 hover:text-gray-300'}`}
                                            >
                                                ENGLISH
                                            </button>
                                            <button 
                                                onClick={() => toggleLanguage('km')}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${language === 'km' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-gray-500 hover:text-gray-300'}`}
                                            >
                                                ភាសាខ្មែរ
                                            </button>
                                        </div>
                                    </div>

                                    {/* Role Switch */}
                                    {!originalAdminUser && appState !== 'role_selection' && (
                                         <button onClick={() => { handleBackClick(); setDropdownOpen(false); }} className="w-full text-left px-5 py-3 text-sm font-bold text-gray-200 hover:bg-blue-600 transition-colors border-t border-white/5 mt-2 flex items-center gap-3">
                                            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                            {t.change_team}
                                         </button>
                                    )}

                                    {/* Logout */}
                                    <button onClick={handleLogout} className="w-full text-left px-5 py-3 text-sm font-black text-red-400 hover:bg-red-500 hover:text-white transition-colors border-t border-white/5 mt-2 flex items-center gap-3">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        {t.logout}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Admin Hamburger Menu */}
                        {isMobileAdmin && (
                            <button 
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 transition-all active:scale-90"
                                aria-label="Toggle Menu"
                            >
                                <div className="flex flex-col gap-1 items-center">
                                    <span className={`h-0.5 bg-blue-400 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'w-5 rotate-45 translate-y-1.5' : 'w-5'}`}></span>
                                    <span className={`h-0.5 bg-blue-400 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'w-0 opacity-0' : 'w-5'}`}></span>
                                    <span className={`h-0.5 bg-blue-400 rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'w-5 -rotate-45 -translate-y-1.5' : 'w-5'}`}></span>
                                </div>
                            </button>
                        )}

                        {/* Chat Button (Hidden on Mobile Admin to make space for Hamburger) */}
                        {!isMobileAdmin && (
                            <button 
                                onClick={() => setIsChatOpen(true)}
                                className="relative p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all active:scale-90 shadow-md"
                                aria-label="Open Chat"
                            >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-gray-900 animate-pulse">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </header>
            {editProfileModalOpen && <EditProfileModal onClose={() => setEditProfileModalOpen(false)} />}
            {advancedSettingsOpen && <AdvancedSettingsModal onClose={() => setAdvancedSettingsOpen(false)} />}
        </>
    );
};

export default Header;
