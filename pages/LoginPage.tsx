
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import Spinner from '../components/common/Spinner';
import { WEB_APP_URL, APP_LOGO_URL } from '../constants';
import { User } from '../types';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { useSoundEffects } from '../hooks/useSoundEffects';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    
    // UI states
    const [showIntro, setShowIntro] = useState(true);
    const [introProgress, setIntroProgress] = useState(0);
    const [isSystemReady, setIsSystemReady] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const { login } = useContext(AppContext);
    const { playError } = useSoundEffects();

    useEffect(() => {
        const duration = 3000;
        const interval = 30;
        const step = (100 / (duration / interval));
        
        const timer = setInterval(() => {
            setIntroProgress(prev => {
                const next = prev + step;
                if (next >= 100) {
                    clearInterval(timer);
                    setIsSystemReady(true);
                    setTimeout(() => setShowIntro(false), 1000);
                    return 100;
                }
                return next;
            });
        }, interval);

        const handleMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20
            });
        };
        window.addEventListener('mousemove', handleMove);

        return () => {
            clearInterval(timer);
            window.removeEventListener('mousemove', handleMove);
        };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await fetch(`${WEB_APP_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: username, password })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Invalid credentials');
            }

            const result = await response.json();
            // result should contain { token, user }
            if (result.token && result.user) {
                login(result.user, result.token);
            } else {
                throw new Error('Invalid server response');
            }
        } catch (err: any) {
            playError();
            setError('Login Failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- 3D CRYSTAL CORE INTRO (Visuals Preserved) ---
    if (showIntro) {
        return (
            <div className="fixed inset-0 z-[100] bg-[#080808] flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-30">
                        <div className="absolute w-1 h-1 bg-blue-500 rounded-full animate-pulse top-1/4 left-1/3"></div>
                        <div className="absolute w-1 h-1 bg-cyan-500 rounded-full animate-pulse top-3/4 left-2/3"></div>
                    </div>
                </div>

                <div className={`relative scene-3d transition-all duration-1000 ${isSystemReady ? 'scale-[5] opacity-0 blur-2xl' : 'scale-100 opacity-100'}`}>
                    <div className="w-40 h-40 preserve-3d animate-prism-rotate">
                        {[0, 120, 240].map((rotate, i) => (
                            <div 
                                key={i}
                                className="absolute inset-0 flex items-center justify-center border-2 border-blue-500/40 bg-blue-600/10 backdrop-blur-md rounded-[2rem]"
                                style={{ transform: `rotateY(${rotate}deg) translateZ(60px)` }}
                            >
                                <img src={convertGoogleDriveUrl(APP_LOGO_URL)} className="w-20 h-20 object-contain opacity-80" alt="Core" />
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-blue-500/20 rounded-full animate-pulse-ring"></div>
                </div>

                <div className="mt-24 w-full max-w-[280px] space-y-4 text-center">
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,1)]" style={{ width: `${introProgress}%` }}></div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[11px] font-black text-blue-500 tracking-[0.5em] uppercase animate-pulse">Connecting...</span>
                    </div>
                </div>

                <style>{`
                    .animate-prism-rotate { animation: prism-rotate 10s infinite linear; }
                    @keyframes prism-rotate { from { transform: rotateY(0deg) rotateX(20deg); } to { transform: rotateY(360deg) rotateX(20deg); } }
                    @keyframes pulse-ring { 0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } 50% { opacity: 0.3; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
                    .animate-pulse-ring { animation: pulse-ring 4s infinite ease-out; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden bg-[#080808] selection:bg-blue-500/30">
            {/* AMBIENT BACKGROUND */}
            <div className="absolute inset-0 z-0">
                 <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[100px] animate-pulse"></div>
                 <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="w-full max-w-lg relative z-10 animate-fade-in-up">
                <div 
                    className="relative p-[1px] rounded-[3rem] bg-gradient-to-br from-white/15 via-transparent to-white/5 shadow-2xl"
                    style={{ 
                        transform: `perspective(1000px) rotateX(${-mousePos.y/15}deg) rotateY(${mousePos.x/15}deg)`, 
                        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
                    }}
                >
                    <div className="bg-[#121212]/90 backdrop-blur-[60px] rounded-[3rem] p-8 sm:p-14 space-y-10 overflow-hidden relative border border-white/5 shadow-inner">
                        
                        {/* Mobile Optimized Header */}
                        <div className="text-center space-y-5">
                            <div className="relative inline-block group">
                                <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-2xl opacity-40 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative w-20 h-20 bg-gray-950 border border-white/10 rounded-[1.8rem] flex items-center justify-center shadow-2xl overflow-hidden group-hover:scale-105 transition-all duration-500">
                                    <img src={convertGoogleDriveUrl(APP_LOGO_URL)} alt="Logo" className="w-12 h-12 object-contain" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-blue-400 tracking-tighter italic uppercase leading-none">
                                    O-System
                                </h1>
                                <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-[0.4em] mt-3">Secure Access Portal</p>
                            </div>
                        </div>

                        {/* High-Target Input Fields */}
                        <form onSubmit={handleLogin} className="space-y-7 relative z-10">
                            <div className="space-y-5">
                                {/* Username */}
                                <div className="group space-y-2">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-4 group-focus-within:text-blue-500 transition-colors">Username</label>
                                    <div className="relative bg-black/40 border border-white/5 group-focus-within:border-blue-500/40 group-focus-within:bg-black/60 transition-all rounded-2xl overflow-hidden group-focus-within:shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                        <input 
                                            type="text" 
                                            value={username} 
                                            onChange={(e) => setUsername(e.target.value)} 
                                            className="w-full bg-transparent py-4.5 px-7 text-white outline-none font-bold placeholder:text-gray-800 text-sm h-14 sm:h-16" 
                                            placeholder="Enter your username"
                                            required 
                                        />
                                        <div className="absolute inset-y-0 right-5 flex items-center opacity-10 group-focus-within:opacity-40 transition-opacity">
                                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="group space-y-2">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-4 group-focus-within:text-blue-500 transition-colors">Password</label>
                                    <div className="relative bg-black/40 border border-white/5 group-focus-within:border-blue-500/40 group-focus-within:bg-black/60 transition-all rounded-2xl overflow-hidden group-focus-within:shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                        <input 
                                            type={isPasswordVisible ? "text" : "password"} 
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)} 
                                            className="w-full bg-transparent py-4.5 px-7 text-white outline-none font-bold placeholder:text-gray-800 text-sm tracking-[0.15em] h-14 sm:h-16" 
                                            placeholder="••••••••"
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setIsPasswordVisible(!isPasswordVisible)} 
                                            className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-700 hover:text-white transition-colors"
                                        >
                                            {isPasswordVisible ? (
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            ) : (
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 .847 0 1.67 .126 2.454 .364m-3.033 2.446a3 3 0 11-4.243 4.243m4.242-4.242l4.243 4.243M3 3l18 18" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-[11px] font-black uppercase tracking-widest animate-shake flex items-center gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    {error}
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full group relative overflow-hidden h-16 sm:h-20 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all active:scale-[0.97] disabled:opacity-50 shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4)] border border-white/10"
                            >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.3)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <span className="relative z-10 font-black uppercase tracking-[0.3em] text-xs sm:text-sm">
                                    {loading ? <Spinner size="sm" /> : 'Authorize Access'}
                                </span>
                                <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:left-[100%] transition-all duration-1000"></div>
                            </button>
                        </form>

                        {/* Minimal Telemetry Footer */}
                        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center opacity-30 gap-5">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Connection Secured</span>
                            </div>
                            <div className="text-[9px] font-mono text-gray-500 flex gap-4 uppercase font-bold tracking-widest">
                                <span>v10.5.2</span>
                                <span>Core Team Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .animate-fade-in-up { animation: fade-in-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.3s ease-in-out; }
            `}</style>
        </div>
    );
};

export default LoginPage;
