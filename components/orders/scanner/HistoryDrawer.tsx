
import React, { useRef } from 'react';
import { MasterProduct } from '../../../types';
import { convertGoogleDriveUrl } from '../../../utils/fileUtils';

export interface ScannedHistoryItem {
    code: string;
    product?: MasterProduct;
    timestamp: number;
    count: number;
}

interface HistoryDrawerProps {
    history: ScannedHistoryItem[];
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    onClear: () => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ history, isOpen, setIsOpen, onClear }) => {
    const touchStartY = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current !== null) {
            const deltaY = e.touches[0].clientY - touchStartY.current;
            if (deltaY > 50) { // Swipe Down to close
                setIsOpen(false);
                touchStartY.current = null;
            }
        }
    };

    return (
        <div 
            className={`
                absolute bottom-0 left-0 right-0 bg-[#0f172a] rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] z-50 transition-all duration-300 ease-out flex flex-col
                ${isOpen ? 'h-[80vh]' : 'h-0 overflow-hidden'}
            `}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => { touchStartY.current = null; }}
        >
            {/* Drag Handle */}
            <div 
                className="w-full flex justify-center py-5 cursor-pointer active:bg-white/5 transition-colors rounded-t-[2.5rem]" 
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="w-16 h-1.5 bg-gray-600 rounded-full"></div>
            </div>

            <div className="flex-grow flex flex-col overflow-hidden px-5 pb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6 px-1">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight">Scanned History</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{history.length} items logged</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClear} 
                        className="text-[10px] text-red-400 font-black uppercase tracking-widest bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 active:scale-95 transition-all hover:bg-red-500 hover:text-white"
                    >
                        Clear All
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 pb-safe-bottom">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 opacity-40">
                            <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                            <p className="text-xs font-black uppercase text-gray-500 tracking-widest">No items scanned yet</p>
                        </div>
                    ) : (
                        history.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4 bg-gray-800/40 p-3 rounded-2xl border border-white/5 shadow-sm">
                                <div className="w-12 h-12 bg-black rounded-xl overflow-hidden border border-white/10 flex-shrink-0 shadow-inner">
                                    {item.product ? (
                                        <img src={convertGoogleDriveUrl(item.product.ImageURL)} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 font-black text-xs">?</div>
                                    )}
                                </div>
                                <div className="flex-grow min-w-0">
                                    <h4 className="text-white font-bold text-sm truncate leading-tight">{item.product?.ProductName || 'Unknown Product'}</h4>
                                    <p className="text-[10px] text-gray-500 font-mono mt-1 font-bold tracking-wider">{item.code}</p>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className="bg-blue-600/20 text-blue-400 text-xs font-black px-2 py-0.5 rounded-lg border border-blue-500/20 mb-1">x{item.count}</span>
                                    <span className="text-[9px] text-gray-600 font-bold">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryDrawer;
