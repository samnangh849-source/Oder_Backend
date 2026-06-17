
import React from 'react';
import { MAP_COLORS, REVENUE_LEVELS } from './mapStyles';

const MapLegend: React.FC = () => {
    return (
        <div className="absolute bottom-6 left-6 bg-black/90 p-4 border border-cyan-500/30 z-10 shadow-lg pointer-events-none min-w-[180px] font-mono">
            <div className="flex items-center justify-between mb-3 border-b border-cyan-900 pb-2">
                <h5 className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">DENSITY INDEX</h5>
                <div className="w-2 h-2 bg-cyan-500 animate-pulse"></div>
            </div>
            
            <div className="space-y-1">
                {REVENUE_LEVELS.map((val, i) => {
                    if (i === 0) return null; 
                    const color = MAP_COLORS.levels[i]; 
                    const prev = REVENUE_LEVELS[i-1];
                    
                    const label = i === REVENUE_LEVELS.length - 1 
                        ? `> ${(val / 1000).toFixed(0)}k` 
                        : `${(prev / 1000).toFixed(0)}k-${(val / 1000).toFixed(0)}k`;

                    return (
                        <div key={i} className="flex items-center gap-3">
                            <div 
                                className="w-2 h-2 border border-cyan-500/50" 
                                style={{ backgroundColor: color }}
                            ></div>
                            <span className="text-[9px] text-cyan-300">{label}</span>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-3 pt-2 border-t border-cyan-900 flex items-center gap-2">
                 <div className="h-8 w-1 bg-gradient-to-t from-black via-cyan-900 to-cyan-500"></div>
                 <div className="flex flex-col">
                     <span className="text-[8px] text-cyan-600 uppercase">Z-AXIS</span>
                     <span className="text-[8px] text-cyan-400">VOLUME</span>
                 </div>
            </div>
        </div>
    );
};

export default MapLegend;
