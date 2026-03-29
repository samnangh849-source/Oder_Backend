import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { ShieldX, AlertCircle, ChevronLeft, Palette, Monitor } from 'lucide-react';
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
    const themeSwitcherRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Click-outside handler for theme switcher popup
    React.useEffect(() => {
        if (!showDisplaySettings) return;
        const handler = (e: MouseEvent | TouchEvent) => {
            if (themeSwitcherRef.current && !themeSwitcherRef.current.contains(e.target as Node)) {
                setShowDisplaySettings(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [showDisplaySettings]);

    // Neutral Dark Theme Constants (Replaces Binance Blue-tinted Darks)
    const terminalBg = '#080808'; 
    const terminalCard = '#121212';
    const terminalBorder = '#1F1F1F';
    const terminalText = '#EAECEF';
    const terminalMuted = '#848E9C';
    const terminalAccent = '#F0B90B'; // Binance Yellow
    const terminalAccentText = '#181A20';

    const uiTheme = advancedSettings?.uiTheme || 'default';

    const handleThemeChange = (theme: string) => {
        setAdvancedSettings(prev => ({ ...prev, uiTheme: theme as any }));
    };

    // Derive theme colors for transition parts (legacy support)
    const isLightMode = advancedSettings?.themeMode === 'light';
    const accentColor = 
        uiTheme === 'binance' ? (isLightMode ? '#FCD535' : '#F0B90B') :
        terminalAccent;

    if (!hasPermission('access_sales_portal')) {
        return (
            <div className="h-screen flex items-center justify-center font-sans" style={{ backgroundColor: terminalBg }}>
                <div className="p-10 text-center max-w-md w-full border" 
                     style={{ borderRadius: '2px', backgroundColor: terminalCard, borderColor: terminalBorder }}>
                    <div className="w-16 h-16 flex items-center justify-center mb-6 mx-auto" 
                         style={{ borderRadius: '2px', backgroundColor: '#F6465D10', border: `1px solid #F6465D20` }}>
                        <ShieldX className="w-8 h-8 text-[#F6465D]" />
                    </div>
                    <h2 className="text-xl font-bold mb-4 uppercase tracking-tight" style={{ color: terminalText }}>
                        {language === 'km' ? 'បដិសេធសិទ្ធិចូល' : 'Access Denied'}
                    </h2>
                    <p className="text-sm mb-10 leading-relaxed opacity-80" style={{ color: terminalText }}>
                        {language === 'km'
                            ? 'អ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់ផ្នែកនេះទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។'
                            : 'This account lacks the required clearance. Please contact administration for authorization.'}
                    </p>
                    <div className="mt-10 flex justify-start">
                        <button
                            onClick={onBackToRoleSelect}
                            className="flex items-center justify-center w-12 h-12 transition-all active:scale-95 shadow-lg"
                            style={{ borderRadius: '2px', backgroundColor: terminalAccent, color: terminalAccentText }}
                            title={t.back}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (userTeams.length === 0) {
        return (
            <div className="h-screen flex items-center justify-center font-sans" style={{ backgroundColor: terminalBg }}>
                <div className="p-10 text-center max-w-md w-full border" 
                     style={{ borderRadius: '2px', backgroundColor: terminalCard, borderColor: terminalBorder }}>
                    <div className="w-16 h-16 flex items-center justify-center mb-6 mx-auto" 
                         style={{ borderRadius: '2px', backgroundColor: '#F6465D10', border: `1px solid #F6465D20` }}>
                        <AlertCircle className="w-8 h-8 text-[#F6465D]" />
                    </div>
                    <h2 className="text-xl font-bold mb-4 uppercase tracking-tight" style={{ color: terminalText }}>
                        {language === 'km' ? 'មិនទាន់មានក្រុម' : 'No Team Assigned'}
                    </h2>
                    <p className="text-sm mb-10 leading-relaxed opacity-80" style={{ color: terminalText }}>
                        {language === 'km'
                            ? 'គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។'
                            : 'You are not assigned to any operational node. Please check with your supervisor.'}
                    </p>
                    <div className="mt-10 flex justify-start">
                        <button
                            onClick={onBackToRoleSelect}
                            className="flex items-center justify-center w-12 h-12 transition-all active:scale-95 shadow-lg"
                            style={{ borderRadius: '2px', backgroundColor: terminalAccent, color: terminalAccentText }}
                            title={t.back}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Render Appropriate View
    return (
        <div className={`user-journey-container h-screen overflow-hidden flex flex-col relative ui-${uiTheme}`} style={{ backgroundColor: terminalBg }}>
            {/* Theme Switcher */}
            <div ref={themeSwitcherRef} className="hidden md:block fixed z-[70] group" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))', left: '1.5rem' }}>
                <button
                    onClick={() => setShowDisplaySettings(!showDisplaySettings)}
                    className="w-12 h-12 flex items-center justify-center transition-all shadow-lg active:scale-90 hover:shadow-xl"
                    style={{
                        borderRadius: '2px',
                        backgroundColor: showDisplaySettings ? terminalAccent : terminalCard,
                        border: `1px solid ${showDisplaySettings ? terminalAccent : terminalBorder}`,
                        color: showDisplaySettings ? terminalAccentText : terminalMuted,
                    }}
                    title={language === 'km' ? 'ការកំណត់ UI' : 'UI Settings'}
                >
                    <Monitor className="w-5 h-5" />
                </button>

                {showDisplaySettings && (
                    <div className="absolute bottom-16 left-0 shadow-2xl" style={{ borderRadius: '4px', backgroundColor: terminalCard, border: `1px solid ${terminalBorder}`, width: '280px' }}>
                        {/* Header */}
                        <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${terminalBorder}` }}>
                            <div className="w-8 h-8 flex items-center justify-center" style={{ borderRadius: '4px', backgroundColor: `${terminalAccent}15` }}>
                                <Palette className="w-4 h-4" style={{ color: terminalAccent }} />
                            </div>
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: terminalText }}>
                                    {language === 'km' ? 'រចនាប័ទ្ម' : 'Display'}
                                </div>
                                <div className="text-[10px]" style={{ color: terminalMuted }}>
                                    {language === 'km' ? 'ជ្រើសរើសស្បែក' : 'Choose your theme'}
                                </div>
                            </div>
                        </div>

                        {/* Theme Grid */}
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'default', label: 'Default', icon: '🏠' },
                                    { id: 'binance', label: 'Finance Pro', icon: '🪙' },
                                    { id: 'netflix', label: 'Entertainment', icon: '🎬' },
                                    { id: 'finance', label: 'Market', icon: '💎' },
                                    { id: 'samsung', label: 'Samsung', icon: '📱' },
                                    { id: 'neumorphism', label: 'Soft UI', icon: '🔘' },
                                ].map(themeOption => {
                                    const isActive = uiTheme === themeOption.id;
                                    return (
                                        <button
                                            key={themeOption.id}
                                            onClick={() => {
                                                handleThemeChange(themeOption.id);
                                                setShowDisplaySettings(false);
                                            }}
                                            className="flex flex-col items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all active:scale-95"
                                            style={{
                                                borderRadius: '4px',
                                                backgroundColor: isActive ? terminalAccent : `${terminalBorder}80`,
                                                color: isActive ? terminalAccentText : terminalMuted,
                                                border: `1px solid ${isActive ? terminalAccent : 'transparent'}`,
                                            }}
                                        >
                                            <span className="text-xl">{themeOption.icon}</span>
                                            <span className="text-[11px] font-semibold">{themeOption.label}</span>
                                            {isActive && (
                                                <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: terminalAccentText, opacity: 0.4 }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 text-[10px] text-center" style={{ borderTop: `1px solid ${terminalBorder}`, color: terminalMuted }}>
                            {language === 'km' ? 'រចនាប័ទ្មបច្ចុប្បន្ន' : 'Current'}: <span style={{ color: terminalText }} className="font-semibold">
                                {[{ id: 'default', label: 'Default' }, { id: 'binance', label: 'Finance Pro' }, { id: 'netflix', label: 'Entertainment' }, { id: 'finance', label: 'Market' }, { id: 'samsung', label: 'Samsung' }, { id: 'neumorphism', label: 'Soft UI' }].find(t => t.id === uiTheme)?.label || 'Default'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-grow flex flex-col w-full">
                {isMobile ? (
                    <MobileUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />
                ) : (
                    <DesktopUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />
                )}
            </div>
        </div>
    );
};

export default UserJourney;
