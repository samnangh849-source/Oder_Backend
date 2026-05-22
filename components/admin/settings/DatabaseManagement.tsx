
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../../../context/AppContext';
import { WEB_APP_URL } from '../../../constants';
import Spinner from '../../common/Spinner';
import { CacheService, CACHE_KEYS } from '../../../services/cacheService';

// ── Types ──────────────────────────────────────────────────────────────────
type SyncProgress = {
    step: number;
    totalSteps: number;
    stepName: string;
    percent: number;
    count: number;
    elapsed: number;
};

type PendingSync = {
    id: number;
    payload: string;
    status: 'pending' | 'processing' | 'failed' | 'permanent_failure';
    retryCount: number;
    maxRetries: number;
    createdAt: string;
    updatedAt: string;
};

type HealthStatus = {
    status: string;
    error?: string;
};

type SystemHealth = {
    database: HealthStatus;
    googleSheets: HealthStatus;
    uptime: number;
};

// ── Step definitions (must match backend broadcast order) ──────────────────
const SYNC_STEPS = [
    { label: 'លុបទិន្នន័យចាស់',     showCount: false, sheet: "" },
    { label: 'Users',                showCount: true,  sheet: "Users" },
    { label: 'Stores',               showCount: true,  sheet: "Stores" },
    { label: 'Settings',             showCount: true,  sheet: "Settings" },
    { label: 'TeamsPages',           showCount: true,  sheet: "TeamsPages" },
    { label: 'Products',             showCount: true,  sheet: "Products" },
    { label: 'Locations',            showCount: true,  sheet: "Locations" },
    { label: 'ShippingMethods',      showCount: true,  sheet: "ShippingMethods" },
    { label: 'Colors',               showCount: true,  sheet: "Colors" },
    { label: 'Drivers',              showCount: true,  sheet: "Drivers" },
    { label: 'BankAccounts',         showCount: true,  sheet: "BankAccounts" },
    { label: 'PhoneCarriers',        showCount: true,  sheet: "PhoneCarriers" },
    { label: 'TelegramTemplates',    showCount: true,  sheet: "TelegramTemplates" },
    { label: 'Inventory',            showCount: true,  sheet: "Inventory" },
    { label: 'StockTransfers',       showCount: true,  sheet: "StockTransfers" },
    { label: 'Returns',              showCount: true,  sheet: "Returns" },
    { label: 'RevenueDashboard',     showCount: true,  sheet: "RevenueDashboard" },
    { label: 'ChatMessages',         showCount: true,  sheet: "ChatMessages" },
    { label: 'EditLogs',             showCount: true,  sheet: "EditLogs" },
    { label: 'UserActivityLogs',     showCount: true,  sheet: "UserActivityLogs" },
    { label: 'DriverRecommendations',showCount: true,  sheet: "DriverRecommendations" },
    { label: 'Roles',                showCount: true,  sheet: "Roles" },
    { label: 'RolePermissions',      showCount: true,  sheet: "RolePermissions" },
    { label: 'AllOrders',            showCount: true,  sheet: "AllOrders" },
    { label: 'Movies',               showCount: true,  sheet: "Movies" },
    { label: 'IncentiveProjects',    showCount: true,  sheet: "IncentiveProjects" },
    { label: 'IncentiveCalculators', showCount: true,  sheet: "IncentiveCalculators" },
    { label: 'IncentiveResults',     showCount: true,  sheet: "IncentiveResults" },
    { label: 'IncentiveManualData',  showCount: true,  sheet: "IncentiveManualData" },
    { label: 'IncentiveCustomPayouts',showCount: true, sheet: "IncentiveCustomPayouts" },
    { label: 'Commit & Seed',        showCount: false, sheet: "" },
];

