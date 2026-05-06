import React, { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Driver } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface DriverSelectorProps {
    drivers?: Driver[];
    selectedDriverName: string;
    onSelect: (driverName: string) => void;
}

const DriverSelector: React.FC<DriverSelectorProps> = ({ drivers = [], selectedDriverName, onSelect }) => {
    const safeDrivers = useMemo(() => Array.isArray(drivers) ? drivers : [], [drivers]);

    const handleSelect = (name: string) => {
        if (selectedDriverName !== name) {
            onSelect(name);
        }
    };

    return (
        <div className="w-full py-2">
            {safeDrivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#2B3139] rounded-none bg-[#0B0E11]/50">
                    <div className="w-10 h-10 border-4 border-[#2B3139] border-t-[#FCD535] rounded-none animate-spin mb-4"></div>
                    <p className="text-[#474D57] font-black uppercase tracking-[0.2em] text-[10px] italic">NO DRIVERS DETECTED</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-1">
                    {safeDrivers.map((d) => (
                        <DriverCard 
                            key={d.DriverName}
                            driver={d}
                            isSelected={selectedDriverName === d.DriverName}
                            onSelect={() => handleSelect(d.DriverName)}
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
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, isSelected, onSelect }) => {
    return (
        <div
            onClick={onSelect}
            className={`
                relative group cursor-pointer transition-all duration-200 rounded-none p-1 border-2
                ${isSelected 
                    ? 'bg-[#FCD535] border-[#FCD535] shadow-[4px_4px_0px_0px_rgba(252,213,53,0.3)] z-10' 
                    : 'bg-[#0B0E11] border-[#2B3139] hover:border-[#FCD535]/50'
                }
            `}
        >
            <div className={`
                relative h-44 sm:h-48 w-full rounded-none overflow-hidden transition-all duration-300
                ${isSelected ? 'border-2 border-[#181A20]/20' : ''}
            `}>
                {/* Background Image */}
                <img 
                    src={convertGoogleDriveUrl(driver.ImageURL)} 
                    className={`w-full h-full object-cover object-top transition-all duration-500 ${isSelected ? 'scale-105 grayscale-0' : 'grayscale group-hover:grayscale-0 group-hover:scale-105'}`}
                    alt={driver.DriverName} 
                />
                
                {/* Gradient Overlays */}
                <div className={`
                    absolute inset-0 transition-opacity duration-300
                    ${isSelected 
                        ? 'bg-gradient-to-t from-[#181A20] via-transparent to-transparent opacity-60' 
                        : 'bg-gradient-to-t from-[#0B0E11] via-transparent to-transparent opacity-80 group-hover:opacity-40'
                    }
                `}></div>

                {/* Selected Checkmark Badge */}
                {isSelected && (
                    <div className="absolute top-2 right-2 bg-[#181A20] text-[#FCD535] p-1 shadow-lg animate-fade-in-scale">
                        <CheckCircle2 className="w-5 h-5" strokeWidth={3} />
                    </div>
                )}

                {/* Status Indicator (Top Left) */}
                <div className={`
                    absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 border-2 backdrop-blur-md transition-all duration-200
                    ${isSelected ? 'bg-[#181A20] border-[#181A20]/10' : 'bg-[#0B0E11]/80 border-[#2B3139] opacity-70 group-hover:opacity-100'}
                `}>
                    <div className={`w-2 h-2 rounded-none ${isSelected ? 'bg-[#FCD535]' : 'bg-[#0ECB81]'} animate-pulse shadow-[0_0_8px_currentColor]`}></div>
                    <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${isSelected ? 'text-[#FCD535]' : 'text-[#0ECB81]'}`}>
                        Ready
                    </span>
                </div>

                {/* Driver Name (Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col items-center">
                    <h3 className={`
                        text-[11px] sm:text-xs font-black uppercase tracking-widest text-center transition-all duration-200
                        ${isSelected 
                            ? 'text-white drop-shadow-md' 
                            : 'text-[#848E9C] group-hover:text-[#EAECEF]'
                        }
                    `}>
                        {driver.DriverName}
                    </h3>
                    
                    {/* Active Bar indicator underneath name */}
                    <div className={`
                        w-8 h-1 mt-1 rounded-none transition-all duration-300
                        ${isSelected ? 'bg-[#FCD535] scale-100' : 'bg-transparent scale-0'}
                    `}></div>
                </div>
            </div>
        </div>
    );
};

export default DriverSelector;
