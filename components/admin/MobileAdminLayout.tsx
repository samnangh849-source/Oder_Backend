
import React, { useContext } from 'react';
import SidebarDrawer from './SidebarDrawer';
import { AppContext } from '../../context/AppContext';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';

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
    const { setIsMobileMenuOpen, currentUser } = useContext(AppContext);

    return (
        <div className="h-screen bg-gray-950 flex flex-col selection:bg-blue-500/30 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]"></div>
            </div>

            {/* Mobile Header */}
            <header className="flex-shrink-0 z-40 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 px-3 py-1.5 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-all border border-white/5 active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-700 rounded flex items-center justify-center shadow-lg shadow-blue-900/20 p-1 border border-white/10">
                             <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white italic uppercase tracking-tighter leading-none">O-System</h1>
                            <span className="text-[7px] text-blue-400 font-bold uppercase tracking-[0.2em]">Mobile Admin</span>
                        </div>
                    </div>
                </div>

                <UserAvatar avatarUrl={currentUser?.ProfilePictureURL} name={currentUser?.FullName || ''} size="xs" className="ring-1 ring-white/10 shadow-md" />
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
