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
    Trophy, Terminal, Calendar, Target, Layout, Cpu, Zap, ArrowRight, Layers
} from 'lucide-react';

interface IncentiveExecutionViewProps {
    projectId: string;
    orders: ParsedOrder[];
    onBack: () => void;
}

const IncentiveExecutionView: React.FC<IncentiveExecutionViewProps> = ({ projectId, orders, onBack }) => {
    const { language, appData, currentUser } = useContext(AppContext);
    const t = translations[language];

    const canViewLogic = useCallback((userTeam?: string) => {
        if (!currentUser) return false;
        if (currentUser.IsSystemAdmin || (currentUser.Role || '').toLowerCase().includes('admin')) return true;
        const myTeams = (currentUser.Team || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const theirTeams = (userTeam || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        return myTeams.some(t => theirTeams.includes(t));
    }, [currentUser]);

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

        if (!pendingManual.current[metric]) pendingManual.current[metric] = {};
        pendingManual.current[metric][cellKey] = valNum;

        setManualDataMap(prev => ({ ...prev, [metric]: { ...(prev[metric] || {}), [cellKey]: valNum } }));
        setSaveStatus('saving');

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
                if (recalcTimer.current) clearTimeout(recalcTimer.current);
                recalcTimer.current = setTimeout(() => loadDataAndCalculate(true), 3000);
            } else {
                setSaveStatus('error');
            }
        }, 800);
    };

    const handleManualDataIncrement = (metric: string, tid: string, p: string, delta: number) => {
        if (isLocked || !project?.id) return;
        const currentVal = pendingManual.current[metric]?.[`${p}_${tid}`]
            ?? (manualDataMap[metric] || {})[`${p}_${tid}`]
            ?? 0;
        handleManualDataChange(metric, tid, String(Math.max(0, currentVal + delta)), p);
    };

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
                try { 
                    const parsed = JSON.parse(cr.breakdownJson);
                    if (Array.isArray(parsed)) breakdown = parsed;
                }
                catch (e) { console.error('Failed to parse breakdownJson', e); }
            }
            const metricType = String(breakdown[0]?.metricType || '').toLowerCase();
            const isAmountMetric = ['sales amount', 'revenue', 'profit'].includes(metricType);
            
            let performance = 0;
            if (metricType === 'profit') performance = cr.totalProfit || 0;
            else if (isAmountMetric) performance = cr.totalRevenue || 0;
            else performance = cr.totalOrders || 0;

            return {
                username: cr.userName,
                fullName: u?.FullName || cr.userName,
                avatar: u?.ProfilePictureURL,
                role: u?.Role,
                team: u?.Team,
                performance,
                performanceMetric: breakdown[0]?.metricType || (isAmountMetric ? 'Revenue' : 'Orders'),
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

    if (!project) return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
    );

    return (
        <div className="incentive-surface w-full h-screen bg-[#050505] text-[#EAECEF] font-sans selection:bg-primary/30 flex flex-col overflow-hidden">
            
            {/* Header: Engineered Protocol Theme */}
            <header className="bg-[#121212] border-b border-white/5 px-6 py-4 shrink-0 relative overflow-hidden group/header">
                <div 
                    className="absolute -top-16 -left-16 w-32 h-32 rounded-full blur-[60px] opacity-[0.05] group-hover/header:opacity-[0.1] transition-all duration-700"
                    style={{ backgroundColor: project.colorCode || '#F0B90B' }}
                ></div>

                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-6 min-w-0">
                        <button onClick={onBack} className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-[#B7BDC6] hover:text-white shrink-0 active:scale-90" title="Back">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="h-10 w-px bg-white/10 hidden sm:block" />
                        <div className="flex items-center gap-5 min-w-0">
                            <div 
                                className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center shrink-0 relative overflow-hidden shadow-lg"
                                style={{ boxShadow: `0 0 15px ${project.colorCode || '#F0B90B'}10` }}
                            >
                                <div className="absolute inset-0 opacity-10 blur-xl" style={{ backgroundColor: project.colorCode || '#F0B90B' }}></div>
                                <Terminal className="w-5 h-5 relative z-10" style={{ color: project.colorCode || '#F0B90B' }} />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-2xl font-black text-white italic tracking-tighter leading-none mb-1.5 truncate">{project.projectName}</h1>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3 text-white/20" />
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{selectedMonth} PAYOUT_CYCLE</span>
                                    </div>
                                    {saveStatus !== 'idle' && (
                                        <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                                            saveStatus === 'saving' ? 'bg-primary/10 border-primary/20 text-primary' : 
                                            saveStatus === 'saved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                                            'bg-red-500/10 border-red-500/20 text-red-500'
                                        }`}>
                                            <div className={`w-1 h-1 rounded-full ${saveStatus === 'saving' ? 'bg-primary animate-pulse' : saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {saveStatus === 'saving' ? 'SYNCING_DATA' : saveStatus === 'saved' ? 'DATA_COMMITTED' : 'SYNC_ERROR'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-1 px-3 h-11 shrink-0">
                            <Calendar className="w-4 h-4 text-white/20" />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none p-0 text-white font-black text-[11px] tracking-[0.2em] uppercase focus:ring-0 cursor-pointer outline-none min-w-[120px]"
                            />
                        </div>

                        <div className={`h-11 px-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-500 flex items-center gap-2.5 shrink-0 ${
                            isLocked ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-white/40'
                        }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`} />
                            {isLocked ? 'CYCLE_LOCKED' : 'CYCLE_OPEN'}
                        </div>

                        <button 
                            onClick={() => setIsPdfModalOpen(true)} 
                            className="h-11 px-5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center gap-3 active:scale-95 shrink-0"
                        >
                            <FileText className="w-4 h-4" /> EXPORT_PDF
                        </button>

                        <button 
                            onClick={toggleLock} 
                            className={`h-11 px-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border flex items-center gap-3 active:scale-95 shrink-0 ${
                                isLocked 
                                    ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' 
                                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                            }`}
                        >
                            {isLocked ? <><Lock className="w-4 h-4" /> UNLOCK_CYCLE</> : <><Unlock className="w-4 h-4" /> COMMIT_PAYOUT</>}
                        </button>

                        {project.dataSource === 'manual' && (
                            <button 
                                onClick={() => setShowInputPanel(!showInputPanel)} 
                                className={`h-11 px-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border flex items-center gap-3 active:scale-95 shrink-0 ${
                                    showInputPanel 
                                        ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20' 
                                        : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10'
                                }`}
                            >
                                <Layout className="w-4 h-4" />
                                {showInputPanel ? 'CLOSE_INPUT' : 'DATA_INPUT'}
                            </button>
                        )}

                        <button 
                            onClick={() => loadDataAndCalculate()} 
                            disabled={isCalculating} 
                            className="w-11 h-11 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/40 hover:text-white rounded-2xl border border-white/10 flex items-center justify-center transition-all shrink-0 active:scale-90" 
                            title="Recalculate Protocol"
                        >
                            <RefreshCw className={`w-5 h-5 ${isCalculating ? 'animate-spin text-primary' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto custom-scrollbar bg-[#050505] p-6 lg:p-8">
                
                {/* Protocol KPI Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'TOTAL_PAYOUT_RESERVE', value: `$${totalPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, color: 'text-primary', accent: 'bg-primary', icon: Coins, detail: `${preparedResults.length} Qualified_Nodes` },
                        { label: 'ALPHA_PERFORMER', value: topStaff?.fullName || 'N/A', detail: topStaff ? `$${topStaff.reward.toFixed(2)}_CREDITED` : 'PROTOCOL_PENDING', color: 'text-emerald-500', accent: 'bg-emerald-500', icon: Trophy },
                        { label: 'MEDIAN_PAYOUT_VAL', value: `$${(totalPayout / (preparedResults.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-white/60', accent: 'bg-white', icon: TrendingUp, detail: 'Average_Per_Entity' },
                        { label: 'ACTIVE_DATA_NODES', value: String(preparedResults.length), color: 'text-primary', accent: 'bg-primary', icon: ShieldCheck, detail: isLocked ? 'STATE_IMMUTABLE' : 'STATE_VARIABLE' },
                    ].map((s, i) => (
                        <div key={i} className="bg-[#121212] border border-white/5 rounded-[32px] p-6 flex flex-col justify-between gap-6 group hover:border-white/10 transition-all shadow-xl">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{s.label}</p>
                                    <h3 className={`text-2xl font-mono font-black ${s.color} truncate`}>{s.value}</h3>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl bg-black border border-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                    <s.icon className={`w-6 h-6 ${s.color}`} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-1 h-1 rounded-full ${s.accent} opacity-40`} />
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{s.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Data Entry Panel (Manual Override) */}
                {showInputPanel && project.dataSource === 'manual' && (
                    <div className="mb-10 bg-[#121212] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.01] pointer-events-none">
                            <Cpu className="w-64 h-64 text-white" />
                        </div>

                        <div className="px-8 py-6 bg-white/[0.02] border-b border-white/5 flex flex-col xl:flex-row xl:items-center gap-6 relative z-10">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-white/20" />
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Active_Module</span>
                                </div>
                                <div className="flex items-center gap-2 bg-black p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                                    {project.calculators?.filter(c => c.status === 'Active').map(calc => (
                                        <button
                                            key={calc.id}
                                            onClick={() => setActiveMetricTab(String(calc.id))}
                                            className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border ${
                                                activeMetricTab === String(calc.id)
                                                    ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20'
                                                    : 'bg-transparent border-transparent text-white/30 hover:text-white hover:bg-white/5'
                                            }`}
                                        >{calc.name}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-white/20" />
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Scale</span>
                                </div>
                                <div className="flex items-center gap-1 bg-black p-1 rounded-2xl border border-white/5">
                                    {(['team', 'user'] as const).map(mode => (
                                        <button 
                                            key={mode} 
                                            onClick={() => setEntryMode(mode)} 
                                            className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                                entryMode === mode 
                                                    ? 'bg-white/10 text-white border border-white/10 shadow-lg' 
                                                    : 'text-white/20 hover:text-white/40'
                                            }`}
                                        >
                                            {mode === 'team' ? 'TEAMS' : 'ENTITIES'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative xl:ml-auto w-full xl:w-80 group">
                                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="FILTER_ENGINE_NODES..."
                                    value={editorSearch}
                                    onChange={e => setEditorSearch(e.target.value)}
                                    className="w-full h-11 bg-black border border-white/10 rounded-2xl pl-11 pr-11 text-[11px] font-black text-white placeholder:text-white/10 focus:border-primary/50 focus:bg-white/[0.02] outline-none transition-all uppercase tracking-widest"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                            {project.calculators?.filter(c => c.status === 'Active' && String(c.id) === activeMetricTab).map(calc => {
                                const definedSubPeriods = Array.from(new Set(
                                    (calc.achievementTiers || [])
                                        .map(t => t.subPeriod)
                                        .filter(sp => sp && sp.trim() !== "")
                                )).sort() as string[];

                                let subPeriods = definedSubPeriods;
                                if (subPeriods.length === 0) {
                                    subPeriods = (calc.calculationPeriod === 'Weekly' || calc.isMarathon) 
                                        ? ['W1', 'W2', 'W3', 'W4', 'W5'] 
                                        : ['month'];
                                }

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
                                    <div key={calc.id} className="relative">
                                        {calc.isMarathon && (
                                            <div className="px-8 py-3 bg-primary/5 border-y border-primary/10 flex items-center gap-4">
                                                <Trophy className="w-4 h-4 text-primary shadow-[0_0_10px_rgba(252,213,53,0.5)]" />
                                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic underline underline-offset-4 decoration-primary/30">Protocol_Marathon_Active: Cumulative reward aggregation per unique node interval</span>
                                            </div>
                                        )}
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead className="sticky top-0 z-20">
                                                <tr className="bg-black/80 backdrop-blur-xl border-b border-white/10 text-[9px] text-white/30 font-black uppercase tracking-[0.3em]">
                                                    <th className="px-8 py-4 min-w-[220px] border-r border-white/5">Engine_Node</th>
                                                    {subPeriods.map(p => (
                                                        <th key={p} className="px-4 py-4 text-center border-r border-white/5 min-w-[180px]">
                                                            {p === 'month' ? 'ACCUMULATED_KPI' : p}
                                                        </th>
                                                    ))}
                                                    <th className="px-8 py-4 text-right text-primary bg-primary/5">Node_Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {targets.map(t => {
                                                    const id = typeof t === 'string' ? t : t.UserName;
                                                    const label = typeof t === 'string' ? t : t.FullName;
                                                    const rowData = manualDataMap[calc.metricType || ''] || {};
                                                    const rowTotal = subPeriods.reduce((sum, p) => sum + (rowData[`${p}_${id}`] || 0), 0);
                                                    
                                                    return (
                                                        <tr key={id} className="hover:bg-white/[0.02] transition-colors group">
                                                            <td className="px-8 py-5 border-r border-white/5 font-black text-white text-xs italic tracking-tight group-hover:text-primary transition-colors">
                                                                {label}
                                                                {entryMode === 'user' && typeof t !== 'string' && (
                                                                    <div className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] mt-1">{t.Team || 'GLOBAL'}</div>
                                                                )}
                                                            </td>
                                                            {subPeriods.map(p => {
                                                                const cellVal = rowData[`${p}_${id}`] || 0;
                                                                let activeTier = null;
                                                                if (calc.achievementTiers) {
                                                                    const tiers = [...calc.achievementTiers]
                                                                        .filter(tier => !tier.subPeriod || tier.subPeriod === p)
                                                                        .sort((a, b) => b.target - a.target);
                                                                    activeTier = tiers.find(tier => cellVal >= tier.target);
                                                                }

                                                                return (
                                                                    <td key={p} className="px-4 py-4 border-r border-white/5">
                                                                        <div className="flex flex-col gap-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isLocked || cellVal <= 0}
                                                                                    onClick={() => handleManualDataIncrement(calc.metricType || '', id, p, -1)}
                                                                                    className="w-9 h-11 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-all disabled:opacity-20 active:scale-90 shrink-0 text-lg font-black"
                                                                                >−</button>
                                                                                <input
                                                                                    type="number"
                                                                                    value={cellVal || ''}
                                                                                    disabled={isLocked}
                                                                                    onChange={e => handleManualDataChange(calc.metricType || '', id, e.target.value, p)}
                                                                                    className="flex-1 h-11 bg-black border border-white/10 text-center font-mono text-[14px] font-black text-white focus:border-primary/50 focus:bg-primary/[0.02] rounded-xl outline-none transition-all disabled:opacity-30"
                                                                                    placeholder="0"
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isLocked}
                                                                                    onClick={() => handleManualDataIncrement(calc.metricType || '', id, p, 1)}
                                                                                    className="w-9 h-11 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all disabled:opacity-20 active:scale-90 shrink-0 text-lg font-black"
                                                                                >+</button>
                                                                            </div>
                                                                            
                                                                            {activeTier ? (
                                                                                <div className="flex items-center justify-between px-2 py-1 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                                                                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">
                                                                                        {activeTier.name || 'TARGET_REACHED'}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-mono font-black text-emerald-400">
                                                                                        +${activeTier.rewardAmount.toFixed(0)}
                                                                                    </span>
                                                                                </div>
                                                                            ) : cellVal > 0 ? (
                                                                                <div className="px-2">
                                                                                    <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                                        <div className="h-full bg-white/20 animate-pulse" style={{width: '40%'}}></div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-8 py-5 text-right bg-primary/[0.02]">
                                                                <span className="font-mono text-[16px] text-primary font-black tracking-tight">{rowTotal.toLocaleString()}</span>
                                                                <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mt-1">{calc.metricType || 'KPI'}</div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Payout Ledger Table */}
                <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-5 min-w-0">
                            <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(252,213,53,0.3)]" />
                            <div>
                                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-1.5">Payout_Ledger</h2>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em]">
                                    {project?.calculators?.some(c => c.isMarathon) 
                                        ? 'Aggregate Marathon Protocol Credits & Final Verification' 
                                        : 'Verified Rewards aggregation and Manual Override Protocol'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsAdjustMode(!isAdjustMode)}
                            disabled={isLocked}
                            className={`h-11 px-6 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg ${
                                isLocked
                                    ? 'bg-white/5 text-white/20 border-white/5 opacity-50 cursor-not-allowed'
                                    : isAdjustMode
                                        ? 'bg-primary text-black border-primary shadow-primary/20'
                                        : 'bg-white/5 text-white/40 hover:text-white border-white/10 hover:bg-white/10'
                            }`}
                        >
                            <MousePointer2 className="w-4 h-4" />
                            {isAdjustMode ? 'FINISH_ADJUSTMENTS' : 'INITIATE_OVERRIDE'}
                        </button>
                    </div>

                    <div className="bg-[#121212] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl relative">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] text-white/30 font-black uppercase tracking-[0.3em]">
                                        <th className="px-8 py-5 w-20 text-center border-r border-white/5">RANK</th>
                                        <th className="px-8 py-5 min-w-[280px] border-r border-white/5">ENTITY_IDENTITY</th>
                                        <th className="px-8 py-5 border-r border-white/5">PERFORMANCE_INDEX</th>
                                        <th className="px-8 py-5 border-r border-white/5">LOGIC_COMPONENTS</th>
                                        <th className="px-8 py-5 text-right">CREDIT_VALUE (USD)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {preparedResults.map((u, idx) => (
                                        <tr key={u.username} className={`hover:bg-white/[0.03] transition-all duration-300 group ${idx === 0 ? 'bg-primary/[0.01]' : ''}`}>
                                            <td className="px-8 py-6 text-center border-r border-white/5">
                                                <span className={`font-mono font-black text-lg ${idx === 0 ? 'text-primary' : 'text-white/10'}`}>
                                                    {(idx + 1).toString().padStart(2, '0')}
                                                </span>
                                            </td>

                                            <td className="px-8 py-6 border-r border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative shrink-0">
                                                        <UserAvatar avatarUrl={u.avatar} name={u.fullName} size="md" className="border-2 border-white/5 group-hover:border-primary/40 transition-all duration-500 scale-90 group-hover:scale-100" />
                                                        {idx === 0 && (
                                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-[#121212] shadow-lg">
                                                                <Trophy className="w-3 h-3 text-black" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-white text-sm uppercase italic tracking-tight truncate group-hover:text-primary transition-colors">{u.fullName}</p>
                                                        <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mt-1">{u.username} // {u.role || 'STAFF_NODE'}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-8 py-6 border-r border-white/5">
                                                <p className="font-mono font-black text-white text-base">
                                                    {u.isAmountMetric ? '$' : ''}{u.performance.toLocaleString()}
                                                </p>
                                                <div className="flex items-center gap-3 mt-3">
                                                    <div className="h-1.5 flex-grow bg-white/5 rounded-full overflow-hidden max-w-[120px]">
                                                        <div
                                                            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(252,213,53,0.4)]"
                                                            style={{ width: `${Math.min(100, Math.round((u.performance / maxPerformance) * 100))}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">
                                                        {Math.round((u.performance / maxPerformance) * 100)}% {u.performanceMetric}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-8 py-6 border-r border-white/5">
                                                {canViewLogic(u.team) ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {u.breakdown?.map((b: any, i: number) => {
                                                            const calc = project?.calculators?.find(c => c.id === b.calculatorId);
                                                            const isMarathonComponent = calc?.isMarathon;
                                                            return (
                                                                <div key={i} className={`px-3 py-1.5 bg-black/40 border rounded-xl text-[10px] flex flex-col gap-1 transition-all duration-300 hover:scale-105 ${isMarathonComponent ? 'border-primary/40 bg-primary/5' : 'border-white/5 hover:border-white/20'}`} title={b.description}>
                                                                    <div className="flex items-center gap-2.5">
                                                                        {isMarathonComponent ? <Trophy className="w-3 h-3 text-primary" /> : <Cpu className="w-3 h-3 text-white/20" />}
                                                                        <span className={`uppercase tracking-widest font-black text-[9px] ${isMarathonComponent ? 'text-primary' : 'text-white/40'}`}>
                                                                            {isMarathonComponent ? 'MARATHON_CREDIT' : (b.name || b.calculatorName || 'BONUS_NODE')}
                                                                        </span>
                                                                        <div className="w-px h-3 bg-white/10" />
                                                                        <span className="text-emerald-400 font-mono font-black">${(b.amount || 0).toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {u.breakdown.length === 0 && (
                                                            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">NO_DATA_BREAKDOWN</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Lock className="w-3 h-3 text-white/20" />
                                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">CLASSIFIED_PROTOCOL</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-8 py-6 text-right">
                                                {canViewLogic(u.team) ? (
                                                    isAdjustMode ? (
                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className="flex items-center gap-2 bg-black border border-white/10 p-1 rounded-2xl">
                                                                <button
                                                                    type="button"
                                                                    disabled={isLocked}
                                                                    onClick={() => {
                                                                        const cur = customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward;
                                                                        handleCustomPayoutChange(u.username, String(Math.max(0, cur - 1)));
                                                                    }}
                                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 transition-all active:scale-90 font-black"
                                                                >−</button>
                                                                <div className="flex items-center px-2">
                                                                    <span className="text-white/20 font-mono text-sm mr-1.5">$</span>
                                                                    <input
                                                                        type="number"
                                                                        value={customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward}
                                                                        onChange={e => handleCustomPayoutChange(u.username, e.target.value)}
                                                                        disabled={isLocked}
                                                                        className="w-24 bg-transparent border-none p-0 text-base text-right font-mono font-black text-primary focus:ring-0 outline-none"
                                                                        min={0}
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    disabled={isLocked}
                                                                    onClick={() => {
                                                                        const cur = customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward;
                                                                        handleCustomPayoutChange(u.username, String(cur + 1));
                                                                    }}
                                                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-all active:scale-90 font-black"
                                                                >+</button>
                                                            </div>
                                                            {customPayouts[u.username] !== undefined && (
                                                                <button
                                                                    disabled={isLocked}
                                                                    onClick={() => handleCustomPayoutChange(u.username, String(u.baseReward))}
                                                                    className="text-[9px] font-black text-white/20 hover:text-primary uppercase tracking-[0.2em] transition-all"
                                                                >
                                                                    RESET_ORIGINAL_${u.baseReward.toFixed(2)}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="group/val">
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-mono font-black text-[22px] text-primary group-hover/val:scale-110 transition-transform duration-300 origin-right">
                                                                    ${u.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                                {u.isCustom && (
                                                                    <div className="flex items-center gap-1.5 mt-1">
                                                                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                                                                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Manual_Override_Active</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-mono font-black text-xl text-white/10">
                                                            $***.**
                                                        </span>
                                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">RESTRICTED_ACCESS</span>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {preparedResults.length === 0 && !isCalculating && (
                            <div className="py-32 text-center group/empty">
                                <div className="w-20 h-20 rounded-[32px] bg-black border border-white/5 flex items-center justify-center mx-auto mb-8 shadow-2xl group-hover/empty:scale-110 transition-transform">
                                    <Search className="w-10 h-10 text-white/10" />
                                </div>
                                <p className="text-xl font-black text-white italic tracking-tight uppercase mb-2">Null_Data_Detected</p>
                                <p className="text-sm font-medium text-white/20 uppercase tracking-[0.2em]">No payout records found for the current protocol cycle</p>
                            </div>
                        )}
                        {isCalculating && (
                            <div className="py-20 text-center">
                                <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">Processing_Protocol_Calculations...</p>
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
