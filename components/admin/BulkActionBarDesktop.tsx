
import React from 'react';

interface BulkActionBarDesktopProps {
    selectedCount: number;
    isSidebarCollapsed: boolean;
    isProcessing: boolean;
    onVerify: () => void;
    onUnverify: () => void;
    onOpenModal: (type: 'cost' | 'payment' | 'shipping' | 'delete' | 'date') => void;
    onClearSelection: () => void;
}

const BulkActionBarDesktop: React.FC<BulkActionBarDesktopProps> = ({
    selectedCount,
    isSidebarCollapsed,
    isProcessing,
    onVerify,
    onUnverify,
    onOpenModal,
    onClearSelection
}) => {
    const containerPaddingLeft = isSidebarCollapsed ? '64px' : '208px';

    return (
        <div 
            className="hidden md:flex fixed bottom-10 left-0 w-full z-[90] justify-center pointer-events-none transition-all duration-500"
            style={{ paddingLeft: containerPaddingLeft }}
        >
            <div className="relative bg-[#0f172a]/95 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.8)] p-3 flex items-center gap-6 overflow-hidden ring-1 ring-white/10 pointer-events-auto animate-fade-in-up">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-full bg-blue-500/5 blur-[80px] pointer-events-none"></div>

                <div className="flex items-center gap-3.5 pl-5 relative z-10">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-lg shadow-[0_0_25px_rgba(37,99,235,0.4)] animate-pulse-subtle border-2 border-white/10">
                        {selectedCount}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black text-white leading-none tracking-tight">ជ្រើសរើស</span>
                        <span className="text-[8px] text-blue-400 font-bold uppercase tracking-[0.25em] mt-1">ACTIVE NODE</span>
                    </div>
                </div>

                <div className="h-10 w-px bg-white/10 relative z-10"></div>

                <div className="flex items-center bg-[#242f41] p-1.5 rounded-[1.8rem] border border-white/5 relative z-10">
                    <button 
                        onClick={onVerify}
                        className="px-6 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white rounded-[1.4rem] text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50"
                        disabled={isProcessing}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                        VERIFY
                    </button>
                    <button 
                        onClick={onUnverify}
                        className="px-5 py-2.5 text-gray-400 hover:text-white text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                        disabled={isProcessing}
                    >
                        UNVERIFY
                    </button>
                </div>

                <div className="flex items-center gap-1 bg-white/5 px-6 py-1.5 rounded-[1.8rem] border border-white/5 relative z-10">
                    <button onClick={() => onOpenModal('date')} className="px-3.5 py-3 hover:text-white text-cyan-400 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-110">DATE</button>
                    <button onClick={() => onOpenModal('cost')} className="px-3.5 py-3 hover:text-white text-[#f6ad55] text-[11px] font-black uppercase tracking-widest transition-all hover:scale-110">COST</button>
                    <button onClick={() => onOpenModal('payment')} className="px-3.5 py-3 hover:text-white text-[#4299e1] text-[11px] font-black uppercase tracking-widest transition-all hover:scale-110">PAY</button>
                    <button onClick={() => onOpenModal('shipping')} className="px-3.5 py-3 hover:text-white text-[#9f7aea] text-[11px] font-black uppercase tracking-widest transition-all hover:scale-110">SHIP</button>
                </div>

                <div className="h-10 w-px bg-white/10 relative z-10"></div>

                <div className="pr-2 relative z-10">
                    <button 
                        onClick={onClearSelection}
                        className="px-5 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-white/5 rounded-[1.6rem] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Unselect All
                    </button>
                </div>

                <div className="pr-5 relative z-10">
                    <button 
                        onClick={() => onOpenModal('delete')} 
                        className="px-6 py-3.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-[1.6rem] text-[12px] font-black transition-all active:scale-95 shadow-lg hover:shadow-red-900/20"
                    >
                        លុបចោល
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkActionBarDesktop;
