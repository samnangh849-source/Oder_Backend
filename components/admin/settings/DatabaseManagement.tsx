
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../../../context/AppContext';
import { WEB_APP_URL } from '../../../constants';
import Spinner from '../../common/Spinner';
import { CacheService, CACHE_KEYS } from '../../../services/cacheService';

// ── Step definitions (must match backend broadcast order) ──────────────────
const SYNC_STEPS = [
    { label: 'លុបទិន្នន័យចាស់',     showCount: false },
    { label: 'Users',                showCount: true  },
    { label: 'Stores',               showCount: true  },
    { label: 'Settings',             showCount: true  },
    { label: 'TeamsPages',           showCount: true  },
    { label: 'Products',             showCount: true  },
    { label: 'Locations',            showCount: true  },
    { label: 'ShippingMethods',      showCount: true  },
    { label: 'Colors',               showCount: true  },
    { label: 'Drivers',              showCount: true  },
    { label: 'BankAccounts',         showCount: true  },
    { label: 'PhoneCarriers',        showCount: true  },
    { label: 'TelegramTemplates',    showCount: true  },
    { label: 'Inventory',            showCount: true  },
    { label: 'StockTransfers',       showCount: true  },
    { label: 'Returns',              showCount: true  },
    { label: 'RevenueDashboard',     showCount: true  },
    { label: 'ChatMessages',         showCount: true  },
    { label: 'EditLogs',             showCount: true  },
    { label: 'UserActivityLogs',     showCount: true  },
    { label: 'DriverRecommendations',showCount: true  },
    { label: 'Roles',                showCount: true  },
    { label: 'RolePermissions',      showCount: true  },
    { label: 'AllOrders',            showCount: true  },
    { label: 'Movies',               showCount: true  },
    { label: 'IncentiveProjects',    showCount: true  },
    { label: 'IncentiveCalculators', showCount: true  },
    { label: 'IncentiveResults',     showCount: true  },
    { label: 'IncentiveManualData',  showCount: true  },
    { label: 'IncentiveCustomPayouts',showCount: true },
    { label: 'Commit & Seed',        showCount: false },
];

