
import React from 'react';
import { ShippingMethod } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface ShippingMethodDropdownProps {
    methods: ShippingMethod[];
    selectedMethodName: string;
    onSelect: (method: ShippingMethod) => void;
    placeholder?: string;
}

const ShippingMethodDropdown: React.FC<ShippingMethodDropdownProps> = ({ 
    methods, 
    selectedMethodName, 
    onSelect 
}) => {
    return (
        <div className="w-full">
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto custom-scrollbar px-1 pb-1 pt-1">
                {methods.map((method) => {
                    const isSelected = selectedMethodName === method.MethodName;
                    
                    return (
                        <button
                            key={method.MethodName}
                            type="button"
                            onClick={() => onSelect(method)}
                            className={`
                                relative group rounded-none transition-all duration-200 min-h-[120px] flex flex-col border-2
                                ${isSelected ? 'border-[#FCD535] bg-[#FCD535]/10 shadow-[4px_4px_0px_0px_rgba(252,213,53,0.3)] translate-x-[-2px] translate-y-[-2px]' : 'bg-[#0B0E11] border-[#2B3139] hover:border-[#FCD535]/50'}
                            `}
                        >
                            {/* Inner Content Container */}
                            <div className={`
                                w-full h-full rounded-none flex flex-col items-center justify-center p-3 relative overflow-hidden
                                ${isSelected ? 'bg-transparent' : 'bg-transparent'}
                            `}>
                                {/* Selected Indicator Badge */}
                                {isSelected && (
                                    <div className="absolute top-0 right-0 p-1 bg-[#FCD535] text-[#181A20]">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}

                                {/* Logo */}
                                <div className={`
                                    relative z-10 w-12 h-12 mb-2 transition-all duration-200
                                    ${isSelected ? 'scale-110 grayscale-0' : 'opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0'}
                                `}>
                                    <img 
                                        src={convertGoogleDriveUrl(method.LogoURL)} 
                                        className="w-full h-full object-contain" 
                                        alt={method.MethodName} 
                                    />
                                </div>

                                {/* Text Info */}
                                <div className="relative z-10 text-center w-full">
                                    <p className={`
                                        text-[11px] font-black uppercase tracking-widest transition-all leading-tight
                                        ${isSelected ? 'text-[#FCD535]' : 'text-[#848E9C] group-hover:text-[#EAECEF]'}
                                    `}>
                                        {method.MethodName}
                                    </p>
                                    
                                    {method.RequireDriverSelection && (
                                        <div className={`
                                            mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-widest
                                            ${isSelected ? 'bg-[#FCD535] text-[#181A20]' : 'bg-[#2B3139] text-[#848E9C]'}
                                        `}>
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            DRIVER REQ
                                        </div>
                                    )}

                                    {method.InternalCost !== undefined && method.InternalCost > 0 && (
                                        <div className={`
                                            mt-1.5 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-[0.1em]
                                            ${isSelected ? 'text-[#FCD535]/80' : 'text-[#474D57]'}
                                        `}>
                                            <span className="opacity-60 uppercase text-[8px]">Rec:</span>
                                            <span className={isSelected ? 'text-[#FCD535]' : 'text-[#848E9C]'}>${method.InternalCost}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            
            {methods.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed border-[#2B3139] rounded-none bg-[#0B0E11]/50">
                    <p className="text-[10px] text-[#474D57] font-black uppercase tracking-widest italic animate-pulse">No Methods Found</p>
                </div>
            )}
        </div>
    );
};

export default ShippingMethodDropdown;
