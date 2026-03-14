
import React, { useEffect, useState } from 'react';

interface FilterPanelProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ isOpen, onClose, children }) => {
    // State to handle the slide-up animation when mounting
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Tiny delay to trigger animation after mount
            const timer = setTimeout(() => setIsAnimating(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsAnimating(false);
        }
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`filter-panel-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] transition-opacity duration-500 ${isAnimating ? 'opacity-100' : 'opacity-0'}`} 
                onClick={onClose}
            ></div>

            {/* Panel */}
            <div 
                className={`filter-panel fixed bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[80] w-full md:w-[94%] max-w-lg h-[94vh] md:h-[88vh] bg-[#0f172a] shadow-[0_-20px_100px_rgba(0,0,0,0.8)] md:shadow-[0_40px_100px_rgba(0,0,0,0.9)] border-t md:border border-white/10 rounded-t-[3rem] md:rounded-[2.5rem] transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) flex flex-col overflow-hidden ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:scale-95 md:translate-y-0'}`}
            >
                {/* Drag Handle for Mobile */}
                <div className="md:hidden w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2 flex-shrink-0"></div>
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-black/30 backdrop-blur-md relative z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"></div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Engine</h2>
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Operational Parameters</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all flex items-center justify-center border border-white/5 shadow-xl active:scale-90 text-2xl"
                    >
                        &times;
                    </button>
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto flex-grow custom-scrollbar space-y-8 relative z-10 bg-gradient-to-b from-transparent to-blue-900/10">
                    {children}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md relative z-20">
                    <button 
                        onClick={onClose} 
                        className="w-full py-4.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_15px_40px_rgba(37,99,235,0.3)] rounded-2xl active:scale-[0.98] transition-all border border-blue-400/20"
                    >
                        Apply Search Parameters
                    </button>
                </div>
            </div>
            
            <style>{`
                .filter-panel {
                    will-change: transform, opacity;
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
        </>
    );
};