type SyncProgress = {
    step: number;
    totalSteps: number;
    stepName: string;
    percent: number;
    count: number;
    elapsed: number;
};

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

    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({ type: 'idle', message: '' });
    const [movieStatus, setMovieStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string }>({ type: 'idle', message: '' });

    // Progress bar state
    const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

    // Checklist state
    // activeStep: index of the step currently running (-1 = not started)
    const [activeStep, setActiveStep] = useState<number>(-1);
    const activeStepRef = useRef<number>(-1); // ref to avoid stale closure in WS handler
    // stepCounts: row counts indexed by step number (stored when that step finishes)
    const [stepCounts, setStepCounts] = useState<Record<number, number>>({});
    // after full_sync_complete
    const [syncDone, setSyncDone] = useState<false | 'success' | 'error'>(false);
    // which step failed (-1 = none)
    const [errorStep, setErrorStep] = useState<number>(-1);

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
    useEffect(() => () => stopElapsedTimer(), []);

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

                // n-1 just finished with count c; n is now active
                activeStepRef.current = n;
                setActiveStep(n);
                if (n > 0 && c > 0) {
                    setStepCounts(prev => ({ ...prev, [n - 1]: c }));
                }

            } else if (data?.type === 'full_sync_complete') {
                stopElapsedTimer();
                setIsMigrating(false);
                setSyncProgress(null);

                if (data.success) {
                    // mark all steps done
                    setActiveStep(SYNC_STEPS.length); // past the last step
                    setSyncDone('success');
                    const secs = typeof data.elapsed === 'number' ? Math.round(data.elapsed) : 0;
                    setStatus({ type: 'success', message: `${data.message} (រយៈពេល ${secs}s)` });
                    showNotification('Full Sync Complete', 'success');
                    refreshData();
                } else {
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
            }
        } catch (_) { /* ignore non-JSON */ }
    }, [lastMessage]);

    // ── Handlers ─────────────────────────────────────────────────────────
    const handleMigrateData = async () => {
        if (!window.confirm("តើអ្នកចង់ Sync ទិន្នន័យពី Google Sheet ចូលទៅកាន់ Database ឥឡូវនេះមែនទេ? (ទិន្នន័យដែលមានស្រាប់នឹងត្រូវបាន Update)")) return;

        // Reset checklist state
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
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-data`, { method: 'POST', headers });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status}): ${text}`);
            }
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Migration request failed');
            showNotification("Full Sync Started", "success");
        } catch (err: any) {
            stopElapsedTimer();
            setIsMigrating(false);
            setSyncProgress(null);
            setStatus({ type: 'error', message: 'បរាជ័យ: ' + err.message });
            showNotification("Migration Failed", "error");
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
            const response = await fetch(`${WEB_APP_URL}/api/admin/migrate-movies`, { method: 'POST', headers });
            if (!response.ok) { const text = await response.text(); throw new Error(`Server Error (${response.status}): ${text}`); }
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Movie migration request failed');
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
            setTimeout(() => window.location.reload(), 1000);
        } catch {
            showNotification("Failed to clear cache", "error");
            setIsClearingCache(false);
        }
    };

    // ── Checklist helpers ─────────────────────────────────────────────────
    // Show immediately when syncing starts (all items render as "pending"),
    // and keep visible after completion so the user can review the result.
    const showChecklist = isMigrating || activeStep >= 0 || syncDone !== false;

    const getStepStatus = (i: number): 'done' | 'active' | 'error' | 'pending' => {
        if (syncDone === 'success') return 'done';
        if (syncDone === 'error' && i === errorStep) return 'error';
        if (syncDone === 'error' && i < errorStep) return 'done';
        if (i < activeStep) return 'done';
        if (i === activeStep) return 'active';
        return 'pending';
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="bg-[#181a20] p-6 lg:p-10 min-h-full font-sans animate-fade-in w-full">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="border-b border-[#2b3139] pb-6">
                    <h2 className="text-2xl font-semibold text-[#eaecef]">Data Management</h2>
                    <p className="text-[#848e9c] mt-2 text-sm">Google Sheet & Database Synchronization Portal</p>
                </div>

                <div className="space-y-4">
                    {/* ── Full Sync Section ── */}
                    <div className="bg-[#1e2329] border border-[#2b3139] hover:border-[#474d57] transition-colors rounded-sm p-6">
                        {/* Title row */}
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
                                    មុខងារនេះនឹងធ្វើការទាញយកទិន្នន័យចុងក្រោយបំផុតពី Google Sheet រួមមាន (Users, Products, Stores, Orders, ...) មកធ្វើបច្ចុប្បន្នភាពក្នុង Database ភ្លាមៗ។
                                </p>
                            </div>
                            <button
                                onClick={handleMigrateData}
                                disabled={isMigrating}
                                className={`shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[200px] ${
                                    isMigrating
                                        ? 'bg-[#2b3139] text-[#848e9c] cursor-not-allowed'
                                        : 'bg-[#fcd535] text-[#181a20] hover:bg-[#f0c929]'
                                }`}
                            >
                                {isMigrating && <Spinner size="sm" />}
                                {isMigrating ? 'Processing...' : 'Sync Now'}
                            </button>
                        </div>

                        {/* ── Progress Bar (while syncing) ── */}
                        {isMigrating && (
                            <div className="mt-5 md:ml-11 space-y-2">
                                <div className="w-full bg-[#2b3139] rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-1.5 rounded-full bg-[#fcd535] transition-all duration-500"
                                        style={{ width: `${syncProgress?.percent ?? 0}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-4 text-xs text-[#848e9c]">
                                    <span className="text-[#fcd535] font-semibold tabular-nums">{syncProgress?.percent ?? 0}%</span>
                                    <span className="truncate">{syncProgress?.stepName ?? 'កំពុងចាប់ផ្តើម...'}</span>
                                    <span className="ml-auto tabular-nums text-[#474d57]">{elapsedTick}s</span>
                                </div>
                            </div>
                        )}

                        {/* ── Checklist Panel ── */}
                        {showChecklist && (
                            <div className="mt-5 md:ml-11">
                                {/* Panel header */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">
                                        Sync Checklist
                                    </span>
                                    {isMigrating && (
                                        <span className="text-xs text-[#474d57] tabular-nums">
                                            {activeStep >= 0 ? activeStep : 0} / {SYNC_STEPS.length} ចប់
                                        </span>
                                    )}
                                    {syncDone === 'success' && (
                                        <span className="text-xs text-[#0ecb81]">ជោគជ័យទាំងស្រុង</span>
                                    )}
                                    {syncDone === 'error' && (
                                        <span className="text-xs text-[#f6465d]">បរាជ័យ</span>
                                    )}
                                </div>

                                {/* 2-column grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 border border-[#2b3139] rounded-sm overflow-hidden">
                                    {SYNC_STEPS.map((step, i) => {
                                        const st = getStepStatus(i);
                                        const count = stepCounts[i];
                                        const isLast = i === SYNC_STEPS.length - 1;

                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-2.5 px-3 py-2 border-b border-[#2b3139] transition-colors ${
                                                    st === 'active'
                                                        ? 'bg-[#2b3139]'
                                                        : st === 'done' && syncDone === 'success'
                                                        ? 'bg-[#0d1f19]'
                                                        : st === 'error'
                                                        ? 'bg-[#2a0d10]'
                                                        : ''
                                                } ${isLast && i % 2 === 0 ? 'sm:col-span-2' : ''}`}
                                            >
                                                {/* Icon */}
                                                <div className="shrink-0 flex items-center justify-center w-4 h-4">
                                                    {st === 'done'    && <IconDone />}
                                                    {st === 'active'  && <IconActive />}
                                                    {st === 'error'   && <IconError />}
                                                    {st === 'pending' && <IconPending />}
                                                </div>

                                                {/* Label */}
                                                <span className={`text-xs font-mono flex-1 truncate ${
                                                    st === 'done'    ? 'text-[#0ecb81]'  :
                                                    st === 'active'  ? 'text-[#fcd535]'  :
                                                    st === 'error'   ? 'text-[#f6465d]'  :
                                                    'text-[#474d57]'
                                                }`}>
                                                    {step.label}
                                                </span>

                                                {/* Row count badge */}
                                                {st === 'done' && step.showCount && count != null && count > 0 && (
                                                    <span className="shrink-0 text-[10px] tabular-nums bg-[#032a22] text-[#0ecb81] px-1.5 py-0.5 rounded">
                                                        {count.toLocaleString()}
                                                    </span>
                                                )}
                                                {st === 'active' && (
                                                    <span className="shrink-0 text-[10px] text-[#fcd535] animate-pulse">
                                                        processing
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Status Message (after completion) */}
                        {!isMigrating && status.type !== 'idle' && (
                            <div className={`mt-4 md:ml-11 p-3 rounded-sm text-sm border-l-2 ${
                                status.type === 'success'
                                    ? 'bg-[#032a22] border-[#0ecb81] text-[#0ecb81]'
                                    : 'bg-[#3f1619] border-[#f6465d] text-[#f6465d]'
                            }`}>
                                {status.message}
                            </div>
                        )}
                    </div>

                    {/* ── Movie Sync Section ── */}
                    <div className="bg-[#1e2329] border border-[#2b3139] hover:border-[#474d57] transition-colors rounded-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#eaecef]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                        </svg>
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
                                className={`shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[200px] ${
                                    isMigratingMovies
                                        ? 'bg-[#2b3139] text-[#848e9c] cursor-not-allowed'
                                        : 'bg-[#2b3139] text-[#eaecef] hover:bg-[#474d57]'
                                }`}
                            >
                                {isMigratingMovies && <Spinner size="sm" />}
                                {isMigratingMovies ? 'Processing...' : 'Sync Movies Only'}
                            </button>
                        </div>
                        {movieStatus.type !== 'idle' && (
                            <div className={`mt-4 md:ml-11 p-3 rounded-sm text-sm border-l-2 ${
                                movieStatus.type === 'success'
                                    ? 'bg-[#032a22] border-[#0ecb81] text-[#0ecb81]'
                                    : 'bg-[#3f1619] border-[#f6465d] text-[#f6465d]'
                            }`}>
                                {movieStatus.message}
                            </div>
                        )}
                    </div>

                    {/* ── Cache Section ── */}
                    <div className="bg-[#1e2329] border border-[#2b3139] hover:border-[#474d57] transition-colors rounded-sm p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[#2b3139] flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#eaecef]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
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
                                className={`shrink-0 px-6 py-2.5 rounded-sm font-medium text-sm transition-colors flex items-center justify-center gap-2 min-w-[200px] ${
                                    isClearingCache
                                        ? 'bg-[#2b3139] text-[#848e9c] cursor-not-allowed'
                                        : 'bg-[#2b3139] text-[#eaecef] hover:bg-[#474d57]'
                                }`}
                            >
                                {isClearingCache && <Spinner size="sm" />}
                                {isClearingCache ? 'Clearing...' : 'Clear All Cache'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Health Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Database Health</h4>
                            <div className="text-sm font-medium text-[#eaecef]">Connection</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#0ecb81] shadow-[0_0_8px_rgba(14,203,129,0.5)]" />
                            <span className="text-sm font-medium text-[#0ecb81]">Stable</span>
                        </div>
                    </div>
                    <div className="bg-[#1e2329] border border-[#2b3139] p-5 rounded-sm flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">Google Sheet API</h4>
                            <div className="text-sm font-medium text-[#eaecef]">Auth Status</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#0ecb81] shadow-[0_0_8px_rgba(14,203,129,0.5)]" />
                            <span className="text-sm font-medium text-[#0ecb81]">Authorized</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseManagement;
