
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
                className={`filter-panel-overlay fixed inset-0 bg-black/80 backdrop-blur-md z-[70] transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={onClose}
            ></div>
            <div 
                className={`filter-panel fixed inset-0 m-auto z-[80] w-[92%] max-w-lg h-[85vh] bg-[#0f172a] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 rounded-[2.5rem] transition-all duration-500 flex flex-col overflow-hidden ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
            >
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Engine</h2>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all flex items-center justify-center border border-white/5 shadow-xl active:scale-90 text-2xl">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto flex-grow no-scrollbar space-y-8">{children}</div>
                <div className="p-6 border-t border-white/5 bg-black/20">
                    <button onClick={onClose} className="btn btn-primary w-full py-4 text-sm font-black uppercase tracking-[0.2em] shadow-[0_15px_40px_rgba(37,99,235,0.3)] rounded-2xl active:scale-95 transition-transform">Apply Configuration</button>
                </div>
            </div>
        </>
    );
};
