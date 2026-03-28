
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

    // Click-outside handler for theme switcher popup (supports both mouse + touch)
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

    const uiTheme = advancedSettings?.uiTheme || 'default';

    const handleThemeChange = (theme: string) => {
        setAdvancedSettings(prev => ({ ...prev, uiTheme: theme as any }));
    };

    // Derive theme colors for error screens
    const isLightMode = advancedSettings?.themeMode === 'light';
    const bg = isLightMode ? '#F5F5F5' : '#0B0E11';
    const cardBg = isLightMode ? '#FFFFFF' : '#1E2329';
    const borderColor = isLightMode ? '#E6E8EA' : '#2B3139';
    const textPrimary = isLightMode ? '#1E2329' : '#EAECEF';
    const textMuted = isLightMode ? '#707A8A' : '#848E9C';
    const accentColor =
        uiTheme === 'netflix' ? '#e50914' :
        uiTheme === 'samsung' ? '#0381fe' :
        uiTheme === 'finance' ? '#10b981' :
        uiTheme === 'binance' ? (isLightMode ? '#FCD535' : '#F0B90B') :
        '#3b82f6';
    const accentText = (uiTheme === 'binance' || accentColor === '#FCD535' || accentColor === '#F0B90B')
        ? '#181A20' : '#ffffff';

    // 1. Permission Check
    if (!hasPermission('access_sales_portal')) {
        return (
            <div className={`min-h-screen flex items-center justify-center p-6 ui-${uiTheme}`} style={{ backgroundColor: bg }}>
                <div className="p-10 text-center max-w-md w-full" style={{ borderRadius: uiTheme === 'binance' ? '2px' : '0.5rem', backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="w-12 h-12 flex items-center justify-center mb-6 mx-auto" style={{ borderRadius: uiTheme === 'binance' ? '2px' : '0.5rem', backgroundColor: bg, border: `1px solid ${borderColor}` }}>
                        <ShieldX className="w-6 h-6 text-[#F6465D]" />
                    </div>
                    <h2 className="text-lg font-bold mb-3" style={{ color: textPrimary }}>
                        {language === 'km' ? 'ការចូលប្រើត្រូវបានបដិសេធ' : 'Access Denied'}
                    </h2>
                    <p className="text-sm mb-8" style={{ color: textMuted }}>
                        {language === 'km'
                            ? 'អ្នកមិនមានសិទ្ធិចូលប្រើប្រាស់ផ្នែកនេះទេ។ សូមទាក់ទង Admin។'
                            : 'You do not have permission to access this section. Please contact an Admin.'}
                    </p>
                    <button
                        onClick={onBackToRoleSelect}
                        className="flex items-center gap-2 px-6 py-2.5 font-semibold text-sm transition-all mx-auto active:scale-95"
                        style={{ borderRadius: uiTheme === 'binance' ? '2px' : '0.375rem', backgroundColor: accentColor, color: accentText }}
                    >
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
            <div className={`min-h-screen flex items-center justify-center p-6 ui-${uiTheme}`} style={{ backgroundColor: bg }}>
                <div className="p-10 text-center max-w-md w-full" style={{ borderRadius: uiTheme === 'binance' ? '2px' : '0.5rem', backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                    <div className="w-12 h-12 flex items-center justify-center mb-6 mx-auto" style={{ borderRadius: uiTheme === 'binance' ? '2px' : '0.5rem', backgroundColor: bg, border: `1px solid ${borderColor}` }}>
                        <AlertCircle className="w-6 h-6 text-[#F6465D]" />
                    </div>
                    <h2 className="text-lg font-bold mb-3" style={{ color: textPrimary }}>
                        {language === 'km' ? 'មិនទាន់មានក្រុម' : 'No Team Assigned'}
                    </h2>
                    <p className="text-sm mb-8" style={{ color: textMuted }}>
                        {language === 'km'
                            ? 'គណនីរបស់អ្នកមិនទាន់មានក្រុមការងារនៅឡើយទេ។ សូមទាក់ទងរដ្ឋបាលប្រព័ន្ធ។'
                            : 'Your account does not have a team assigned yet. Please contact a system administrator.'}
                    </p>
                    <button
                        onClick={onBackToRoleSelect}
                        className="flex items-center gap-2 px-6 py-2.5 font-semibold text-sm transition-all mx-auto active:scale-95"
                        style={{ borderRadius: uiTheme === 'binance' ? '2px' : '0.375rem', backgroundColor: accentColor, color: accentText }}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        {t.back}
                    </button>
                </div>
            </div>
        );
    }

    // 3. Render Appropriate View
    return (
        <div className={`user-journey-container h-full w-full relative ui-${uiTheme}`}>
            {/* Theme Switcher — inline to avoid remount on every render */}
            <div ref={themeSwitcherRef} className="hidden md:block fixed z-[70] group" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))', left: '1.5rem' }}>
                <button
                    onClick={() => setShowDisplaySettings(!showDisplaySettings)}
                    className={`w-12 h-12 ${uiTheme === 'binance' ? '' : 'rounded-full'} flex items-center justify-center transition-all shadow-lg active:scale-90 hover:shadow-xl`}
                    style={{
                        borderRadius: uiTheme === 'binance' ? '2px' : undefined,
                        backgroundColor: showDisplaySettings ? accentColor : cardBg,
                        border: `1px solid ${showDisplaySettings ? accentColor : borderColor}`,
                        color: showDisplaySettings ? accentText : textMuted,
                    }}
                    title={language === 'km' ? 'ការកំណត់ UI' : 'UI Settings'}
                >
                    <Monitor className="w-5 h-5" />
                </button>

                {showDisplaySettings && (
                    <div className={`absolute bottom-16 left-0 ${uiTheme === 'binance' ? '' : 'rounded-xl'} p-3 w-52 shadow-2xl`} style={{ borderRadius: uiTheme === 'binance' ? '2px' : undefined, backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
                        <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: `1px solid ${borderColor}` }}>
                            <Palette className="w-4 h-4" style={{ color: accentColor }} />
                            <span className="text-xs font-semibold" style={{ color: textPrimary }}>
                                {language === 'km' ? 'រចនាប័ទ្ម' : 'UI Display'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {[
                                { id: 'default', label: 'Default', icon: '🏠' },
                                { id: 'binance', label: 'Finance Pro', icon: '🪙' },
                                { id: 'netflix', label: 'Entertainment', icon: '🎬' },
                                { id: 'finance', label: 'Market', icon: '💎' },
                                { id: 'samsung', label: 'Samsung', icon: '📱' },
                                { id: 'neumorphism', label: 'Soft UI', icon: '🔘' },
                            ].map(themeOption => (
                                <button
                                    key={themeOption.id}
                                    onClick={() => {
                                        handleThemeChange(themeOption.id);
                                        setShowDisplaySettings(false);
                                    }}
                                    className={`flex items-center justify-between px-3 py-2.5 ${uiTheme === 'binance' ? '' : 'rounded-lg'} text-xs font-medium transition-all active:scale-95`}

                                    style={{
                                        borderRadius: uiTheme === 'binance' ? '2px' : undefined,
                                        backgroundColor: uiTheme === themeOption.id ? accentColor : 'transparent',
                                        color: uiTheme === themeOption.id ? accentText : textMuted,
                                    }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">{themeOption.icon}</span>
                                        <span>{themeOption.label}</span>
                                    </div>
                                    {uiTheme === themeOption.id && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentText, opacity: 0.5 }} />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            {isMobile ? (
                <MobileUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />
            ) : (
                <DesktopUserJourney onBackToRoleSelect={onBackToRoleSelect} userTeams={userTeams} />
            )}
        </div>
    );
};

export default UserJourney;
