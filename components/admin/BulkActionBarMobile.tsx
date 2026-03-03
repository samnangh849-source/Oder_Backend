
import React from 'react';

interface BulkActionBarMobileProps {
    selectedCount: number;
    isProcessing: boolean;
    onVerify: () => void;
    onUnverify: () => void;
    onOpenModal: (type: 'cost' | 'payment' | 'shipping' | 'delete' | 'date') => void;
    onClearSelection: () => void;
}

const BulkActionBarMobile: React.FC<BulkActionBarMobileProps> = ({
    selectedCount,
    isProcessing,
    onVerify,
    onUnverify,
    onOpenModal,
    onClearSelection
}) => {
    return (
        <div className="md:hidden fixed bottom-0 left-0 w-full z-[100] animate-slide-up">
            {/* Header / Selection Info */}
            <div className="bg-gray-900/90 backdrop-blur-xl border-t border-white/10 p-3 flex justify-between items-center shadow-2xl relative z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-600/30">
                        {selectedCount}
                    </div>
                    <span className="text-xs font-bold text-gray-300">items selected</span>
                </div>
                <button 
                    onClick={onClearSelection}
                    className="flex items-center gap-1.5 text-[9px] font-black text-white uppercase tracking-widest bg-gray-800 px-3 py-2 rounded-xl border border-white/10 active:scale-95 transition-all shadow-lg"
                >
                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Unselect All
                </button>
            </div>

            {/* Actions Scrollable Row */}
            <div className="bg-[#0f172a] p-3 pb-safe-bottom overflow-x-auto custom-scrollbar border-t border-gray-800">
                <div className="flex items-center gap-3 min-w-max">
                    {/* Verify Group */}
                    <div className="flex items-center bg-gray-800/50 p-1 rounded-xl border border-white/5">
                        <button 
                            onClick={onVerify}
                            disabled={isProcessing}
                            className="px-4 py-3 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                            Verify
                        </button>
                        <button 
                            onClick={onUnverify}
                            disabled={isProcessing}
                            className="px-4 py-3 text-gray-400 font-bold text-[10px] uppercase tracking-wider active:scale-95 disabled:opacity-50"
                        >
                            Unverify
                        </button>
                    </div>

                    {/* Edit Actions */}
                    <button onClick={() => onOpenModal('date')} className="flex flex-col items-center justify-center w-16 h-14 bg-gray-800/50 rounded-xl border border-white/5 active:bg-gray-700">
                        <span className="text-lg">📅</span>
                        <span className="text-[8px] font-black uppercase text-gray-400 mt-0.5">Date</span>
                    </button>

                    <button onClick={() => onOpenModal('cost')} className="flex flex-col items-center justify-center w-16 h-14 bg-gray-800/50 rounded-xl border border-white/5 active:bg-gray-700">
                        <span className="text-lg">💰</span>
                        <span className="text-[8px] font-black uppercase text-gray-400 mt-0.5">Cost</span>
                    </button>
                    
                    <button onClick={() => onOpenModal('payment')} className="flex flex-col items-center justify-center w-16 h-14 bg-gray-800/50 rounded-xl border border-white/5 active:bg-gray-700">
                        <span className="text-lg">💳</span>
                        <span className="text-[8px] font-black uppercase text-gray-400 mt-0.5">Pay</span>
                    </button>
                    
                    <button onClick={() => onOpenModal('shipping')} className="flex flex-col items-center justify-center w-16 h-14 bg-gray-800/50 rounded-xl border border-white/5 active:bg-gray-700">
                        <span className="text-lg">🚚</span>
                        <span className="text-[8px] font-black uppercase text-gray-400 mt-0.5">Ship</span>
                    </button>

                    {/* Delete */}
                    <button 
                        onClick={() => onOpenModal('delete')} 
                        className="px-4 py-3 bg-red-600/10 border border-red-500/20 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest active:bg-red-600 active:text-white transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
            
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
                .pb-safe-bottom { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
            `}</style>
        </div>
    );
};

export default BulkActionBarMobile;
