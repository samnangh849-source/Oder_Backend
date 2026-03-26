
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { ShieldX, AlertCircle, ChevronLeft, Layout, Palette, Monitor } from 'lucide-react';
import MobileUserJourney from './MobileUserJourney';
import DesktopUserJourney from './DesktopUserJourney';

const UserJourney: React.FC<{ onBackToRoleSelect: () => void }> = ({ onBackToRoleSelect }) => {
    const { currentUser, language, hasPermission, advancedSettings, setAdvancedSettings } = useContext(AppContext);

    const userTeams = useMemo(() =>
        (currentUser?.Team || '').split(',').map(t => t.trim()).filter(Boolean),
        [currentUser]);

    const t = translations[language];

    // Responsive State
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
    const [showDisplaySettings, setShowDisplaySettings] = React.useState(false);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const uiTheme = advancedSettings?.uiTheme || 'default';
    
    const handleThemeChange = (theme: string) => {
        setAdvancedSettings(prev => ({ ...prev, uiTheme: theme as any }));
    };

    // 1. Permission Check
    if (!hasPermission('access_sales_portal')) {
        return (
            <div className="min-h-screen bg-bg-black flex items-center justify-center p-6">
                <div className="bg-card-bg border border-[#2B3139] rounded-md p-10 text-center max-w-md w-full shadow-2xl">
                    <div className="w-12 h-12 bg-bg-black rounded-md flex items-center justify-center border border-[#2B3139] mb-6 mx-auto">
                        <ShieldX className="w-6 h-6 text-[#F6465D]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#EAECEF] uppercase tracking-wider mb-3">Access Denied</h2>
                    <p className="text-secondary text-[11px] font-bold uppercase tracking-widest mb-8">អ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់ផ្នែកនេះទេ។ សូមទាក់ទង Admin។</p>
                    <button onClick={onBackToRoleSelect} className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-[#f0c51d] text-bg-black rounded-md font-bold uppercase tracking-widest text-[11px] transition-all mx-auto active:scale-95">
                        <ChevronLeft className="w-4 h-4" />
                        {t.back}
                    </button>
                </div>
            </div>
        );
    }

    // 2. Team Count Check
    if (userTeams.length === 0) {
        return (
            <div className="min-h-screen bg-bg-black flex items-center justify-center p-6">
                <div className="bg-card-bg border border-[#2B3139] rounded-md p-10 text-center max-w-md w-full shadow-2xl">
                    <div className="w-12 h-12 bg-bg-black rounded-md flex items-center justify-center border border-[#2B3139] mb-6 mx-auto">
                        <AlertCircle className="w-6 h-6 text-[#F6465D]" />
                    </div>
                    <h2 className="text-lg font-bold text-[#EAECEF] uppercase tracking-wider mb-3">Identification Error</h2>
                    <p className="text-secondary text-[11px] font-bold uppercase tracking-widest mb-8">គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។</p>
                    <button onClick={onBackToRoleSelect} className="flex items-center gap-2 px-8 py-2.5 bg-primary hover:bg-[#f0c51d] text-bg-black rounded-md font-bold uppercase tracking-widest text-[11px] transition-all mx-auto active:scale-95">
                        <ChevronLeft className="w-4 h-4" />
                        {t.back}
                    </button>
                </div>
            </div>
        );
    }

    const ThemeSwitcher = () => (
        <div className="fixed bottom-6 left-6 z-[70] group">
            <button 
                onClick={() => setShowDisplaySettings(!showDisplaySettings)}
                className="w-12 h-12 bg-[#1E2329] border border-[#2B3139] rounded-full flex items-center justify-center text-secondary hover:text-primary hover:border-primary transition-all shadow-xl active:scale-90"
                title="Display & UI Settings"
            >
                <Monitor className="w-5 h-5" />
            </button>
            
            {showDisplaySettings && (
                <div className="absolute bottom-16 left-0 bg-[#1E2329] border border-[#2B3139] rounded-xl p-3 w-48 shadow-2xl animate-reveal">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2B3139]">
                        <Palette className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-bold text-[#EAECEF] uppercase tracking-widest">UI Display</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                        {[
                            { id: 'default', label: 'Default View', icon: '🏠' },
                            { id: 'binance', label: 'Finance Pro', icon: '🪙' },
                            { id: 'netflix', label: 'Entertainment', icon: '🎬' },
                            { id: 'finance', label: 'Market Mode', icon: '💎' }
                        ].map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => {
                                    handleThemeChange(theme.id);
                                    setShowDisplaySettings(false);
                                }}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                    uiTheme === theme.id ? 'bg-primary text-bg-black' : 'text-secondary hover:bg-white/5 hover:text-[#EAECEF]'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span>{theme.icon}</span>
                                    <span>{theme.label}</span>
                                </div>
                                {uiTheme === theme.id && <div className="w-1 h-1 rounded-full bg-bg-black" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // 3. Render Appropriate View
    return (
        <div className={`user-journey-container h-full w-full relative ui-${uiTheme}`}>
            <ThemeSwitcher />
            {isMobile ? (
                <MobileUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />
            ) : (
                <DesktopUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />
            )}
        </div>
    );
};

export default UserJourney;

