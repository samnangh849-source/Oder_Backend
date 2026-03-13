import React from 'react';

interface TeamSelectionProps {
    teams: string[];
    onSelectTeam: (team: string) => void;
    onBack: () => void;
    canGoBack: boolean;
}

const TeamSelection: React.FC<TeamSelectionProps> = ({ teams, onSelectTeam, onBack, canGoBack }) => {
    return (
        <div className="flex flex-col items-center justify-between min-h-[85vh] sm:min-h-[80vh] px-4 py-8 font-['Kantumruy_Pro'] overflow-hidden">
            <style>{`
                .tahoe-glass { 
                    background: rgba(255, 255, 255, 0.02); 
                    backdrop-filter: blur(50px) saturate(180%); 
                    border: 1px solid rgba(255, 255, 255, 0.05); 
                    box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
                }
                .tahoe-card { transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
                .tahoe-card:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.15); }
                .tahoe-card:active { transform: scale(0.96); background: rgba(255, 255, 255, 0.08); }
                
                @keyframes slideIn { from { opacity: 0; transform: translateY(20px); filter: blur(10px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
                .animate-tahoe { animation: slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                .text-glow { text-shadow: 0 0 20px rgba(255, 255, 255, 0.15); }
            `}</style>

            <div className="text-center animate-tahoe w-full">
                <div className="w-10 h-1 bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full mb-6 sm:mb-10 mx-auto shadow-[0_0_30px_rgba(59,130,246,0.3)]"></div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tighter leading-tight mb-3 text-glow">
                    Operational <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Team Selection</span>
                </h2>
                <div className="flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05] backdrop-blur-md w-fit mx-auto">
                     <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                     <p className="text-white/40 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.3em]">Architecture v26.3.1</p>
                </div>
            </div>

            <div className={`w-full grid ${teams.length > 3 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 sm:gap-4 max-w-md animate-tahoe my-6`} style={{ animationDelay: '0.1s' }}>
                {teams.map((team, idx) => (
                    <button
                        key={team}
                        onClick={() => onSelectTeam(team)}
                        className="tahoe-glass tahoe-card w-full flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl sm:rounded-[2.5rem] group relative overflow-hidden"
                    >
                        <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-white border border-white/10 group-hover:border-blue-500/30 transition-all duration-700 shadow-2xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="relative z-10 text-base sm:text-xl font-black tracking-tighter italic">{team.charAt(0)}</span>
                        </div>

                        <div className="relative z-10 flex-grow text-left min-w-0">
                            <h3 className="text-xs sm:text-base font-bold text-white/95 group-hover:text-white transition-colors tracking-tight truncate">{team}</h3>
                            <p className="text-[8px] sm:text-[10px] text-white/30 font-semibold uppercase tracking-widest mt-0.5 opacity-60">ID: 0{idx + 1}</p>
                        </div>

                        <div className="hidden sm:flex relative z-10 w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] items-center justify-center opacity-40 group-hover:opacity-100 group-hover:bg-blue-600 transition-all">
                             <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                    </button>
                ))}
            </div>

            {canGoBack && (
                <button
                    onClick={onBack}
                    className="group flex items-center gap-2 text-white/20 hover:text-white/80 text-[9px] font-bold uppercase tracking-[0.2em] transition-all py-2.5 px-6 rounded-full hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] animate-tahoe"
                    style={{ animationDelay: '0.2s' }}
                >
                    <svg className="w-3 h-3 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ត្រឡប់ទៅតួនាទី
                </button>
            )}
        </div>
    );
};

export default TeamSelection;
