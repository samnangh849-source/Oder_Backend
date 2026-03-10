
import React, { useContext } from 'react';
import Sidebar from './Sidebar';
import { AppContext } from '../../context/AppContext';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SidebarDrawerProps {
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
}

const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ 
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
    const { isMobileMenuOpen, setIsMobileMenuOpen } = useContext(AppContext);

    if (!isMobileMenuOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex overflow-hidden">
            <style>{`
                @keyframes slide-right {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-right {
                    animation: slide-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>

            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300" 
                onClick={() => setIsMobileMenuOpen(false)} 
            />
            
            {/* Drawer Container (Clean Design) */}
            <div className="relative w-[85%] max-w-[320px] h-full bg-[#020617] shadow-2xl animate-slide-right flex flex-col border-r border-white/10">
                
                {/* Mobile Header */}
                <div className="flex-shrink-0 px-6 pt-12 pb-6 flex items-center justify-between bg-gradient-to-b from-[#0f172a] to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40 border border-white/10 overflow-hidden p-1.5">
                             <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">O-System</h2>
                            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.25em] mt-1">Core Access</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 border border-white/5 transition-all active:scale-90"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                </div>

                {/* Sidebar Content Wrapper */}
                <div className="flex-grow overflow-hidden relative z-10">
                    <Sidebar 
                        isMobile={true}
                        activeDashboard={activeDashboard}
                        currentAdminView={currentAdminView}
                        isReportSubMenuOpen={isReportSubMenuOpen}
                        isProfileSubMenuOpen={isProfileSubMenuOpen}
                        onNavChange={(id) => {
                            onNavChange(id);
                            // Auto close drawer on navigation (except reports which is a toggle)
                            if (id !== 'reports') setIsMobileMenuOpen(false);
                        }}
                        onReportSubNav={(id) => { 
                            onReportSubNav(id); 
                            setIsMobileMenuOpen(false); 
                        }}
                        setIsReportSubMenuOpen={setIsReportSubMenuOpen}
                        setIsProfileSubMenuOpen={setIsProfileSubMenuOpen}
                        setEditProfileModalOpen={setEditProfileModalOpen}
                        setAdvancedSettingsOpen={setAdvancedSettingsOpen}
                    />
                </div>
            </div>
        </div>
    );
};

export default SidebarDrawer;
