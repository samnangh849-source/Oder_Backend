import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from './Modal';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import { translations } from '../../translations';
import { NOTIFICATION_SOUNDS } from '../../constants';

interface AdvancedSettingsModalProps {
    onClose: () => void;
}

type SettingsTab = 'general' | 'privacy' | 'display';

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({ onClose }) => {
    const { advancedSettings, setAdvancedSettings, language, showNotification, currentUser } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [isTesting, setIsTesting] = useState(false);

    const t = translations[language || 'en'];
    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';

    if (!advancedSettings || !setAdvancedSettings) return null;

    // Theme-specific styles
    const getModalBg = () => {
        if (uiTheme === 'netflix') return isLightMode ? 'bg-[#f5f5f1]' : 'bg-[#141414]';
        if (uiTheme === 'samsung') return isLightMode ? 'bg-[#f2f2f7]' : 'bg-black';
        return isLightMode ? 'bg-white' : 'bg-black';
    };

    const getSidebarBg = () => {
        if (uiTheme === 'netflix') return isLightMode ? 'bg-white' : 'bg-black';
        if (uiTheme === 'samsung') return isLightMode ? 'bg-white/50 backdrop-blur-xl' : 'bg-[#121212]';
        return isLightMode ? 'bg-gray-50' : 'bg-black';
    };

    const getAccentColor = () => {
        if (uiTheme === 'netflix') return '#e50914';
        if (uiTheme === 'samsung') return '#0381fe';
        return '#1DB954'; // Spotify green for default
    };

    const accentColor = getAccentColor();

    const handleTestNotification = async () => {
        setIsTesting(true);
        try {
            await requestNotificationPermission();
            await sendSystemNotification(t.test_notification, t.test_notification_body);
            showNotification(t.test_notification_body, 'success');
        } catch (err) {
            console.error("Test notification failed", err);
        } finally {
            setTimeout(() => setIsTesting(false), 1000);
        }
    };

    const toggleFloatingAlerts = () => {
        setAdvancedSettings(prev => ({
            ...prev,
            enableFloatingAlerts: !prev.enableFloatingAlerts
        }));
    };

    const togglePrivacyMode = () => {
        setAdvancedSettings(prev => ({
            ...prev,
            enablePrivacyMode: !prev.enablePrivacyMode
        }));
    };

    const toggleSecurityLevel = () => {
        setAdvancedSettings(prev => ({
            ...prev,
            securityLevel: prev.securityLevel === 'high' ? 'standard' : 'high'
        }));
    };

    const setUiTheme = (theme: 'default' | 'neumorphism' | 'samsung' | 'netflix') => {
        setAdvancedSettings(prev => ({ ...prev, uiTheme: theme }));
    };

    const setThemeMode = (mode: 'light' | 'dark') => {
        setAdvancedSettings(prev => ({ ...prev, themeMode: mode }));
    };

    return (
        <Modal isOpen={true} onClose={onClose} fullScreen={true}>
            <div className={`flex flex-col md:flex-row h-screen w-screen ${getModalBg()} ${isLightMode ? 'text-black' : 'text-white'} overflow-hidden font-custom shadow-none border-none transition-colors duration-500`}>
                {/* Dynamic Sidebar */}
                <aside className={`w-full md:w-[280px] ${getSidebarBg()} p-4 flex flex-col flex-shrink-0 border-r ${isLightMode ? 'border-gray-200' : 'border-white/5'} relative z-20 transition-colors duration-500`}>
                    <div className="px-4 py-6 flex items-center gap-3">
                        <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-500"
                            style={{ backgroundColor: accentColor, boxShadow: `0 0 20px ${accentColor}4D` }}
                        >
                            <svg className={`w-6 h-6 ${isLightMode && uiTheme !== 'netflix' ? 'text-white' : 'text-black'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        </div>
                        <h2 className="text-xl font-black tracking-tighter uppercase italic">{t.advanced_settings}</h2>
                    </div>

                    <nav className="flex flex-row md:flex-col gap-1 mt-4 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'general', label: t.general_settings, icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
                            { id: 'display', label: t.display_ui, icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
                            { id: 'privacy', label: t.privacy_security, icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }
                        ].map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                                    className={`flex items-center gap-4 px-5 py-4 rounded-xl transition-all group whitespace-nowrap ${
                                        isActive 
                                        ? (isLightMode ? 'bg-gray-100 text-black' : 'bg-[#282828] text-white') 
                                        : (isLightMode ? 'text-gray-500 hover:text-black hover:bg-gray-50' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]')
                                    }`}
                                >
                                    <svg 
                                        className={`w-5 h-5 transition-colors duration-300 ${isActive ? '' : 'text-gray-500 group-hover:text-current'}`} 
                                        style={{ color: isActive ? accentColor : undefined }}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
                                    ><path d={tab.icon} /></svg>
                                    <span className="text-[14px] font-black uppercase tracking-wider">{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="mt-auto hidden md:block p-6">
                        <div className={`${isLightMode ? 'bg-gray-50' : 'bg-[#121212]'} p-6 rounded-[1.5rem] border ${isLightMode ? 'border-gray-200' : 'border-white/5'} space-y-4 shadow-inner`}>
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest leading-none">Subsystem Active</p>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}></div>
                                <span className={`text-xs font-black font-mono ${isLightMode ? 'text-gray-700' : 'text-white'}`}>v4.2.0-PRO</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className={`flex-1 flex flex-col ${isLightMode ? 'bg-white' : 'bg-[#121212]'} overflow-hidden relative transition-colors duration-500`}>
                    {/* Header with Dynamic Gradient */}
                    <header 
                        className="flex-shrink-0 px-8 py-10 flex justify-between items-end border-b transition-all duration-500"
                        style={{ 
                            background: `linear-gradient(to bottom, ${accentColor}1A, transparent)`,
                            borderBottomColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
                        }}
                    >
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-2">{t.advanced_settings}</p>
                            <h2 className={`text-4xl md:text-6xl font-black ${isLightMode ? 'text-black' : 'text-white'} uppercase tracking-tighter italic`}>
                                {activeTab === 'general' ? t.general_settings : activeTab === 'display' ? t.display_ui : t.privacy_security}
                            </h2>
                        </div>
                        <button onClick={onClose} className={`w-12 h-12 ${isLightMode ? 'bg-gray-100 hover:bg-red-50' : 'bg-black/40 hover:bg-red-500/20'} text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all border ${isLightMode ? 'border-gray-200' : 'border-white/5'} shadow-2xl active:scale-90`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </header>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10 pb-32">
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-fade-in-up">
                                {/* Toggle Style Item */}
                                <div className={`flex items-center justify-between group p-2 rounded-xl ${isLightMode ? 'hover:bg-gray-50' : 'hover:bg-white/5'} transition-colors`}>
                                    <div className="space-y-1">
                                        <h3 className={`text-base font-black ${isLightMode ? 'text-gray-900' : 'text-white'} uppercase tracking-tight`}>{t.floating_alerts}</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">{t.floating_alerts_desc}</p>
                                    </div>
                                    <button 
                                        onClick={toggleFloatingAlerts}
                                        className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${advancedSettings.enableFloatingAlerts ? '' : 'bg-[#727272]'}`}
                                        style={{ backgroundColor: advancedSettings.enableFloatingAlerts ? accentColor : undefined }}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${advancedSettings.enableFloatingAlerts ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className={`h-px ${isLightMode ? 'bg-gray-100' : 'bg-white/5'}`}></div>

                                {/* Slider Item: Grace Period */}
                                <div className="space-y-6 p-2">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <h3 className={`text-base font-black ${isLightMode ? 'text-gray-900' : 'text-white'} uppercase tracking-tight`}>{t.edit_grace_period || 'Edit Grace Period'}</h3>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">{language === 'km' ? 'កំណត់រយៈពេល (នាទី) ដែលអ្នកអាចកែប្រែការកម្មង់បាន' : 'Time limit to edit your own orders (minutes)'}</p>
                                        </div>
                                        <span className="text-2xl font-black font-mono leading-none" style={{ color: accentColor }}>{Math.round((advancedSettings.orderEditGracePeriod || 43200) / 60)}<span className="text-[10px] text-gray-500 uppercase ml-1">min</span></span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" max="1440" step="1" 
                                        value={Math.round((advancedSettings.orderEditGracePeriod || 43200) / 60)} 
                                        onChange={(e) => setAdvancedSettings(prev => ({ ...prev, orderEditGracePeriod: parseInt(e.target.value) * 60 }))}
                                        className={`w-full h-1 ${isLightMode ? 'bg-gray-200' : 'bg-[#4d4d4d]'} rounded-full appearance-none cursor-pointer transition-all`}
                                        style={{ accentColor: accentColor }}
                                    />
                                </div>

                                {/* Slider Item: Placing Order */}
                                <div className="space-y-6 p-2">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <h3 className={`text-base font-black ${isLightMode ? 'text-gray-900' : 'text-white'} uppercase tracking-tight`}>{t.placing_order_grace_period || 'Placing Order Grace Period'}</h3>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">{t.placing_order_grace_period_desc || 'Time limit for placing orders (seconds)'}</p>
                                        </div>
                                        <span className="text-2xl font-black font-mono leading-none" style={{ color: accentColor }}>{advancedSettings.placingOrderGracePeriod || 5}<span className="text-[10px] text-gray-500 uppercase ml-1">sec</span></span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="3" max="60" step="1" 
                                        value={advancedSettings.placingOrderGracePeriod || 5} 
                                        onChange={(e) => setAdvancedSettings(prev => ({ ...prev, placingOrderGracePeriod: parseInt(e.target.value) }))}
                                        className={`w-full h-1 ${isLightMode ? 'bg-gray-200' : 'bg-[#4d4d4d]'} rounded-full appearance-none cursor-pointer transition-all`}
                                        style={{ accentColor: accentColor }}
                                    />
                                </div>

                                {/* Notification Sound List */}
                                <div className="space-y-6 pt-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{t.notification_sound}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {NOTIFICATION_SOUNDS.map(sound => {
                                            const isSelected = advancedSettings.notificationSound === sound.id;
                                            return (
                                                <button
                                                    key={sound.id}
                                                    onClick={() => {
                                                        setAdvancedSettings(prev => ({ ...prev, notificationSound: sound.id }));
                                                        const audio = new Audio(sound.url);
                                                        audio.volume = advancedSettings.notificationVolume ?? 1;
                                                        audio.play().catch(() => {});
                                                    }}
                                                    className={`p-5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                                                        isSelected 
                                                        ? (isLightMode ? 'bg-gray-50 border-transparent shadow-md' : 'bg-[#282828] border-transparent shadow-xl') 
                                                        : (isLightMode ? 'bg-transparent border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-black' : 'bg-transparent border-white/5 text-gray-400 hover:bg-[#1a1a1a] hover:text-white')
                                                    }`}
                                                    style={{ color: isSelected ? accentColor : undefined }}
                                                >
                                                    <span className="text-sm font-black uppercase tracking-widest">{sound.name}</span>
                                                    {isSelected && <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_12px_currentcolor]" style={{ backgroundColor: accentColor }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Volume Slider */}
                                <div className={`space-y-6 pt-6 border-t ${isLightMode ? 'border-gray-100' : 'border-white/5'}`}>
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{t.alert_volume}</h4>
                                        <span className="text-sm font-black font-mono" style={{ color: accentColor }}>{Math.round((advancedSettings.notificationVolume || 1) * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.01" 
                                        value={advancedSettings.notificationVolume ?? 1} 
                                        onChange={(e) => setAdvancedSettings(prev => ({ ...prev, notificationVolume: parseFloat(e.target.value) }))}
                                        className={`w-full h-1 ${isLightMode ? 'bg-gray-200' : 'bg-[#4d4d4d]'} rounded-full appearance-none cursor-pointer`}
                                        style={{ accentColor: accentColor }}
                                    />
                                </div>

                                {/* Music Volume Slider */}
                                <div className={`space-y-6 pt-6 border-t ${isLightMode ? 'border-gray-100' : 'border-white/5'}`}>
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{t.music_volume || 'Music Volume'}</h4>
                                        <span className="text-sm font-black font-mono" style={{ color: accentColor }}>{Math.round((advancedSettings.musicVolume ?? 0.3) * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.01" 
                                        value={advancedSettings.musicVolume ?? 0.3} 
                                        onChange={(e) => setAdvancedSettings(prev => ({ ...prev, musicVolume: parseFloat(e.target.value) }))}
                                        className={`w-full h-1 ${isLightMode ? 'bg-gray-200' : 'bg-[#4d4d4d]'} rounded-full appearance-none cursor-pointer`}
                                        style={{ accentColor: accentColor }}
                                    />
                                </div>

                                {/* Action Button */}
                                <div className="pt-10">
                                    <button 
                                        onClick={handleTestNotification}
                                        disabled={isTesting}
                                        className="w-full md:w-auto px-12 py-5 text-black rounded-full font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-95 shadow-2xl disabled:opacity-50"
                                        style={{ backgroundColor: accentColor }}
                                    >
                                        {isTesting ? 'Testing Audio Subsystem...' : t.test_notification}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'display' && (
                            <div className="space-y-10 animate-fade-in-up">
                                <section className="space-y-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{t.theme_mode}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setThemeMode('light')}
                                            className={`p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${advancedSettings.themeMode === 'light' ? 'bg-white text-black border-black shadow-2xl' : (isLightMode ? 'bg-gray-50 border-transparent text-gray-400' : 'bg-[#181818] border-transparent text-gray-500 hover:bg-[#282828] hover:text-white')}`}
                                        >
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M14.5 12a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>
                                            <span className="text-xs font-black uppercase tracking-widest">{t.mode_light}</span>
                                        </button>
                                        <button
                                            onClick={() => setThemeMode('dark')}
                                            className={`p-8 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${advancedSettings.themeMode === 'dark' ? 'text-black border-transparent shadow-xl' : (isLightMode ? 'bg-gray-50 border-transparent text-gray-400' : 'bg-[#181818] border-transparent text-gray-500 hover:bg-[#282828] hover:text-white')}`}
                                            style={{ backgroundColor: advancedSettings.themeMode === 'dark' ? accentColor : undefined }}
                                        >
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                                            <span className="text-xs font-black uppercase tracking-widest">{t.mode_dark}</span>
                                        </button>
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">{t.ui_style}</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {[
                                            { id: 'default', label: t.ui_default, icon: '🏠' },
                                            { id: 'neumorphism', label: t.ui_neumorphism, icon: '🫧' },
                                            { id: 'samsung', label: t.ui_samsung, icon: '🪐' },
                                            { id: 'netflix', label: t.ui_netflix, icon: '🎬' }
                                        ].map(theme => {
                                            const isSelected = advancedSettings.uiTheme === theme.id || (!advancedSettings.uiTheme && theme.id === 'default');
                                            return (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => setUiTheme(theme.id as any)}
                                                    className={`p-6 rounded-2xl transition-all border-2 text-center flex flex-col items-center gap-3 ${
                                                        isSelected 
                                                        ? (isLightMode ? 'bg-white text-black shadow-lg' : 'bg-[#282828] text-white shadow-xl') 
                                                        : (isLightMode ? 'bg-gray-50 border-transparent text-gray-400 hover:text-black' : 'bg-[#181818] border-transparent text-gray-500 hover:text-white hover:bg-[#282828]')
                                                    }`}
                                                    style={{ borderColor: isSelected ? accentColor : 'transparent' }}
                                                >
                                                    <span className="text-3xl mb-1">{theme.icon}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">{theme.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'privacy' && (
                            <div className="space-y-8 animate-fade-in-up">
                                <div className={`flex items-center justify-between group p-2 rounded-xl ${isLightMode ? 'hover:bg-gray-50' : 'hover:bg-white/5'} transition-colors`}>
                                    <div className="space-y-1">
                                        <h3 className={`text-base font-black ${isLightMode ? 'text-gray-900' : 'text-white'} uppercase tracking-tight`}>{t.privacy_mode}</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">{t.privacy_mode_desc}</p>
                                    </div>
                                    <button 
                                        onClick={togglePrivacyMode}
                                        className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${advancedSettings.enablePrivacyMode ? '' : 'bg-[#727272]'}`}
                                        style={{ backgroundColor: advancedSettings.enablePrivacyMode ? accentColor : undefined }}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${advancedSettings.enablePrivacyMode ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <div className={`h-px ${isLightMode ? 'bg-gray-100' : 'bg-white/5'}`}></div>
                                <div className={`flex items-center justify-between group p-2 rounded-xl ${isLightMode ? 'hover:bg-gray-50' : 'hover:bg-white/5'} transition-colors`}>
                                    <div className="space-y-1">
                                        <h3 className={`text-base font-black ${isLightMode ? 'text-gray-900' : 'text-white'} uppercase tracking-tight`}>{t.high_security}</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">{t.high_security_desc}</p>
                                    </div>
                                    <button 
                                        onClick={toggleSecurityLevel}
                                        className={`w-14 h-7 rounded-full p-1 transition-all duration-300 ${advancedSettings.securityLevel === 'high' ? '' : 'bg-[#727272]'}`}
                                        style={{ backgroundColor: advancedSettings.securityLevel === 'high' ? accentColor : undefined }}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-xl transform transition-transform duration-300 ${advancedSettings.securityLevel === 'high' ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Dynamic Footer */}
                    <footer 
                        className={`absolute bottom-0 left-0 right-0 h-24 p-6 pointer-events-none flex items-center justify-center transition-colors duration-500 ${
                            isLightMode ? 'bg-gradient-to-t from-white via-white/80 to-transparent' : 'bg-gradient-to-t from-black via-black/80 to-transparent'
                        }`}
                    >
                        <p className={`text-[10px] font-black ${isLightMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-[0.3em] pointer-events-auto`}>Settings are saved locally on this device</p>
                    </footer>
                </main>
            </div>
        </Modal>
    );
};

export default AdvancedSettingsModal;
