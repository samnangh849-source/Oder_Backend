import React, { useState, useMemo, useContext, useEffect } from 'react';
import { IncentiveProject, ParsedOrder, User, IncentiveCalculator, IncentiveTier } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import UserAvatar from '../common/UserAvatar';
import { getProjectById } from '../../services/incentiveService';

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
        return Array.from(teams).filter(Boolean).sort();
    }, [appData.users]);

    // 2. State
    const [project, setProject] = useState<IncentiveProject | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
    const [manualDataMap, setManualDataMap] = useState<Record<string, Record<string, number>>>({}); 
    const [showInputPanel, setShowInputPanel] = useState(false);
    const [entryMode, setEntryMode] = useState<'team' | 'user'>('team');
    const [isAdjustMode, setIsAdjustMode] = useState(false);
    const [customPayouts, setCustomPayouts] = useState<Record<string, number>>({}); 
    const [activeMetricTab, setActiveMetricTab] = useState<string>('');
    const [isLocked, setIsLocked] = useState(false);
    const [editorSearch, setEditorSearch] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // 3. Loading
    useEffect(() => {
        const p = getProjectById(projectId);
        if (p) {
            setProject(p);
            const activeCalcs = p.calculators?.filter(c => c.status === 'Active') || [];
            if (activeCalcs.length > 0 && !activeMetricTab) setActiveMetricTab(activeCalcs[0].id);
        }
    }, [projectId]);

    useEffect(() => {
        if (project?.id) {
            const lockKey = `payout_lock_${project.id}_${selectedMonth}`;
            setIsLocked(localStorage.getItem(lockKey) === 'true');
            const savedManual = localStorage.getItem(`manual_data_${project.id}_${selectedMonth}`);
            setManualDataMap(savedManual ? JSON.parse(savedManual) : {});
            const savedCustom = localStorage.getItem(`custom_payouts_${project.id}_${selectedMonth}`);
            setCustomPayouts(savedCustom ? JSON.parse(savedCustom) : {});
        }
    }, [project?.id, selectedMonth]);

    const toggleLock = () => {
        const nextState = !isLocked;
        if (nextState && !window.confirm("តើអ្នកចង់ចាក់សោររបាយការណ៍ខែនេះមែនទេ?")) return;
        setIsLocked(nextState);
        localStorage.setItem(`payout_lock_${project!.id}_${selectedMonth}`, String(nextState));
    };

    const handleManualDataChange = (metric: string, tid: string, val: string, pk: string) => {
        if (isLocked) return;
        setSaveStatus('saving');
        const valNum = Number(val) || 0;
        const newData = { ...manualDataMap, [metric]: { ...(manualDataMap[metric] || {}), [`${pk}_${tid}`]: valNum } };
        setManualDataMap(newData);
        localStorage.setItem(`manual_data_${project!.id}_${selectedMonth}`, JSON.stringify(newData));
        setTimeout(() => setSaveStatus('saved'), 500);
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const clearColumn = (metric: string, pk: string) => {
        if (isLocked || !window.confirm(`Clear all data for ${pk}?`)) return;
        const next = { ...manualDataMap };
        const metricData = { ...(next[metric] || {}) };
        Object.keys(metricData).forEach(key => { if (key.startsWith(`${pk}_`)) delete metricData[key]; });
        next[metric] = metricData;
        setManualDataMap(next);
        localStorage.setItem(`manual_data_${project!.id}_${selectedMonth}`, JSON.stringify(next));
    };

    const clearRow = (metric: string, tid: string) => {
        if (isLocked || !window.confirm(`Clear all data for this row?`)) return;
        const next = { ...manualDataMap };
        const metricData = { ...(next[metric] || {}) };
        Object.keys(metricData).forEach(key => { if (key.endsWith(`_${tid}`)) delete metricData[key]; });
        next[metric] = metricData;
        setManualDataMap(next);
        localStorage.setItem(`manual_data_${project!.id}_${selectedMonth}`, JSON.stringify(next));
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

    const handleCustomPayoutChange = (un: string, val: string) => {
        if (isLocked) return;
        const next = { ...customPayouts, [un]: Number(val) || 0 };
        setCustomPayouts(next);
        localStorage.setItem(`custom_payouts_${project!.id}_${selectedMonth}`, JSON.stringify(next));
    };

    const exportToCSV = () => {
        const headers = ["Personnel", "Username", "Role", "Team", "Reward Amount", "Components"];
        const rows = results.users.map(u => [u.fullName, u.username, u.role || '', u.team || '', u.reward.toFixed(2), u.breakdown?.map(b => `${b.name}: ${b.amount.toFixed(1)}`).join(' | ')]);
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `Incentive_${project?.name}_${selectedMonth}.csv`);
        document.body.appendChild(link); link.click();
    };

    const periodOrders = useMemo(() => orders?.filter(o => o.Timestamp?.startsWith(selectedMonth)) || [], [orders, selectedMonth]);

    // 4. Integrated Calculation Engine
    const results = useMemo(() => {
        const teamResults: Record<string, { revenue: number, reward: number, calculators: any[] }> = {};
        const userResults: Record<string, { reward: number, performance: number, breakdown: any[] }> = {};
        if (!project) return { teams: [], users: [] };

        appData.users?.forEach(u => { userResults[u.UserName] = { reward: 0, performance: 0, breakdown: [] }; });

        project.calculators?.filter(c => c.status === 'Active').forEach(calc => {
            const periodType = calc.calculationPeriod || 'Monthly';
            
            // DYNAMIC WEEK DETECTION from Calculator Tiers
            const definedWeeks = Array.from(new Set(calc.achievementTiers?.map(t => t.subPeriod).filter(Boolean))).sort();
            const subPeriods = periodType === 'Weekly' ? (definedWeeks.length > 0 ? definedWeeks : ['W1', 'W2', 'W3', 'W4']) : ['month'];

            const isUserEligible = (u: User) => {
                if (!calc.applyTo || calc.applyTo.length === 0) return true;
                const uts = u.Team?.split(',').map(t => t.trim()) || [];
                return calc.applyTo.some(f => u.Role === f || uts.includes(f) || u.UserName === f);
            };

            const runCalcLogic = (val: number, pk?: string) => {
                if (calc.type === 'Achievement') {
                    let tiers = [...(calc.achievementTiers || [])];
                    if (pk && pk !== 'month') tiers = tiers.filter(t => t.subPeriod === pk);
                    tiers.sort((a, b) => b.target - a.target);
                    const tier = tiers.find(t => val >= t.target);
                    return tier ? (tier.rewardType === 'Percentage' ? val * (tier.rewardAmount / 100) : tier.rewardAmount) : 0;
                } else {
                    if (calc.commissionType === 'Flat Commission') return calc.commissionMethod === 'Percentage' ? val * ((calc.commissionRate || 0) / 100) : (calc.commissionRate || 0);
                    if (calc.commissionType === 'Above Target Commission') return val > (calc.targetAmount || 0) ? (calc.commissionMethod === 'Percentage' ? (val - (calc.targetAmount || 0)) * ((calc.commissionRate || 0) / 100) : (calc.commissionRate || 0)) : 0;
                    if (calc.commissionType === 'Tiered Commission') {
                        const t = calc.commissionTiers?.find(ct => val >= ct.from && (ct.to === null || val <= ct.to));
                        return t ? val * (t.rate / 100) : 0;
                    }
                }
                return 0;
            };

            if (project.dataSource === 'manual') {
                const mData = manualDataMap[calc.metricType] || {};
                allTeams.forEach(tn => {
                    let tr = 0, trev = 0, running = 0;
                    subPeriods.forEach(p => {
                        const v = mData[`${p}_${tn}`] || 0;
                        trev += v;
                        if (calc.isMarathon) { running += v; tr += runCalcLogic(running, p); } else { tr += runCalcLogic(v, p); }
                    });
                    if (trev > 0 || tr > 0) {
                        if (!teamResults[tn]) teamResults[tn] = { revenue: 0, reward: 0, calculators: [] };
                        teamResults[tn].revenue += trev; teamResults[tn].reward += tr;
                        teamResults[tn].calculators.push({ name: calc.name, amount: tr });
                        const eligible = appData.users?.filter(u => u.Team?.split(',').map(s => s.trim()).includes(tn) && isUserEligible(u)) || [];
                        const share = tr / (eligible.length || 1);
                        eligible.forEach(m => { if (userResults[m.UserName]) { userResults[m.UserName].reward += share; userResults[m.UserName].performance += (trev / (eligible.length || 1)); userResults[m.UserName].breakdown.push({ name: `${calc.name} (${tn})`, amount: share }); } });
                    }
                });
                appData.users?.filter(isUserEligible).forEach(u => {
                    let ur = 0, uperf = 0, running = 0;
                    subPeriods.forEach(p => {
                        const v = mData[`${p}_${u.UserName}`] || 0;
                        uperf += v;
                        if (calc.isMarathon) { running += v; ur += runCalcLogic(running, p); } else { ur += runCalcLogic(v, p); }
                    });
                    if (uperf > 0 || ur > 0) { userResults[u.UserName].reward += ur; userResults[u.UserName].performance += uperf; userResults[u.UserName].breakdown.push({ name: `${calc.name} (Direct)`, amount: ur }); }
                });
            } else {
                const tData: Record<string, Record<string, number>> = {};
                const uData: Record<string, Record<string, number>> = {};
                periodOrders.forEach(o => {
                    const team = o.Team || 'Unassigned', user = o.User || 'Unknown';
                    let pk = 'month';
                    if (periodType === 'Weekly') {
                        const d = new Date(o.Timestamp);
                        const fday = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
                        pk = `W${Math.ceil((d.getDate() + fday) / 7)}`;
                    }
                    let val = (calc.metricType === 'Sales Amount' || calc.metricType === 'Revenue') ? (Number(o['Grand Total']) || 0) : 1;
                    if (!tData[team]) tData[team] = {}; tData[team][pk] = (tData[team][pk] || 0) + val;
                    if (!uData[user]) uData[user] = {}; uData[user][pk] = (uData[user][pk] || 0) + val;
                });
                Object.entries(tData).forEach(([tn, pds]) => {
                    let tr = 0, trev = 0, trun = 0;
                    Object.keys(pds).sort().forEach(p => {
                        const v = pds[p]; trev += v;
                        if (calc.isMarathon) { trun += v; tr += runCalcLogic(trun, p); } else { tr += runCalcLogic(v, p); }
                    });
                    if (trev > 0) {
                        if (!teamResults[tn]) teamResults[tn] = { revenue: 0, reward: 0, calculators: [] };
                        teamResults[tn].revenue += trev; teamResults[tn].reward += tr;
                        teamResults[tn].calculators.push({ name: calc.name, amount: tr });
                        const eligible = appData.users?.filter(u => u.Team?.split(',').map(s => s.trim()).includes(tn) && isUserEligible(u)) || [];
                        eligible.forEach(m => {
                            let ur = 0, trunInt = 0, uperf = 0, uPds = uData[m.UserName] || {};
                            Object.keys(pds).sort().forEach(p => {
                                const tv = pds[p], uv = uPds[p] || 0; uperf += uv;
                                if (calc.isMarathon) { trunInt += tv; ur += runCalcLogic(trunInt, p) * (uv / (tv || 1)); } 
                                else { ur += runCalcLogic(tv, p) * (uv / (tv || 1)); }
                            });
                            if (userResults[m.UserName]) { userResults[m.UserName].reward += ur; userResults[m.UserName].performance += uperf; userResults[m.UserName].breakdown.push({ name: `${calc.name} (Auto)`, amount: ur }); }
                        });
                    }
                });
            }
        });

        return {
            teams: Object.entries(teamResults).map(([name, data]) => ({ name, ...data })),
            users: Object.entries(userResults).map(([username, data]) => {
                const u = appData.users?.find(x => x.UserName === username);
                const finalReward = customPayouts[username] !== undefined ? customPayouts[username] : data.reward;
                return { username, fullName: u?.FullName || username, avatar: u?.ProfilePictureURL, role: u?.Role, team: u?.Team, ...data, reward: finalReward, isCustom: customPayouts[username] !== undefined };
            }).sort((a, b) => b.reward - a.reward || b.performance - a.performance)
        };
    }, [project, manualDataMap, appData.users, allTeams, customPayouts, selectedMonth, periodOrders]);

    const totalPayout = results.users.reduce((sum, u) => sum + u.reward, 0);

    if (!project) return <div className="p-10 text-slate-500 font-medium italic">Loading...</div>;

    return (
        <div className="w-full max-w-6xl mx-auto p-6 md:p-10 animate-fade-in text-slate-200">
            <div className="flex flex-col gap-6 mb-12">
                <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
                    <button onClick={onBack} className="hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5" /></svg> Back
                    </button>
                    <span>/</span><span className="uppercase tracking-widest text-slate-400">Execution Workstation</span>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl border border-white/5 shadow-inner" style={{ backgroundColor: `${project.colorCode}10`, color: project.colorCode }}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth="2.5" /></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
                            <div className="flex items-center gap-3 mt-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-[0.1em]">
                                <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none p-0 text-indigo-400 focus:ring-0 cursor-pointer" />
                                <span>•</span><span>Payout: <span className="text-emerald-400 font-black">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={exportToCSV} className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-2 transition-all shadow-sm">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5" /></svg> Export
                        </button>
                        <button onClick={toggleLock} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 transition-all ${isLocked ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
                            {isLocked ? <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" /></svg> Locked</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" strokeWidth="2.5" /></svg> Lock Payout</>}</button>
                        <button onClick={() => setShowInputPanel(!showInputPanel)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${showInputPanel ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                            {showInputPanel ? 'Close Editor' : 'Edit Performance Data'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Manual Input Editor */} 
            {showInputPanel && (
                <div className="mb-12 border border-slate-800 rounded-xl bg-slate-950 shadow-2xl overflow-hidden animate-fade-in relative group/editor">
                    <div className="px-6 py-4 bg-slate-900/80 border-b border-slate-800 flex flex-wrap justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-slate-800">
                                {project.calculators?.filter(c => c.status === 'Active').map(calc => (
                                    <button key={calc.id} onClick={() => setActiveMetricTab(calc.id)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeMetricTab === calc.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{calc.name}</button>
                                ))}
                            </div>
                            <div className="flex gap-1.5 p-1 bg-black/40 rounded-lg border border-slate-800">
                                <button onClick={() => setEntryMode('team')} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${entryMode === 'team' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Teams</button>
                                <button onClick={() => setEntryMode('user')} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${entryMode === 'user' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Staff</button>
                            </div>
                        </div>
                        <div className="flex-grow max-w-sm relative">
                            <input type="text" placeholder={`Search...`} value={editorSearch} onChange={e => setEditorSearch(e.target.value)} className="w-full bg-black/40 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs font-bold text-white placeholder:text-slate-600 focus:border-indigo-500 transition-all" />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" /></svg>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                            {saveStatus === 'saving' && <span className="text-amber-500 animate-pulse">Saving...</span>}
                            {saveStatus === 'saved' && <span className="text-emerald-500">Sync Done</span>}
                        </div>
                    </div>

                    {isLocked && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1.5px] z-50 flex items-center justify-center text-center p-6"><div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-xs border-t-amber-500/50 border-t-2"><svg className="w-12 h-12 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5" /></svg><h3 className="text-base font-black text-white mb-1 uppercase tracking-tight">Editor Locked</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Unlock payout to edit data.</p></div></div>}

                    <div className="overflow-x-auto custom-scrollbar">
                        {project.calculators?.filter(c => c.id === activeMetricTab).map(calc => {
                            const definedWeeks = Array.from(new Set(calc.achievementTiers?.map(t => t.subPeriod).filter(Boolean))).sort();
                            const subPeriods = calc.calculationPeriod === 'Weekly' ? (definedWeeks.length > 0 ? definedWeeks : ['W1', 'W2', 'W3', 'W4']) : ['month'];
                            const targets = (entryMode === 'team' ? allTeams : appData.users || []).filter(t => (typeof t === 'string' ? t : t.FullName).toLowerCase().includes(editorSearch.toLowerCase()));
                            const metricTotal = Object.entries(manualDataMap[calc.metricType] || {}).reduce((s, [k, v]) => s + v, 0);

                            return (
                                <div key={calc.id} className="animate-fade-in">
                                    <table className="w-full text-left border-collapse min-w-[1000px]">
                                        <thead>
                                            <tr className="border-b border-slate-800 text-[10px] text-slate-500 font-black uppercase tracking-widest bg-black/40">
                                                <th className="px-6 py-4 min-w-[250px] sticky left-0 bg-slate-950 z-10 border-r border-slate-800/50">Identity</th>
                                                {subPeriods.map(p => (
                                                    <th key={p} className="px-4 py-4 text-center border-r border-slate-800/50 group/th">
                                                        <div className="flex flex-col items-center gap-1"><span>{p === 'month' ? 'Total' : p}</span><button onClick={() => clearColumn(calc.metricType, p)} className="hidden group-hover/th:block text-[8px] text-red-500 hover:text-red-400 normal-case">Clear</button></div>
                                                    </th>
                                                ))}
                                                <th className="px-6 py-4 text-right bg-indigo-600/5 font-black text-indigo-400">Sum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50 text-[11px]">
                                            {targets.map(t => {
                                                const id = typeof t === 'string' ? t : t.UserName;
                                                const label = typeof t === 'string' ? t : t.FullName;
                                                const rowTotal = subPeriods.reduce((sum, p) => sum + (manualDataMap[calc.metricType]?.[`${p}_${id}`] || 0), 0);
                                                return (
                                                    <tr key={id} className="hover:bg-white/[0.03] transition-colors group/row">
                                                        <td className="px-6 py-3 sticky left-0 bg-slate-950 group-hover/row:bg-slate-900 z-10 border-r border-slate-800/50 font-bold text-slate-300"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><span className="truncate block uppercase">{label}</span>{entryMode === 'user' && (t as User).Team && <span className="text-[8px] text-slate-600 font-black">{(t as User).Team}</span>}</div><button onClick={() => clearRow(calc.metricType, id)} className="hidden group-hover/row:block text-[8px] text-slate-600 hover:text-red-500">Reset</button></div></td>
                                                        {subPeriods.map(p => {
                                                            const val = manualDataMap[calc.metricType]?.[`${p}_${id}`] || 0;
                                                            const opacity = val > 0 ? Math.min(0.05 + (val / 15000), 0.35) : 0;
                                                            return (
                                                                <td key={p} className="px-2 py-2 border-r border-slate-800/20" style={{ backgroundColor: val > 0 ? `rgba(79, 70, 229, ${opacity})` : 'transparent' }}>
                                                                    <input type="number" data-id={id} data-pk={p} value={manualDataMap[calc.metricType]?.[`${p}_${id}`] || ''} onChange={e => handleManualDataChange(calc.metricType, id, e.target.value, p)} onKeyDown={e => handleKeyDown(e, id, p, calc.metricType, subPeriods, targets)} className="w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 focus:bg-slate-800 text-xs text-right font-bold text-white transition-all rounded p-1.5" placeholder="0" />
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-6 py-3 text-right bg-indigo-600/5 transition-all"><span className="font-mono text-[10px] text-indigo-400 font-black">${rowTotal.toLocaleString()}</span></td>
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

            <div className="space-y-10">
                <section>
                    <div className="flex justify-between items-end mb-6 px-1">
                        <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Individual Payout Ledger</h2>
                        <button onClick={() => setIsAdjustMode(!isAdjustMode)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border ${isAdjustMode ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse' : 'text-slate-500 border-slate-800 hover:text-white hover:border-slate-600'}`}>{isAdjustMode ? '🔒 Done' : '⚙️ Adjust'}</button>
                    </div>
                    <div className="border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/30 border-b border-slate-800 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                    <th className="px-6 py-4 w-12 text-center">#</th>
                                    <th className="px-6 py-4 min-w-[250px]">Personnel</th>
                                    <th className="px-6 py-4">Achievement</th>
                                    <th className="px-6 py-4">Breakdown</th>
                                    <th className="px-6 py-4 text-right">Final Payout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {results.users.map((u, idx) => (
                                    <tr key={u.username} className="hover:bg-white/[0.02] transition-colors group text-xs">
                                        <td className="px-6 py-4 text-[10px] font-bold text-slate-600 text-center">{idx + 1}</td>
                                        <td className="px-6 py-4"><div className="flex items-center gap-3"><UserAvatar avatarUrl={u.avatar} name={u.fullName} size="sm" /><div className="min-w-0"><p className="font-bold text-slate-200 uppercase truncate max-w-[150px]">{u.fullName}</p><p className="text-[9px] text-slate-500 truncate">@{u.username}</p></div></div></td>
                                        <td className="px-6 py-4"><p className="font-mono text-slate-400 font-bold">${u.performance.toLocaleString()}</p><p className="text-[8px] text-slate-600 uppercase font-black mt-0.5">Reported Sales</p></td>
                                        <td className="px-6 py-4"><div className="flex flex-wrap gap-1.5">{u.breakdown?.map((b, i) => (<div key={i} className="px-2 py-0.5 bg-black/20 border border-slate-800 rounded flex items-center gap-2"><span className="text-[8px] text-slate-500 font-black uppercase whitespace-nowrap">{b.name}</span><span className="text-[9px] text-indigo-400 font-bold">${b.amount.toFixed(1)}</span></div>))}</div></td>
                                        <td className="px-6 py-4 text-right">{isAdjustMode ? <input type="number" value={u.reward} onChange={e => handleCustomPayoutChange(u.username, e.target.value)} className="w-24 bg-slate-800 border-none rounded px-2 py-1 text-sm text-right font-black text-emerald-400 focus:ring-1 focus:ring-emerald-500" /> : <span className={`font-black text-sm ${u.isCustom ? 'text-amber-400' : 'text-emerald-400'}`}>${u.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default IncentiveExecutionView;