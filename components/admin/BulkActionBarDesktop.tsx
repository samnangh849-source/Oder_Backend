
import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

interface BulkActionBarDesktopProps {
    selectedCount: number;
    isSidebarCollapsed: boolean;
    isProcessing: boolean;
    onVerify: () => void;
    onUnverify: () => void;
    onSendTelegram?: () => void;
    onOpenModal: (type: 'cost' | 'payment' | 'shipping' | 'delete' | 'date') => void;
    onClearSelection: () => void;
}

const BulkActionBarDesktop: React.FC<BulkActionBarDesktopProps> = ({
    selectedCount,
    isSidebarCollapsed,
    isProcessing,
    onVerify,
    onUnverify,
    onSendTelegram,
    onOpenModal,
    onClearSelection
}) => {
    const { advancedSettings } = useContext(AppContext);
    const isBinance = advancedSettings?.uiTheme === 'binance';
    const containerPaddingLeft = isSidebarCollapsed ? '64px' : '208px';

    return (
        <div
            className="hidden md:flex fixed bottom-10 left-0 w-full z-[90] justify-center pointer-events-none transition-all duration-500"
            style={{ paddingLeft: containerPaddingLeft }}
        >
            <div className={`relative ${isBinance ? 'bg-[#1E2329] border-[#2B3139]' : 'bg-[#0f172a]/95 backdrop-blur-3xl border-white/10 rounded-[3rem] shadow-[0_30px_70px_rgba(0,0,0,0.8)] ring-1 ring-white/10'} border p-3 flex items-center gap-5 overflow-hidden pointer-events-auto animate-fade-in-up`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                {!isBinance && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-full bg-blue-500/5 blur-[80px] pointer-events-none"></div>}

                <div className="flex items-center gap-3 pl-4 relative z-10">
                    <div className={`w-10 h-10 ${isBinance ? 'bg-[#FCD535] text-[#181A20]' : 'bg-blue-600 text-white rounded-full shadow-[0_0_25px_rgba(37,99,235,0.4)] animate-pulse-subtle border-2 border-white/10'} flex items-center justify-center font-black text-base`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                        {selectedCount}
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-[12px] font-bold ${isBinance ? 'text-[#EAECEF]' : 'text-white'} leading-none tracking-tight`}>ជ្រើសរើស</span>
                        <span className={`text-[8px] ${isBinance ? 'text-[#848E9C]' : 'text-blue-400'} font-bold uppercase tracking-wider mt-1`}>SELECTED</span>
                    </div>
                </div>

                <div className={`h-8 w-px ${isBinance ? 'bg-[#2B3139]' : 'bg-white/10'} relative z-10`}></div>

                <div className={`flex items-center ${isBinance ? 'bg-[#0B0E11] border-[#2B3139]' : 'bg-[#242f41] border-white/5 rounded-[1.8rem]'} p-1.5 border relative z-10`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                    <button
                        onClick={onVerify}
                        className={`px-5 py-2 ${isBinance ? 'bg-[#0ECB81] hover:bg-[#0ba86d]' : 'bg-[#10b981] hover:bg-[#059669] rounded-[1.4rem] shadow-lg'} text-white text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50`}
                        style={isBinance ? { borderRadius: '2px' } : undefined}
                        disabled={isProcessing}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                        VERIFY
                    </button>
                    <button
                        onClick={onUnverify}
                        className={`px-4 py-2 ${isBinance ? 'text-[#848E9C] hover:text-[#EAECEF]' : 'text-gray-400 hover:text-white'} text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50`}
                        disabled={isProcessing}
                    >
                        UNVERIFY
                    </button>
                </div>

                <div className={`flex items-center ${isBinance ? 'bg-[#0B0E11] border-[#2B3139]' : 'bg-blue-600/10 border-blue-500/20 rounded-[1.8rem]'} p-1.5 border relative z-10`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                    <button
                        onClick={onSendTelegram}
                        className={`px-5 py-2 ${isBinance ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-500 rounded-[1.4rem] shadow-lg shadow-blue-900/40'} text-white text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50`}
                        style={isBinance ? { borderRadius: '2px' } : undefined}
                        disabled={isProcessing}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                        SEND TELEGRAM
                    </button>
                </div>

                <div className={`flex items-center gap-1 ${isBinance ? 'bg-[#0B0E11] border-[#2B3139]' : 'bg-white/5 border-white/5 rounded-[1.8rem]'} px-4 py-1 border relative z-10`} style={isBinance ? { borderRadius: '2px' } : undefined}>
                    <button onClick={() => onOpenModal('date')} className={`px-3 py-2.5 ${isBinance ? 'text-[#848E9C] hover:text-[#EAECEF]' : 'hover:text-white text-cyan-400 hover:scale-110'} text-[11px] font-bold uppercase tracking-widest transition-all`}>DATE</button>
                    <button onClick={() => onOpenModal('cost')} className={`px-3 py-2.5 ${isBinance ? 'text-[#848E9C] hover:text-[#EAECEF]' : 'hover:text-white text-[#f6ad55] hover:scale-110'} text-[11px] font-bold uppercase tracking-widest transition-all`}>COST</button>
                    <button onClick={() => onOpenModal('payment')} className={`px-3 py-2.5 ${isBinance ? 'text-[#848E9C] hover:text-[#EAECEF]' : 'hover:text-white text-[#4299e1] hover:scale-110'} text-[11px] font-bold uppercase tracking-widest transition-all`}>PAY</button>
                    <button onClick={() => onOpenModal('shipping')} className={`px-3 py-2.5 ${isBinance ? 'text-[#848E9C] hover:text-[#EAECEF]' : 'hover:text-white text-[#9f7aea] hover:scale-110'} text-[11px] font-bold uppercase tracking-widest transition-all`}>SHIP</button>
                </div>

                <div className={`h-8 w-px ${isBinance ? 'bg-[#2B3139]' : 'bg-white/10'} relative z-10`}></div>

                <div className="pr-2 relative z-10">
                    <button
                        onClick={onClearSelection}
                        className={`px-4 py-3 ${isBinance ? 'bg-[#2B3139] border-[#474D57] text-[#848E9C] hover:text-[#EAECEF]' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border-white/5 rounded-[1.6rem]'} border text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2`}
                        style={isBinance ? { borderRadius: '2px' } : undefined}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Unselect All
                    </button>
                </div>

                <div className="pr-4 relative z-10">
                    <button
                        onClick={() => onOpenModal('delete')}
                        className={`px-5 py-3 ${isBinance ? 'bg-transparent border-[#F6465D] text-[#F6465D] hover:bg-[#F6465D] hover:text-white' : 'bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border-red-500/20 rounded-[1.6rem] shadow-lg hover:shadow-red-900/20'} border text-[12px] font-bold transition-all active:scale-95`}
                        style={isBinance ? { borderRadius: '2px' } : undefined}
                    >
                        លុបចោល
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkActionBarDesktop;
