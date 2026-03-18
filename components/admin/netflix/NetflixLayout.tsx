
import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../../../context/AppContext';
import Sidebar from '../Sidebar';
import UserAvatar from '../../common/UserAvatar';
import { translations } from '../../../translations';
import Spinner from '../../common/Spinner';

interface NetflixLayoutProps {
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

const NetflixLayout: React.FC<NetflixLayoutProps> = ({ 
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
    const { currentUser, language, refreshData, setAppState, logout, originalAdminUser, advancedSettings } = useContext(AppContext);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const t = translations[language];
    const isLightMode = advancedSettings.themeMode === 'light';

    useEffect(() => {
        const handleScroll = (e: any) => {
            if (e.target.scrollTop > 50) setScrolled(true);
            else setScrolled(false);
        };
        const container = document.getElementById('netflix-scroll-container');
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, []);

    return (
        <div className={`flex h-screen w-full overflow-hidden transition-colors duration-500 ${isLightMode ? 'bg-[#f5f5f1] text-black' : 'bg-[#141414] text-white'}`}>
            {/* Netflix Sidebar (Customized via CSS classes in main Sidebar) */}
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
            
            <main className={`flex-1 flex flex-col h-screen transition-all duration-500 ease-in-out relative ${isSidebarCollapsed ? 'pl-20' : 'pl-64'}`}>
                
                <div id="netflix-scroll-container" className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth custom-scrollbar-hidden">
                    {/* Hero Area Gradient */}
                    {!isLightMode && (
                         <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-[#e50914]/20 via-[#141414]/40 to-[#141414] pointer-events-none -z-10"></div>
                    )}
                    
                    <div className="p-8 pt-8 max-w-[1800px] mx-auto min-h-screen">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NetflixLayout;
