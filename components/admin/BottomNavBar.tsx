import React from 'react';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface BottomNavBarProps {
    activeDashboard: string;
    onNavChange: (id: string) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeDashboard, onNavChange }) => {
    const { playClick } = useSoundEffects();

    const navItems = [
        { id: 'dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zM14 13a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" /></svg>, label: 'Hub' },
        { id: 'orders', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, label: 'Orders' },
        { id: 'fulfillment', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>, label: 'Ops' },
        { id: 'reports', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, label: 'Report' },
        { id: 'settings', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, label: 'Config' }
    ];

    const handleClick = (id: string) => {
        playClick();
        onNavChange(id);
    };

    return (
        <div className="fixed bottom-6 left-4 right-4 z-[100] animate-slide-up">
            <style>{`
                .floating-nav {
                    background: rgba(15, 23, 42, 0.85);
                    backdrop-filter: blur(24px) saturate(180%);
                    -webkit-backdrop-filter: blur(24px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.5), 
                                0 0 20px rgba(59, 130, 246, 0.05);
                }
                .nav-active-pill {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%);
                    border-radius: 1.25rem;
                    z-index: 0;
                    border: 1px solid rgba(59, 130, 246, 0.2);
                }
            `}</style>
            
            <div className="floating-nav max-w-lg mx-auto rounded-[2rem] px-2 py-2 flex items-center justify-around h-[72px] relative">
                {navItems.map((item) => {
                    const isActive = activeDashboard === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => handleClick(item.id)}
                            className={`flex flex-col items-center justify-center gap-1.5 w-[64px] h-[56px] transition-all relative group active:scale-90 ${
                                isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {isActive && (
                                <div className="nav-active-pill animate-reveal"></div>
                            )}
                            
                            <span className={`relative z-10 transition-all duration-500 ${isActive ? 'scale-110 -translate-y-0.5' : 'opacity-60'}`}>
                                {item.icon}
                            </span>
                            
                            <span className={`relative z-10 text-[8.5px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                {item.label}
                            </span>

                            {isActive && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_#3b82f6]"></div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNavBar;
