import React, { useState, useContext } from 'react';
import { IncentiveCalculator, CalculatorType, IncentiveTier, CommissionTier } from '../../types';
import { addCalculatorToProject, updateCalculator } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import UserAvatar from '../common/UserAvatar';

interface CalculatorBuilderProps {
    projectId: string;
    initialData?: IncentiveCalculator;
    type: CalculatorType;
    onClose: () => void;
    onSave: () => void;
}

const CalculatorBuilder: React.FC<CalculatorBuilderProps> = ({ projectId, initialData, type, onClose, onSave }) => {
    const { language } = useContext(AppContext);
    const t = translations[language];

    const [step, setStep] = useState(1);
    
    // State for the calculator being built
    const [calcData, setCalcData] = useState<Partial<IncentiveCalculator>>(initialData || {
        name: '',
        type,
        status: 'Draft',
        departmentOrRole: [],
        applyTo: [],
        metricType: 'Sales Amount',
        metricUnit: 'USD',
        calculationPeriod: 'Monthly',
        resetEveryPeriod: true,
        // Type 1 defaults
        achievementTiers: [],
        // Type 2 defaults
        commissionType: 'Flat Commission',
        commissionMethod: 'Percentage',
        commissionCondition: 'On Total Sales',
        commissionRate: 0,
        commissionTiers: []
    });

    const updateField = (field: keyof IncentiveCalculator, value: any) => {
        setCalcData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!calcData.name) {
            alert("Please provide a name.");
            return;
        }

        if (initialData && initialData.id) {
            updateCalculator(projectId, initialData.id, calcData);
        } else {
            addCalculatorToProject(projectId, calcData as Omit<IncentiveCalculator, 'id'>);
        }
        onSave();
    };

    // --- STEP 1: Basic Info ---
    const renderBasicInfo = () => (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-black text-white uppercase tracking-tight border-b border-slate-800 pb-3">1. {t.calc_basic_info}</h3>
            
            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.calc_name}</label>
                <input 
                    type="text" 
                    value={calcData.name}
                    onChange={e => updateField('name', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                    placeholder={type === 'Achievement' ? "e.g., Weekly Sales Incentive" : "e.g., Senior Sales Commission"}
                />
            </div>

            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.status}</label>
                <select 
                    value={calcData.status}
                    onChange={e => updateField('status', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Disable">Disable</option>
                </select>
            </div>
            
            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.apply_to}</label>
                <input 
                    type="text" 
                    value={calcData.applyTo?.join(', ')}
                    onChange={e => updateField('applyTo', e.target.value.split(',').map(s => s.trim()))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                    placeholder="e.g., Sales, Marketing, Leader (Comma separated)"
                />
            </div>
        </div>
    );

    // --- STEP 2: Metric & Period ---
    const renderMetricPeriod = () => (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-black text-white uppercase tracking-tight border-b border-slate-800 pb-3">2. {t.perf_metric_period}</h3>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.metric_type}</label>
                    <select 
                        value={calcData.metricType}
                        onChange={e => updateField('metricType', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                    >
                        <option value="Sales Amount">Sales Amount ($)</option>
                        <option value="Number of Orders">Number of Orders</option>
                        <option value="Number of Videos">Number of Videos</option>
                        <option value="Leads Generated">Leads Generated</option>
                        <option value="Revenue">Revenue</option>
                        <option value="Profit">Profit</option>
                        <option value="Custom KPI">Custom KPI</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.unit}</label>
                    <select 
                        value={calcData.metricUnit}
                        onChange={e => updateField('metricUnit', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                    >
                        <option value="USD">USD</option>
                        <option value="Count">Count</option>
                        <option value="%">Percentage (%)</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.calc_period}</label>
                <div className="flex flex-wrap gap-3">
                    {['Daily', 'Weekly', 'Monthly', 'Per Order', 'Custom Range'].map(p => (
                        <button 
                            key={p}
                            onClick={() => updateField('calculationPeriod', p)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${calcData.calculationPeriod === p ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={calcData.resetEveryPeriod}
                    onChange={e => updateField('resetEveryPeriod', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                />
                <span className="text-sm font-bold text-white">{t.reset_progress}</span>
            </label>

            {type === 'Achievement' && (
                <div className="bg-blue-600/5 border border-blue-500/20 p-4 rounded-2xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={calcData.isMarathon}
                            onChange={e => updateField('isMarathon', e.target.checked)}
                            className="w-5 h-5 rounded border-blue-500/50 bg-slate-900 text-blue-600 focus:ring-0"
                        />
                        <div>
                            <span className="text-sm font-black text-blue-400 uppercase tracking-tight">Marathon Mode (Cumulative)</span>
                            <p className="text-[10px] text-slate-500 font-bold leading-tight mt-0.5">Targets will be checked against total sales progress over time (e.g., Week 1 + Week 2 + ...)</p>
                        </div>
                    </label>
                </div>
            )}
        </div>
    );

    // --- STEP 3: Rule Configuration (Type specific) ---
    const renderRuleConfig = () => {
        if (type === 'Achievement') {
            const isWeekly = calcData.calculationPeriod === 'Weekly';
            const tiers = calcData.achievementTiers || [];
            
            // Group tiers by subPeriod if weekly
            const groupedTiers: Record<string, IncentiveTier[]> = {};
            if (isWeekly) {
                tiers.forEach(t => {
                    const key = t.subPeriod || 'W1';
                    if (!groupedTiers[key]) groupedTiers[key] = [];
                    groupedTiers[key].push(t);
                });
            }

            const addTier = (subPeriod?: string) => {
                const newTier: IncentiveTier = { 
                    id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
                    target: 0, 
                    rewardAmount: 0, 
                    rewardType: 'Fixed Cash',
                    subPeriod: subPeriod,
                    name: subPeriod ? `Week ${subPeriod.replace('W', '')}` : ''
                };
                updateField('achievementTiers', [...tiers, newTier]);
            };

            const addWeek = () => {
                const existingWeeks = new Set(tiers.map(t => t.subPeriod).filter(Boolean));
                const nextWeekNum = existingWeeks.size + 1;
                addTier(`W${nextWeekNum}`);
            };

            return (
                <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">3. {t.milestone_setup}</h3>
                        <button 
                            onClick={isWeekly ? addWeek : () => addTier()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            {isWeekly ? "Add Week" : t.add_tier}
                        </button>
                    </div>

                    <div className="space-y-8">
                        {isWeekly ? (
                            Object.keys(groupedTiers).sort().map((weekKey) => (
                                <div key={weekKey} className="bg-slate-900/30 rounded-[2rem] border border-slate-800 p-6 space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                            <input 
                                                type="text" 
                                                value={groupedTiers[weekKey][0].name || weekKey}
                                                onChange={e => {
                                                    const nt = tiers.map(t => t.subPeriod === weekKey ? { ...t, name: e.target.value } : t);
                                                    updateField('achievementTiers', nt);
                                                }}
                                                className="bg-transparent border-none p-0 text-sm font-black text-white uppercase tracking-widest focus:ring-0 w-40"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => addTier(weekKey)}
                                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border border-slate-700"
                                        >
                                            + Add Multi-Tier
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {groupedTiers[weekKey].map((tier) => (
                                            <div key={tier.id} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5 group">
                                                <div className="flex-1">
                                                    <label className="block text-[7px] font-black text-slate-600 uppercase mb-1">Target Sales</label>
                                                    <input 
                                                        type="number" 
                                                        value={tier.target}
                                                        onChange={e => {
                                                            const nt = tiers.map(t => t.id === tier.id ? { ...t, target: Number(e.target.value) } : t);
                                                            updateField('achievementTiers', nt);
                                                        }}
                                                        className="w-full bg-slate-800 border-none rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                                                    />
                                                </div>
                                                <div className="text-slate-700 pt-3">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-[7px] font-black text-slate-600 uppercase mb-1">Reward</label>
                                                    <div className="flex gap-1">
                                                        <input 
                                                            type="number" 
                                                            value={tier.rewardAmount}
                                                            onChange={e => {
                                                                const nt = tiers.map(t => t.id === tier.id ? { ...t, rewardAmount: Number(e.target.value) } : t);
                                                                updateField('achievementTiers', nt);
                                                            }}
                                                            className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-1.5 text-xs text-emerald-400 font-bold"
                                                        />
                                                        <select 
                                                            value={tier.rewardType}
                                                            onChange={e => {
                                                                const nt = tiers.map(t => t.id === tier.id ? { ...t, rewardType: e.target.value as any } : t);
                                                                updateField('achievementTiers', nt);
                                                            }}
                                                            className="bg-slate-800 border-none rounded-lg px-1 py-1.5 text-[9px] text-white font-bold"
                                                        >
                                                            <option value="Fixed Cash">$</option>
                                                            <option value="Percentage">%</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        const nt = tiers.filter(t => t.id !== tier.id);
                                                        updateField('achievementTiers', nt);
                                                    }}
                                                    className="mt-3 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="space-y-3">
                                {tiers.map((tier, index) => (
                                    <div key={tier.id} className="flex flex-col gap-2 bg-slate-900/50 p-4 rounded-2xl border border-slate-700 group hover:border-blue-500/50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="text" 
                                                value={tier.name || ''}
                                                onChange={e => {
                                                    const nt = [...tiers];
                                                    nt[index].name = e.target.value;
                                                    updateField('achievementTiers', nt);
                                                }}
                                                placeholder="Label (e.g. Bronze Tier)"
                                                className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-blue-400 focus:ring-1 focus:ring-blue-500"
                                            />
                                            <button 
                                                onClick={() => {
                                                    const nt = [...tiers].filter((_, i) => i !== index);
                                                    updateField('achievementTiers', nt);
                                                }}
                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <input type="number" value={tier.target} onChange={e => { const nt = [...tiers]; nt[index].target = Number(e.target.value); updateField('achievementTiers', nt); }} className="w-full bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-white font-bold" placeholder="Target"/>
                                            </div>
                                            <div className="flex-1 flex gap-1">
                                                <input type="number" value={tier.rewardAmount} onChange={e => { const nt = [...tiers]; nt[index].rewardAmount = Number(e.target.value); updateField('achievementTiers', nt); }} className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-sm text-emerald-400 font-bold" placeholder="Reward"/>
                                                <select value={tier.rewardType} onChange={e => { const nt = [...tiers]; nt[index].rewardType = e.target.value as any; updateField('achievementTiers', nt); }} className="bg-slate-800 border-none rounded-lg px-1 py-2 text-[10px] text-white font-bold"><option value="Fixed Cash">$</option><option value="Percentage">%</option></select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {tiers.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-[2.5rem] text-slate-600 font-bold italic">
                                {isWeekly ? "Click '+ Add Week' to begin setup." : "No milestones added yet."}
                            </div>
                        )}
                    </div>
                </div>
            );
        } else {
            // Commission
            return (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight border-b border-slate-800 pb-3">3. {t.commission_rule}</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.commission_type}</label>
                            <select 
                                value={calcData.commissionType}
                                onChange={e => updateField('commissionType', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                            >
                                <option value="Flat Commission">Flat Commission</option>
                                <option value="Above Target Commission">Above Target Commission</option>
                                <option value="Tiered Commission">Tiered Commission</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.reward_method}</label>
                            <select 
                                value={calcData.commissionMethod}
                                onChange={e => updateField('commissionMethod', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                            >
                                <option value="Percentage">Percentage (%)</option>
                                <option value="Fixed Amount">Fixed Amount ($)</option>
                            </select>
                        </div>
                    </div>

                    {(calcData.commissionType === 'Flat Commission' || calcData.commissionType === 'Above Target Commission') && (
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4">
                            {calcData.commissionType === 'Above Target Commission' && (
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.target_amount} ({calcData.metricUnit})</label>
                                    <input 
                                        type="number" 
                                        value={calcData.targetAmount || 0}
                                        onChange={e => updateField('targetAmount', Number(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white font-bold focus:border-blue-500"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    {t.commission_rate_label} {calcData.commissionMethod === 'Percentage' ? '(%)' : '($)'}
                                </label>
                                <input 
                                    type="number" 
                                    value={calcData.commissionRate || 0}
                                    onChange={e => updateField('commissionRate', Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white font-bold focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {calcData.commissionType === 'Tiered Commission' && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{t.tiers}</label>
                                <button 
                                    onClick={() => {
                                        const newTier: CommissionTier = { id: `t_${Date.now()}`, from: 0, to: 0, rate: 0 };
                                        updateField('commissionTiers', [...(calcData.commissionTiers || []), newTier]);
                                    }}
                                    className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-[10px] font-black uppercase"
                                >
                                    + Tier
                                </button>
                            </div>
                            {(calcData.commissionTiers || []).map((tier, index) => (
                                <div key={tier.id} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                                    <input 
                                        type="number" value={tier.from} onChange={e => { const nt = [...(calcData.commissionTiers||[])]; nt[index].from = Number(e.target.value); updateField('commissionTiers', nt); }}
                                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" placeholder="From"
                                    />
                                    <span className="text-slate-500 text-xs">to</span>
                                    <input 
                                        type="number" value={tier.to || ''} onChange={e => { const nt = [...(calcData.commissionTiers||[])]; nt[index].to = e.target.value ? Number(e.target.value) : null; updateField('commissionTiers', nt); }}
                                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white" placeholder="To (∞)"
                                    />
                                    <span className="text-slate-500 text-xs">→ Rate:</span>
                                    <input 
                                        type="number" value={tier.rate} onChange={e => { const nt = [...(calcData.commissionTiers||[])]; nt[index].rate = Number(e.target.value); updateField('commissionTiers', nt); }}
                                        className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                                    />
                                    <button onClick={() => updateField('commissionTiers', (calcData.commissionTiers||[]).filter((_, i) => i !== index))} className="ml-auto text-red-400 hover:text-red-300"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }
    };

    const renderDistributionPreview = () => {
        const previewVal = 5000;
        let previewResult = 0;

        const runCalcLogic = (val: number, pKey?: string) => {
            let reward = 0;
            if (type === 'Achievement') {
                let tiers = [...(calcData.achievementTiers || [])];
                
                // Isolation logic for weeks
                if (pKey && pKey !== 'month') {
                    const subTiers = tiers.filter(t => t.subPeriod === pKey);
                    if (subTiers.length > 0) tiers = subTiers;
                }

                tiers.sort((a, b) => b.target - a.target);
                const achievedTier = tiers.find(tier => val >= tier.target);
                if (achievedTier) {
                    reward = achievedTier.rewardType === 'Percentage' 
                        ? val * (achievedTier.rewardAmount / 100) 
                        : achievedTier.rewardAmount;
                }
            } else {
                if (calcData.commissionType === 'Flat Commission') {
                    reward = calcData.commissionMethod === 'Percentage' ? val * ((calcData.commissionRate||0) / 100) : (calcData.commissionRate||0);
                } else if (calcData.commissionType === 'Above Target Commission') {
                    const target = calcData.targetAmount || 0;
                    if (val > target) {
                        reward = calcData.commissionMethod === 'Percentage' ? (val - target) * ((calcData.commissionRate||0) / 100) : (calcData.commissionRate||0);
                    }
                } else if (calcData.commissionType === 'Tiered Commission') {
                    const tiers = calcData.commissionTiers || [];
                    const tier = tiers.find(t => val >= t.from && (t.to === null || val <= t.to));
                    if (tier) reward = val * (tier.rate / 100);
                }
            }
            return reward;
        };

        const weeklyDetails: any[] = [];
        if (type === 'Achievement' && calcData.calculationPeriod === 'Weekly') {
            const definedWeeks = Array.from(new Set(calcData.achievementTiers?.map(t => t.subPeriod).filter(Boolean))).sort();
            const weeksCount = definedWeeks.length || 4;
            const valPerWeek = previewVal / weeksCount;
            
            let runningTotal = 0;

            definedWeeks.forEach((wKey) => {
                const currentWeekSales = valPerWeek;
                let weekReward = 0;
                let targetLabel = 'N/A';

                if (calcData.isMarathon) {
                    runningTotal += currentWeekSales;
                    weekReward = runCalcLogic(runningTotal, wKey);
                    
                    const tiers = [...(calcData.achievementTiers || [])].filter(t => t.subPeriod === wKey).sort((a,b) => b.target - a.target);
                    const reached = tiers.find(t => runningTotal >= t.target);
                    targetLabel = reached ? (reached.name || `Target $${reached.target}`) : 'Below Target';
                } else {
                    weekReward = runCalcLogic(currentWeekSales, wKey);
                    const tiers = [...(calcData.achievementTiers || [])].filter(t => t.subPeriod === wKey).sort((a,b) => b.target - a.target);
                    const reached = tiers.find(t => currentWeekSales >= t.target);
                    targetLabel = reached ? (reached.name || `Target $${reached.target}`) : 'Below Target';
                }

                weeklyDetails.push({
                    week: wKey,
                    sales: currentWeekSales,
                    totalSoFar: calcData.isMarathon ? runningTotal : currentWeekSales,
                    target: targetLabel,
                    reward: weekReward
                });
                previewResult += weekReward;
            });
        } else {
            previewResult = runCalcLogic(previewVal);
        }

        return (
            <div className="space-y-6 animate-fade-in">
                <h3 className="text-lg font-black text-white uppercase tracking-tight border-b border-slate-800 pb-3">4. {t.dist_preview}</h3>
                
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.team_dist_method}</label>
                    <select 
                        value={calcData.distributionRule?.method || 'Equal Split'}
                        onChange={e => updateField('distributionRule', { method: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500"
                    >
                        <option value="Equal Split">Equal Split (Reward / Team Size)</option>
                        <option value="Percentage Allocation">Percentage Allocation</option>
                        <option value="Performance-Based Split">Performance-Based Split</option>
                    </select>
                </div>

                <div className="bg-slate-900/80 rounded-[2rem] border border-slate-700 shadow-2xl relative overflow-hidden">
                    <div className="p-6 border-b border-white/5">
                        <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                            {t.simulation_preview}
                        </h4>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-slate-400 text-sm">{t.if_sales} (Monthly)</span>
                            <span className="text-white font-black text-lg">${previewVal.toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Logic: {calcData.calculationPeriod} {calcData.isMarathon ? '(Marathon Mode)' : ''}</p>
                    </div>

                    {weeklyDetails.length > 0 && (
                        <div className="px-6 py-4 bg-black/20 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                        <th className="pb-3 pr-2">Period</th>
                                        <th className="pb-3 pr-2">Assumption</th>
                                        {calcData.isMarathon && <th className="pb-3 pr-2">Running Total</th>}
                                        <th className="pb-3 pr-2">Status</th>
                                        <th className="pb-3 text-right">Reward</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {weeklyDetails.map((d, i) => (
                                        <tr key={i} className="text-[10px]">
                                            <td className="py-2.5 font-black text-blue-400">{d.week}</td>
                                            <td className="py-2.5 text-slate-300 font-bold">${d.sales.toFixed(0)}</td>
                                            {calcData.isMarathon && <td className="py-2.5 text-slate-500 font-mono">${d.totalSoFar.toFixed(0)}</td>}
                                            <td className="py-2.5">
                                                <span className={`px-1.5 py-0.5 rounded ${d.reward > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'} font-bold`}>
                                                    {d.target}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-right font-black text-white">${d.reward.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="p-6 bg-blue-600/5 flex justify-between items-center">
                        <span className="text-slate-400 text-xs font-black uppercase italic">{t.est_reward} (Total)</span>
                        <div className="text-right">
                            <span className="text-emerald-400 font-black text-3xl drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                                ${previewResult.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                        {initialData ? t.edit_calculator : t.create_calculator} {type === 'Achievement' ? t.achievement_bonus : t.commission_rate}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">{t.calculators_engine_desc}</p>
                </div>
                <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all">{t.cancel}</button>
            </div>

            {/* Stepper */}
            <div className="flex gap-2 mb-8">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-slate-800'}`}></div>
                ))}
            </div>

            {/* Content Container */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl min-h-[400px]">
                {step === 1 && renderBasicInfo()}
                {step === 2 && renderMetricPeriod()}
                {step === 3 && renderRuleConfig()}
                {step === 4 && renderDistributionPreview()}
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center mt-8">
                <button 
                    onClick={() => setStep(s => Math.max(1, s - 1))}
                    disabled={step === 1}
                    className="px-6 py-3 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {t.back}
                </button>
                {step < 4 ? (
                    <button 
                        onClick={() => setStep(s => Math.min(4, s + 1))}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95"
                    >
                        {t.next_step}
                    </button>
                ) : (
                    <button 
                        onClick={handleSave}
                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
                    >
                        {t.save_calculator}
                    </button>
                )}
            </div>
        </div>
    );
};

export default CalculatorBuilder;
