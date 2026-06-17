
import React from 'react';

interface ScannerOverlayProps {
    isScanning: boolean;
    error: string | null;
    scanSuccessFlash: boolean;
    zoom: number;
    useSimulatedZoom: boolean;
    trackingBox?: { x: number; y: number; width: number; height: number } | null;
    focusPoint?: { x: number; y: number } | null;
}

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({ 
    isScanning, 
    error, 
    scanSuccessFlash, 
    zoom, 
    useSimulatedZoom,
    trackingBox,
    focusPoint
}) => {
    return (
        <>
            <style>{`
              .hud-grid {
                background-size: 40px 40px;
                background-image: linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px);
              }
              .scanner-laser {
                position: absolute; left: 0; width: 100%; height: 2px; background: #3b82f6; box-shadow: 0 0 15px #3b82f6; animation: laser-scan 2s ease-in-out infinite;
              }
              @keyframes laser-scan { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
              
              /* Enhanced Success Animation */
              .scan-flash-overlay { animation: flash-screen 0.4s ease-out forwards; }
              @keyframes flash-screen { 
                  0% { background-color: rgba(16, 185, 129, 0); } 
                  20% { background-color: rgba(16, 185, 129, 0.4); } 
                  100% { background-color: rgba(16, 185, 129, 0); } 
              }
              
              .tracking-box {
                  position: absolute;
                  border: 2px solid #10b981;
                  background-color: rgba(16, 185, 129, 0.1);
                  box-shadow: 0 0 15px rgba(16, 185, 129, 0.6);
                  border-radius: 8px;
                  transition: all 0.1s linear; /* Smooth movement */
                  pointer-events: none;
                  z-index: 10;
                  transform: translate(-50%, -50%); /* Center based on x, y */
              }

              /* Focus Reticle Animation */
              @keyframes focus-ping {
                  0% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; border-color: white; }
                  20% { opacity: 1; }
                  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; border-color: #f59e0b; }
              }
              .focus-reticle {
                  position: absolute;
                  width: 60px;
                  height: 60px;
                  border: 2px solid white;
                  border-radius: 50%;
                  pointer-events: none;
                  animation: focus-ping 0.6s ease-out forwards;
                  z-index: 20;
                  box-shadow: 0 0 10px rgba(255,255,255,0.5);
              }
            `}</style>
            
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Grid Background */}
                {!isScanning && !error && <div className="absolute inset-0 hud-grid opacity-30"></div>}
                
                {/* Full Screen Flash on Success */}
                {scanSuccessFlash && <div className="absolute inset-0 z-50 scan-flash-overlay"></div>}

                {/* Focus Point Reticle */}
                {focusPoint && (
                    <div 
                        className="focus-reticle"
                        style={{ left: focusPoint.x, top: focusPoint.y }}
                    />
                )}

                {/* AI Tracking Box (Calculated from Vision Algorithm) */}
                {trackingBox && (
                    <div 
                        className="tracking-box"
                        style={{
                            left: `${trackingBox.x}%`,
                            top: `${trackingBox.y}%`,
                            width: `${trackingBox.width}%`,
                            height: `${trackingBox.height}%`
                        }}
                    >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-lg whitespace-nowrap animate-pulse">
                            AI TRACKING
                        </div>
                    </div>
                )}

                {/* Static Target Box (Only show if no AI box) */}
                {!isScanning && !error && !trackingBox && (
                    <div className={`
                        absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        w-[260px] h-[260px] border-2 transition-all duration-300
                        ${scanSuccessFlash ? 'border-emerald-500 scale-110 shadow-[0_0_50px_rgba(16,185,129,0.8)]' : 'border-white/30'}
                        rounded-[2rem]
                    `}>
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl -translate-x-1 -translate-y-1"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl translate-x-1 -translate-y-1"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl -translate-x-1 translate-y-1"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl translate-x-1 translate-y-1"></div>
                        
                        <div className="scanner-laser"></div>
                    </div>
                )}

                {/* Info Metrics */}
                <div className="absolute top-[18%] right-4 flex flex-col gap-2 items-end">
                    <div className="text-[9px] font-mono text-blue-400 bg-black/60 px-2 py-1 rounded border border-blue-500/20 flex items-center gap-2 backdrop-blur-md">
                        <span>{zoom.toFixed(1)}x</span>
                        {useSimulatedZoom && <span className="bg-white/10 px-1 rounded text-[8px] text-white">DIGITAL</span>}
                    </div>
                    {trackingBox && (
                        <div className="text-[9px] font-mono text-emerald-400 bg-black/60 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-2 backdrop-blur-md animate-pulse">
                            <span>SMART-ZOOM</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ScannerOverlay;
