
import React from 'react';

interface MapTooltipProps {
    name: string;
    revenue: number;
    orders: number;
}

export const MapTooltip: React.FC<MapTooltipProps> = ({ name, revenue, orders }) => {
    return (
        <div className="relative group min-w-[220px] font-mono">
            {/* Tech Container */}
            <div className="relative bg-black/95 p-4 border border-cyan-500/60 shadow-lg overflow-hidden">
                
                {/* Corner Markers */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-500"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-500"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500"></div>

                {/* Scanline */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400/50 animate-scan-fast pointer-events-none shadow-[0_0_5px_#00f0ff]"></div>

                {/* Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-cyan-900 border-dashed">
                    <div className="flex flex-col">
                         <span className="text-[8px] text-cyan-600 uppercase">TARGET SECTOR</span>
                         <h4 className="font-bold text-sm text-cyan-100 uppercase tracking-widest">{name}</h4>
                    </div>
                    {revenue > 0 && <div className="w-2 h-2 bg-cyan-500 animate-pulse"></div>}
                </div>
                
                {/* Data Grid */}
                <div className="space-y-3">
                    
                    {/* Revenue */}
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-gray-500 text-[9px] uppercase">REVENUE</span>
                            <span className="font-bold text-lg text-white tracking-tighter">${revenue.toLocaleString()}</span>
                        </div>
                        {/* Bar */}
                        <div className="w-full h-1.5 bg-gray-900 border border-gray-800">
                             <div 
                                className="h-full bg-cyan-500 relative" 
                                style={{ width: `${Math.min((revenue / 50000) * 100, 100)}%` }}
                             ></div>
                        </div>
                    </div>

                    {/* Orders */}
                    <div className="flex justify-between items-center pt-1 border-t border-gray-900">
                        <span className="text-gray-500 text-[9px] uppercase">ORDER COUNT</span>
                        <div className="flex items-center gap-2">
                             <span className="font-bold text-sm text-cyan-400">{orders}</span>
                             <span className="text-[8px] text-gray-600 px-1 border border-gray-700">UNITS</span>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-1 right-2 text-[7px] text-cyan-900">
                    SYS.ID: {Math.floor(Math.random() * 9999)}
                </div>
            </div>

            <style>{`
                @keyframes scan-fast {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-fast {
                    animation: scan-fast 1.5s linear infinite;
                }
            `}</style>
        </div>
    );
};