// ── Icons ──────────────────────────────────────────────────────────────────
const IconDone = () => (
    <svg className="w-4 h-4 text-[#0ecb81] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);
const IconActive = () => (
    <svg className="w-4 h-4 text-[#fcd535] shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);
const IconPending = () => (
    <span className="w-4 h-4 rounded-full border border-[#474d57] shrink-0 inline-block" />
);
const IconError = () => (
    <svg className="w-4 h-4 text-[#f6465d] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// ── Component ──────────────────────────────────────────────────────────────
const DatabaseManagement: React.FC = () => {
    const { refreshData, showNotification, lastMessage } = useContext(AppContext);

    const [isMigrating, setIsMigrating] = useState(false);
    const [isMigratingMovies, setIsMigratingMovies] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);
    const [isSelectiveSyncing, setIsSelectiveSyncing] = useState(false);

    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({ type: 'idle', message: '' });
    const [movieStatus, setMovieStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({ type: 'idle', message: '' });

    const [selectedSheet, setSelectedSheet] = useState<string>("");

    // Progress bar state
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

    // Checklist state
    const [activeStep, setActiveStep] = useState<number>(-1);
    const activeStepRef = useRef<number>(-1);
    const [stepCounts, setStepCounts] = useState<Record<number, number>>({});
    const [syncDone, setSyncDone] = useState<false | 'success' | 'error'>(false);
    const [errorStep, setErrorStep] = useState<number>(-1);

    // Sync Queue State
    const [syncQueue, setSyncQueue] = useState<PendingSync[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);

    // Health State
    const [health, setHealth] = useState<SystemHealth | null>(null);

    // Elapsed timer
    const [elapsedTick, setElapsedTick] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const syncStartRef = useRef<number>(0);

    const startElapsedTimer = () => {
        syncStartRef.current = Date.now();
        setElapsedTick(0);
        elapsedRef.current = setInterval(() => {
            setElapsedTick(Math.floor((Date.now() - syncStartRef.current) / 1000));
        }, 1000);
    };
    const stopElapsedTimer = () => {
        if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    };

    useEffect(() => {
        fetchHealth();
        fetchSyncQueue();
        const interval = setInterval(() => {
            fetchHealth();
            fetchSyncQueue();
        }, 30000);
        return () => {
            stopElapsedTimer();
            clearInterval(interval);
        };
    }, []);

    const fetchHealth = async () => {
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const res = await fetch(`${WEB_APP_URL}/api/admin/health-check`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHealth(data.health);
            }
        } catch (e) { console.error("Health fetch failed", e); }
    };

    const fetchSyncQueue = async () => {
        setIsLoadingQueue(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const res = await fetch(`${WEB_APP_URL}/api/admin/sync-queue`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSyncQueue(data.data || []);
            }
        } catch (e) { console.error("Queue fetch failed", e); }
        finally { setIsLoadingQueue(false); }
    };

    // ── WebSocket listener ────────────────────────────────────────────────
    useEffect(() => {
        if (!lastMessage) return;
        try {
            const data = typeof lastMessage === 'string' ? JSON.parse(lastMessage) : lastMessage;

            if (data?.type === 'full_sync_progress') {
                const n: number = data.step;
                const c: number = data.count ?? 0;
                setSyncProgress({
                    step: n,
                    totalSteps: data.totalSteps,
                    stepName: data.stepName,
                    percent: data.percent,
                    count: c,
                    elapsed: data.elapsed,
                });
                activeStepRef.current = n;
                setActiveStep(n);
                if (n > 0 && c > 0) {
                    setStepCounts(prev => ({ ...prev, [n - 1]: c }));
                }
            } else if (data?.type === 'full_sync_complete') {
                stopElapsedTimer();
                if (data.success) {
                    setSyncProgress(prev => prev ? { ...prev, percent: 100, stepName: 'បូរេពលរួចរាល់!' } : null);
                    setActiveStep(SYNC_STEPS.length); 
                    setSyncDone('success');
                    const secs = typeof data.elapsed === 'number' ? Math.round(data.elapsed) : 0;
                    setStatus({ type: 'success', message: `${data.message} (រយៈពេល ${secs}s)` });
                    showNotification('Full Sync Complete', 'success');
                    refreshData();
                    setTimeout(() => {
                        setIsMigrating(false);
                        setSyncProgress(null);
                    }, 1500);
                } else {
                    setIsMigrating(false);
                    setSyncProgress(null);
                    setSyncDone('error');
                    setErrorStep(activeStepRef.current);
                    setStatus({ type: 'error', message: 'បរាជ័យ: ' + (data.message || 'Unknown error') });
                    showNotification('Full Sync Failed', 'error');
                }
            } else if (data?.type === 'movie_migration_complete') {
                setIsMigratingMovies(false);
                if (data.success) {
                    setMovieStatus({ type: 'success', message: data.message || 'Sync ជោគជ័យ!' });
                    showNotification(`Movie Sync Complete (${data.count} movies)`, 'success');
                    refreshData();
                } else {
                    setMovieStatus({ type: 'error', message: data.message || 'Sync បរាជ័យ!' });
                    showNotification('Movie Sync Failed', 'error');
                }
            } else if (data?.type === 'selective_sync_complete') {
                showNotification(`${data.sheet} Sync Complete`, 'success');
                refreshData();
                fetchHealth();
            } else if (data?.type === 'sync_error' || data?.type === 'sheet_webhook_sync') {
                fetchSyncQueue();
            }
        } catch (_) { /* ignore */ }
    }, [lastMessage]);

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleMigrateData = async () => {
        if (!window.confirm("តើអ្នកចង់ Sync ទិន្នន័យទាំងអស់មែនទេ?")) return;
        setIsMigrating(true);
        setStatus({ type: 'idle', message: '' });
        setSyncProgress(null);
        activeStepRef.current = -1;
        setActiveStep(-1);
        setStepCounts({});
        setSyncDone(false);
        setErrorStep(-1);
        startElapsedTimer();
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-data`, { method: 'POST', headers });
            if (!response.ok) throw new Error(`Server Error (${response.status})`);
            showNotification("Full Sync Started", "success");
        } catch (err: any) {
            stopElapsedTimer();
            setIsMigrating(false);
            setStatus({ type: 'error', message: 'បរាជ័យ: ' + err.message });
        }
    };

    const handleMigrateMovies = async () => {
        if (!window.confirm("តើអ្នកចង់ Sync ទិន្នន័យ Movie ទេ?")) return;
        setIsMigratingMovies(true);
        setMovieStatus({ type: 'idle', message: 'កំពុង Sync...' });
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-movies`, { method: 'POST', headers });
            if (!response.ok) throw new Error(`Server Error (${response.status})`);
            showNotification("Movie Sync Started", "success");
        } catch (err: any) {
            setIsMigratingMovies(false);
            setMovieStatus({ type: 'error', message: 'បរាជ័យ: ' + err.message });
        }
    };

    const handleSelectiveSync = async () => {
        if (!selectedSheet) return;
        setIsSelectiveSyncing(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sheetName: selectedSheet, fullSync: true })
            });
            if (!response.ok) throw new Error("Sync failed");
            showNotification(`${selectedSheet} Sync Started`, "success");
        } catch (e) { showNotification("Sync failed", "error"); }
        finally { setIsSelectiveSyncing(false); }
    };

    const handleRetryAll = async () => {
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const res = await fetch(`${WEB_APP_URL}/api/admin/sync-retry-all`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                showNotification("Retrying all failed tasks", "success");
                fetchSyncQueue();
            }
        } catch (e) { showNotification("Retry failed", "error"); }
    };

    const handleClearFailed = async () => {
        if (!window.confirm("Clear all permanent failures?")) return;
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const res = await fetch(`${WEB_APP_URL}/api/admin/sync-clear-failed`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                showNotification("Failed tasks cleared", "success");
                fetchSyncQueue();
            }
        } catch (e) { showNotification("Clear failed", "error"); }
    };

    const handleRetryTask = async (id: number) => {
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const res = await fetch(`${WEB_APP_URL}/api/admin/sync-retry/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                showNotification(`Retrying task #${id}`, "success");
                fetchSyncQueue();
            }
        } catch (e) { showNotification("Retry failed", "error"); }
    };

    const handleClearCache = async () => {
        if (!window.confirm("តើអ្នកចង់សម្អាត Cache ទាំងអស់មែនទេ?")) return;
        setIsClearingCache(true);
        try {
            await CacheService.clearAll();
            showNotification("System Cache Cleared", "success");
            setTimeout(() => window.location.reload(), 1000);
        } catch {
            showNotification("Failed to clear cache", "error");
            setIsClearingCache(false);
        }
    };

    const getStepStatus = (i: number): 'done' | 'active' | 'error' | 'pending' => {
        if (syncDone === 'success') return 'done';
        if (syncDone === 'error' && i === errorStep) return 'error';
        if (syncDone === 'error' && i < errorStep) return 'done';
        if (i < activeStep) return 'done';
        if (i === activeStep) return 'active';
        return 'pending';
    };

    const showChecklist = isMigrating || activeStep >= 0 || syncDone !== false;

    return (
        <div className="bg-[#181a20] p-6 lg:p-10 min-h-full font-sans animate-fade-in w-full">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="border-b border-[#2b3139] pb-6 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-semibold text-[#eaecef]">Data Management</h2>
                        <p className="text-[#848e9c] mt-2 text-sm">Google Sheet & Database Synchronization Portal</p>
                    </div>
                    {health && (
                        <div className="text-right">
                            <span className="text-[10px] text-[#474d57] uppercase block mb-1">System Uptime</span>
                            <span className="text-sm font-mono text-[#eaecef]">{Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m</span>
                        </div>
                    )}
                </div>

                {/* ── Health Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Database Health</h4>
                            <div className="text-sm font-medium text-[#eaecef]">
                                {health?.database.status || 'Checking...'}
                            </div>
                            {health?.database.error && <p className="text-[10px] text-[#f6465d] truncate max-w-[200px]">{health.database.error}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                                health?.database.status === 'Stable' ? 'bg-[#0ecb81] shadow-[#0ecb81]/50' : 
                                health?.database.status === 'Unstable' ? 'bg-[#fcd535] shadow-[#fcd535]/50' : 'bg-[#f6465d] shadow-[#f6465d]/50'
                            }`} />
                        </div>
                    </div>
                    <div className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Google Sheet API</h4>
                            <div className="text-sm font-medium text-[#eaecef]">
                                {health?.googleSheets.status || 'Checking...'}
                            </div>
                            {health?.googleSheets.error && <p className="text-[10px] text-[#f6465d] truncate max-w-[200px]">{health.googleSheets.error}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                                health?.googleSheets.status === 'Authorized' ? 'bg-[#0ecb81] shadow-[#0ecb81]/50' : 'bg-[#f6465d] shadow-[#f6465d]/50'
                            }`} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Sync Controls */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* ── Full Sync Section ── */}
                        <div className="bg-[#1e2329] border border-[#2b3139] rounded-sm p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                            <svg className={`w-4 h-4 text-[#fcd535] ${isMigrating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-medium text-[#eaecef]">Full Synchronization</h3>
                                    </div>
                                    <p className="text-[#848e9c] text-sm leading-relaxed md:ml-11">
                                        ទាញយកទិន្នន័យទាំងអស់ពី Google Sheet មកបច្ចុប្បន្នភាពក្នុង Database។
                                    </p>
                                </div>
                                <button
                                    onClick={handleMigrateData}
                                    disabled={isMigrating}
                                    className={`shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[160px] ${
                                        isMigrating ? 'bg-[#2b3139] text-[#848e9c]' : 'bg-[#fcd535] text-[#181a20] hover:bg-[#f0c929]'
                                    }`}
                                >
                                    {isMigrating && <Spinner size="sm" />}
                                    {isMigrating ? 'Processing...' : 'Sync Now'}
                                </button>
                            </div>

                            {isMigrating && (
                                <div className="mt-5 md:ml-11 space-y-2">
                                    <div className="w-full bg-[#2b3139] rounded-full h-1.5 overflow-hidden">
                                        <div className="h-1.5 rounded-full bg-[#fcd535] transition-all duration-500" style={{ width: `${syncProgress?.percent ?? 0}%` }} />
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-[#848e9c]">
                                        <span className="text-[#fcd535] font-semibold">{syncProgress?.percent ?? 0}%</span>
                                        <span className="truncate">{syncProgress?.stepName ?? 'កំពុងចាប់ផ្តើម...'}</span>
                                        <span className="ml-auto tabular-nums">{elapsedTick}s</span>
                                    </div>
                                </div>
                            )}

                            {showChecklist && (
                                <div className="mt-5 md:ml-11">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0 border border-[#2b3139] rounded-sm overflow-hidden">
                                        {SYNC_STEPS.map((step, i) => {
                                            const st = getStepStatus(i);
                                            const count = stepCounts[i];
                                            return (
                                                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 border-b border-[#2b3139] ${
                                                    st === 'active' ? 'bg-[#2b3139]' : st === 'done' && syncDone === 'success' ? 'bg-[#0d1f19]' : st === 'error' ? 'bg-[#2a0d10]' : ''
                                                }`}>
                                                    <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                                                        {st === 'done' && <IconDone />}
                                                        {st === 'active' && <IconActive />}
                                                        {st === 'error' && <IconError />}
                                                        {st === 'pending' && <IconPending />}
                                                    </div>
                                                    <span className={`text-[11px] font-mono flex-1 truncate ${st === 'done' ? 'text-[#0ecb81]' : st === 'active' ? 'text-[#fcd535]' : st === 'error' ? 'text-[#f6465d]' : 'text-[#474d57]'}`}>
                                                        {step.label}
                                                    </span>
                                                    {st === 'done' && step.showCount && count > 0 && (
                                                        <span className="text-[9px] bg-[#032a22] text-[#0ecb81] px-1 rounded">{count}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Selective Sync Section ── */}
                        <div className="bg-[#1e2329] border border-[#2b3139] rounded-sm p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                            <svg className="w-4 h-4 text-[#0ecb81]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-medium text-[#eaecef]">Selective Synchronization</h3>
                                    </div>
                                    <p className="text-[#848e9c] text-sm leading-relaxed md:ml-11">
                                        ជ្រើសរើសប្រភេទជួរទិន្នន័យជាក់លាក់ណាមួយដើម្បី Sync (មិនលុបទិន្នន័យចាស់ទេ)។
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 min-w-[300px]">
                                    <select 
                                        value={selectedSheet}
                                        onChange={(e) => setSelectedSheet(e.target.value)}
                                        className="bg-[#2b3139] text-[#eaecef] text-sm px-3 py-2 rounded-sm border border-transparent focus:border-[#fcd535] outline-none flex-1"
                                    >
                                        <option value="">Select Category...</option>
                                        {SYNC_STEPS.filter(s => s.sheet).map(s => (
                                            <option key={s.sheet} value={s.sheet}>{s.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSelectiveSync}
                                        disabled={!selectedSheet || isSelectiveSyncing}
                                        className={`px-4 py-2 rounded-sm font-medium text-xs transition-colors flex items-center justify-center gap-2 ${
                                            !selectedSheet || isSelectiveSyncing ? 'bg-[#2b3139] text-[#474d57]' : 'bg-[#0ecb81] text-[#181a20] hover:bg-[#0bbd78]'
                                        }`}
                                    >
                                        {isSelectiveSyncing && <Spinner size="sm" />}
                                        Sync Item
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Background Sync Queue ── */}
                        <div className="bg-[#1e2329] border border-[#2b3139] rounded-sm overflow-hidden">
                            <div className="p-4 border-b border-[#2b3139] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-[#eaecef]">Background Sync Queue</h3>
                                    {syncQueue.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-[#2b3139] text-[#848e9c] text-[10px]">
                                            {syncQueue.length}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={fetchSyncQueue} disabled={isLoadingQueue} className="p-1 hover:bg-[#2b3139] rounded text-[#848e9c]">
                                        <svg className={`w-4 h-4 ${isLoadingQueue ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                    <button onClick={handleRetryAll} className="text-[10px] text-[#fcd535] hover:underline">Retry All</button>
                                    <button onClick={handleClearFailed} className="text-[10px] text-[#f6465d] hover:underline">Clear Failed</button>
                                </div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {syncQueue.length === 0 ? (
                                    <div className="p-8 text-center text-[#474d57] text-xs">No pending synchronization tasks.</div>
                                ) : (
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="sticky top-0 bg-[#2b3139] text-[#848e9c] uppercase text-[10px]">
                                            <tr>
                                                <th className="px-4 py-2 font-medium">Task / Action</th>
                                                <th className="px-4 py-2 font-medium">Status</th>
                                                <th className="px-4 py-2 font-medium">Retries</th>
                                                <th className="px-4 py-2 font-medium text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2b3139]">
                                            {syncQueue.map(task => {
                                                const payload = JSON.parse(task.payload);
                                                return (
                                                    <tr key={task.id} className="hover:bg-[#2b3139]/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-[#eaecef]">{payload.action}</div>
                                                            <div className="text-[10px] text-[#848e9c]">{payload.sheetName || 'N/A'} {payload.orderId ? `| ID: ${payload.orderId}` : ''}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium uppercase ${
                                                                task.status === 'pending' ? 'bg-[#2b3139] text-[#848e9c]' :
                                                                task.status === 'processing' ? 'bg-[#032a22] text-[#fcd535]' :
                                                                task.status === 'failed' ? 'bg-[#3f1619] text-[#f6465d]' :
                                                                'bg-[#3f1619] text-[#f6465d] border border-[#f6465d]/30'
                                                            }`}>
                                                                {task.status.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-[#848e9c] tabular-nums">
                                                            {task.retryCount} / {task.maxRetries}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {(task.status === 'failed' || task.status === 'permanent_failure') && (
                                                                <button onClick={() => handleRetryTask(task.id)} className="p-1 hover:bg-[#474d57] rounded text-[#fcd535] transition-colors">
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Other Actions */}
                    <div className="space-y-4">
                        <div className="bg-[#1e2329] border border-[#2b3139] rounded-sm p-5 space-y-4">
                            <h4 className="text-sm font-medium text-[#eaecef]">System Maintenance</h4>
                            <div className="space-y-3">
                                <button
                                    onClick={handleMigrateMovies}
                                    disabled={isMigratingMovies}
                                    className="w-full py-2 bg-[#2b3139] text-[#eaecef] text-xs font-medium rounded-sm hover:bg-[#474d57] transition-colors flex items-center justify-center gap-2"
                                >
                                    {isMigratingMovies ? <Spinner size="sm" /> : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                        </svg>
                                    )}
                                    Sync Movies Only
                                </button>
                                <button
                                    onClick={handleClearCache}
                                    disabled={isClearingCache}
                                    className="w-full py-2 bg-[#2b3139] text-[#eaecef] text-xs font-medium rounded-sm hover:bg-[#474d57] transition-colors flex items-center justify-center gap-2"
                                >
                                    {isClearingCache ? <Spinner size="sm" /> : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    )}
                                    Clear Browser Cache
                                </button>
                            </div>

                            <div className="pt-4 border-t border-[#2b3139]">
                                <div className="text-[10px] text-[#474d57] uppercase mb-2">Sync Engine Info</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-[#848e9c]">Worker Pool</span>
                                        <span className="text-[#eaecef]">2 Active Threads</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-[#848e9c]">Sync Protocol</span>
                                        <span className="text-[#eaecef]">REST + Persistent DB</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-[#848e9c]">Deduplication</span>
                                        <span className="text-[#0ecb81]">Enabled</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Messages */}
                        {(status.type !== 'idle' || movieStatus.type !== 'idle') && (
                            <div className={`p-4 rounded-sm text-xs border-l-2 animate-fade-in ${
                                (status.type === 'success' || movieStatus.type === 'success') ? 'bg-[#032a22] border-[#0ecb81] text-[#0ecb81]' : 'bg-[#3f1619] border-[#f6465d] text-[#f6465d]'
                            }`}>
                                {status.message || movieStatus.message}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseManagement;
