import React, { useState, useMemo, useContext, useEffect } from 'react';
import { IncentiveProject, ParsedOrder, User, IncentiveCalculator, IncentiveTier } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import UserAvatar from '../common/UserAvatar';
import { getProjectById } from '../../services/incentiveService';
import IncentivePdfExportModal from './IncentivePdfExportModal';

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
        appData.pages?.forEach(p => p.Team?.split(',').forEach(tn => teams.add(tn.trim()))); // Also check pages for teams
        return Array.from(teams).filter(Boolean).sort();
    }, [appData.users, appData.pages]);

    // 1.5. Staff Identification
    const allStaff = useMemo(() => {
        const staffMap = new Map<string, User>();
        // Master list from appData
        appData.users?.forEach(u => staffMap.set(u.UserName, u));
        // Fallback from order history
        orders.forEach(o => {
            if (o.User && !staffMap.has(o.User)) {
                staffMap.set(o.User, { 
                    UserName: o.User, 
                    FullName: o.User, 
                    Team: o.Team || '', 
                    Role: '', 
                    IsSystemAdmin: false, 
                    ProfilePictureURL: '' 
                } as User);
            }
        });
        return Array.from(staffMap.values()).sort((a, b) => a.FullName.localeCompare(b.FullName));
    }, [appData.users, orders]);

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
    const [editorPeriodMode, setEditorPeriodMode] = useState<'Monthly' | 'Weekly'>('Monthly');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

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
        if (nextState && !window.confirm(t.confirm_lock_payout || "តើអ្នកចង់ចាក់សោររបាយការណ៍ខែនេះមែនទេ?")) return;
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
        if (isLocked || !window.confirm(`${t.confirm_clear_column || 'Clear all data for'} ${pk}?`)) return;
        const next = { ...manualDataMap };
        const metricData = { ...(next[metric] || {}) };
        Object.keys(metricData).forEach(key => { if (key.startsWith(`${pk}_`)) delete metricData[key]; });
        next[metric] = metricData;
        setManualDataMap(next);
        localStorage.setItem(`manual_data_${project!.id}_${selectedMonth}`, JSON.stringify(next));
    };

    const clearRow = (metric: string, tid: string) => {
        if (isLocked || !window.confirm(t.confirm_clear_row || "តើអ្នកចង់លុបទិន្នន័យជួរដេកនេះមែនទេ?")) return;
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
                    
                    if (periodType === 'Monthly') {
                        // For Monthly calculators, we sum 'month' value and any 'W1'-'W5' values found
                        const monthlyVal = mData[`month_${tn}`] || 0;
                        const weeklySum = ['W1', 'W2', 'W3', 'W4', 'W5'].reduce((sum, w) => sum + (mData[`${w}_${tn}`] || 0), 0);
                        const finalVal = monthlyVal || weeklySum;
                        trev = finalVal;
                        tr = runCalcLogic(finalVal);
                    } else {
                        // Weekly or other period logic
                        (subPeriods as string[]).forEach((p: string) => {
                            const v = mData[`${p}_${tn}`] || 0;
                            trev += v;
                            if (calc.isMarathon) { running += v; tr += runCalcLogic(running, p); } else { tr += runCalcLogic(v, p); }
                        });
                    }

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

                    if (periodType === 'Monthly') {
                        const monthlyVal = mData[`month_${u.UserName}`] || 0;
                        const weeklySum = ['W1', 'W2', 'W3', 'W4', 'W5'].reduce((sum, w) => sum + (mData[`${w}_${u.UserName}`] || 0), 0);
                        const finalVal = monthlyVal || weeklySum;
                        uperf = finalVal;
                        ur = runCalcLogic(finalVal);
                    } else {
                        (subPeriods as string[]).forEach((p: string) => {
                            const v = mData[`${p}_${u.UserName}`] || 0;
                            uperf += v;
                            if (calc.isMarathon) { running += v; ur += runCalcLogic(running, p); } else { ur += runCalcLogic(v, p); }
                        });
                    }

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
    const topStaff = results.users.length > 0 ? results.users[0] : null;
    const avgPerf = results.users.length > 0 ? results.users.reduce((sum, u) => sum + u.performance, 0) / results.users.length : 0;

    if (!project) return <div className="p-10 text-slate-500 font-medium italic">Loading...</div>;

    return (
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-8 md:p-10 animate-fade-in text-slate-200">
            {/* Standard Header Navigation */}
            <div className="flex flex-col gap-6 mb-10">
                <div className="flex items-center gap-3 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    <button onClick={onBack} className="hover:text-white transition-colors flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5 active:scale-95">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3" /></svg> {t.back}
                    </button>
                    <span className="opacity-30">/</span>
                    <span className="text-slate-400">{t.execution_workstation}</span>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border border-white/10 shadow-inner" style={{ backgroundColor: `${project.colorCode}15`, color: project.colorCode }}>
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth="2.5" /></svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight uppercase italic">{project.name}</h1>
                            <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent border-none p-0 text-indigo-400 text-[10px] font-black uppercase focus:ring-0 cursor-pointer" />
                                </div>
                                <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.total_payout}: <span className="text-emerald-400 font-black ml-1">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => setIsPdfModalOpen(true)} className="flex-1 md:flex-none px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2.5" /></svg> PDF Report
                        </button>
                        <button onClick={exportToCSV} className="flex-1 md:flex-none px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2.5" /></svg> CSV Export
                        </button>
                        <button onClick={toggleLock} className={`flex-1 md:flex-none px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${isLocked ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}>
                            {isLocked ? <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" /></svg> {t.locked}</> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" strokeWidth="2.5" /></svg> {t.lock_payout}</>}</button>
                        {project.dataSource === 'manual' && (
                            <button onClick={() => setShowInputPanel(!showInputPanel)} className={`flex-1 md:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border active:scale-95 shadow-xl ${showInputPanel ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-900/40' : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white'}`}>
                                {showInputPanel ? t.close_editor : t.edit_perf_data}
                            </button>
                        )}
                    </div>
                </div>

                {/* OVERVIEW CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden group">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total Payout Volume</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-emerald-400 italic">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">USD</span>
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden group">
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Top Performer</span>
                                {topStaff ? (
                                    <div className="flex items-center gap-3">
                                        <UserAvatar avatarUrl={topStaff.avatar} name={topStaff.fullName} size="sm" />
                                        <div>
                                            <p className="text-sm font-black text-white uppercase italic truncate max-w-[120px]">{topStaff.fullName}</p>
                                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">${topStaff.reward.toFixed(2)} reward</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm font-bold text-slate-700 italic">No data yet</p>
                                )}
                            </div>
                            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" strokeWidth="2.5" /></svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2.5rem] backdrop-blur-xl relative overflow-hidden group">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Avg. Achievement</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-blue-400 italic">${avgPerf.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">Per Staff</span>
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                    </div>
                </div>
            </div>

            {/* MODERN Manual Input Editor */} 
            {showInputPanel && project.dataSource === 'manual' && (
                <div className="mb-12 border border-white/5 rounded-[2.5rem] bg-[#0f172a]/80 backdrop-blur-2xl shadow-3xl overflow-hidden animate-fade-in relative group/editor ring-1 ring-white/10">
                    {/* Editor Toolbar */}
                    <div className="px-8 py-6 bg-black/40 border-b border-white/5 flex flex-wrap justify-between items-center gap-8">
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t.select_calculator}</label>
                                <div className="flex gap-1.5 p-1.5 bg-black/60 rounded-xl border border-white/5">
                                    {project.calculators?.filter(c => c.status === 'Active').map(calc => (
                                        <button key={calc.id} onClick={() => setActiveMetricTab(calc.id)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${activeMetricTab === calc.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{calc.name}</button>
                                    ))}
                                    {(!project.calculators || project.calculators.filter(c => c.status === 'Active').length === 0) && (
                                        <span className="px-4 py-2 text-[10px] font-bold text-red-400 uppercase italic">{t.no_active_calcs}</span>
                                    )}
                                </div>
                            </div>

                            <div className="w-px h-10 bg-white/5 hidden lg:block"></div>

                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t.entry_mode}</label>
                                <div className="flex gap-1.5 p-1.5 bg-black/60 rounded-xl border border-white/5">
                                    <button onClick={() => setEntryMode('team')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 ${entryMode === 'team' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-400'}`}>{t.teams}</button>
                                    <button onClick={() => setEntryMode('user')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 ${entryMode === 'user' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-400'}`}>{t.staff}</button>
                                </div>
                            </div>

                            <div className="w-px h-10 bg-white/5 hidden lg:block"></div>

                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{t.calc_period}</label>
                                <div className="flex gap-1.5 p-1.5 bg-black/60 rounded-xl border border-white/5">
                                    <button onClick={() => setEditorPeriodMode('Monthly')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 ${editorPeriodMode === 'Monthly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{t.this_month}</button>
                                    <button onClick={() => setEditorPeriodMode('Weekly')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 ${editorPeriodMode === 'Weekly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{t.this_week}</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-grow max-w-sm relative self-end">
                            <input type="text" placeholder={t.search_placeholder_editor} value={editorSearch} onChange={e => setEditorSearch(e.target.value)} className="w-full bg-black/60 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/50 focus:ring-0 transition-all shadow-inner" />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" /></svg>
                        </div>

                        <div className="flex flex-col items-end gap-1 min-w-[100px] self-end">
                            <div className="flex items-center gap-2">
                                {saveStatus === 'saving' && <><div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div><span className="text-[9px] font-black text-amber-500 uppercase">{t.saving}</span></>}
                                {saveStatus === 'saved' && <><svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-[9px] font-black text-emerald-500 uppercase">{t.synced}</span></>}
                                {saveStatus === 'idle' && <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{t.auto_save_on}</span>}
                            </div>
                        </div>
                    </div>

                    {isLocked && <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] z-50 flex items-center justify-center p-8 text-center"><div className="bg-[#1e293b] border border-white/10 p-10 rounded-[3rem] shadow-3xl max-w-sm ring-1 ring-white/10"><div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20"><svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5" /></svg></div><h3 className="text-xl font-black text-white mb-2 uppercase tracking-tight italic">{t.locked}</h3><p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Unlock payout status to modify performance data.</p></div></div>}

                    <div className="overflow-x-auto custom-scrollbar bg-black/20">
                        {project.calculators?.filter(c => c.status === 'Active' && c.id === activeMetricTab).map(calc => {
                            const definedWeeks = Array.from(new Set(calc.achievementTiers?.map(t => t.subPeriod).filter(Boolean))).sort();
                            const subPeriods = editorPeriodMode === 'Weekly' ? (definedWeeks.length > 0 ? definedWeeks : ['W1', 'W2', 'W3', 'W4', 'W5']) : ['month'];
                            const targets = (entryMode === 'team' ? allTeams : appData.users || []).filter(t => {
                                const label = typeof t === 'string' ? t : t.FullName;
                                return label.toLowerCase().includes(editorSearch.toLowerCase());
                            });
                            
                            if (targets.length === 0) {
                                return (
                                    <div key={calc.id} className="p-32 text-center">
                                        <div className="w-16 h-16 bg-slate-800/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 opacity-50"><svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" /></svg></div>
                                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs italic">{t.no_data} {entryMode === 'team' ? t.teams : t.staff}</p>
                                    </div>
                                );
                            }

                            return (
                                <div key={calc.id} className="animate-fade-in">
                                    <table className="w-full text-left border-collapse min-w-[1000px]">
                                        <thead>
                                            <tr className="border-b border-white/5 text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] bg-black/40">
                                                <th className="px-8 py-5 min-w-[280px] sticky left-0 bg-[#0f172a] z-10 border-r border-white/5 backdrop-blur-md">{t.identity_entity}</th>
                                                {(subPeriods as string[]).map(p => (
                                                    <th key={p} className="px-4 py-5 text-center border-r border-white/5 group/th hover:bg-white/[0.02] transition-all">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className="text-slate-400">{p === 'month' ? (t.this_month || 'Total') : p}</span>
                                                            <button onClick={() => clearColumn(calc.metricType, p)} className="hidden group-hover/th:block text-[8px] bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-2 py-0.5 rounded transition-all normal-case font-bold">Clear</button>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="px-8 py-5 text-right bg-indigo-600/10 font-black text-indigo-400 tracking-widest">{t.aggregated_sum}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-[11px]">
                                            {(targets as (string | User)[]).filter(t => {
                                                const label = typeof t === 'string' ? t : t.FullName;
                                                return label.toLowerCase().includes(editorSearch.toLowerCase());
                                            }).map(t => {
                                                const id = typeof t === 'string' ? t : t.UserName;
                                                const label = typeof t === 'string' ? t : t.FullName;
                                                const rowTotal = (subPeriods as string[]).reduce((sum, p) => sum + (manualDataMap[calc.metricType]?.[`${p}_${id}`] || 0), 0);
                                                return (
                                                    <tr key={id} className="hover:bg-white/[0.03] transition-colors group/row">
                                                        <td className="px-8 py-4 sticky left-0 bg-[#0f172a] group-hover/row:bg-slate-900 z-10 border-r border-white/5 font-black text-slate-300 shadow-xl backdrop-blur-md">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="min-w-0">
                                                                    <span className="truncate block uppercase tracking-tight text-white/90 font-black italic">{label}</span>
                                                                    {entryMode === 'user' && (t as User).Team && <span className="text-[8px] text-slate-600 font-bold bg-black/40 px-1.5 py-0.5 rounded border border-white/5 mt-1 inline-block">{(t as User).Team}</span>}
                                                                </div>
                                                                <button onClick={() => clearRow(calc.metricType, id)} className="hidden group-hover/row:flex w-6 h-6 items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all active:scale-90">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5" /></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                        {(subPeriods as string[]).map(p => {
                                                            const val = manualDataMap[calc.metricType]?.[`${p}_${id}`] || 0;
                                                            const hasValue = val > 0;
                                                            const opacity = hasValue ? Math.min(0.05 + (val / 15000), 0.45) : 0;
                                                            return (
                                                                <td key={p} className="px-2 py-3 border-r border-white/5 transition-all" style={{ backgroundColor: hasValue ? `rgba(79, 70, 229, ${opacity})` : 'transparent' }}>
                                                                    <input 
                                                                        type="number" 
                                                                        data-id={id} 
                                                                        data-pk={p} 
                                                                        value={manualDataMap[calc.metricType]?.[`${p}_${id}`] || ''} 
                                                                        onChange={e => handleManualDataChange(calc.metricType, id, e.target.value, p)} 
                                                                        onKeyDown={e => handleKeyDown(e, id, p, calc.metricType, subPeriods as string[], targets as any[])} 
                                                                        className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-slate-800 text-[13px] text-right font-black text-white transition-all rounded-xl p-2.5 shadow-sm" 
                                                                        placeholder="0" 
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-8 py-4 text-right bg-indigo-600/[0.03] transition-all group-hover/row:bg-indigo-600/10">
                                                            <span className="font-mono text-xs text-indigo-400 font-black drop-shadow-sm">${rowTotal.toLocaleString()}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                        
                        {(!project.calculators || project.calculators.filter(c => c.status === 'Active').length === 0) && (
                            <div className="p-40 text-center flex flex-col items-center gap-6">
                                <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center border border-red-500/20 text-red-500 shadow-2xl">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-sm italic">{t.no_active_calcs}</p>
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed">{t.activate_calcs_desc}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Editor Footer Help */}
                    <div className="px-8 py-4 bg-black/40 border-t border-white/5 flex items-center gap-8 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                        <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">ENTER</span><span>{t.next_row}</span></div>
                        <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">ARROWS</span><span>{t.navigate_cells}</span></div>
                        <div className="ml-auto italic">Data is automatically saved after every keystroke</div>
                    </div>
                </div>
            )}

            <div className="space-y-12">
                <section className="animate-fade-in-up">
                    <div className="flex justify-between items-end mb-8 px-2">
                        <div className="space-y-1">
                            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] italic">{t.payout_ledger}</h2>
                            <div className="w-12 h-1 bg-indigo-600 rounded-full"></div>
                        </div>
                        <button onClick={() => setIsAdjustMode(!isAdjustMode)} className={`text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-2xl transition-all border active:scale-95 shadow-lg ${isAdjustMode ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse' : 'text-slate-500 border-slate-800 hover:text-white hover:border-slate-600'}`}>{isAdjustMode ? `🔒 ${t.done_adjusting}` : `⚙️ ${t.adjust_results}`}</button>
                    </div>
                    
                    <div className="border border-white/5 rounded-[3rem] bg-slate-900/30 overflow-hidden shadow-3xl backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
                                    <th className="px-8 py-6 w-16 text-center">#</th>
                                    <th className="px-8 py-6 min-w-[300px]">Personnel / Identity</th>
                                    <th className="px-8 py-6">{t.achievement_perf}</th>
                                    <th className="px-8 py-6">{t.reward_breakdown}</th>
                                    <th className="px-8 py-6 text-right tracking-widest">{t.final_net_payout}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-[11px]">
                                {results.users.map((u, idx) => (
                                    <tr key={u.username} className="hover:bg-white/[0.02] transition-all group">
                                        <td className="px-8 py-5 text-[10px] font-black text-slate-600 text-center italic">{idx + 1}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <UserAvatar avatarUrl={u.avatar} name={u.fullName} size="md" />
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-200 uppercase truncate max-w-[180px] italic">{u.fullName}</p>
                                                    <p className="text-[9px] text-slate-500 font-bold tracking-widest mt-0.5">@{u.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="space-y-1">
                                                <p className="font-mono text-slate-300 font-black text-[13px] italic">${u.performance.toLocaleString()}</p>
                                                <p className="text-[8px] text-slate-600 uppercase font-black tracking-tighter">{t.gross_perf_vol}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-wrap gap-2">
                                                {u.breakdown?.map((b, i) => (
                                                    <div key={i} className="px-3 py-1 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2 group-hover:border-indigo-500/20 transition-all">
                                                        <span className="text-[8px] text-slate-500 font-black uppercase whitespace-nowrap italic">{b.name}</span>
                                                        <span className="text-[10px] text-indigo-400 font-black">${b.amount.toFixed(1)}</span>
                                                    </div>
                                                ))}
                                                {(u.breakdown?.length === 0) && <span className="text-[9px] text-slate-700 italic font-bold">{t.no_reward_achieved}</span>}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            {isAdjustMode ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-slate-600 font-black text-xs">$</span>
                                                    <input type="number" value={u.reward} onChange={e => handleCustomPayoutChange(u.username, e.target.value)} className="w-32 bg-black/60 border border-amber-500/20 rounded-xl py-2 px-3 text-[13px] text-right font-black text-emerald-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-inner" />
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <span className={`font-black text-lg italic tracking-tighter ${u.isCustom ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]'}`}>
                                                        ${u.reward.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    {u.isCustom && <p className="text-[7px] text-amber-600 font-black uppercase tracking-[0.2em] italic">{t.manual_adjustment}</p>}
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

            {isPdfModalOpen && project && (
                <IncentivePdfExportModal 
                    isOpen={isPdfModalOpen}
                    onClose={() => setIsPdfModalOpen(false)}
                    results={results.users}
                    projectName={project.name}
                    selectedMonth={selectedMonth}
                    language={language}
                />
            )}
        </div>
    );
};

export default IncentiveExecutionView;
