
import React from 'react';
import { isIOS } from '../../../utils/platform';

interface ScannerHeaderProps {
    onClose: () => void;
    onSwitchCamera: () => void;
    onToggleTorch: () => void;
    isTorchOn: boolean;
    isTorchSupported: boolean;
    isAutoZooming: boolean;
}

const ScannerHeader: React.FC<ScannerHeaderProps> = ({
    onClose,
    onSwitchCamera,
    onToggleTorch,
    isTorchOn,
    isTorchSupported,
    isAutoZooming
}) => {
    // iOS WebKit does not support torch via JS yet.
    const showTorchButton = !isIOS() && isTorchSupported;

    return (
        <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
             style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            
            <div className="pointer-events-auto bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-blue-500/30 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-white font-black text-xs uppercase tracking-widest">LIVE</span>
                {isAutoZooming && <span className="text-[9px] text-blue-400 font-bold ml-1 animate-pulse">AUTO-ZOOM</span>}
            </div>
            
            <div className="flex gap-3 pointer-events-auto">
                <button 
                    onClick={onSwitchCamera} 
                    className="w-10 h-10 bg-gray-800/60 backdrop-blur-md rounded-full text-white border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-gray-700/60"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>

                {showTorchButton && (
                    <button 
                        onClick={onToggleTorch} 
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-md border ${isTorchOn ? 'bg-yellow-500 text-black border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-gray-800/60 text-gray-300 border-white/10'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                )}
                
                <button onClick={onClose} className="w-10 h-10 bg-gray-800/60 backdrop-blur-md rounded-full text-white border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-red-500/80 hover:border-red-500/50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export default ScannerHeader;
