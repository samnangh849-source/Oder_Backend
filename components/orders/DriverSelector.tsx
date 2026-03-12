
import React, { useRef, useEffect, useMemo } from 'react';
import { Driver } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface DriverSelectorProps {
    drivers?: Driver[];
    selectedDriverName: string;
    onSelect: (driverName: string) => void;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({ drivers = [], selectedDriverName, onSelect }) => {
    const safeDrivers = useMemo(() => Array.isArray(drivers) ? drivers : [], [drivers]);
    
    // --- Audio System ---
    const sfxHover = useRef<HTMLAudioElement | null>(null);
    const sfxSelect = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // High-Tech Digital Interface Sounds
        sfxHover.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'); 
        sfxSelect.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3'); 
        
        if (sfxHover.current) sfxHover.current.volume = 0.15;
        if (sfxSelect.current) sfxSelect.current.volume = 0.4;
    }, []);

    const playHover = () => {
        if (sfxHover.current) {
            sfxHover.current.currentTime = 0;
            sfxHover.current.play().catch(() => {});
        }
    };

    const handleSelect = (name: string) => {
        if (selectedDriverName !== name) {
            if (sfxSelect.current) {
                sfxSelect.current.currentTime = 0;
                sfxSelect.current.play().catch(() => {});
            }
            onSelect(name);
        }
    };

    return (
        <div className="w-full py-4">
            <style>{`
                /* Flux Animation Keyframes */
                @keyframes spin-flux {
                    from { --angle: 0deg; }
                    to { --angle: 360deg; }
                }

                .flux-card {
                    position: relative;
                    background: #0f172a;
                    border-radius: 1rem;
                    z-index: 1;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
                }

                .flux-card.selected::after, .flux-card.selected::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    z-index: -1;
                    background: conic-gradient(from var(--angle, 0deg), transparent 60%, #22d3ee, #3b82f6, #a855f7, #22d3ee);
                    border-radius: inherit;
                    animation: spin-flux 2s linear infinite;
                }

                .flux-card.selected::before {
                    filter: blur(10px);
                    opacity: 0.7;
                }

                @keyframes float-text {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                .animate-float-text {
                    animation: float-text 3s ease-in-out infinite;
                }
            `}</style>

            {safeDrivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
                    <div className="w-10 h-10 border-2 border-gray-700 border-t-cyan-500 rounded-full animate-spin mb-3"></div>
                    <p className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">NO DRIVERS DETECTED</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 p-2">
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
                flux-card relative h-48 cursor-pointer transition-all duration-300 group overflow-visible
                flex flex-col items-center justify-end pb-3
                ${isSelected 
                    ? 'selected scale-[1.03]' 
                    : 'border border-white/5 hover:border-blue-500/30 grayscale opacity-70 hover:opacity-100 hover:grayscale-0'
                }
            `}
        >
            <div className="absolute inset-0 rounded-2xl overflow-hidden bg-gray-900">
                <div className="absolute inset-0 opacity-20" style={{ 
                    backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', 
                    backgroundSize: '10px 10px' 
                }}></div>
                {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-blue-900/40 to-transparent"></div>
                )}
            </div>

            <div className={`
                absolute inset-x-0 transition-all duration-500 z-10 flex justify-center
                ${isSelected ? 'top-3 bottom-12' : 'top-4 bottom-10'}
            `}>
                <div className={`
                    relative w-full h-full max-w-[85%] rounded-xl overflow-hidden transition-all duration-500
                    ${isSelected ? 'shadow-[0_0_20px_rgba(59,130,246,0.4)] ring-1 ring-blue-400/30' : 'shadow-none'}
                `}>
                    <img 
                        src={convertGoogleDriveUrl(driver.ImageURL)} 
                        className="w-full h-full object-cover object-top"
                        alt={driver.DriverName} 
                    />
                </div>
            </div>

            <div className="relative z-20 w-full px-2 text-center">
                <div className={`
                    transition-all duration-300 transform
                    ${isSelected ? 'translate-y-0 animate-float-text' : 'translate-y-1'}
                `}>
                    <h3 className={`
                        text-[11px] font-black uppercase tracking-widest leading-tight
                        ${isSelected ? 'text-white drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'text-gray-400'}
                    `}>
                        {driver.DriverName}
                    </h3>
                </div>
                <div className={`
                    mt-2 flex items-center justify-center gap-1.5 transition-all duration-300
                    ${isSelected ? 'opacity-100' : 'opacity-0 scale-0'}
                `}>
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_5px_#22d3ee]"></div>
                    <span className="text-[7px] font-bold text-cyan-300 uppercase tracking-[0.2em] border border-cyan-500/30 px-1.5 py-0.5 rounded bg-cyan-950/50">
                        ONLINE
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DriverSelector;
