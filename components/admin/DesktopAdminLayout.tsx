
import React from 'react';
import Sidebar from './Sidebar';

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
    return (
        <div className="flex h-screen overflow-hidden bg-gray-950">
            {/* Fixed Sidebar */}
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
            
            {/* Dynamic Content Margin based on Sidebar State */}
            <main className={`flex-1 h-full overflow-hidden transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'pl-20' : 'pl-64'}`}>
                {/* Ambient Background Effect for Desktop */}
                <div className="fixed inset-0 pointer-events-none opacity-50 overflow-hidden">
                    <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
                </div>
                
                {/* 
                    Intelligent Layout Container:
                    - Optimized padding to prioritize data visibility
                */}
                <div className="p-2 md:p-3 lg:p-4 xl:p-5 2xl:p-6 max-w-[2400px] mx-auto h-full w-full relative z-10 transition-all duration-300 flex flex-col overflow-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default DesktopAdminLayout;
