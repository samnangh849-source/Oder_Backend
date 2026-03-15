import React from 'react';
import { createPortal } from 'react-dom';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface BulkActionBarMobileProps {
    selectedCount: number;
    onClear: () => void;
    onVerify: () => void;
    onUnverify: () => void;
    onOpenModal: (type: 'cost' | 'payment' | 'shipping' | 'delete' | 'date') => void;
    isProcessing?: boolean;
}

const BulkActionBarMobile: React.FC<BulkActionBarMobileProps> = ({ 
    selectedCount, onClear, onVerify, onUnverify, onOpenModal, isProcessing 
}) => {
    const { playClick, playPop } = useSoundEffects();

    if (selectedCount === 0) return null;

    return createPortal(
        <div className="md:hidden fixed bottom-[20px] left-0 right-0 z-[100] animate-slide-up px-4 pointer-events-none">
            <div className="bg-[#1e293b]/95 backdrop-blur-2xl border border-blue-500/30 rounded-[2rem] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-2 ring-1 ring-white/10 pointer-events-auto">
                {/* Header Info */}
                <div className="flex items-center justify-between px-3 pt-1">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-[10px] shadow-lg">
                            {selectedCount}
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Selected</span>
                    </div>
                    <button onClick={() => { playPop(); onClear(); }} className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Clear</button>
                </div>

                {/* Actions Toolbar - Scrollable */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
                    <button 
                        onClick={() => { playClick(); onVerify(); }}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                        disabled={isProcessing}
                    >
                        Verify
                    </button>
                    <button 
                        onClick={() => { playClick(); onUnverify(); }}
                        className="flex-shrink-0 px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all border border-white/5"
                        disabled={isProcessing}
                    >
                        Unverify
                    </button>
                    
                    <div className="w-px h-6 bg-white/10 shrink-0"></div>

                    <button onClick={() => onOpenModal('date')} className="flex-shrink-0 px-4 py-2.5 bg-white/5 text-cyan-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 active:scale-95">Date</button>
                    <button onClick={() => onOpenModal('payment')} className="flex-shrink-0 px-4 py-2.5 bg-white/5 text-blue-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 active:scale-95">Pay</button>
                    <button onClick={() => onOpenModal('shipping')} className="flex-shrink-0 px-4 py-2.5 bg-white/5 text-purple-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 active:scale-95">Ship</button>
                    <button onClick={() => onOpenModal('cost')} className="flex-shrink-0 px-4 py-2.5 bg-white/5 text-orange-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 active:scale-95">Cost</button>
                    
                    <div className="w-px h-6 bg-white/10 shrink-0"></div>

                    <button 
                        onClick={() => onOpenModal('delete')}
                        className="flex-shrink-0 px-4 py-2.5 bg-red-600/10 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/20 active:scale-95"
                        disabled={isProcessing}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BulkActionBarMobile;
