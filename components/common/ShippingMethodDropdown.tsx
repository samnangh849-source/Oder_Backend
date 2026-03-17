
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
            <style>{`
                @keyframes spin-border {
                    from { --angle: 0deg; }
                    to { --angle: 360deg; }
                }
                @property --angle {
                    syntax: '<angle>';
                    initial-value: 0deg;
                    inherits: false;
                }
                .card-flux {
                    position: relative;
                    background: #0f172a; /* Slate 900 */
                    border-radius: 1rem;
                    z-index: 1;
                }
                /* The spinning border effect */
                .card-flux-active::after, .card-flux-active::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    z-index: -1;
                    background: conic-gradient(from var(--angle), transparent 70%, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
                    border-radius: inherit;
                    animation: spin-border 3s linear infinite;
                }
                .card-flux-active::before {
                    filter: blur(10px);
                    opacity: 0.7;
                }
                
                @keyframes float-y {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-float-y {
                    animation: float-y 3s ease-in-out infinite;
                }
                
                @keyframes pulse-soft {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .animate-pulse-soft {
                    animation: pulse-soft 2s ease-in-out infinite;
                }
            `}</style>
            
            {/* Added px-2 to ensure even padding on both left and right sides */}
            <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto custom-scrollbar px-2 pb-2 pt-2">
                {methods.map((method) => {
                    const isSelected = selectedMethodName === method.MethodName;
                    
                    return (
                        <button
                            key={method.MethodName}
                            type="button"
                            onClick={() => onSelect(method)}
                            className={`
                                relative group rounded-2xl transition-all duration-300 min-h-[140px] flex flex-col
                                ${isSelected ? 'card-flux card-flux-active scale-[1.02]' : 'bg-gray-900 border border-gray-800 hover:bg-gray-800'}
                            `}
                        >
                            {/* Inner Content Container */}
                            <div className={`
                                w-full h-full rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden
                                ${isSelected ? 'bg-[#0f172a]' : 'bg-transparent'}
                            `}>
                                {/* Background Ambient Glow */}
                                {isSelected && (
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-500/10 via-purple-500/5 to-transparent pointer-events-none"></div>
                                )}

                                {/* Status Badge */}
                                <div className="absolute top-3 right-3 flex gap-1">
                                    {isSelected && (
                                        <span className="relative flex h-2.5 w-2.5">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                                        </span>
                                    )}
                                </div>

                                {/* Logo with Floating Animation */}
                                <div className={`
                                    relative z-10 w-14 h-14 mb-3 transition-all duration-300
                                    ${isSelected ? 'animate-float-y drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'opacity-80 group-hover:opacity-100'}
                                `}>
                                    <img 
                                        src={convertGoogleDriveUrl(method.LogosURL)} 
                                        className="w-full h-full object-contain" 
                                        alt={method.MethodName} 
                                    />
                                </div>

                                {/* Text Info */}
                                <div className="relative z-10 text-center w-full">
                                    <p className={`
                                        text-xs font-black uppercase tracking-widest transition-all
                                        ${isSelected ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-400 animate-pulse-soft' : 'text-gray-400 group-hover:text-gray-200'}
                                    `}>
                                        {method.MethodName}
                                    </p>
                                    
                                    {method.RequireDriverSelection && (
                                        <div className={`
                                            mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider
                                            ${isSelected ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'bg-gray-800 text-gray-500'}
                                        `}>
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            Driver Req
                                        </div>
                                    )}

                                    {method.InternalCost !== undefined && method.InternalCost > 0 && (
                                        <div className={`
                                            mt-1 flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-[0.1em]
                                            ${isSelected ? 'text-blue-300' : 'text-gray-500'}
                                        `}>
                                            <span className="opacity-60 italic">Rec:</span>
                                            <span className={isSelected ? 'text-blue-400' : 'text-gray-400'}>${method.InternalCost}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
            
            {methods.length === 0 && (
                <div className="p-8 text-center border border-dashed border-gray-700 rounded-2xl bg-gray-900/50">
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest animate-pulse">No Signal</p>
                </div>
            )}
        </div>
    );
};

export default ShippingMethodDropdown;
