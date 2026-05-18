import React, { useState, useEffect } from 'react';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Detect if already installed/standalone
        const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsStandalone(isStandaloneMode);

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isAppleDevice);

        // Capture beforeinstallprompt for Android/Windows/Chrome
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            if (!isStandaloneMode) {
                const dismissedAt = localStorage.getItem('pwa_prompt_dismissed');
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                
                if (!dismissedAt || (Date.now() - parseInt(dismissedAt) > sevenDays)) {
                    setIsVisible(true);
                }
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS, we show the prompt if not standalone after a short delay
        if (isAppleDevice && !isStandaloneMode) {
            // Check if dismissed before (show again after 7 days)
            const dismissedAt = localStorage.getItem('pwa_prompt_dismissed');
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            
            if (!dismissedAt || (Date.now() - parseInt(dismissedAt) > sevenDays)) {
                const timer = setTimeout(() => setIsVisible(true), 3000);
                return () => clearTimeout(timer);
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            setDeferredPrompt(null);
            setIsVisible(false);
        }
    };

    const dismissPrompt = () => {
        setIsVisible(false);
        // Don't show again for 7 days if manually dismissed
        localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
    };

    if (isStandalone || !isVisible) return null;

    return (
        <div className="fixed inset-x-0 bottom-4 z-[9999] px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-md mx-auto relative group">
                {/* Glassmorphism Background */}
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"></div>
                </div>

                <div className="relative p-5 flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                        <div className="relative flex-shrink-0">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-emerald-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
                            <img 
                                src={convertGoogleDriveUrl(APP_LOGO_URL)} 
                                alt="App Logo" 
                                className="relative w-14 h-14 rounded-2xl object-cover shadow-lg border border-white/10"
                            />
                        </div>
                        
                        <div className="flex-1 pt-1">
                            <h3 className="text-white font-bold text-lg leading-tight">
                                Install O-System
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Install as an app for a faster, better experience and easy access.
                            </p>
                        </div>

                        <button 
                            onClick={dismissPrompt}
                            className="text-slate-500 hover:text-white transition-colors p-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {isIOS ? (
                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                            <p className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                                Tap <span className="inline-flex items-center justify-center bg-white/10 p-1 rounded-lg"><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></span> then 
                                <span className="font-semibold text-blue-400 underline decoration-blue-400/30 underline-offset-4">Add to Home Screen</span> to install on iOS.
                            </p>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <button 
                                onClick={handleInstall}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all duration-200"
                            >
                                Install Now
                            </button>
                            <button 
                                onClick={dismissPrompt}
                                className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors"
                            >
                                Not Now
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
