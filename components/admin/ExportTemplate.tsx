
import React, { useCallback } from 'react';
import { TeamPage } from '../../types';

interface ExportTemplateProps {
    storesHierarchy: Record<string, Record<string, TeamPage[]>>;
    selectedPageNames: Set<string>;
    teamsPerRow: number;
    columns: {
        pageName: boolean;
        telegramValue: boolean;
        logoImage: boolean;
    };
    imageMap: Record<string, string>;
}

const ExportTemplate: React.FC<ExportTemplateProps> = ({ 
    storesHierarchy, 
    selectedPageNames, 
    teamsPerRow, 
    columns, 
    imageMap 
}) => {
    
    const totalSelectedItems = selectedPageNames.size;
    
    const getDynamicScale = useCallback(() => {
        if (totalSelectedItems > 60) return 0.45;
        if (totalSelectedItems > 45) return 0.6;
        if (totalSelectedItems > 30) return 0.75;
        if (totalSelectedItems >= 20) return 0.85; 
        return 1.0;
    }, [totalSelectedItems]);

    const scale = getDynamicScale();
    const s = (px: number) => Math.round(px * scale);

    return (
        <div 
            id="png-export-layer" 
            style={{ 
                display: 'none', 
                width: '2560px', 
                minHeight: '1440px', 
                height: 'auto',      
                position: 'relative',
                backgroundColor: '#020617',
                fontFamily: "'Kantumruy Pro', sans-serif",
                WebkitFontSmoothing: 'antialiased',
                paddingBottom: s(100) 
            }} 
            className="flex flex-col items-center" 
        >
            <style>{`
                #png-export-layer * {
                    box-sizing: border-box;
                    line-height: 1.6 !important;
                }
                .khmer-text {
                    font-family: 'Kantumruy Pro', sans-serif !important;
                    padding-bottom: 2px;
                }
                .item-container {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .team-badge-gradient {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border: ${s(2)}px solid rgba(59, 130, 246, 0.5);
                }
            `}</style>

            {/* Aesthetic Background */}
            <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#3b82f6 1.2px, transparent 1.2px)', backgroundSize: '40px 40px', height: '100%' }}></div>
            
            {/* Main Content Container */}
            <div className="w-full h-full flex flex-col p-[50px] relative z-10 justify-center">
                
                <div className="w-full">
                    {Object.entries(storesHierarchy).map(([storeName, teams], sIdx) => {
                        const storeHasSelected = Object.values(teams).some(tp => tp.some(p => selectedPageNames.has(p.PageName)));
                        if (!storeHasSelected) return null;

                        return (
                            <div key={storeName} className="w-full item-container flex flex-col mb-[70px] last:mb-0 items-center">
                                
                                {/* Store Header - Clean version without Cluster Team */}
                                <div className="flex items-center gap-[30px] mb-[60px] justify-center">
                                    <div 
                                        style={{ width: s(100), height: s(100), borderRadius: s(28), fontSize: s(50) }}
                                        className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black shadow-[0_0_40px_rgba(59,130,246,0.3)] border border-white/20 flex-shrink-0"
                                    >
                                        {(sIdx + 1).toString().padStart(2, '0')}
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <h2 style={{ fontSize: s(100) }} className="font-black text-white uppercase tracking-tighter leading-none khmer-text drop-shadow-2xl">{storeName}</h2>
                                    </div>
                                </div>

                                {/* Teams Grid Layout */}
                                <div className="w-full flex justify-center">
                                    <div 
                                        className="grid" 
                                        style={{ 
                                            gridTemplateColumns: `repeat(${teamsPerRow}, minmax(0, 1fr))`,
                                            gap: s(60),
                                            width: '100%',
                                            maxWidth: '95%',
                                            direction: 'ltr' 
                                        }}
                                    >
                                        {Object.entries(teams).map(([teamName, teamPages]) => {
                                            const filteredPages = teamPages.filter(p => selectedPageNames.has(p.PageName));
                                            if (filteredPages.length === 0) return null;
                                            
                                            return (
                                                <div 
                                                    key={teamName} 
                                                    style={{ borderRadius: s(45), padding: s(40), paddingTop: s(65) }}
                                                    className="bg-gray-900/40 border border-white/10 shadow-2xl flex flex-col relative backdrop-blur-xl"
                                                >
                                                    {/* Redesigned Team Badge Box - Modern Look */}
                                                    <div 
                                                        style={{ 
                                                            top: s(-42), 
                                                            left: '50%', 
                                                            transform: 'translateX(-50%)',
                                                            borderRadius: s(20), 
                                                            padding: `${s(14)}px ${s(50)}px`, 
                                                            fontSize: s(34),
                                                            minWidth: s(220),
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: `0 ${s(15)}px ${s(35)}px rgba(0,0,0,0.8), inset 0 0 ${s(10)}px rgba(59, 130, 246, 0.2)`
                                                        }}
                                                        className="absolute team-badge-gradient font-black uppercase tracking-widest text-blue-400 khmer-text whitespace-nowrap z-20"
                                                    >
                                                        {teamName}
                                                    </div>
                                                    
                                                    <div className="space-y-[20px] flex-grow">
                                                        {filteredPages.map((p) => (
                                                            <div 
                                                                key={p.PageName} 
                                                                style={{ borderRadius: s(28), padding: s(18) }}
                                                                className="flex items-center gap-[20px] bg-black/40 border border-white/5 shadow-inner hover:border-blue-500/30 transition-all"
                                                            >
                                                                {columns.logoImage && imageMap[p.PageName] && (
                                                                    <div className="relative flex-shrink-0">
                                                                        <img 
                                                                            src={imageMap[p.PageName]} 
                                                                            style={{ width: s(85), height: s(85), borderRadius: s(22) }}
                                                                            className="object-cover border-[3px] border-gray-700 shadow-lg" 
                                                                            alt="" 
                                                                        />
                                                                    </div>
                                                                )}
                                                                {/* Page Info */}
                                                                <div className="flex-grow min-w-0 text-left" style={{ marginTop: s(-25) }}>
                                                                    <span 
                                                                        style={{ fontSize: s(36) }}
                                                                        className="font-black block text-white uppercase tracking-tight khmer-text leading-tight break-words"
                                                                    >
                                                                        {p.PageName}
                                                                    </span>
                                                                    {columns.telegramValue && (
                                                                        <div 
                                                                            style={{ marginTop: s(8) }}
                                                                            className="flex items-center gap-2"
                                                                        >
                                                                            <svg style={{ width: s(20), height: s(20) }} className="text-blue-500 opacity-80" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm-1-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                                                                            <span style={{ fontSize: s(24) }} className="text-blue-400/70 font-mono font-bold tracking-wider leading-none">
                                                                                @{p.TelegramValue}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ExportTemplate;
