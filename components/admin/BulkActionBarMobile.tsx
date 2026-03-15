import React from 'react';
import { createPortal } from 'react-dom';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface BulkActionBarMobileProps {
    selectedCount: number;
    onClear: () => void;
    onAction: (action: string) => void;
    isProcessing?: boolean;
}

const BulkActionBarMobile: React.FC<BulkActionBarMobileProps> = ({ 
    selectedCount, onClear, onAction, isProcessing 
}) => {
    const { playClick, playPop } = useSoundEffects();

    if (selectedCount === 0) return null;

    return createPortal(
        <div className="md:hidden fixed bottom-[90px] left-4 right-4 z-[100] animate-slide-up pointer-events-none">
            <div className="bg-[#1e293b]/95 backdrop-blur-2xl border border-blue-500/30 rounded-[2rem] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between ring-1 ring-white/10 pointer-events-auto">
                <div className="flex items-center gap-3 ml-2">
                    <button 
                        onClick={() => { playPop(); onClear(); }}
                        className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-full text-white active:scale-90 transition-all"
                    >
                        &times;
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[11px] font-black text-white leading-none">{selectedCount} Selected</span>
                        <span className="text-[7px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Bulk Operations</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { playClick(); onAction('verify'); }}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
                        disabled={isProcessing}
                    >
                        Verify
                    </button>
                    <button 
                        onClick={() => { playClick(); onAction('print'); }}
                        className="p-2.5 bg-white/5 text-gray-300 rounded-xl active:scale-95 transition-all border border-white/5"
                        disabled={isProcessing}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={2.5}/></svg>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BulkActionBarMobile;
