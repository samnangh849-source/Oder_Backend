
import React from 'react';
import { TeamPage } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface PageDropdownProps {
    pages: TeamPage[];
    selectedPageName: string;
    onSelect: (page: TeamPage) => void;
}

const PageDropdown: React.FC<PageDropdownProps> = ({ pages, selectedPageName, onSelect }) => {
    return (
        <div className="relative w-full">
            {/* Horizontal Scroll Container with Snapping */}
            <div className="flex overflow-x-auto gap-3.5 pb-6 pt-2 px-1 snap-x no-scrollbar">
                {pages.map((page) => {
                    const isSelected = selectedPageName === page.PageName;
                    return (
                        <button
                            key={page.PageName}
                            type="button"
                            onClick={() => onSelect(page)}
                            className={`
                                relative flex-shrink-0 w-[115px] h-[135px] snap-center rounded-[2rem] 
                                border-2 transition-all duration-700 outline-none group
                                ${isSelected 
                                    ? 'bg-blue-600/20 border-blue-500 shadow-[0_15px_30px_rgba(59,130,246,0.3)] scale-105' 
                                    : 'bg-gray-800/30 backdrop-blur-xl border-white/5 hover:border-blue-500/30'}
                            `}
                        >
                            {/* Inner Glass Content */}
                            <div className="flex flex-col items-center justify-center h-full p-3 gap-2">
                                {/* Logo with Halo Effect */}
                                <div className="relative">
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                                    )}
                                    <div className={`
                                        relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-700
                                        ${isSelected ? 'border-white scale-110 shadow-2xl rotate-[360deg]' : 'border-gray-700 opacity-50 group-hover:opacity-100'}
                                    `}>
                                        <img 
                                            src={convertGoogleDriveUrl(page.PageLogoURL)} 
                                            className="w-full h-full object-cover" 
                                            alt={page.PageName} 
                                        />
                                    </div>
                                    
                                    {/* Small Selection Checkmark */}
                                    {isSelected && (
                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-lg animate-bounce-slow">
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                                                <path d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Text Info */}
                                <div className="text-center w-full px-1">
                                    <span className={`
                                        text-[10px] font-black uppercase tracking-tighter leading-tight block truncate transition-colors duration-500
                                        ${isSelected ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}
                                    `}>
                                        {page.PageName}
                                    </span>
                                    {page.TelegramValue && isSelected && (
                                        <span className="text-[7px] font-bold text-blue-400/80 block mt-0.5 animate-fade-in truncate">
                                            @{page.TelegramValue}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Accent Line */}
                            <div className={`
                                absolute bottom-3 left-1/2 -translate-x-1/2 h-1 rounded-full transition-all duration-700
                                ${isSelected ? 'w-6 bg-blue-400 shadow-[0_0_8px_#60a5fa]' : 'w-0 bg-transparent'}
                            `}></div>
                        </button>
                    );
                })}

                {pages.length === 0 && (
                    <div className="w-full py-10 flex flex-col items-center justify-center bg-gray-900/20 rounded-[2.5rem] border-2 border-dashed border-gray-800">
                        <svg className="w-6 h-6 text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest italic">រកមិនឃើញ Page</p>
                    </div>
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default PageDropdown;
