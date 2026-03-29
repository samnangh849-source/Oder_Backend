
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../../context/AppContext';
import { WEB_APP_URL } from '../../../constants';
import Spinner from '../../common/Spinner';
import { CacheService, CACHE_KEYS } from '../../../services/cacheService';

const DatabaseManagement: React.FC = () => {
    const { refreshData, showNotification, lastMessage } = useContext(AppContext);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isMigratingMovies, setIsMigratingMovies] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);
    // Separate status states so they don't override each other
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
    const [movieStatus, setMovieStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

    // Listen for real-time WebSocket result from the background goroutine
    useEffect(() => {
        if (!lastMessage) return;
        try {
            const data = typeof lastMessage === 'string' ? JSON.parse(lastMessage) : lastMessage;
            if (data?.type === 'movie_migration_complete') {
                setIsMigratingMovies(false);
                if (data.success) {
                    setMovieStatus({ type: 'success', message: data.message || 'Sync ជោគជ័យ!' });
                    showNotification(`Movie Sync Complete (${data.count} movies)`, 'success');
                    refreshData();
                } else {
                    setMovieStatus({ type: 'error', message: data.message || 'Sync បរាជ័យ!' });
                    showNotification('Movie Sync Failed', 'error');
                }
            }
        } catch (_) {
            // ignore non-JSON messages
        }
    }, [lastMessage]);

    const handleMigrateData = async () => {
        if (!window.confirm("តើអ្នកចង់ Sync ទិន្នន័យពី Google Sheet ចូលទៅកាន់ Database ឥឡូវនេះមែនទេ? (ទិន្នន័យដែលមានស្រាប់នឹងត្រូវបាន Update)")) return;
        
        setIsMigrating(true);
        setStatus({ type: 'idle', message: 'កំពុងទាញយកទិន្នន័យពី Google Sheet...' });
        
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-data`, {
                method: 'POST',
                headers
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status}): ${text}`);
            }

            const result = await response.json();
            
            if (result.status === 'success') {
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

    const handleMigrateMovies = async () => {
        if (!window.confirm("តើអ្នកចង់ Sync ទិន្នន័យ Movie ពី Google Sheet ចូលទៅកាន់ Database ឥឡូវនេះមែនទេ?")) return;

        setIsMigratingMovies(true);
        setMovieStatus({ type: 'idle', message: 'កំពុងបញ្ជូន request... (លទ្ធផល​នឹងបង្ហាញដោយស្វ័យប្រវត្តិ)' });

        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-movies`, {
                method: 'POST',
                headers
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status}): ${text}`);
            }

            const result = await response.json();

            if (result.status !== 'success') {
                throw new Error(result.message || 'Movie migration request failed');
            }
            // ✅ Server accepted the job — goroutine is running in background.
            // We DO NOT setIsMigratingMovies(false) here; the WebSocket event will do it.
            setMovieStatus({ type: 'idle', message: 'Server បានទទួល request ហើយ! កំពុង Sync នៅ Background... (រង់ចាំ)' });
            showNotification('Movie Sync Started', 'success');
        } catch (err: any) {
            setIsMigratingMovies(false);
            setMovieStatus({ type: 'error', message: 'Request បរាជ័យ: ' + err.message });
            showNotification('Movie Sync Failed', 'error');
        }
    };

    const handleClearCache = async () => {
        if (!window.confirm("តើអ្នកចង់សម្អាត Cache ទាំងអស់មែនទេ? នេះនឹងធ្វើឱ្យប្រព័ន្ធទាញយកទិន្នន័យថ្មីទាំងស្រុងពី Server។")) return;
        
        setIsClearingCache(true);
        try {
            await CacheService.clearAll();
            showNotification("System Cache Cleared", "success");
            
            // Reload page to start fresh
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            showNotification("Failed to clear cache", "error");
            setIsClearingCache(false);
        }
    };

    return (
        <div className="bg-[#181a20] p-6 lg:p-10 min-h-full font-sans animate-fade-in w-full">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="border-b border-[#2b3139] pb-6">
                    <h2 className="text-2xl font-semibold text-[#eaecef]">Data Management</h2>
                    <p className="text-[#848e9c] mt-2 text-sm">Google Sheet & Database Synchronization Portal</p>
                </div>

                <div className="space-y-4">
                    {/* Sync Section */}
                    <div className="bg-[#1e2329] border border-[#2b3139] hover:border-[#474d57] transition-colors rounded-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#fcd535]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </div>
                                    <h3 className="text-base font-medium text-[#eaecef]">Full Synchronization</h3>
                                </div>
                                <p className="text-[#848e9c] text-sm leading-relaxed md:ml-11">
                                    មុខងារនេះនឹងធ្វើការទាញយកទិន្នន័យចុងក្រោយបំផុតពី Google Sheet រួមមាន (Users, Products, Stores, Orders, ...) មកធ្វើបច្ចុប្បន្នភាពក្នុង Database ភ្លាមៗ។
                                </p>
                            </div>

                            <button 
                                onClick={handleMigrateData}
                                disabled={isMigrating}
                                className={`
                                    shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[200px]
                                    ${isMigrating 
                                        ? 'bg-[#2b3139] text-[#848e9c] cursor-not-allowed' 
                                        : 'bg-[#fcd535] text-[#181a20] hover:bg-[#f0c929]'
                                    }
                                `}
                            >
                                {isMigrating ? <Spinner size="sm" /> : null}
                                {isMigrating ? 'Processing...' : 'Sync Now'}
                            </button>
                        </div>
                        {/* Status Message */}
                        {status.type !== 'idle' && (
                            <div className={`mt-4 md:ml-11 p-3 rounded-sm text-sm border-l-2 ${status.type === 'success' ? 'bg-[#032a22] border-[#0ecb81] text-[#0ecb81]' : 'bg-[#3f1619] border-[#f6465d] text-[#f6465d]'}`}>
                                {status.message}
                            </div>
                        )}
                    </div>

                    {/* Movie Sync Section */}
                    <div className="bg-[#1e2329] border border-[#2b3139] hover:border-[#474d57] transition-colors rounded-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#eaecef]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                                    </div>
                                    <h3 className="text-base font-medium text-[#eaecef]">Movie Sheet Synchronization</h3>
                                </div>
                                <p className="text-[#848e9c] text-sm leading-relaxed md:ml-11">
                                    មុខងារនេះនឹងធ្វើការទាញយកតែទិន្នន័យពី Sheet "Movies" ប៉ុណ្ណោះ។ វារហ័ស និងមិនប៉ះពាល់ដល់ទិន្នន័យផ្សេងៗទៀតឡើយ។
                                </p>
                            </div>

                            <button 
                                onClick={handleMigrateMovies}
                                disabled={isMigratingMovies}
                                className={`
                                    shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[200px]
                                    ${isMigratingMovies 
                                        ? 'bg-[#2b3139] text-[#848e9c] cursor-not-allowed' 
                                        : 'bg-[#2b3139] text-[#eaecef] hover:bg-[#474d57]'
                                    }
                                `}
                            >
                                {isMigratingMovies ? <Spinner size="sm" /> : null}
                                {isMigratingMovies ? 'Processing...' : 'Sync Movies Only'}
                            </button>
                        </div>

                        {movieStatus.type !== 'idle' && (
                            <div className={`mt-4 md:ml-11 p-3 rounded-sm text-sm border-l-2 ${movieStatus.type === 'success' ? 'bg-[#032a22] border-[#0ecb81] text-[#0ecb81]' : 'bg-[#3f1619] border-[#f6465d] text-[#f6465d]'}`}>
                                {movieStatus.message}
                            </div>
                        )}
                    </div>

                    {/* Cache Section */}
                    <div className="bg-[#1e2329] border border-[#2b3139] hover:border-[#474d57] transition-colors rounded-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#eaecef]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </div>
                                    <h3 className="text-base font-medium text-[#eaecef]">Clear System Cache</h3>
                                </div>
                                <p className="text-[#848e9c] text-sm leading-relaxed md:ml-11">
                                    សម្អាតទិន្នន័យដែលបានរក្សាទុកក្នុង Browser របស់អ្នក (IndexedDB)។ មុខងារនេះជួយដោះស្រាយបញ្ហាទិន្នន័យចាស់មិនព្រមបាត់ ឬបញ្ហាកម្មវិធីគាំង។
                                </p>
                            </div>

                            <button 
                                onClick={handleClearCache}
                                disabled={isClearingCache}
                                className={`
                                    shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[200px]
                                    ${isClearingCache 
                                        ? 'bg-[#2b3139] text-[#848e9c] cursor-not-allowed' 
                                        : 'bg-[#2b3139] text-[#eaecef] hover:bg-[#474d57]'
                                    }
                                `}
                            >
                                {isClearingCache ? <Spinner size="sm" /> : null}
                                {isClearingCache ? 'Clearing...' : 'Clear All Cache'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Database Health</h4>
                            <div className="text-sm font-medium text-[#eaecef]">Connection</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#0ecb81] shadow-[0_0_8px_rgba(14,203,129,0.5)]"></span>
                            <span className="text-sm font-medium text-[#0ecb81]">Stable</span>
                        </div>
                    </div>
                    <div className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Google Sheet API</h4>
                            <div className="text-sm font-medium text-[#eaecef]">Auth Status</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#0ecb81] shadow-[0_0_8px_rgba(14,203,129,0.5)]"></span>
                            <span className="text-sm font-medium text-[#0ecb81]">Authorized</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseManagement;
