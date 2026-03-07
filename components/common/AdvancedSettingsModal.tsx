import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from './Modal';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import { translations } from '../../translations';
import { NOTIFICATION_SOUNDS } from '../../constants';

interface AdvancedSettingsModalProps {
    onClose: () => void;
}

type SettingsTab = 'general' | 'privacy';

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({ onClose }) => {
    const { advancedSettings, setAdvancedSettings, language, showNotification } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [isTesting, setIsTesting] = useState(false);

    const t = translations[language || 'en'];

    if (!advancedSettings || !setAdvancedSettings) return null;

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

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="flex flex-col md:flex-row h-[85vh] md:h-[550px] text-white overflow-hidden rounded-[2rem]">
                {/* Sidebar / Top Tab Bar */}
                <div className="w-full md:w-[220px] border-b md:border-b-0 md:border-r border-white/10 bg-gray-900/80 md:bg-gray-900/50 p-3 md:p-6 flex flex-row md:flex-col gap-2 flex-shrink-0 relative z-20">
                    <h2 className="hidden md:block text-2xl font-black text-white uppercase tracking-tighter italic mb-8 px-2">
                        {t.advanced_settings}
                    </h2>
                    
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 md:flex-none text-center md:text-left px-4 py-3 md:py-4 rounded-2xl text-xs md:text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center md:justify-start gap-2 md:gap-3 ${activeTab === 'general' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        <span className="truncate">{t.general_settings}</span>
                    </button>

                    <button 
                        onClick={() => setActiveTab('privacy')}
                        className={`flex-1 md:flex-none text-center md:text-left px-4 py-3 md:py-4 rounded-2xl text-xs md:text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center md:justify-start gap-2 md:gap-3 ${activeTab === 'privacy' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        <span className="truncate">{t.privacy_security}</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="w-full md:w-2/3 flex flex-col overflow-hidden bg-[#0f172a]">
                    <div className="flex justify-between items-center p-4 md:p-6 sticky top-0 bg-[#0f172a]/95 backdrop-blur-md z-10 border-b border-white/5 shadow-sm">
                        <div className="md:hidden">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-500 mb-0.5">{t.advanced_settings}</h3>
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">
                                {activeTab === 'general' ? t.general_settings : t.privacy_security}
                            </h2>
                        </div>
                        <h3 className="hidden md:block text-xl font-black uppercase tracking-tighter italic text-gray-400">
                            {activeTab === 'general' ? t.general_settings : t.privacy_security}
                        </h3>
                        <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl text-gray-400 hover:text-red-400 transition-all active:scale-90">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-4 md:p-8 overflow-y-auto flex-grow custom-scrollbar space-y-8 pb-20 md:pb-8">
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-fade-in-up">
                                <div className="flex items-center justify-between bg-gray-800/40 p-5 rounded-3xl border border-white/5 hover:border-blue-500/20 transition-all group">
                                    <div className="flex items-center gap-4">
                                         <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-all border border-blue-500/20 shadow-inner">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                         </div>
                                         <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">{t.floating_alerts}</h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{t.floating_alerts_desc}</p>
                                         </div>
                                    </div>
                                    
                                    <button 
                                        onClick={toggleFloatingAlerts}
                                        className={`w-14 h-7 rounded-full p-1.5 transition-all duration-500 ${advancedSettings.enableFloatingAlerts ? 'bg-blue-600 shadow-lg shadow-blue-600/40' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-500 ${advancedSettings.enableFloatingAlerts ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Order Edit Grace Period Setting */}
                                <div className="p-5 bg-gray-800/40 rounded-[2rem] border border-white/5 hover:border-blue-500/20 transition-all group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-all border border-indigo-500/20 shadow-inner">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white uppercase tracking-tight">{t.edit_grace_period || 'Edit Grace Period'}</h3>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{t.edit_grace_period_desc || 'Time limit to edit your own orders (seconds)'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                                            <input 
                                                type="number" 
                                                min="3"
                                                value={advancedSettings.orderEditGracePeriod || 43200}
                                                onChange={(e) => {
                                                    const val = Math.max(3, parseInt(e.target.value) || 3);
                                                    setAdvancedSettings(prev => ({ ...prev, orderEditGracePeriod: val }));
                                                }}
                                                className="bg-transparent border-none text-right text-blue-400 font-black font-mono p-0 w-20 focus:ring-0"
                                            />
                                            <span className="text-[10px] font-black text-slate-600 uppercase">Sec</span>
                                        </div>
                                    </div>
                                    <div className="px-2">
                                        <input 
                                            type="range" 
                                            min="3" 
                                            max="86400" // 24 hours
                                            step="1" 
                                            value={advancedSettings.orderEditGracePeriod || 43200} 
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setAdvancedSettings(prev => ({ ...prev, orderEditGracePeriod: val }));
                                            }}
                                            className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <div className="flex justify-between mt-2">
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">3s</span>
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">24h</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Notification Sound Selection */}
                                <div className="p-5 bg-gray-800/20 rounded-[2rem] border border-white/5 shadow-inner">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shadow-inner">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                        </div>
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">{t.notification_sound}</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-2 pb-2">
                                        {NOTIFICATION_SOUNDS.map(sound => (
                                            <button
                                                key={sound.id}
                                                onClick={() => {
                                                    setAdvancedSettings(prev => ({ ...prev, notificationSound: sound.id }));
                                                    const audio = new Audio(sound.url);
                                                    audio.volume = advancedSettings.notificationVolume ?? 1;
                                                    audio.play().catch(() => {});
                                                }}
                                                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between group active:scale-[0.98] ${
                                                    advancedSettings.notificationSound === sound.id 
                                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-100 shadow-lg shadow-blue-900/20' 
                                                    : 'bg-gray-900/40 border-white/5 text-gray-500 hover:bg-gray-800 hover:border-white/10'
                                                }`}
                                            >
                                                <span className="text-xs font-black uppercase tracking-widest">{sound.name}</span>
                                                {advancedSettings.notificationSound === sound.id ? (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_12px_#3b82f6] animate-pulse" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Volume Slider */}
                                    <div className="mt-8 border-t border-white/5 pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                                    {advancedSettings.notificationVolume === 0 ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                    )}
                                                </div>
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">{t.alert_volume}</h4>
                                            </div>
                                            <span className="text-sm font-black text-blue-400 font-mono">{Math.round((advancedSettings.notificationVolume || 1) * 100)}%</span>
                                        </div>
                                        
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.01" 
                                            value={advancedSettings.notificationVolume ?? 1} 
                                            onChange={(e) => {
                                                const newVolume = parseFloat(e.target.value);
                                                setAdvancedSettings(prev => ({ ...prev, notificationVolume: newVolume }));
                                            }}
                                            onMouseUp={() => {
                                                 const soundId = advancedSettings.notificationSound || 'default';
                                                 const soundObj = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS[0];
                                                 const audio = new Audio(soundObj.url);
                                                 audio.volume = advancedSettings.notificationVolume ?? 1;
                                                 audio.play().catch(() => {});
                                            }}
                                            onTouchEnd={() => {
                                                 const soundId = advancedSettings.notificationSound || 'default';
                                                 const soundObj = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS[0];
                                                 const audio = new Audio(soundObj.url);
                                                 audio.volume = advancedSettings.notificationVolume ?? 1;
                                                 audio.play().catch(() => {});
                                            }}
                                            className="w-full h-2.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600 transition-all hover:bg-gray-600"
                                        />
                                    </div>
                                </div>

                                {/* Test Button Section */}
                                <div className="pt-4 border-t border-white/5">
                                    <button 
                                        onClick={handleTestNotification}
                                        disabled={isTesting}
                                        className={`w-full py-5 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-4 active:scale-95 shadow-xl border border-white/5
                                            ${isTesting ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-600/30'}`}
                                    >
                                        {isTesting ? (
                                            <>
                                                <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                                                <span>Testing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                                <span>{t.test_notification}</span>
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em] mt-4 text-center">{t.verify_alerts}</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'privacy' && (
                            <div className="space-y-6 animate-fade-in-up">
                                {/* Privacy Mode Toggle */}
                                <div className="flex items-center justify-between bg-gray-800/40 p-5 rounded-3xl border border-white/5 hover:border-purple-500/20 transition-all group">
                                    <div className="flex items-center gap-4">
                                         <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-all border border-purple-500/20 shadow-inner">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943-9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                         </div>
                                         <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">{t.privacy_mode}</h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{t.privacy_mode_desc}</p>
                                         </div>
                                    </div>
                                    
                                    <button 
                                        onClick={togglePrivacyMode}
                                        className={`w-14 h-7 rounded-full p-1.5 transition-all duration-500 ${advancedSettings.enablePrivacyMode ? 'bg-purple-600 shadow-lg shadow-purple-600/40' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-500 ${advancedSettings.enablePrivacyMode ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Security Level Toggle */}
                                <div className="flex items-center justify-between bg-gray-800/40 p-5 rounded-3xl border border-white/5 hover:border-green-500/20 transition-all group">
                                    <div className="flex items-center gap-4">
                                         <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400 group-hover:scale-110 transition-all border border-green-500/20 shadow-inner">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                         </div>
                                         <div>
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">{t.high_security}</h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{t.high_security_desc}</p>
                                         </div>
                                    </div>
                                    
                                    <button 
                                        onClick={toggleSecurityLevel}
                                        className={`w-14 h-7 rounded-full p-1.5 transition-all duration-500 ${advancedSettings.securityLevel === 'high' ? 'bg-green-600 shadow-lg shadow-green-600/40' : 'bg-gray-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-500 ${advancedSettings.securityLevel === 'high' ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AdvancedSettingsModal;