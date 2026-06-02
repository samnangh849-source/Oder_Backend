
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { fetchAuditLogs } from '../services/auditService';
import { UserActivityLog, EditLog } from '../types';
import Spinner from '../components/common/Spinner';
import { translations } from '../translations';

interface AuditLogDashboardProps {
    onBack: () => void;
}

const AuditLogDashboard: React.FC<AuditLogDashboardProps> = ({ onBack }) => {
    const { language, setMobilePageTitle } = useContext(AppContext);
    const t = translations[language];
    
    const [activeTab, setActiveTab] = useState<'activity' | 'edit'>('activity');
    const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
    const [editLogs, setEditLogs] = useState<EditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    
    // Update Mobile Header Title
    useEffect(() => {
        setMobilePageTitle(t.audit);
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, t.audit]);

    useEffect(() => {
        loadLogs();
    }, [activeTab]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await fetchAuditLogs(activeTab);
            if (activeTab === 'activity') {
                setActivityLogs(data as UserActivityLog[]);
            } else {
                setEditLogs(data as EditLog[]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(text);
        setTimeout(() => setCopySuccess(null), 2000);
    };

    const formatRelativeTime = (isoString: string) => {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
            
            if (diffInSeconds < 60) return 'Just now';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
            if (diffInSeconds < 172800) return 'Yesterday';
            
            return date.toLocaleDateString();
        } catch(e) { return isoString; }
    };

    const formatTimeOnly = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch(e) { return ''; }
    };

    const getActionTheme = (action: string) => {
        const a = action.toUpperCase();
        if (a.includes('LOGIN')) return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: '🔑' };
        if (a.includes('DELETE')) return { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: '🗑️' };
        if (a.includes('UPDATE') || a.includes('EDIT')) return { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: '📝' };
        if (a.includes('CREATE')) return { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: '✨' };
        if (a.includes('SYNC')) return { color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: '🔄' };
        return { color: 'text-gray-400 bg-gray-800 border-gray-700', icon: '•' };
    };

    const filteredLogs = useMemo(() => {
        const logs = activeTab === 'activity' ? activityLogs : editLogs;
        return logs.filter(log => {
            const logDate = new Date(log.Timestamp).toISOString().split('T')[0];
            const dateMatch = !selectedDate || logDate === selectedDate;
            const searchLower = searchTerm.toLowerCase();
            
            if (!dateMatch) return false;
            if (!searchTerm) return true;

            if (activeTab === 'activity') {
                const l = log as UserActivityLog;
                return (l.User && l.User.toLowerCase().includes(searchLower)) ||
                       (l.Action && l.Action.toLowerCase().includes(searchLower)) ||
                       (l.Details && l.Details.toLowerCase().includes(searchLower));
            } else {
                const l = log as EditLog;
                return (l.OrderID && l.OrderID.toLowerCase().includes(searchLower)) ||
                       (l.Requester && l.Requester.toLowerCase().includes(searchLower)) ||
                       (l["Field Changed"] && l["Field Changed"].toLowerCase().includes(searchLower)) ||
                       (String(l["Old Value"]).toLowerCase().includes(searchLower)) ||
                       (String(l["New Value"]).toLowerCase().includes(searchLower));
            }
        }).sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
    }, [activeTab, activityLogs, editLogs, searchTerm, selectedDate]);

    return (
        <div className="w-full max-w-[120rem] mx-auto p-4 lg:p-8 space-y-8 animate-fade-in text-[#EAECEF]">
            
            {/* Navigation Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onBack} 
                        className="w-12 h-12 flex items-center justify-center bg-[#1E2329] text-gray-400 rounded-2xl border border-[#2B3139] hover:text-white hover:border-[#FCD535] transition-all group shadow-lg"
                    >
                        <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                            <span className="bg-[#FCD535] text-black px-2 py-0.5 rounded-md not-italic shadow-[0_0_20px_rgba(252,213,53,0.3)]">🛡️</span>
                            {t.audit}
                        </h1>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{activeTab === 'activity' ? 'Live Activity Feed' : 'Structural Data History'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex bg-[#0B0E11] p-1.5 rounded-2xl border border-[#2B3139] shadow-inner">
                    <button 
                        onClick={() => setActiveTab('activity')} 
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'activity' ? 'bg-[#FCD535] text-black shadow-xl shadow-yellow-500/10 scale-[1.02]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        {t.user_activity}
                    </button>
                    <button 
                        onClick={() => setActiveTab('edit')} 
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'edit' ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/10 scale-[1.02]' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {t.edit_history}
                    </button>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#1E2329]/40 p-5 rounded-[2rem] border border-[#2B3139] backdrop-blur-md">
                <div className="md:col-span-7 relative group">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-2 block">Quick Search</label>
                    <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Search by user, action, order ID..." 
                        className="w-full bg-[#0B0E11] border-[#2B3139] focus:border-[#FCD535] rounded-2xl py-3.5 pl-12 text-sm transition-all outline-none"
                    />
                    <svg className="absolute left-4 bottom-4 w-5 h-5 text-gray-600 group-focus-within:text-[#FCD535] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                
                <div className="md:col-span-3">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-2 block">Date Filter</label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="w-full bg-[#0B0E11] border-[#2B3139] focus:border-[#FCD535] rounded-2xl py-3.5 px-4 text-sm transition-all outline-none"
                    />
                </div>

                <div className="md:col-span-2 flex items-end gap-2">
                    <button 
                        onClick={() => { setSearchTerm(''); setSelectedDate(''); }}
                        className="flex-1 h-[52px] flex items-center justify-center bg-[#1E2329] text-gray-500 rounded-2xl border border-[#2B3139] hover:text-white hover:bg-gray-800 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                        Reset
                    </button>
                    <button 
                        onClick={loadLogs} 
                        className="h-[52px] w-[52px] flex items-center justify-center bg-[#FCD535] text-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                    >
                        <svg className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {/* Log Stream */}
            <div className="bg-[#0B0E11]/80 border border-[#2B3139] rounded-[2.5rem] overflow-hidden shadow-2xl relative min-h-[600px]">
                {loading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <Spinner size="lg" />
                            <p className="text-[10px] font-black text-[#FCD535] uppercase tracking-[0.3em] animate-pulse">Syncing Audit Stream...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1E2329]/50 border-b border-[#2B3139]">
                                <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-48 text-center border-r border-[#2B3139]">Timestamp</th>
                                {activeTab === 'activity' ? (
                                    <>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-56">Operator</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-48 text-center">Event</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Details</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-56">Resource ID</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-48">Editor</th>
                                        <th className="p-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Field Manifest</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2B3139]">
                            {filteredLogs.map((log, idx) => {
                                const theme = activeTab === 'activity' ? getActionTheme((log as UserActivityLog).Action) : null;
                                
                                return (
                                    <tr key={idx} className="hover:bg-[#1E2329]/30 transition-all group">
                                        <td className="p-6 text-center border-r border-[#2B3139]">
                                            <p className="text-xs font-black text-[#EAECEF] tabular-nums">{formatRelativeTime(log.Timestamp)}</p>
                                            <p className="text-[9px] font-bold text-gray-500 mt-1 tabular-nums">{formatTimeOnly(log.Timestamp)}</p>
                                        </td>
                                        
                                        {activeTab === 'activity' ? (
                                            <>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 flex items-center justify-center text-lg shadow-inner">👤</div>
                                                        <div>
                                                            <p className="text-sm font-black text-white leading-none">{(log as UserActivityLog).User}</p>
                                                            <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">System User</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${theme?.color}`}>
                                                        <span>{theme?.icon}</span>
                                                        {(log as UserActivityLog).Action}
                                                    </span>
                                                </td>
                                                <td className="p-6">
                                                    <p className="text-xs text-[#848E9C] font-medium leading-relaxed group-hover:text-[#EAECEF] transition-colors italic">
                                                        {(log as UserActivityLog).Details}
                                                    </p>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-6">
                                                    <div className="flex items-center justify-between group/id">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-sm shadow-inner">📦</div>
                                                            <span className="text-xs font-black text-orange-400 font-mono tracking-tighter">#{(log as EditLog).OrderID}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleCopy((log as EditLog).OrderID)}
                                                            className={`p-2 rounded-lg transition-all ${copySuccess === (log as EditLog).OrderID ? 'text-emerald-500 bg-emerald-500/10' : 'text-gray-600 hover:text-white hover:bg-white/5 opacity-0 group-hover/id:opacity-100'}`}
                                                        >
                                                            {copySuccess === (log as EditLog).OrderID ? (
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                            ) : (
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <p className="text-sm font-black text-white italic">{(log as EditLog).Requester}</p>
                                                    { (log as EditLog).Approver && (
                                                        <p className="text-[8px] text-gray-500 mt-1 uppercase tracking-widest">Auth: {(log as EditLog).Approver}</p>
                                                    )}
                                                </td>
                                                <td className="p-6">
                                                    <div className="bg-[#0B0E11] rounded-2xl p-4 border border-[#2B3139] flex flex-col gap-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest border border-blue-500/20">{(log as EditLog)["Field Changed"]}</span>
                                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-[#2B3139] to-transparent"></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                                                            <div className="relative p-3 rounded-xl bg-red-500/5 border border-red-500/10 group-hover:border-red-500/20 transition-all">
                                                                <span className="absolute -top-2 left-3 px-1.5 bg-[#0B0E11] text-[8px] font-black text-red-500/70 uppercase">Before</span>
                                                                <p className="text-[11px] font-mono text-red-300/60 break-all leading-relaxed italic line-through decoration-red-500/50">{(log as EditLog)["Old Value"] || 'null'}</p>
                                                            </div>
                                                            <div className="relative p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
                                                                <span className="absolute -top-2 left-3 px-1.5 bg-[#0B0E11] text-[8px] font-black text-emerald-500/70 uppercase">After</span>
                                                                <div className="flex items-start gap-2">
                                                                    <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                                                    <p className="text-[11px] font-mono text-emerald-400 break-all leading-relaxed font-bold">{(log as EditLog)["New Value"] || 'null'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            
                            {filteredLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={activeTab === 'activity' ? 4 : 4} className="p-32 text-center">
                                        <div className="flex flex-col items-center gap-6 animate-pulse">
                                            <div className="w-20 h-20 rounded-full bg-[#1E2329] flex items-center justify-center text-4xl shadow-inner border border-[#2B3139]">🔍</div>
                                            <div>
                                                <p className="text-lg font-black text-gray-400 uppercase tracking-widest">{t.no_data}</p>
                                                <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-[0.2em]">Try adjusting your search or date range</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Status Bar */}
                <div className="bg-[#1E2329]/50 border-t border-[#2B3139] p-4 flex justify-between items-center px-8">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        Total Stream Items: <span className="text-[#FCD535]">{filteredLogs.length}</span>
                    </p>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FCD535]"></span>
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Encryption: Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Storage: G-Sheet Ready</span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Custom Animation Styles */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
    );
};

export default AuditLogDashboard;
