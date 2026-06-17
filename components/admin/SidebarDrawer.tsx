
import React, { useContext } from 'react';
import Sidebar from './Sidebar';
import { AppContext } from '../../context/AppContext';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SidebarDrawerProps {
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
}

const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ 
    activeDashboard, 
    currentAdminView,
    activeReport,
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
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-700" 
                onClick={() => setIsMobileMenuOpen(false)} 
            />
            
            {/* Drawer Container (Modern Clean Design) */}
            <div className="relative w-[85%] max-w-[310px] h-full bg-[#080b12] shadow-[40px_0_100px_rgba(0,0,0,0.5)] animate-slide-right flex flex-col border-r border-white/5 overflow-hidden">
                <div
                    className="absolute inset-0 pointer-events-none opacity-40"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(37, 99, 235, 0.15) 0%, transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
                        backgroundSize: '100% 100%, 100% 40px',
                    }}
                    aria-hidden="true"
                ></div>
                
                {/* Mobile Header */}
                <div className="flex-shrink-0 px-6 pt-10 pb-6 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-xl shadow-blue-900/30 border border-white/10 overflow-hidden p-2 transform -rotate-2 hover:rotate-0 transition-transform duration-700">
                             <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
                        </div>
                        <div>
                            <h2 className="text-[18px] font-black text-white uppercase tracking-tighter leading-none italic">O-System</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                <p className="text-[10px] text-blue-400/80 font-black uppercase tracking-[0.2em]">Core Access</p>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 border border-white/5 transition-all active:scale-90"
                        aria-label="Close sidebar"
                    >
                        <i className="fa-solid fa-xmark text-base"></i>
                    </button>
                </div>

                {/* Sidebar Content Wrapper */}
                <div className="flex-grow overflow-hidden relative z-10">
                    <Sidebar 
                        isMobile={true}
                        activeDashboard={activeDashboard}
                        currentAdminView={currentAdminView}
                        activeReport={activeReport}
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
