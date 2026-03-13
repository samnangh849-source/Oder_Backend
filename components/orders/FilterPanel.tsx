
import React from 'react';

interface FilterPanelProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ isOpen, onClose, children }) => {
    return (
        <>
            <div 
                className={`filter-panel-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={onClose}
            ></div>
            <div 
                className={`filter-panel fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[94%] max-w-lg h-[88vh] bg-[#0f172a] shadow-[0_40px_100px_rgba(0,0,0,0.9)] border border-white/10 rounded-[2.5rem] transition-all duration-500 flex flex-col overflow-hidden ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
            >
                {/* Header - Fixed Height */}
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

                {/* Content Area - Scrollable */}
                <div className="p-6 overflow-y-auto flex-grow custom-scrollbar space-y-8 relative z-10 bg-gradient-to-b from-transparent to-blue-900/10">
                    {children}
                </div>

                {/* Footer - Fixed Height */}
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
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
        </>
    );
};
