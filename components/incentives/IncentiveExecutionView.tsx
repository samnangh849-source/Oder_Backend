import React, { useState, useMemo, useContext, useEffect, useCallback, useRef } from 'react';
import { IncentiveProject, ParsedOrder, IncentiveResult, IncentiveManualData } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import UserAvatar from '../common/UserAvatar';
import { getProjectById, calculateIncentive, getIncentiveManualData, saveIncentiveManualData, getIncentiveCustomPayouts, saveIncentiveCustomPayout, lockIncentivePayout } from '../../services/incentiveService';
import IncentivePdfExportModal from './IncentivePdfExportModal';
import {
    ChevronLeft, FileText, Lock, Unlock, Search, CheckCircle, RefreshCw,
    AlertCircle, Activity, Coins, TrendingUp, ShieldCheck, MousePointer2,
    Trophy, Terminal, Calendar, Target
} from 'lucide-react';

interface IncentiveExecutionViewProps {
    projectId: string;
    orders: ParsedOrder[];
    onBack: () => void;
}

const IncentiveExecutionView: React.FC<IncentiveExecutionViewProps> = ({ projectId, orders, onBack }) => {
    const { language, appData } = useContext(AppContext);
    const t = translations[language];

    // Teams Identification
    const allTeams = useMemo(() => {
        const teams = new Set<string>();
        appData.users?.forEach(u => u.Team?.split(',').forEach(tn => teams.add(tn.trim())));
        appData.pages?.forEach(p => p.Team?.split(',').forEach(tn => teams.add(tn.trim())));
        return Array.from(teams).filter(Boolean).sort();
    }, [appData.users, appData.pages]);

    // State
    const [project, setProject] = useState<IncentiveProject | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [manualDataMap, setManualDataMap] = useState<Record<string, Record<string, number>>>({});
    const [customPayouts, setCustomPayouts] = useState<Record<string, number>>({});
    const [calculationResults, setCalculationResults] = useState<IncentiveResult[]>([]);

    const [showInputPanel, setShowInputPanel] = useState(false);
    const [entryMode, setEntryMode] = useState<'team' | 'user'>('team');
    const [isAdjustMode, setIsAdjustMode] = useState(false);
    const [activeMetricTab, setActiveMetricTab] = useState<string>('');
    const [isLocked, setIsLocked] = useState(false);
    const [editorSearch, setEditorSearch] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);

    // Separate timers: saveTimer debounces API writes, recalcTimer debounces recalculation
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const recalcTimer = useRef<NodeJS.Timeout | null>(null);
    // pendingManual tracks the latest committed value per cell (avoids stale closure reads)
    const pendingManual = useRef<Record<string, Record<string, number>>>({});

    useEffect(() => {
        const fetchProject = async () => {
            const p = await getProjectById(Number(projectId));
            if (p) {
                setProject(p);
                const activeCalcs = p.calculators?.filter(c => c.status === 'Active') || [];
                if (activeCalcs.length > 0) {
                    if (!activeMetricTab || !activeCalcs.find(c => String(c.id) === activeMetricTab)) {
                        setActiveMetricTab(String(activeCalcs[0].id));
                    }
                }
            }
        };
        fetchProject();
    }, [projectId]);

    const loadDataAndCalculate = useCallback(async (isSilent = false) => {
        if (!project?.id) return;
        if (!isSilent) setIsCalculating(true);
        try {
            const [manualData, customData, results] = await Promise.all([
                getIncentiveManualData(project.id, selectedMonth),
                getIncentiveCustomPayouts(project.id, selectedMonth),
                calculateIncentive(project.id, selectedMonth)
            ]);
            const mdMap: Record<string, Record<string, number>> = {};
            manualData.forEach((item: IncentiveManualData) => {
                if (!mdMap[item.metricType]) mdMap[item.metricType] = {};
                mdMap[item.metricType][item.dataKey] = item.value;
            });
            setManualDataMap(mdMap);
            const cpMap: Record<string, number> = {};
            customData.forEach((item: any) => { cpMap[item.userName] = item.value; });
            setCustomPayouts(cpMap);
            setCalculationResults(results);
        } catch (error) {
            console.error('Error loading incentive data', error);
            setSaveStatus('error');
        } finally {
            setIsCalculating(false);
        }
    }, [project?.id, selectedMonth]);

    useEffect(() => { loadDataAndCalculate(); }, [loadDataAndCalculate]);

    const toggleLock = async () => {
        if (!project?.id) return;
        if (isLocked) { setIsLocked(false); return; }
        if (!window.confirm(t.confirm_lock_payout || 'តើអ្នកចង់ចាក់សោររបាយការណ៍ខែនេះមែនទេ?')) return;
        setSaveStatus('saving');
        const success = await lockIncentivePayout(project.id, selectedMonth, calculationResults);
        if (success) { setIsLocked(true); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
        else { alert('Failed to lock and save results.'); setSaveStatus('idle'); }
    };

    const handleManualDataChange = (metric: string, tid: string, val: string, pk: string) => {
        if (isLocked || !project?.id) return;
        const valNum = Number(val) || 0;
        const cellKey = `${pk}_${tid}`;

        // 1. Sync pending ref immediately (for rapid increment reads)
        if (!pendingManual.current[metric]) pendingManual.current[metric] = {};
        pendingManual.current[metric][cellKey] = valNum;

        // 2. Optimistic UI update
        setManualDataMap(prev => ({ ...prev, [metric]: { ...(prev[metric] || {}), [cellKey]: valNum } }));
        setSaveStatus('saving');

        // 3. Debounce the SAVE (800ms) — saves the latest pending value
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            const latestVal = pendingManual.current[metric]?.[cellKey] ?? valNum;
            const success = await saveIncentiveManualData({
                projectId: project.id,
                month: selectedMonth,
                metricType: metric,
                dataKey: cellKey,
                value: latestVal
            });
            if (success) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 1500);
                // 4. Debounce the RECALCULATE separately (3s after last save)
                //    This prevents UI flicker from rapid +/- clicks
                if (recalcTimer.current) clearTimeout(recalcTimer.current);
                recalcTimer.current = setTimeout(() => loadDataAndCalculate(true), 3000);
            } else {
                setSaveStatus('error');
            }
        }, 800);
    };

    const handleManualDataIncrement = (metric: string, tid: string, p: string, delta: number) => {
        if (isLocked || !project?.id) return;
        // Read from pendingManual ref (always up-to-date even under rapid clicks)
        const currentVal = pendingManual.current[metric]?.[`${p}_${tid}`]
            ?? (manualDataMap[metric] || {})[`${p}_${tid}`]
            ?? 0;
        handleManualDataChange(metric, tid, String(Math.max(0, currentVal + delta)), p);
    };

    // Track pending payout per user (same pattern as pendingManual)
    const pendingPayout = useRef<Record<string, number>>({});

    const handleCustomPayoutChange = (un: string, val: string) => {
        if (isLocked || !project?.id) return;
        const valNum = Number(val) || 0;
        pendingPayout.current[un] = valNum;
        setCustomPayouts(prev => ({ ...prev, [un]: valNum }));
        setSaveStatus('saving');
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            const latest = pendingPayout.current[un] ?? valNum;
            const success = await saveIncentiveCustomPayout({
                projectId: project.id,
                month: selectedMonth,
                userName: un,
                value: latest
            });
            if (success) {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 1500);
                if (recalcTimer.current) clearTimeout(recalcTimer.current);
                recalcTimer.current = setTimeout(() => loadDataAndCalculate(true), 3000);
            } else {
                setSaveStatus('error');
            }
        }, 800);
    };

    const preparedResults = useMemo(() => {
        return calculationResults.map(cr => {
            const u = appData.users?.find(x => x.UserName === cr.userName);
            let breakdown: any[] = [];
            if (cr.breakdownJson) {
                try { breakdown = JSON.parse(cr.breakdownJson); }
                catch (e) { console.error('Failed to parse breakdownJson', e); }
            }
            const metricType = breakdown[0]?.metricType || (cr.totalRevenue > 0 ? 'Sales Amount' : 'Number of Orders');
            const isAmountMetric = ['sales amount', 'revenue', 'profit'].includes(String(metricType).toLowerCase());
            const performance = isAmountMetric ? (cr.totalRevenue || 0) : (cr.totalOrders || 0);
            return {
                username: cr.userName,
                fullName: u?.FullName || cr.userName,
                avatar: u?.ProfilePictureURL,
                role: u?.Role,
                team: u?.Team,
                performance,
                performanceMetric: metricType,
                isAmountMetric,
                reward: cr.calculatedValue,
                baseReward: cr.calculatedValue,
                isCustom: cr.isCustom || false,
                breakdown
            };
        }).sort((a, b) => b.reward - a.reward || b.performance - a.performance);
    }, [calculationResults, appData.users]);

    const totalPayout = useMemo(() => preparedResults.reduce((sum, u) => sum + u.reward, 0), [preparedResults]);
    const topStaff = preparedResults.length > 0 ? preparedResults[0] : null;
    const maxPerformance = useMemo(() => Math.max(...preparedResults.map(r => r.performance), 1), [preparedResults]);

    // ---------- Loading State ----------
    if (!project) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#F0B90B]/20 border-t-[#F0B90B] rounded-full animate-spin" />
        </div>
    );

    // ---------- MAIN RENDER (Binance Style) ----------
    return (
        <div className="w-full h-screen bg-[#050505] text-[#EAECEF] font-sans selection:bg-[#F0B90B]/30 flex flex-col overflow-hidden">

            {/* ── Top Header Bar ── */}
            <header className="h-14 bg-[#121212] border-b border-[#1A1A1A] px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-1.5 hover:bg-[#2B3139] rounded transition-all text-[#B7BDC6] hover:text-[#F0B90B]">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-[#1A1A1A]" />
                    <Terminal className="w-4 h-4 text-[#F0B90B]" />
                    <h1 className="text-sm font-bold tracking-wider uppercase">{project.projectName}</h1>
                    <span className="px-2 py-0.5 bg-[#1A1A1A] text-[#707A8A] text-[9px] font-mono rounded border border-[#2B3139]">
                        STN_{String(project.id).padStart(3, '0')}
                    </span>
                    {/* Save status */}
                    {saveStatus === 'saving' && (
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#F0B90B] uppercase tracking-widest animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Auto-Saving...
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#0ECB81] uppercase tracking-widest">
                            <CheckCircle className="w-3 h-3" /> Saved · Recalculating in 3s
                        </span>
                    )}
                    {saveStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-[9px] font-bold text-[#F6465D] uppercase tracking-widest">
                            <AlertCircle className="w-3 h-3" /> Save Failed
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Month Picker */}
                    <div className="flex items-center gap-2 h-8 px-3 bg-[#1A1A1A] border border-[#2B3139] rounded text-[#F0B90B]">
                        <Calendar className="w-3.5 h-3.5" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none p-0 text-[#F0B90B] text-[10px] font-bold tracking-widest focus:ring-0 cursor-pointer outline-none"
                        />
                    </div>

                    <div className="h-6 w-px bg-[#1A1A1A]" />

                    {/* Lock status badge */}
                    <div className={`px-2 py-1 rounded text-[9px] font-bold uppercase flex items-center gap-1.5 border ${
                        isLocked ? 'bg-[#F6465D]/10 border-[#F6465D]/20 text-[#F6465D]' : 'bg-[#1A1A1A] border-[#2B3139] text-[#707A8A]'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-[#F6465D] animate-pulse' : 'bg-[#707A8A]'}`} />
                        {isLocked ? 'Locked' : 'Unlocked'}
                    </div>

                    {/* PDF */}
                    <button onClick={() => setIsPdfModalOpen(true)} className="h-8 px-3 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#B7BDC6] hover:text-[#EAECEF] rounded text-[10px] font-bold uppercase tracking-wider transition-all border border-[#2B3139] flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> PDF
                    </button>

                    {/* Lock/Unlock */}
                    <button onClick={toggleLock} className={`h-8 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                        isLocked ? 'bg-[#F6465D]/10 border-[#F6465D]/30 text-[#F6465D] hover:bg-[#F6465D]/20' : 'bg-[#1A1A1A] hover:bg-[#2B3139] text-[#B7BDC6] border-[#2B3139]'
                    }`}>
                        {isLocked ? <><Lock className="w-3.5 h-3.5" />{t.locked}</> : <><Unlock className="w-3.5 h-3.5" />{t.lock_payout}</>}
                    </button>

                    {/* Performance Input */}
                    {project.dataSource === 'manual' && (
                        <button onClick={() => setShowInputPanel(!showInputPanel)} className={`h-8 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                            showInputPanel ? 'bg-[#F0B90B] text-black border-[#F0B90B]' : 'bg-[#F0B90B]/10 border-[#F0B90B]/30 text-[#F0B90B] hover:bg-[#F0B90B] hover:text-black'
                        }`}>
                            {showInputPanel ? 'CLOSE INPUT' : 'PERFORMANCE_INPUT'}
                        </button>
                    )}

                    {/* Refresh */}
                    <button onClick={() => loadDataAndCalculate()} disabled={isCalculating} className="w-8 h-8 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#F0B90B] rounded border border-[#2B3139] flex items-center justify-center transition-all">
                        <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* ── Scrollable Body ── */}
            <main className="flex-1 overflow-auto">

                {/* ── KPI Stats Bar ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-[#1A1A1A]">
                    {[
                        { label: 'Total Distribution', value: `$${totalPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: '#F0B90B', icon: Coins },
                        { label: 'Alpha Performer', value: topStaff?.fullName || 'N/A', sub: topStaff ? `$${topStaff.reward.toFixed(2)}` : null, color: '#0ECB81', icon: Trophy },
                        { label: 'Yield Average', value: `$${(totalPayout / (preparedResults.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: '#B7BDC6', icon: TrendingUp },
                        { label: 'Qualified Entities', value: String(preparedResults.length), color: '#F0B90B', icon: ShieldCheck },
                    ].map((s, i) => (
                        <div key={i} className={`p-4 bg-[#121212] flex flex-col gap-1 ${i < 3 ? 'border-r border-[#1A1A1A]' : ''}`}>
                            <div className="flex items-center gap-2">
                                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                                <span className="text-[10px] font-bold text-[#707A8A] uppercase tracking-widest">{s.label}</span>
                            </div>
                            <span className="text-lg font-mono font-bold truncate" style={{ color: s.color }}>{s.value}</span>
                            {s.sub && <span className="text-[10px] font-mono text-[#707A8A]">{s.sub}</span>}
                        </div>
                    ))}
                </div>

                {/* ── Performance Input Panel ── */}
                {showInputPanel && project.dataSource === 'manual' && (
                    <div className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
                        {/* Panel Header */}
                        <div className="px-4 py-3 bg-[#121212] border-b border-[#1A1A1A] flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-[#707A8A] uppercase tracking-widest">Calculator:</span>
                                <div className="flex items-center gap-1 bg-[#050505] p-0.5 rounded border border-[#1A1A1A]">
                                    {project.calculators?.filter(c => c.status === 'Active').map(calc => (
                                        <button
                                            key={calc.id}
                                            onClick={() => setActiveMetricTab(String(calc.id))}
                                            className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                                                activeMetricTab === String(calc.id)
                                                    ? 'bg-[#F0B90B] text-black'
                                                    : 'text-[#707A8A] hover:text-[#EAECEF]'
                                            }`}
                                        >{calc.name}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-[#707A8A] uppercase tracking-widest">Scope:</span>
                                <div className="flex items-center gap-1 bg-[#050505] p-0.5 rounded border border-[#1A1A1A]">
                                    {(['team', 'user'] as const).map(mode => (
                                        <button key={mode} onClick={() => setEntryMode(mode)} className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${entryMode === mode ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}>
                                            {mode === 'team' ? 'Teams' : 'Staff'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative ml-auto w-56 group">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#707A8A] group-focus-within:text-[#F0B90B] transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search entity..."
                                    value={editorSearch}
                                    onChange={e => setEditorSearch(e.target.value)}
                                    className="w-full h-8 bg-[#050505] border border-[#1A1A1A] rounded pl-8 pr-8 text-[11px] font-bold text-[#EAECEF] placeholder:text-[#707A8A] focus:border-[#F0B90B]/50 outline-none transition-all"
                                />
                                {editorSearch && (
                                    <button
                                        onClick={() => setEditorSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[#707A8A] hover:text-[#EAECEF] transition-colors text-[10px] font-bold"
                                    >✕</button>
                                )}
                            </div>
                        </div>

                        {/* Input Table */}
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            {project.calculators?.filter(c => c.status === 'Active' && String(c.id) === activeMetricTab).map(calc => {
                                const subPeriods = calc.calculationPeriod === 'Weekly' ? ['W1', 'W2', 'W3', 'W4', 'W5'] : ['month'];
                                const eligibleUsers = entryMode === 'user'
                                    ? (appData.users || []).filter(u => {
                                        if (!calc.applyTo || calc.applyTo.length === 0) return true;
                                        return calc.applyTo.some(rule => {
                                            if (rule.startsWith('Role:')) return u.Role === rule.replace('Role:', '');
                                            if (rule.startsWith('Team:')) {
                                                const tgt = rule.replace('Team:', '').trim().toLowerCase();
                                                return (u.Team || '').split(',').some(t => t.trim().toLowerCase() === tgt);
                                            }
                                            if (rule.startsWith('User:')) return u.UserName === rule.replace('User:', '');
                                            return false;
                                        });
                                    }).sort((a, b) => a.FullName.localeCompare(b.FullName))
                                    : [];
                                const targets = (entryMode === 'team' ? allTeams : eligibleUsers).filter(t => {
                                    const label = typeof t === 'string' ? t : t.FullName;
                                    return label.toLowerCase().includes(editorSearch.toLowerCase());
                                });
                                return (
                                    <table key={calc.id} className="w-full text-left border-collapse min-w-[700px]">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-[#121212] border-b border-[#1A1A1A] text-[9px] text-[#707A8A] font-bold uppercase tracking-widest">
                                                <th className="px-4 py-3 min-w-[180px] border-r border-[#1A1A1A]">Entity</th>
                                                {subPeriods.map(p => (
                                                    <th key={p} className="px-2 py-3 text-center border-r border-[#1A1A1A] min-w-[160px]">
                                                        {p === 'month' ? 'Accumulated KPI' : p}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 text-right text-[#F0B90B] bg-[#F0B90B]/5">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#1A1A1A]">
                                            {targets.map(t => {
                                                const id = typeof t === 'string' ? t : t.UserName;
                                                const label = typeof t === 'string' ? t : t.FullName;
                                                const rowData = manualDataMap[calc.metricType || ''] || {};
                                                const rowTotal = subPeriods.reduce((sum, p) => sum + (rowData[`${p}_${id}`] || 0), 0);
                                                return (
                                                    <tr key={id} className="hover:bg-[#121212] transition-colors group">
                                                        <td className="px-4 py-3 border-r border-[#1A1A1A] font-bold text-[#EAECEF] text-[11px] uppercase tracking-wide group-hover:text-[#F0B90B] transition-colors">{label}</td>
                                                        {subPeriods.map(p => {
                                                            const cellVal = rowData[`${p}_${id}`] || 0;
                                                            return (
                                                                <td key={p} className="px-2 py-2 border-r border-[#1A1A1A]">
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            type="button"
                                                                            disabled={isLocked || cellVal <= 0}
                                                                            onClick={() => handleManualDataIncrement(calc.metricType || '', id, p, -1)}
                                                                            className="w-7 h-8 flex items-center justify-center rounded bg-[#F6465D]/10 hover:bg-[#F6465D]/20 text-[#F6465D] font-black border border-[#F6465D]/20 transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-95 shrink-0 select-none text-sm"
                                                                            title="បន្ថយ 1"
                                                                        >−</button>
                                                                        <input
                                                                            type="number"
                                                                            value={cellVal || ''}
                                                                            disabled={isLocked}
                                                                            onChange={e => handleManualDataChange(calc.metricType || '', id, e.target.value, p)}
                                                                            className="flex-1 bg-[#050505] border border-[#1A1A1A] text-center font-mono text-[12px] font-bold text-[#EAECEF] focus:bg-[#F0B90B]/5 focus:text-[#F0B90B] focus:border-[#F0B90B]/40 rounded py-2 outline-none transition-all disabled:opacity-30 min-w-0"
                                                                            placeholder="0"
                                                                            min={0}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            disabled={isLocked}
                                                                            onClick={() => handleManualDataIncrement(calc.metricType || '', id, p, 1)}
                                                                            className="w-7 h-8 flex items-center justify-center rounded bg-[#0ECB81]/10 hover:bg-[#0ECB81]/20 text-[#0ECB81] font-black border border-[#0ECB81]/20 transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-95 shrink-0 select-none text-sm"
                                                                            title="បន្ថែម 1"
                                                                        >+</button>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-4 py-3 text-right bg-[#F0B90B]/5">
                                                            <span className="font-mono text-[14px] text-[#F0B90B] font-bold">{rowTotal.toLocaleString()}</span>
                                                            <div className="text-[8px] text-[#707A8A] font-bold uppercase tracking-widest">{calc.metricType || 'KPI'}</div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Settlement Ledger ── */}
                <div className="p-4 space-y-4">
                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-5 bg-[#F0B90B] rounded-full" />
                            <h2 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider">Settlement Ledger</h2>
                            <div className="h-4 w-px bg-[#1A1A1A]" />
                            <span className="text-[10px] font-mono text-[#707A8A] uppercase tracking-widest">Final validation &amp; override protocol</span>
                        </div>
                        <button
                            onClick={() => setIsAdjustMode(!isAdjustMode)}
                            className={`h-8 px-4 text-[10px] font-bold uppercase tracking-wider rounded border transition-all flex items-center gap-2 ${
                                isAdjustMode
                                    ? 'bg-[#F0B90B] text-black border-[#F0B90B]'
                                    : 'bg-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF] border-[#2B3139]'
                            }`}
                        >
                            <MousePointer2 className="w-3.5 h-3.5" />
                            {isAdjustMode ? 'TERMINATE_ADJUSTMENT' : 'INITIALIZE_OVERRIDE'}
                        </button>
                    </div>

                    {/* Ledger Table */}
                    <div className="bg-[#121212] border border-[#1A1A1A] rounded overflow-hidden">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-[#0A0A0A] border-b border-[#1A1A1A] text-[9px] text-[#707A8A] font-bold uppercase tracking-widest">
                                    <th className="px-4 py-3 w-12 text-center border-r border-[#1A1A1A]">Rank</th>
                                    <th className="px-4 py-3 min-w-[220px] border-r border-[#1A1A1A]">Entity</th>
                                    <th className="px-4 py-3 border-r border-[#1A1A1A]">Performance KPI</th>
                                    <th className="px-4 py-3 border-r border-[#1A1A1A]">Yield Components</th>
                                    <th className="px-4 py-3 text-right">Settlement (USD)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1A1A1A]">
                                {preparedResults.map((u, idx) => (
                                    <tr key={u.username} className={`hover:bg-[#1A1A1A] transition-all group ${idx === 0 ? 'bg-[#F0B90B]/[0.02]' : ''}`}>
                                        {/* Rank */}
                                        <td className="px-4 py-4 text-center border-r border-[#1A1A1A]">
                                            <span className={`font-mono font-bold text-sm ${idx === 0 ? 'text-[#F0B90B]' : 'text-[#2B3139]'}`}>
                                                {(idx + 1).toString().padStart(2, '0')}
                                            </span>
                                        </td>

                                        {/* Entity */}
                                        <td className="px-4 py-4 border-r border-[#1A1A1A]">
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    <UserAvatar avatarUrl={u.avatar} name={u.fullName} size="sm" className="border border-[#2B3139] group-hover:border-[#F0B90B]/40 transition-colors" />
                                                    {idx === 0 && (
                                                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#F0B90B] rounded-full flex items-center justify-center border border-[#050505]">
                                                            <Trophy className="w-2.5 h-2.5 text-black" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-[#EAECEF] text-[12px] uppercase truncate group-hover:text-[#F0B90B] transition-colors">{u.fullName}</p>
                                                    <p className="text-[9px] text-[#707A8A] font-mono truncate">{u.username} · {u.role || 'Staff'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Performance KPI */}
                                        <td className="px-4 py-4 border-r border-[#1A1A1A]">
                                            <p className="font-mono font-bold text-[#EAECEF] text-[13px]">
                                                {u.isAmountMetric ? '$' : ''}{u.performance.toLocaleString()}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="h-1 w-20 bg-[#1A1A1A] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#F0B90B] rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(100, Math.round((u.performance / maxPerformance) * 100))}%` }}
                                                    />
                                                </div>
                                                <span className="text-[9px] text-[#707A8A] font-bold uppercase tracking-widest">
                                                    {Math.round((u.performance / maxPerformance) * 100)}% · {u.performanceMetric}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Yield Components */}
                                        <td className="px-4 py-4 border-r border-[#1A1A1A]">
                                            <div className="flex flex-wrap gap-1.5">
                                                {u.breakdown?.map((b: any, i: number) => (
                                                    <div key={i} className="px-2 py-1 bg-[#050505] border border-[#1A1A1A] hover:border-[#F0B90B]/30 rounded text-[9px] flex items-center gap-1.5 transition-all">
                                                        <span className="text-[#707A8A] font-bold uppercase tracking-wide">{b.name || b.calculatorName || 'Bonus'}</span>
                                                        <div className="w-px h-3 bg-[#1A1A1A]" />
                                                        <span className="text-[#0ECB81] font-mono font-bold">${(b.amount || 0).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {u.breakdown.length === 0 && (
                                                    <span className="text-[9px] text-[#2B3139] font-bold uppercase tracking-widest italic">—</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Settlement */}
                                        <td className="px-4 py-4 text-right">
                                            {isAdjustMode ? (
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward;
                                                                handleCustomPayoutChange(u.username, String(Math.max(0, cur - 1)));
                                                            }}
                                                            className="w-7 h-8 flex items-center justify-center rounded bg-[#F6465D]/10 hover:bg-[#F6465D]/20 text-[#F6465D] font-black text-sm border border-[#F6465D]/20 transition-all active:scale-95 select-none"
                                                            title="បន្ថយ $1"
                                                        >−</button>
                                                        <div className="flex items-center">
                                                            <span className="text-[#707A8A] font-mono text-sm mr-1">$</span>
                                                            <input
                                                                type="number"
                                                                value={customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward}
                                                                onChange={e => handleCustomPayoutChange(u.username, e.target.value)}
                                                                className="w-24 bg-[#050505] border border-[#F0B90B]/30 rounded py-1.5 px-2 text-[13px] text-right font-mono font-bold text-[#F0B90B] focus:border-[#F0B90B] outline-none"
                                                                min={0}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const cur = customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward;
                                                                handleCustomPayoutChange(u.username, String(cur + 1));
                                                            }}
                                                            className="w-7 h-8 flex items-center justify-center rounded bg-[#0ECB81]/10 hover:bg-[#0ECB81]/20 text-[#0ECB81] font-black text-sm border border-[#0ECB81]/20 transition-all active:scale-95 select-none"
                                                            title="បន្ថែម $1"
                                                        >+</button>
                                                    </div>
                                                    {customPayouts[u.username] !== undefined && (
                                                        <button
                                                            onClick={() => handleCustomPayoutChange(u.username, String(u.baseReward))}
                                                            className="text-[8px] text-[#707A8A] hover:text-[#F0B90B] font-bold uppercase tracking-widest transition-all"
                                                        >
                                                            ↺ Reset ${u.baseReward.toFixed(2)}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <span className={`font-mono font-bold text-[18px] ${u.isCustom ? 'text-[#F0B90B]' : 'text-[#F0B90B]'}`}>
                                                        ${u.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {u.isCustom && (
                                                        <p className="text-[8px] text-[#707A8A] font-bold uppercase tracking-widest mt-0.5">✎ Override</p>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {preparedResults.length === 0 && !isCalculating && (
                            <div className="py-20 text-center">
                                <Search className="w-10 h-10 text-[#1A1A1A] mx-auto mb-4" />
                                <p className="text-[11px] font-bold text-[#707A8A] uppercase tracking-widest">No settlement records found in this cycle</p>
                            </div>
                        )}
                        {isCalculating && (
                            <div className="py-10 text-center">
                                <div className="w-6 h-6 border-2 border-[#F0B90B]/20 border-t-[#F0B90B] rounded-full animate-spin mx-auto" />
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* PDF Modal */}
            {isPdfModalOpen && project && (
                <IncentivePdfExportModal
                    isOpen={isPdfModalOpen}
                    onClose={() => setIsPdfModalOpen(false)}
                    project={project}
                    period={selectedMonth}
                    results={preparedResults}
                    language={language}
                />
            )}
        </div>
    );
};

export default IncentiveExecutionView;
