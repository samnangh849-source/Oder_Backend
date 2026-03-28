import React, { useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { IncentiveProject, ParsedOrder, User, IncentiveResult, IncentiveManualData } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import UserAvatar from '../common/UserAvatar';
import { getProjectById, calculateIncentive, getIncentiveManualData, saveIncentiveManualData, getIncentiveCustomPayouts, saveIncentiveCustomPayout, lockIncentivePayout } from '../../services/incentiveService';
import IncentivePdfExportModal from './IncentivePdfExportModal';
import { ChevronLeft, FileText, Download, Lock, Unlock, Edit, Search, CheckCircle, AlertTriangle } from 'lucide-react';

interface IncentiveExecutionViewProps {
    projectId: string;
    orders: ParsedOrder[];
    onBack: () => void;
}

const IncentiveExecutionView: React.FC<IncentiveExecutionViewProps> = ({ projectId, orders, onBack }) => {
    const { language, appData } = useContext(AppContext);
    const t = translations[language];

    // 1. Teams Identification
    const allTeams = useMemo(() => {
        const teams = new Set<string>();
        appData.users?.forEach(u => u.Team?.split(',').forEach(tn => teams.add(tn.trim())));
        appData.pages?.forEach(p => p.Team?.split(',').forEach(tn => teams.add(tn.trim())));
        return Array.from(teams).filter(Boolean).sort();
    }, [appData.users, appData.pages]);

    // 2. State
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
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);

    // 3. Loading
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
                } else {
                    setActiveMetricTab('');
                }
            }
        };
        fetchProject();
    }, [projectId]);

    const loadDataAndCalculate = useCallback(async () => {
        if (!project?.id) return;
        setIsCalculating(true);
        
        const manualData = await getIncentiveManualData(project.id, selectedMonth);
        const mdMap: Record<string, Record<string, number>> = {};
        manualData.forEach((item: IncentiveManualData) => {
            if (!mdMap[item.metricType]) mdMap[item.metricType] = {};
            mdMap[item.metricType][item.dataKey] = item.value;
        });
        setManualDataMap(mdMap);

        const customData = await getIncentiveCustomPayouts(project.id, selectedMonth);
        const cpMap: Record<string, number> = {};
        customData.forEach((item: any) => {
            cpMap[item.userName] = item.value;
        });
        setCustomPayouts(cpMap);

        const results = await calculateIncentive(project.id, selectedMonth);
        setCalculationResults(results);
        
        setIsCalculating(false);
    }, [project?.id, selectedMonth]);

    useEffect(() => {
        loadDataAndCalculate();
    }, [loadDataAndCalculate]);

    const toggleLock = async () => {
        if (!project?.id) return;
        const nextState = !isLocked;
        if (nextState && !window.confirm(t.confirm_lock_payout || "តើអ្នកចង់ចាក់សោររបាយការណ៍ខែនេះមែនទេ?")) return;
        
        if (nextState) {
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
        } else {
            setIsLocked(false);
        }
    };

    const handleManualDataChange = async (metric: string, tid: string, val: string, pk: string) => {
        if (isLocked || !project?.id) return;
        setSaveStatus('saving');
        const valNum = Number(val) || 0;
        
        const newData = { ...manualDataMap, [metric]: { ...(manualDataMap[metric] || {}), [`${pk}_${tid}`]: valNum } };
        setManualDataMap(newData);

        await saveIncentiveManualData({
            projectId: project.id,
            month: selectedMonth,
            metricType: metric,
            dataKey: `${pk}_${tid}`,
            value: valNum
        });
        
        loadDataAndCalculate();

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const clearColumn = (metric: string, pk: string) => {
        if (isLocked || !window.confirm(`${t.confirm_clear_column || 'Clear all data for'} ${pk}?`)) return;
        const targets = entryMode === 'team' ? allTeams : (appData.users || []).map(u => u.UserName);
        targets.forEach(tid => handleManualDataChange(metric, tid, "0", pk));
    };

    const clearRow = (metric: string, tid: string) => {
        if (isLocked || !window.confirm(t.confirm_clear_row || "តើអ្នកចង់លុបទិន្នន័យជួរដេកនេះមែនទេ?")) return;
        const subPeriods = ['month', 'W1', 'W2', 'W3', 'W4', 'W5'];
        subPeriods.forEach(pk => handleManualDataChange(metric, tid, "0", pk));
    };

    const handleKeyDown = (e: React.KeyboardEvent, tid: string, pk: string, metric: string, subPeriods: string[], targets: any[]) => {
        if (isLocked) return;
        const targetIds = targets.map(t => typeof t === 'string' ? t : t.UserName);
        const rIdx = targetIds.indexOf(tid);
        const cIdx = subPeriods.indexOf(pk);
        let nTid = tid, nPk = pk;

        if (e.key === 'ArrowDown' && rIdx < targetIds.length - 1) nTid = targetIds[rIdx + 1];
        else if (e.key === 'ArrowUp' && rIdx > 0) nTid = targetIds[rIdx - 1];
        else if (e.key === 'ArrowRight' && cIdx < subPeriods.length - 1) nPk = subPeriods[cIdx + 1];
        else if (e.key === 'ArrowLeft' && cIdx > 0) nPk = subPeriods[cIdx - 1];
        else if (e.key === 'Enter') { e.preventDefault(); if (rIdx < targetIds.length - 1) nTid = targetIds[rIdx + 1]; }
        else return;

        const next = document.querySelector(`input[data-id="${nTid}"][data-pk="${nPk}"]`) as HTMLInputElement;
        if (next) next.focus();
    };

    const handleCustomPayoutChange = async (un: string, val: string) => {
        if (isLocked || !project?.id) return;
        setSaveStatus('saving');
        const next = { ...customPayouts, [un]: Number(val) || 0 };
        setCustomPayouts(next);

        await saveIncentiveCustomPayout({
            projectId: project.id,
            month: selectedMonth,
            userName: un,
            value: Number(val) || 0
        });

        loadDataAndCalculate();
        
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const exportToCSV = () => {
        const headers = ["Personnel", "Username", "Role", "Team", "Reward Amount", "Performance", "Metric"];
        const rows = preparedResults.users.map(u => [
            u.fullName, 
            u.username, 
            u.role || '', 
            u.team || '', 
            u.reward.toFixed(2),
            u.performance.toFixed(2),
            u.performanceMetric
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `Incentive_${project?.projectName}_${selectedMonth}.csv`);
        document.body.appendChild(link); link.click();
    };

    const preparedResults = useMemo(() => {
        const users = calculationResults.map(cr => {
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
                performanceMetric: metricType || (cr.totalRevenue ? 'Revenue/Profit' : 'Number of Orders'),
                isAmountMetric,
                reward: cr.calculatedValue,
                isCustom: cr.isCustom || false,
                breakdown: breakdown
            };
        }).sort((a, b) => b.reward - a.reward || b.performance - a.performance);

        return { users, teams: [] };
    }, [calculationResults, appData.users]);

    const totalPayout = preparedResults.users.reduce((sum, u) => sum + u.reward, 0);
    const topStaff = preparedResults.users.length > 0 ? preparedResults.users[0] : null;

    if (!project) return <div className="ui-binance p-10 bg-bg-black text-secondary font-bold uppercase tracking-widest text-[11px]">Loading...</div>;

    return (
        <div className="ui-binance w-full min-h-screen bg-bg-black text-[#EAECEF] font-sans">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header Navigation */}
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex items-center gap-3 text-secondary text-[10px] font-bold uppercase tracking-widest">
                        <button onClick={onBack} className="hover:text-primary transition-colors flex items-center gap-1.5 bg-card-bg px-3 py-1.5 rounded-md border border-[#2B3139]">
                            <ChevronLeft className="w-3.5 h-3.5" /> {t.back}
                        </button>
                        <span className="opacity-30">/</span>
                        <span className="text-secondary">{t.execution_workstation}</span>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card-bg p-5 rounded-md border border-[#2B3139]">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-md flex items-center justify-center text-primary bg-bg-black border border-[#2B3139]">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-[#EAECEF] tracking-wider uppercase">{project.projectName || (project as any).name}</h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <div className="flex items-center bg-bg-black px-2 py-1 rounded border border-[#2B3139]">
                                        <input 
                                            type="month" 
                                            value={selectedMonth} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                // Only update if it's a valid year-month or empty (for typing)
                                                if (!val || /^\d{4}-\d{2}$/.test(val) || val.length < 7) {
                                                    setSelectedMonth(val);
                                                }
                                            }} 
                                            className="bg-transparent border-none p-0 text-primary text-[10px] font-bold uppercase focus:ring-0 cursor-pointer" 
                                        />
                                    </div>
                                    <span className="text-[#2B3139]">|</span>
                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{t.total_payout}: <span className="text-primary font-mono ml-1">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                                    {isCalculating && <span className="text-[10px] text-primary animate-pulse ml-2">SYNCING...</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 md:flex-none px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider bg-bg-black border border-[#2B3139] text-secondary hover:text-[#EAECEF] hover:border-[#474D57] flex items-center justify-center gap-2 transition-all">
                                <FileText className="w-4 h-4" /> PDF
                            </button>
                            <button onClick={exportToCSV} className="flex-1 md:flex-none px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider bg-bg-black border border-[#2B3139] text-secondary hover:text-[#EAECEF] hover:border-[#474D57] flex items-center justify-center gap-2 transition-all">
                                <Download className="w-4 h-4" /> CSV
                            </button>
                            <button onClick={toggleLock} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider border flex items-center justify-center gap-2 transition-all ${isLocked ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-bg-black border-[#2B3139] text-secondary hover:text-[#EAECEF]'}`}>
                                {isLocked ? <><Lock className="w-4 h-4" /> {t.locked}</> : <><Unlock className="w-4 h-4" /> {t.lock_payout}</>}
                            </button>
                            {project.dataSource === 'manual' && (
                                <button onClick={() => setShowInputPanel(!showInputPanel)} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border ${showInputPanel ? 'bg-primary text-bg-black border-primary' : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary hover:text-bg-black'}`}>
                                    {showInputPanel ? t.close_editor : t.edit_perf_data}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* OVERVIEW CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md relative overflow-hidden">
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1">Total Distributed</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-primary font-mono">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] font-bold text-secondary uppercase">USD</span>
                            </div>
                        </div>

                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">{t.top_performer || 'Top Performer'}</span>
                            {topStaff ? (
                                <div className="flex items-center gap-3">
                                    <UserAvatar avatarUrl={topStaff.avatar} name={topStaff.fullName} size="sm" />
                                    <div>
                                        <p className="text-[11px] font-bold text-[#EAECEF] uppercase truncate max-w-[150px]">{topStaff.fullName}</p>
                                        <p className="text-[10px] font-bold text-primary uppercase font-mono">${topStaff.reward.toFixed(2)}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] font-bold text-secondary italic">No data yet</p>
                            )}
                        </div>

                        <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1">Avg. Reward</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-[#EAECEF] font-mono">${(totalPayout / (preparedResults.users.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span className="text-[10px] font-bold text-secondary uppercase">Per Staff</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Manual Input Editor */} 
                {showInputPanel && project.dataSource === 'manual' && (
                    <div className="mb-8 border border-[#2B3139] rounded-md bg-card-bg overflow-hidden relative">
                        <div className="px-6 py-4 bg-bg-black border-b border-[#2B3139] flex flex-wrap justify-between items-center gap-6">
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">{t.select_calculator}</label>
                                    <div className="flex gap-1 bg-card-bg p-1 rounded border border-[#2B3139]">
                                        {project.calculators?.filter(c => c.status === 'Active').map(calc => (
                                            <button key={calc.id} onClick={() => setActiveMetricTab(String(calc.id))} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${activeMetricTab === String(calc.id) ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{calc.name}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">{t.entry_mode}</label>
                                    <div className="flex gap-1 bg-card-bg p-1 rounded border border-[#2B3139]">
                                        <button onClick={() => setEntryMode('team')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${entryMode === 'team' ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{t.teams}</button>
                                        <button onClick={() => setEntryMode('user')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${entryMode === 'user' ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{t.staff}</button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">{t.calc_period}</label>
                                    <div className="flex gap-1 bg-card-bg p-1 rounded border border-[#2B3139]">
                                        <button onClick={() => setEditorPeriodMode('Monthly')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${editorPeriodMode === 'Monthly' ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{t.this_month}</button>
                                        <button onClick={() => setEditorPeriodMode('Weekly')} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${editorPeriodMode === 'Weekly' ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{t.this_week}</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow max-w-xs relative self-end">
                                <input type="text" placeholder={t.search_placeholder_editor} value={editorSearch} onChange={e => setEditorSearch(e.target.value)} className="w-full bg-bg-black border border-[#2B3139] rounded px-3 py-2 pl-9 text-[11px] font-bold text-[#EAECEF] focus:border-primary focus:ring-0 outline-none" />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-secondary" />
                            </div>

                            <div className="flex flex-col items-end gap-1 self-end">
                                <div className="flex items-center gap-2">
                                    {saveStatus === 'saving' && <><span className="text-[10px] font-bold text-amber-500 uppercase animate-pulse">SAVING...</span></>}
                                    {saveStatus === 'saved' && <><CheckCircle className="w-3 h-3 text-primary" /><span className="text-[10px] font-bold text-primary uppercase">SYNCED</span></>}
                                    {saveStatus === 'idle' && <span className="text-[10px] font-bold text-[#474D57] uppercase tracking-widest">AUTO-SAVE</span>}
                                </div>
                            </div>
                        </div>

                        {isLocked && <div className="absolute inset-0 bg-bg-black/60 backdrop-blur-[1px] z-50 flex items-center justify-center p-8 text-center"><div className="bg-card-bg border border-[#2B3139] p-8 rounded-md shadow-xl max-w-xs"><Lock className="w-10 h-10 text-primary mx-auto mb-4" /><h3 className="text-sm font-bold text-[#EAECEF] mb-2 uppercase tracking-widest">{t.locked}</h3><p className="text-[11px] text-secondary uppercase tracking-wider leading-relaxed">Unlock payout status to modify data.</p></div></div>}

                        <div className="overflow-x-auto bg-bg-black">
                            {project.calculators?.filter(c => c.status === 'Active' && String(c.id) === activeMetricTab).map(calc => {
                                const definedWeeks = Array.from(new Set(calc.achievementTiers?.map(t => t.subPeriod).filter(Boolean))).sort();
                                const subPeriods = editorPeriodMode === 'Weekly' ? (definedWeeks.length > 0 ? definedWeeks : ['W1', 'W2', 'W3', 'W4', 'W5']) : ['month'];
                                const targets = (entryMode === 'team' ? allTeams : appData.users || []).filter(t => {
                                    const label = typeof t === 'string' ? t : t.FullName;
                                    return label.toLowerCase().includes(editorSearch.toLowerCase());
                                });
                                
                                return (
                                    <div key={calc.id}>
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead>
                                                <tr className="border-b border-[#2B3139] text-[10px] text-secondary font-bold uppercase tracking-widest bg-card-bg">
                                                    <th className="px-6 py-3 min-w-[200px] border-r border-[#2B3139]">ENTITY</th>
                                                    {(subPeriods as string[]).map(p => (
                                                        <th key={p} className="px-3 py-3 text-center border-r border-[#2B3139]">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span>{p === 'month' ? 'TOTAL' : p}</span>
                                                                <button onClick={() => clearColumn(calc.metricType || '', p)} className="text-[9px] text-red-500 hover:text-red-400 font-bold">CLEAR</button>
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th className="px-6 py-3 text-right text-primary">AGGREGATED</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#2B3139]">
                                                {targets.map(t => {
                                                    const id = typeof t === 'string' ? t : t.UserName;
                                                    const label = typeof t === 'string' ? t : t.FullName;
                                                    const rowData = manualDataMap[calc.metricType || ''] || {};
                                                    const rowTotal = (subPeriods as string[]).reduce((sum, p) => sum + (rowData[`${p}_${id}`] || 0), 0);

                                                    return (
                                                        <tr key={id} className="hover:bg-card-bg-hover transition-colors group">
                                                            <td className="px-6 py-2 border-r border-[#2B3139] font-bold text-[#EAECEF] text-[11px]">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="truncate uppercase">{label}</span>
                                                                    <button onClick={() => clearRow(calc.metricType || '', id)} className="hidden group-hover:block text-red-500 p-1">✕</button>
                                                                </div>
                                                            </td>
                                                            {(subPeriods as string[]).map(p => (
                                                                <td key={p} className="px-1 py-1 border-r border-[#2B3139]">
                                                                    <input
                                                                        type="number"
                                                                        data-id={id}
                                                                        data-pk={p}
                                                                        value={rowData[`${p}_${id}`] || ''}
                                                                        onChange={e => handleManualDataChange(calc.metricType || '', id, e.target.value, p)}
                                                                        onKeyDown={e => handleKeyDown(e, id, p, calc.metricType || '', subPeriods as string[], targets)}
                                                                        className="w-full bg-transparent border-none text-center font-mono text-[11px] font-bold focus:bg-card-bg-hover focus:ring-1 focus:ring-primary rounded py-1.5 outline-none"
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="px-6 py-2 text-right bg-primary/5">
                                                                <span className="font-mono text-[11px] text-primary font-bold">{rowTotal.toLocaleString()}</span>
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

                <div className="space-y-8">
                    <section>
                        <div className="flex justify-between items-end mb-4">
                            <h2 className="text-[11px] font-bold text-secondary uppercase tracking-[0.2em]">{t.payout_ledger}</h2>
                            <button onClick={() => setIsAdjustMode(!isAdjustMode)} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border transition-all ${isAdjustMode ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'text-secondary border-[#2B3139] hover:text-[#EAECEF] hover:border-[#474D57]'}`}>{isAdjustMode ? `DONE` : `ADJUST RESULTS`}</button>
                        </div>

                        <div className="border border-[#2B3139] rounded-md bg-card-bg overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-bg-black border-b border-[#2B3139] text-[10px] text-secondary font-bold uppercase tracking-widest">
                                        <th className="px-6 py-3 w-12 text-center">#</th>
                                        <th className="px-6 py-3 min-w-[250px]">Personnel</th>
                                        <th className="px-6 py-3">{t.achievement_perf}</th>
                                        <th className="px-6 py-3">{t.reward_breakdown}</th>
                                        <th className="px-6 py-3 text-right">PAYOUT (USD)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2B3139] text-[11px]">
                                    {preparedResults.users.map((u, idx) => (
                                        <tr key={u.username} className="hover:bg-card-bg-hover transition-all group">
                                            <td className="px-6 py-4 text-secondary text-center font-mono">{idx + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar avatarUrl={u.avatar} name={u.fullName} size="xs" />
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[#EAECEF] uppercase truncate">{u.fullName}</p>
                                                        <p className="text-[9px] text-secondary font-bold tracking-wider">@{u.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-0.5">
                                                    <p className="font-mono text-[#EAECEF] font-bold text-[11px]">{u.isAmountMetric ? '$' : ''}{u.performance.toLocaleString()}</p>
                                                    <p className="text-[9px] text-secondary uppercase font-bold">{u.performanceMetric}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {u.breakdown?.map((b: any, i: number) => (
                                                        <div key={i} className="px-2 py-0.5 bg-bg-black border border-[#2B3139] rounded text-[9px] flex items-center gap-2">
                                                            <span className="text-secondary font-bold uppercase">{b.name}</span>
                                                            <span className="text-primary font-bold font-mono">${b.amount.toFixed(1)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isAdjustMode ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <span className="text-secondary font-bold font-mono">$</span>
                                                        <input type="number" value={u.reward} onChange={e => handleCustomPayoutChange(u.username, e.target.value)} className="w-24 bg-bg-black border border-[#2B3139] rounded py-1 px-2 text-[11px] text-right font-bold text-primary focus:border-primary outline-none" />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        <span className={`font-bold font-mono text-[13px] ${u.isCustom ? 'text-amber-500' : 'text-primary'}`}>
                                                            ${u.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                        {u.isCustom && <p className="text-[8px] text-amber-500 font-bold uppercase text-right">ADJUSTED</p>}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>

            {isPdfModalOpen && (
                <IncentivePdfExportModal
                    isOpen={isPdfModalOpen}
                    onClose={() => setIsPdfModalOpen(false)}
                    project={project}
                    period={selectedMonth}
                    results={preparedResults.users}
                    language={language}
                />
            )}
        </div>
    );
};

export default IncentiveExecutionView;
