
import React from 'react';
import SidebarDrawer from './SidebarDrawer';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';
import { AppContext } from '../../context/AppContext';

interface TabletAdminLayoutProps {
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

const TabletAdminLayout: React.FC<TabletAdminLayoutProps> = ({ 
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
    const { setIsMobileMenuOpen, currentUser } = React.useContext(AppContext);

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col selection:bg-blue-500/30">
            {/* Ambient Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]"></div>
            </div>

            {/* Tablet Header */}
            <header className="sticky top-0 z-40 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all border border-white/5 active:scale-95"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 p-1.5 border border-white/10">
                             <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white italic uppercase tracking-tighter leading-none">O-System</h1>
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">Tablet Admin</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-white leading-tight">{currentUser?.FullName}</p>
                        <p className="text-[10px] text-gray-500 font-mono uppercase">{currentUser?.Role}</p>
                    </div>
                    <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="md" className="ring-2 ring-white/10 shadow-md" />
                </div>
            </header>

            {/* Sidebar Drawer (Reusing existing component) */}
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
            <main className="flex-1 p-6 relative z-10 overflow-x-hidden">
                <div className="w-full mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default TabletAdminLayout;
