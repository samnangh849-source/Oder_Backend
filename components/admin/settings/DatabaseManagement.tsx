
import React, { useState, useContext } from 'react';
import { AppContext } from '../../../context/AppContext';
import { WEB_APP_URL } from '../../../constants';
import Spinner from '../../common/Spinner';

const DatabaseManagement: React.FC = () => {
    const { refreshData, showNotification } = useContext(AppContext);
    const [isMigrating, setIsMigrating] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

    const handleMigrateData = async () => {
        if (!window.confirm("តើអ្នកចង់ Sync ទិន្នន័យពី Google Sheet ចូលទៅកាន់ Database ឥឡូវនេះមែនទេ? (ទិន្នន័យដែលមានស្រាប់នឹងត្រូវបាន Update)")) return;
        
        setIsMigrating(true);
        setStatus({ type: 'idle', message: 'កំពុងទាញយកទិន្នន័យពី Google Sheet...' });
        
        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (response.ok && result.status === 'success') {
                setStatus({ type: 'success', message: 'ការ Sync ទិន្នន័យបានចាប់ផ្តើមដោយជោគជ័យ! សូមរង់ចាំមួយស្របក់ដើម្បីឱ្យប្រព័ន្ធបញ្ចប់ការងារក្នុង Background។' });
                showNotification("Data Migration Started", "success");
                
                // Refresh local data after a short delay
                setTimeout(async () => {
                    await refreshData();
                }, 5000);
            } else {
                throw new Error(result.message || 'Migration request failed');
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: 'បរាជ័យ: ' + err.message });
            showNotification("Migration Failed", "error");
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-[3rem] p-8 shadow-2xl backdrop-blur-md animate-fade-in">
            <div className="max-w-2xl mx-auto space-y-10 py-10">
                <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-blue-500/20 shadow-2xl">
                        <svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">ប្រព័ន្ធគ្រប់គ្រងទិន្នន័យ</h2>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Google Sheet & Database Synchronization Portal</p>
                </div>

                <div className="bg-blue-600/5 border border-blue-500/20 rounded-[2.5rem] p-8 space-y-6 shadow-inner relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] -mr-16 -mt-16"></div>
                    
                    <div className="space-y-4 relative z-10">
                        <h3 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Sync with Google Sheet
                        </h3>
                        <p className="text-gray-400 text-sm leading-relaxed font-medium">
                            មុខងារនេះនឹងធ្វើការទាញយកទិន្នន័យចុងក្រោយបំផុតពី Google Sheet រួមមាន (Users, Products, Stores, Orders, ...) មកធ្វើបច្ចុប្បន្នភាពក្នុង Database (PostgreSQL) ភ្លាមៗ។
                        </p>
                    </div>

                    <div className="pt-4 relative z-10">
                        <button 
                            onClick={handleMigrateData}
                            disabled={isMigrating}
                            className={`
                                w-full py-5 rounded-[1.8rem] font-black uppercase text-sm tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-2xl
                                ${isMigrating 
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5' 
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:scale-[1.02] active:scale-95 border border-white/10'
                                }
                            `}
                        >
                            {isMigrating ? (
                                <Spinner size="sm" />
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                            {isMigrating ? 'កំពុងដំណើរការ...' : 'MIGRATE DATA / SYNC NOW'}
                        </button>
                    </div>

                    {status.type !== 'idle' && (
                        <div className={`
                            mt-6 p-5 rounded-2xl border flex items-start gap-4 animate-fade-in
                            ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}
                        `}>
                            <div className="shrink-0 mt-0.5">
                                {status.type === 'success' ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                )}
                            </div>
                            <p className="text-xs font-bold leading-relaxed">{status.message}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    <div className="bg-gray-900/60 border border-white/5 p-6 rounded-3xl space-y-3">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Database Health</h4>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-300">Connection</span>
                            <span className="text-xs font-black text-emerald-500 uppercase">Stable</span>
                        </div>
                    </div>
                    <div className="bg-gray-900/60 border border-white/5 p-6 rounded-3xl space-y-3">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Google Sheet API</h4>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-300">Auth Status</span>
                            <span className="text-xs font-black text-emerald-500 uppercase">Authorized</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseManagement;
