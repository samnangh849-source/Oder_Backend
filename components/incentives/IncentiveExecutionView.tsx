import React, { useState, useMemo, useContext, useEffect, useCallback, useRef } from 'react';
import { IncentiveProject, ParsedOrder, IncentiveResult, IncentiveManualData } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import UserAvatar from '../common/UserAvatar';
import { getProjectById, calculateIncentive, getIncentiveManualData, saveIncentiveManualData, getIncentiveCustomPayouts, saveIncentiveCustomPayout, lockIncentivePayout } from '../../services/incentiveService';
import IncentivePdfExportModal from './IncentivePdfExportModal';
import { ChevronLeft, FileText, Download, Lock, Unlock, Search, CheckCircle, RefreshCw, AlertCircle, Info } from 'lucide-react';

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
    const [editorPeriodMode, setEditorPeriodMode] = useState<'Monthly' | 'Weekly'>('Monthly');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);

    // Debounce Timer Ref
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Initial Loading
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

    const loadDataAndCalculate = useCallback(async (isSilient = false) => {
        if (!project?.id) return;
        if (!isSilient) setIsCalculating(true);
        
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
            customData.forEach((item: any) => {
                cpMap[item.userName] = item.value;
            });
            setCustomPayouts(cpMap);

            setCalculationResults(results);
        } catch (error) {
            console.error("Error loading incentive data", error);
            setSaveStatus('error');
        } finally {
            setIsCalculating(false);
        }
    }, [project?.id, selectedMonth]);

    useEffect(() => {
        loadDataAndCalculate();
    }, [loadDataAndCalculate]);

    const toggleLock = async () => {
        if (!project?.id) return;
        if (isLocked) {
            setIsLocked(false);
            return;
        }
        
        if (!window.confirm(t.confirm_lock_payout || "តើអ្នកចង់ចាក់សោររបាយការណ៍ខែនេះមែនទេ?")) return;
        
        setSaveStatus('saving');
        const success = await lockIncentivePayout(project.id, selectedMonth, calculationResults);
        if (success) {
            setIsLocked(true);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            alert("Failed to lock and save results.");
            setSaveStatus('idle');
        }
    };

    const handleManualDataChange = (metric: string, tid: string, val: string, pk: string) => {
        if (isLocked || !project?.id) return;
        
        const valNum = Number(val) || 0;
        
        // Optimistic Update
        setManualDataMap(prev => ({
            ...prev,
            [metric]: { ...(prev[metric] || {}), [`${pk}_${tid}`]: valNum }
        }));

        setSaveStatus('saving');

        // Debounce API Call
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            const success = await saveIncentiveManualData({
                projectId: project.id,
                month: selectedMonth,
                metricType: metric,
                dataKey: `${pk}_${tid}`,
                value: valNum
            });
            
            if (success) {
                setSaveStatus('saved');
                loadDataAndCalculate(true); // Re-calculate silently
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
            }
        }, 1000);
    };

    const handleCustomPayoutChange = (un: string, val: string) => {
        if (isLocked || !project?.id) return;
        
        const valNum = Number(val) || 0;
        setCustomPayouts(prev => ({ ...prev, [un]: valNum }));
        setSaveStatus('saving');

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            const success = await saveIncentiveCustomPayout({
                projectId: project.id,
                month: selectedMonth,
                userName: un,
                value: valNum
            });

            if (success) {
                setSaveStatus('saved');
                loadDataAndCalculate(true);
                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('error');
            }
        }, 1000);
    };

    const preparedResults = useMemo(() => {
        return calculationResults.map(cr => {
            const u = appData.users?.find(x => x.UserName === cr.userName);
            let breakdown: any[] = [];
            if (cr.breakdownJson) {
                try {
                    breakdown = JSON.parse(cr.breakdownJson);
                } catch (e) {
                    console.error("Failed to parse breakdownJson", e);
                }
            }
            const metricType = breakdown.find((b: any) => b?.metricType)?.metricType || '';
            const isAmountMetric = ['sales amount', 'revenue', 'profit'].includes(String(metricType).toLowerCase());
            
            return {
                username: cr.userName,
                fullName: u?.FullName || cr.userName,
                avatar: u?.ProfilePictureURL,
                role: u?.Role,
                team: u?.Team,
                performance: cr.totalRevenue || cr.totalOrders,
                performanceMetric: metricType || (cr.totalRevenue ? 'Revenue' : 'Orders'),
                isAmountMetric,
                reward: cr.calculatedValue,
                isCustom: cr.isCustom || false,
                breakdown: breakdown
            };
        }).sort((a, b) => b.reward - a.reward || b.performance - a.performance);
    }, [calculationResults, appData.users]);

    const totalPayout = useMemo(() => preparedResults.reduce((sum, u) => sum + u.reward, 0), [preparedResults]);
    const topStaff = preparedResults.length > 0 ? preparedResults[0] : null;

    if (!project) return <div className="ui-binance flex items-center justify-center min-h-screen bg-bg-black"><div className="text-secondary font-bold uppercase tracking-[0.2em] animate-pulse">Initializing Protocol...</div></div>;

    return (
        <div className="ui-binance w-full min-h-screen bg-bg-black text-[#EAECEF] font-sans selection:bg-primary/30">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Global Header */}
                <div className="flex flex-col gap-6 mb-10">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 text-secondary text-[10px] font-bold uppercase tracking-widest">
                            <button onClick={onBack} className="hover:text-primary transition-colors flex items-center gap-1.5 bg-card-bg px-3 py-1.5 rounded-md border border-[#2B3139]">
                                <ChevronLeft className="w-3.5 h-3.5" /> {t.back}
                            </button>
                            <span className="opacity-30">/</span>
                            <span className="text-secondary">{t.execution_workstation}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             {saveStatus === 'saving' && <span className="text-[10px] font-bold text-amber-500 uppercase animate-pulse flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</span>}
                             {saveStatus === 'saved' && <span className="text-[10px] font-bold text-primary uppercase flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> All changes synced</span>}
                             {saveStatus === 'error' && <span className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Sync failed</span>}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card-bg p-6 rounded-md border border-[#2B3139] shadow-xl">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-md flex items-center justify-center text-primary bg-bg-black border border-[#2B3139] shadow-inner">
                                <FileText className="w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-[#EAECEF] tracking-tight uppercase leading-none mb-2">{project.projectName}</h1>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center bg-bg-black px-3 py-1.5 rounded border border-[#2B3139]">
                                        <input 
                                            type="month" 
                                            value={selectedMonth} 
                                            onChange={e => setSelectedMonth(e.target.value)} 
                                            className="bg-transparent border-none p-0 text-primary text-[11px] font-bold uppercase focus:ring-0 cursor-pointer" 
                                        />
                                    </div>
                                    <div className="h-4 w-px bg-[#2B3139]"></div>
                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                                        Total Payout: <span className="text-primary text-sm font-mono">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto mt-4 md:mt-0">
                            <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 md:flex-none px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-bg-black border border-[#2B3139] text-secondary hover:text-[#EAECEF] hover:border-primary flex items-center justify-center gap-2 transition-all">
                                <FileText className="w-4 h-4" /> PDF Report
                            </button>
                            <button onClick={toggleLock} className={`flex-1 md:flex-none px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center justify-center gap-2 transition-all ${isLocked ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-bg-black border-[#2B3139] text-secondary hover:text-[#EAECEF] hover:border-amber-500'}`}>
                                {isLocked ? <><Lock className="w-4 h-4" /> {t.locked}</> : <><Unlock className="w-4 h-4" /> {t.lock_payout}</>}
                            </button>
                            {project.dataSource === 'manual' && (
                                <button onClick={() => setShowInputPanel(!showInputPanel)} className={`flex-1 md:flex-none px-4 py-2.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border ${showInputPanel ? 'bg-primary text-bg-black border-primary shadow-lg shadow-primary/20' : 'bg-primary/5 border-primary/20 text-primary hover:bg-primary hover:text-bg-black'}`}>
                                    {showInputPanel ? "Hide Editor" : "Open Perf Editor"}
                                </button>
                            )}
                            <button onClick={() => loadDataAndCalculate()} disabled={isCalculating} className={`p-2.5 rounded-md bg-bg-black border border-[#2B3139] text-secondary hover:text-primary transition-all ${isCalculating ? 'animate-spin' : ''}`}>
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md group hover:border-primary transition-all">
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 flex items-center gap-2">Total Pool <Info className="w-3 h-3 opacity-30" /></p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-primary font-mono">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[9px] font-bold text-secondary uppercase">USD</span>
                            </div>
                        </div>

                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md group hover:border-primary transition-all">
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Alpha Performer</p>
                            {topStaff ? (
                                <div className="flex items-center gap-3">
                                    <UserAvatar avatarUrl={topStaff.avatar} name={topStaff.fullName} size="xs" />
                                    <div>
                                        <p className="text-[11px] font-bold text-[#EAECEF] uppercase truncate max-w-[120px]">{topStaff.fullName}</p>
                                        <p className="text-[10px] font-bold text-primary uppercase font-mono">${topStaff.reward.toFixed(2)}</p>
                                    </div>
                                </div>
                            ) : <div className="h-8 flex items-center text-[10px] text-secondary uppercase italic">Syncing...</div>}
                        </div>

                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Yield Average</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-[#EAECEF] font-mono">${(totalPayout / (preparedResults.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span className="text-[9px] font-bold text-secondary uppercase">Avg/Staff</span>
                            </div>
                        </div>

                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Qualified Entries</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-[#EAECEF] font-mono">{preparedResults.length}</span>
                                <span className="text-[9px] font-bold text-secondary uppercase">Units</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Editor Panel */}
                {showInputPanel && project.dataSource === 'manual' && (
                    <div className="mb-10 border border-primary/20 rounded-md bg-card-bg overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="px-6 py-5 bg-[#1E2329] border-b border-[#2B3139] flex flex-wrap justify-between items-end gap-6">
                            <div className="flex flex-wrap items-center gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Active Calculator</label>
                                    <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                                        {project.calculators?.filter(c => c.status === 'Active').map(calc => (
                                            <button key={calc.id} onClick={() => setActiveMetricTab(String(calc.id))} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeMetricTab === String(calc.id) ? 'bg-primary text-bg-black shadow-lg shadow-primary/20' : 'text-secondary hover:text-[#EAECEF]'}`}>{calc.name}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Entry Scope</label>
                                    <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                                        <button onClick={() => setEntryMode('team')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${entryMode === 'team' ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>Team Data</button>
                                        <button onClick={() => setEntryMode('user')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${entryMode === 'user' ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>User Data</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow max-w-sm relative">
                                <input type="text" placeholder="Search entity..." value={editorSearch} onChange={e => setEditorSearch(e.target.value)} className="w-full bg-bg-black border border-[#2B3139] rounded px-4 py-2.5 pl-10 text-[12px] font-bold text-[#EAECEF] focus:border-primary focus:ring-0 outline-none transition-all" />
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                            </div>
                        </div>

                        <div className="overflow-x-auto bg-bg-black max-h-[600px] overflow-y-auto custom-scrollbar">
                            {project.calculators?.filter(c => c.status === 'Active' && String(c.id) === activeMetricTab).map(calc => {
                                const subPeriods = calc.calculationPeriod === 'Weekly' ? ['W1', 'W2', 'W3', 'W4', 'W5'] : ['month'];
                                const targets = (entryMode === 'team' ? allTeams : appData.users || []).filter(t => {
                                    const label = typeof t === 'string' ? t : t.FullName;
                                    return label.toLowerCase().includes(editorSearch.toLowerCase());
                                });
                                
                                return (
                                    <table key={calc.id} className="w-full text-left border-collapse min-w-[800px]">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-[#1E2329] border-b border-[#2B3139] text-[10px] text-secondary font-bold uppercase tracking-widest">
                                                <th className="px-6 py-4 min-w-[200px] border-r border-[#2B3139]">Target Entity</th>
                                                {subPeriods.map(p => (
                                                    <th key={p} className="px-4 py-4 text-center border-r border-[#2B3139]">{p === 'month' ? 'Total Accumulation' : p}</th>
                                                ))}
                                                <th className="px-6 py-4 text-right text-primary bg-primary/5">Calculated KPI</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2B3139]">
                                            {targets.map(t => {
                                                const id = typeof t === 'string' ? t : t.UserName;
                                                const label = typeof t === 'string' ? t : t.FullName;
                                                const rowData = manualDataMap[calc.metricType || ''] || {};
                                                const rowTotal = subPeriods.reduce((sum, p) => sum + (rowData[`${p}_${id}`] || 0), 0);

                                                return (
                                                    <tr key={id} className="hover:bg-card-bg-hover transition-colors group">
                                                        <td className="px-6 py-3 border-r border-[#2B3139] font-bold text-[#EAECEF] text-[12px] uppercase">{label}</td>
                                                        {subPeriods.map(p => (
                                                            <td key={p} className="px-2 py-2 border-r border-[#2B3139]">
                                                                <input
                                                                    type="number"
                                                                    value={rowData[`${p}_${id}`] || ''}
                                                                    disabled={isLocked}
                                                                    onChange={e => handleManualDataChange(calc.metricType || '', id, e.target.value, p)}
                                                                    className="w-full bg-transparent border-none text-center font-mono text-[12px] font-bold text-[#EAECEF] focus:bg-primary/10 focus:text-primary rounded py-2 outline-none transition-all disabled:opacity-50"
                                                                    placeholder="0"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-6 py-3 text-right bg-primary/5">
                                                            <span className="font-mono text-[12px] text-primary font-bold">{rowTotal.toLocaleString()}</span>
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

                {/* Results Ledger */}
                <div className="space-y-6">
                    <div className="flex justify-between items-end">
                        <div>
                            <h2 className="text-[12px] font-bold text-primary uppercase tracking-[0.3em] mb-1">Payout Ledger</h2>
                            <p className="text-[10px] text-secondary uppercase font-bold tracking-widest">Real-time settlement calculation</p>
                        </div>
                        <button onClick={() => setIsAdjustMode(!isAdjustMode)} className={`text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded border transition-all ${isAdjustMode ? 'bg-amber-500 text-bg-black border-amber-500 shadow-lg shadow-amber-500/20' : 'text-secondary border-[#2B3139] hover:text-[#EAECEF] hover:border-primary'}`}>
                            {isAdjustMode ? "Save Adjustments" : "Adjust Results"}
                        </button>
                    </div>

                    <div className="border border-[#2B3139] rounded-md bg-card-bg overflow-hidden shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#1E2329] border-b border-[#2B3139] text-[10px] text-secondary font-bold uppercase tracking-widest">
                                    <th className="px-6 py-4 w-12 text-center">Rank</th>
                                    <th className="px-6 py-4 min-w-[280px]">Entity</th>
                                    <th className="px-6 py-4">Performance</th>
                                    <th className="px-6 py-4">Yield Breakdown</th>
                                    <th className="px-6 py-4 text-right">Settlement (USD)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2B3139]">
                                {preparedResults.map((u, idx) => (
                                    <tr key={u.username} className={`hover:bg-card-bg-hover transition-all group ${idx === 0 ? 'bg-primary/5' : ''}`}>
                                        <td className="px-6 py-5 text-secondary text-center font-mono font-bold">{idx + 1}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <UserAvatar avatarUrl={u.avatar} name={u.fullName} size="sm" />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-[#EAECEF] uppercase truncate text-[12px]">{u.fullName}</p>
                                                    <p className="text-[9px] text-secondary font-bold tracking-widest">ID: {u.username} • {u.role || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="space-y-1">
                                                <p className="font-mono text-[#EAECEF] font-bold text-[13px]">{u.isAmountMetric ? '$' : ''}{u.performance.toLocaleString()}</p>
                                                <p className="text-[9px] text-secondary uppercase font-bold tracking-tighter opacity-70">{u.performanceMetric}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-wrap gap-2">
                                                {u.breakdown?.map((b: any, i: number) => (
                                                    <div key={i} className="px-2.5 py-1 bg-bg-black border border-[#2B3139] rounded-md text-[9px] flex items-center gap-2 group/tag hover:border-primary transition-colors">
                                                        <span className="text-secondary font-bold uppercase group-hover/tag:text-primary">{b.name}</span>
                                                        <div className="h-2 w-px bg-[#2B3139]"></div>
                                                        <span className="text-[#EAECEF] font-bold font-mono">${b.amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {u.breakdown.length === 0 && <span className="text-[10px] text-secondary italic opacity-50">No yield components</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {isAdjustMode ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-secondary font-bold font-mono">$</span>
                                                    <input 
                                                        type="number" 
                                                        value={customPayouts[u.username] !== undefined ? customPayouts[u.username] : u.reward} 
                                                        onChange={e => handleCustomPayoutChange(u.username, e.target.value)} 
                                                        className="w-28 bg-bg-black border border-amber-500/50 rounded-md py-1.5 px-3 text-[12px] text-right font-bold text-amber-500 focus:border-amber-500 outline-none shadow-inner" 
                                                    />
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <span className={`font-bold font-mono text-[15px] tracking-tight ${u.isCustom ? 'text-amber-500' : 'text-primary'}`}>
                                                        ${u.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {u.isCustom && <p className="text-[8px] text-amber-500 font-bold uppercase text-right tracking-widest">Manual Override</p>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {preparedResults.length === 0 && !isCalculating && (
                            <div className="p-20 text-center">
                                <Search className="w-12 h-12 text-secondary opacity-20 mx-auto mb-4" />
                                <p className="text-secondary font-bold uppercase tracking-widest text-[11px]">No settlement data found for this period</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
