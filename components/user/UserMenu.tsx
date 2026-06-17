
import React from 'react';

interface UserMenuProps {
    selectedTeam: string;
    onNavigate: (view: 'create_order' | 'my_orders' | 'report') => void;
    onSwitchTeam: () => void;
    onBackToRole: () => void;
    canGoBack: boolean;
    hasMultipleTeams: boolean;
}

const UserMenu: React.FC<UserMenuProps> = ({ 
    selectedTeam, 
    onNavigate, 
    onSwitchTeam, 
    onBackToRole, 
    canGoBack, 
    hasMultipleTeams 
}) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in">
            <div className="mb-10 text-center">
                <div className="inline-block relative">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl mb-4 border border-white/10 mx-auto">
                        <span className="text-4xl font-black text-white">{selectedTeam.charAt(0)}</span>
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-gray-900 border border-gray-700 rounded-full p-1.5">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">{selectedTeam}</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.25em] mt-1">Operational Dashboard</p>
            </div>

            <div className="w-full max-w-sm space-y-4">
                <button 
                    onClick={() => onNavigate('create_order')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] p-5 shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-5 group"
                >
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-black uppercase tracking-tight">Create Order</h3>
                        <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">New Transaction</p>
                    </div>
                    <svg className="w-5 h-5 text-white/50 ml-auto group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>

                <button 
                    onClick={() => onNavigate('my_orders')}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-[2rem] p-5 border border-white/5 active:scale-95 transition-all flex items-center gap-5 group"
                >
                    <div className="w-12 h-12 bg-gray-700 rounded-2xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-black uppercase tracking-tight">My Orders</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">View History</p>
                    </div>
                </button>

                <button 
                    onClick={() => onNavigate('report')}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-[2rem] p-5 border border-white/5 active:scale-95 transition-all flex items-center gap-5 group"
                >
                    <div className="w-12 h-12 bg-gray-700 rounded-2xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-black uppercase tracking-tight">Report</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Performance & Sales</p>
                    </div>
                </button>
            </div>

            {/* Footer Controls */}
            <div className="mt-12 flex flex-col items-center gap-4">
                {hasMultipleTeams && (
                    <button 
                        onClick={onSwitchTeam}
                        className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        Switch Team
                    </button>
                )}
                {canGoBack && (
                    <button 
                        onClick={onBackToRole}
                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors"
                    >
                        Back to Role Selection
                    </button>
                )}
            </div>
        </div>
    );
};

export default UserMenu;
