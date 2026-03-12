
import React, { useContext, useState, useRef, useEffect } from 'react';
import SidebarDrawer from './SidebarDrawer';
import { AppContext } from '../../context/AppContext';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';
import { translations } from '../../translations';
import Spinner from '../common/Spinner';

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
    const { setIsMobileMenuOpen, currentUser, logout, language, refreshData } = useContext(AppContext);
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

    return (
        <div className="h-screen bg-gray-950 flex flex-col selection:bg-blue-500/30 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
            </div>

            {/* Mobile Header */}
            <header className="flex-shrink-0 z-40 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 rounded-xl bg-white/5 text-gray-300 hover:text-white transition-all border border-white/5 active:scale-90"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40 p-1.5 border border-white/10">
                             <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white italic uppercase tracking-tighter leading-none">O-System</h1>
                            <span className="text-[8px] text-blue-400 font-black uppercase tracking-[0.2em]">ADMIN PANEL</span>
                        </div>
                    </div>
                </div>

                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center active:scale-95 transition-transform"
                    >
                        <UserAvatar 
                            avatarUrl={currentUser?.ProfilePictureURL} 
                            name={currentUser?.FullName || ''} 
                            size="sm" 
                            className={`ring-2 shadow-xl transition-all ${dropdownOpen ? 'ring-blue-500' : 'ring-white/5'}`} 
                        />
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-3 w-56 bg-[#1a2235] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] py-2 z-50 animate-fade-in-scale backdrop-blur-3xl overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-white/5 mb-1">
                                <p className="font-black text-white text-xs truncate">{currentUser?.FullName}</p>
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{currentUser?.Role}</p>
                            </div>
                            
                            <button onClick={() => { setEditProfileModalOpen(true); setDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-300 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {t.edit_profile}
                            </button>

                            <button onClick={() => { setAdvancedSettingsOpen(true); setDropdownOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-300 hover:bg-blue-600 transition-colors flex items-center gap-3">
                                <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {t.advanced_settings}
                            </button>

                            <button onClick={async () => {
                                setIsRefreshing(true);
                                try { await refreshData(); window.location.reload(); } catch (err) { setIsRefreshing(false); }
                            }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-300 hover:bg-blue-600 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <svg className={`w-3.5 h-3.5 opacity-60 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    {t.refresh_data}
                                </div>
                                {isRefreshing && <Spinner size="xs" />}
                            </button>

                            <button onClick={logout} className="w-full text-left px-4 py-2.5 text-xs font-black text-red-400 hover:bg-red-500 hover:text-white transition-colors border-t border-white/5 mt-1 flex items-center gap-3">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                {t.logout}
                            </button>
                        </div>
                    )}
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
            <main className="flex-1 pb-12 px-2 pt-1.5 overflow-y-auto no-scrollbar relative z-10">
                <div className="max-w-xl mx-auto">
                    {children}
                </div>
            </main>

            {/* Aesthetic Home Indicator Support */}
            <div className="h-1 w-24 bg-white/5 rounded-full mx-auto mb-4 flex-shrink-0"></div>
        </div>
    );
};

export default MobileAdminLayout;
