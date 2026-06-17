
import React, { useRef } from 'react';

interface ScannerControlsProps {
    zoom: number;
    zoomCapabilities: { min: number; max: number; step: number } | null;
    handleZoomChange: (zoom: number) => void;
    scanMode: 'single' | 'increment';
    setScanMode: (mode: 'single' | 'increment') => void;
    onOpenHistory: () => void;
    onUpload: (file: File) => void;
}

const ScannerControls: React.FC<ScannerControlsProps> = ({
    zoom,
    zoomCapabilities,
    handleZoomChange,
    scanMode,
    setScanMode,
    onOpenHistory,
    onUpload
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine which lens buttons to show based on capabilities
    const showUltrawide = zoomCapabilities && zoomCapabilities.min < 1;
    const show2x = zoomCapabilities && zoomCapabilities.max >= 2;
    const show5x = zoomCapabilities && zoomCapabilities.max >= 5;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
            // Reset input so same file can be selected again
            e.target.value = '';
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 p-6 z-40 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-5 pointer-events-none"
             style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            
            {/* iOS Style Lens Switcher */}
            {zoomCapabilities && (
                <div className="flex justify-center items-center gap-4 pointer-events-auto mb-1 animate-fade-in-up">
                    {showUltrawide && (
                        <button 
                            onClick={() => handleZoomChange(0.5)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${Math.abs(zoom - 0.5) < 0.2 ? 'bg-yellow-500 text-black border-yellow-400 scale-110' : 'bg-black/50 text-white border-white/20 hover:bg-black/70'}`}
                        >
                            .5
                        </button>
                    )}
                    <button 
                        onClick={() => handleZoomChange(1)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${Math.abs(zoom - 1) < 0.2 ? 'bg-yellow-500 text-black border-yellow-400 scale-110' : 'bg-black/50 text-white border-white/20 hover:bg-black/70'}`}
                    >
                        1x
                    </button>
                    {show2x && (
                        <button 
                            onClick={() => handleZoomChange(2)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${Math.abs(zoom - 2) < 0.2 ? 'bg-yellow-500 text-black border-yellow-400 scale-110' : 'bg-black/50 text-white border-white/20 hover:bg-black/70'}`}
                        >
                            2
                        </button>
                    )}
                    {show5x && (
                        <button 
                            onClick={() => handleZoomChange(5)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black transition-all border ${Math.abs(zoom - 5) < 0.2 ? 'bg-yellow-500 text-black border-yellow-400 scale-110' : 'bg-black/50 text-white border-white/20 hover:bg-black/70'}`}
                        >
                            5
                        </button>
                    )}
                </div>
            )}

            {/* Fine Tune Zoom Slider */}
            {zoomCapabilities && (
                <div className="flex items-center gap-3 px-2 pointer-events-auto">
                    <span className="text-[9px] font-black text-gray-500 w-6 text-center">{zoomCapabilities.min}x</span>
                    <input 
                        type="range" 
                        min={zoomCapabilities.min} 
                        max={zoomCapabilities.max} 
                        step={zoomCapabilities.step} 
                        value={zoom} 
                        onChange={(e) => handleZoomChange(parseFloat(e.target.value))} 
                        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                    <span className="text-[9px] font-black text-gray-500 w-6 text-center">{zoomCapabilities.max}x</span>
                </div>
            )}

            <div className="flex justify-between items-center gap-3 pointer-events-auto px-2">
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange} 
                />
                
                {/* Upload Button */}
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 rounded-2xl bg-gray-800 border border-white/10 flex items-center justify-center text-gray-400 active:scale-90 transition-all shadow-lg hover:text-white"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </button>

                {/* Mode Switcher */}
                <div className="flex bg-gray-800 p-1.5 rounded-2xl border border-white/10 shadow-lg flex-grow max-w-[200px]">
                    <button 
                        onClick={() => setScanMode('single')} 
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${scanMode === 'single' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        Single
                    </button>
                    <button 
                        onClick={() => setScanMode('increment')} 
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${scanMode === 'increment' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        Multi
                    </button>
                </div>

                {/* Placeholder to balance layout (or another feature later) */}
                <div className="w-12"></div>
            </div>

            <div 
                className="w-full flex justify-center pb-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity pointer-events-auto"
                onClick={onOpenHistory}
            >
                <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-1 bg-gray-600 rounded-full"></div>
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Swipe for History</span>
                </div>
            </div>
        </div>
    );
};

export default ScannerControls;
