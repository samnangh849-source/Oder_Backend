import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Driver } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface DriverSelectorProps {
    drivers?: Driver[];
    selectedDriverName: string;
    onSelect: (driverName: string) => void;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({ drivers = [], selectedDriverName, onSelect }) => {
    const safeDrivers = useMemo(() => Array.isArray(drivers) ? drivers : [], [drivers]);
    const { playHover, playClick } = useSoundEffects();

    const handleSelect = (name: string) => {
        if (selectedDriverName !== name) {
            playClick();
            onSelect(name);
        }
    };

    return (
        <div className="w-full py-4">
            <style>{`
                @keyframes float-badge {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .animate-float-badge {
                    animation: float-badge 3s ease-in-out infinite;
                }
                .glass-card-hover {
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                }
            `}</style>
            
            {safeDrivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-white/10 rounded-[2rem] bg-white/[0.02] backdrop-blur-xl">
                    <div className="w-10 h-10 border-2 border-gray-700 border-t-cyan-500 rounded-full animate-spin mb-3"></div>
                    <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">NO DRIVERS DETECTED</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-2">
                    {safeDrivers.map((d) => (
                        <DriverCard 
                            key={d.DriverName}
                            driver={d}
                            isSelected={selectedDriverName === d.DriverName}
                            onSelect={() => handleSelect(d.DriverName)}
                            onHover={playHover}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface DriverCardProps {
    driver: Driver;
    isSelected: boolean;
    onSelect: () => void;
    onHover: () => void;
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, isSelected, onSelect, onHover }) => {
    return (
        <div
            onClick={onSelect}
            onMouseEnter={onHover}
            className={`
                relative group cursor-pointer transition-all duration-500 rounded-[2rem] p-1.5 
                ${isSelected 
                    ? 'bg-gradient-to-b from-blue-500 to-indigo-600 shadow-[0_10px_40px_rgba(59,130,246,0.4)] scale-[1.03] sm:scale-105 z-10' 
                    : 'bg-gray-800/40 hover:bg-gray-700/60 hover:scale-[1.02] hover:shadow-2xl border border-white/5'
                }
            `}
        >
            <div className={`
                relative h-44 sm:h-48 w-full rounded-[1.5rem] overflow-hidden transition-all duration-500
                ${isSelected ? 'ring-[3px] ring-white/20 shadow-inner' : ''}
            `}>
                {/* Background Image */}
                <img 
                    src={convertGoogleDriveUrl(driver.ImageURL)} 
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110"
                    alt={driver.DriverName} 
                />
                
                {/* Gradient Overlays */}
                <div className={`
                    absolute inset-0 transition-colors duration-500
                    ${isSelected 
                        ? 'bg-gradient-to-t from-indigo-900/90 via-blue-900/30 to-transparent' 
                        : 'bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent opacity-90 group-hover:opacity-100'
                    }
                `}></div>

                {/* Selected Checkmark Badge */}
                {isSelected && (
                    <div className="absolute top-3 right-3 bg-white text-blue-600 rounded-full p-1 shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-fade-in-scale">
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                )}

                {/* Status Indicator (Top Left) */}
                <div className={`
                    absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md transition-all duration-500
                    ${isSelected ? 'bg-black/20 border-white/20 animate-float-badge' : 'bg-black/40 border-white/10 opacity-70 group-hover:opacity-100'}
                `}>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></div>
                    <span className="text-[7.5px] sm:text-[8px] font-black text-emerald-300 uppercase tracking-widest leading-none">
                        Ready
                    </span>
                </div>

                {/* Driver Name (Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex flex-col items-center">
                    <h3 className={`
                        text-xs sm:text-sm font-black uppercase tracking-[0.15em] text-center transition-all duration-300
                        ${isSelected 
                            ? 'text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)] transform -translate-y-1' 
                            : 'text-gray-300 group-hover:text-white group-hover:-translate-y-1'
                        }
                    `}>
                        {driver.DriverName}
                    </h3>
                    
                    {/* Active Bar indicator underneath name */}
                    <div className={`
                        w-6 h-1 mt-2 rounded-full transition-all duration-500
                        ${isSelected ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee] scale-100' : 'bg-transparent scale-0'}
                    `}></div>
                </div>
            </div>
        </div>
    );
};

export default DriverSelector;
