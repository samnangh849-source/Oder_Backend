import React, { RefObject } from 'react';
import { DetectionResult } from '@/utils/visionAlgorithm';

interface CameraViewportProps {
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    fileInputRef: RefObject<HTMLInputElement>;
    isCameraActive: boolean;
    isAiEnabled: boolean;
    setIsAiEnabled: (val: boolean) => void;
    isAiLoading: boolean;
    detection: DetectionResult | null;
    autoCaptureProgress: number;
    countdown: number | null;
    previewImage: string | null;
    setPreviewImage: (val: string | null) => void;
    showFullImage: (url: string) => void;
    stopCamera: () => void;
    capturePhoto: () => void;
    startCamera: (facingMode?: 'environment' | 'user') => void;
    zoom: number;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    toggleCamera: () => void;
}

const CameraViewport: React.FC<CameraViewportProps> = ({
    videoRef, canvasRef, fileInputRef, isCameraActive, isAiEnabled, setIsAiEnabled,
    isAiLoading, detection, autoCaptureProgress, countdown, previewImage, setPreviewImage,
    showFullImage, stopCamera, capturePhoto, startCamera, zoom, handleFileChange, toggleCamera
}) => {
    return (
        <div className="bg-[#181A20] rounded-sm p-6 border border-[#2B3139] flex-grow flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1DB954] animate-pulse"></div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Camera Module Active</p>
                </div>
                <button onClick={() => setIsAiEnabled(!isAiEnabled)} className={`px-4 py-2 rounded-sm text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border ${isAiEnabled ? 'bg-[#FCD535]/10 text-[#FCD535] border-[#FCD535]/30' : 'bg-[#0B0E11] text-gray-500 border-[#2B3139]'}`}>
                    <div className={`w-2 h-2 rounded-full ${isAiEnabled ? (isAiLoading ? 'bg-[#FCD535]/50 animate-pulse' : 'bg-[#FCD535]') : 'bg-gray-600'}`}></div>
                    {isAiLoading ? 'LOADING AI...' : (isAiEnabled ? 'AI AUTO-CAPTURE' : 'AI OFFLINE')}
                </button>
            </div>
            
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <canvas ref={canvasRef} className="hidden" />

            <style>{`
                @keyframes scan-laser {
                    0% { transform: translateY(-160px); }
                    50% { transform: translateY(160px); }
                    100% { transform: translateY(-160px); }
                }
                .animate-scan-laser { animation: scan-laser 3s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
            `}</style>

            <div className="relative flex-grow min-h-[400px]">
                {previewImage ? (
                    <div className="absolute inset-0 rounded-sm overflow-hidden border border-[#2B3139] bg-[#0B0E11] cursor-pointer" onClick={() => showFullImage(previewImage)}>
                        <img src={previewImage} className="w-full h-full object-contain" alt="Preview" />
                        <button onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }} className="absolute top-4 right-4 w-10 h-10 bg-[#0B0E11] border border-[#2B3139] text-gray-400 hover:text-white rounded-sm flex items-center justify-center transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ) : isCameraActive ? (
                    <div className="absolute inset-0 rounded-sm overflow-hidden border border-[#2B3139] bg-black">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: `scale(${zoom})` }} />
                        
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-[85%] h-[80%] border border-[#2B3139] rounded-sm relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#FCD535]"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#FCD535]"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#FCD535]"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#FCD535]"></div>
                            </div>
                        </div>

                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#0B0E11]/80 backdrop-blur-sm">
                                <span className="text-8xl font-mono font-bold text-white">{countdown}</span>
                            </div>
                        )}

                        {isAiEnabled && detection?.barcodeBox && (
                            <div className="absolute transition-all duration-200 pointer-events-none z-30" style={{
                                left: `${(detection.barcodeBox.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                top: `${(detection.barcodeBox.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                width: `${(detection.barcodeBox.w / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                height: `${(detection.barcodeBox.h / (videoRef.current?.videoHeight || 1)) * 100}%`,
                            }}>
                                <div className="absolute inset-0 border-2 rounded-sm border-[#1DB954] shadow-[0_0_15px_rgba(29,185,84,0.5)]">
                                    <div className="absolute -top-6 left-0 px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-widest whitespace-nowrap bg-[#1DB954] text-white">
                                        {detection.barcodeFormat === 'qr_code' ? 'QR DETECTED' : 'BARCODE DETECTED'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isAiEnabled && detection?.found && detection.box && !detection.barcodeBox && (
                            <div className="absolute transition-all duration-200 pointer-events-none" style={{
                                left: `${(detection.box.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                top: `${(detection.box.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                width: `${(detection.box.w / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                height: `${(detection.box.h / (videoRef.current?.videoHeight || 1)) * 100}%`,
                            }}>
                                <div className={`absolute inset-0 border-2 rounded-sm ${detection.isHand ? 'border-[#F6465D]' : 'border-[#FCD535]'}`}>
                                    <div className={`absolute -top-6 left-0 px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-widest whitespace-nowrap ${detection.isHand ? 'bg-[#F6465D] text-white' : 'bg-[#FCD535] text-black'}`}>
                                        {detection.isHand ? 'OBSTACLE DETECTED' : 'OBJECT LOCKED'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isAiEnabled && !previewImage && (
                            <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
                                <div className="w-[85%] h-[2px] bg-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,1)] animate-scan-laser opacity-60"></div>
                            </div>
                        )}

                        {autoCaptureProgress > 0 && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-48 h-1 bg-[#181A20] rounded-sm overflow-hidden z-20">
                                <div className="h-full bg-[#FCD535] transition-all" style={{ width: `${autoCaptureProgress}%` }}></div>
                            </div>
                        )}

                        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8 z-40">
                            <button onClick={stopCamera} className="w-12 h-12 bg-[#0B0E11] text-gray-400 rounded-sm flex items-center justify-center border border-[#2B3139] hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <button onClick={capturePhoto} className="w-16 h-16 bg-[#FCD535] rounded-sm p-1.5 flex-shrink-0 active:scale-95 transition-all shadow-[0_0_15px_rgba(252,213,53,0.3)] border border-[#2B3139] hover:bg-[#E3C02F]">
                                <div className="w-full h-full border border-black/30 flex items-center justify-center">
                                    <span className="font-black text-black text-[9px] uppercase tracking-widest">Scan</span>
                                </div>
                            </button>
                            <div className="flex flex-col gap-2">
                                <button onClick={toggleCamera} className="w-10 h-10 bg-[#0B0E11] text-gray-400 rounded-sm flex items-center justify-center border border-[#2B3139] hover:text-white transition-colors" title="Flip Camera">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                                <div className="w-10 h-10 bg-[#0B0E11] border border-[#2B3139] rounded-sm flex items-center justify-center">
                                    <span className="text-[10px] font-mono font-bold text-[#FCD535]">{zoom.toFixed(1)}x</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <button onClick={startCamera} className="w-full h-full border border-dashed border-[#2B3139] rounded-sm flex flex-col items-center justify-center gap-6 hover:border-[#FCD535]/50 bg-[#0B0E11] transition-all group overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#FCD535]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="w-20 h-20 bg-[#181A20] rounded-sm flex items-center justify-center text-[#FCD535] border border-[#2B3139] group-hover:border-[#FCD535] group-hover:scale-105 transition-all shadow-[0_0_15px_rgba(252,213,53,0)] group-hover:shadow-[0_0_20px_rgba(252,213,53,0.15)] relative z-10">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <div className="text-center relative z-10">
                            <p className="text-sm font-bold text-gray-200 uppercase tracking-widest group-hover:text-white transition-colors">Activate Camera</p>
                            <p className="text-[#FCD535] text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80 group-hover:opacity-100 transition-opacity">Ready for capture sequence</p>
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};

export default CameraViewport;
