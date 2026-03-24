import React, { useState, useContext, useEffect } from 'react';
import { IncentiveCalculator, CalculatorType, IncentiveTier, CommissionTier, DistributionRule } from '../../types';
import { addCalculatorToProject, updateCalculator } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';

interface CalculatorBuilderProps {
    projectId: string;
    initialData?: IncentiveCalculator;
    type: CalculatorType;
    onClose: () => void;
    onSave: () => void;
}

const CalculatorBuilder: React.FC<CalculatorBuilderProps> = ({ projectId, initialData, type, onClose, onSave }) => {
    const { language, appData } = useContext(AppContext);
    const t = translations[language];

    const [step, setStep] = useState(1);
    const [previewInput, setPreviewInput] = useState<number>(5000);
    
    const [calcData, setCalcData] = useState<Partial<IncentiveCalculator>>(initialData || {
        name: '',
        type,
        status: 'Active',
        departmentOrRole: [],
        applyTo: [],
        metricType: 'Sales Amount',
        metricUnit: 'USD',
        calculationPeriod: 'Monthly',
        resetEveryPeriod: true,
        achievementTiers: [],
        commissionType: 'Flat Commission',
        commissionMethod: 'Percentage',
        commissionCondition: 'On Total Sales',
        commissionRate: 0,
        commissionTiers: [],
        distributionRule: { method: 'Equal Split' },
        startDate: '',
        endDate: '',
        targetAmount: 0,
        minSalesRequired: 0,
        maxCommissionCap: 0,
        requireApproval: false,
        excludeRefunded: true,
        includeTax: false
    });

    const updateField = (field: keyof IncentiveCalculator, value: any) => {
        setCalcData(prev => ({ ...prev, [field]: value }));
    };

    const toggleApplyTo = (item: string) => {
        const current = calcData.applyTo || [];
        if (current.includes(item)) {
            updateField('applyTo', current.filter(i => i !== item));
        } else {
            updateField('applyTo', [...current, item]);
        }
    };

    // Templates Logic
    const applyTemplate = (templateId: string) => {
        if (templateId === 'tiered_sales') {
            updateField('name', 'Tiered Sales Bonus');
            updateField('type', 'Achievement');
            updateField('calculationPeriod', 'Monthly');
            updateField('achievementTiers', [
                { id: 't1', target: 3000, rewardAmount: 20, rewardType: 'Fixed Cash', name: 'Bronze' },
                { id: 't2', target: 6000, rewardAmount: 50, rewardType: 'Fixed Cash', name: 'Silver' },
                { id: 't3', target: 10000, rewardAmount: 100, rewardType: 'Fixed Cash', name: 'Gold' }
            ]);
        } else if (templateId === 'weekly_progressive') {
            updateField('name', 'Weekly Sprint Incentive');
            updateField('type', 'Achievement');
            updateField('calculationPeriod', 'Weekly');
            updateField('isMarathon', true);
            updateField('achievementTiers', [
                { id: 'w1', target: 1500, rewardAmount: 10, rewardType: 'Fixed Cash', subPeriod: 'W1', name: 'Week 1 Goal' },
                { id: 'w2', target: 3000, rewardAmount: 15, rewardType: 'Fixed Cash', subPeriod: 'W2', name: 'Week 2 Goal' },
                { id: 'w3', target: 4500, rewardAmount: 20, rewardType: 'Fixed Cash', subPeriod: 'W3', name: 'Week 3 Goal' },
                { id: 'w4', target: 6000, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W4', name: 'Week 4 Goal' }
            ]);
        } else if (templateId === 'flat_commission') {
            updateField('name', 'Standard 1% Commission');
            updateField('type', 'Commission');
            updateField('commissionType', 'Flat Commission');
            updateField('commissionRate', 1);
            updateField('commissionMethod', 'Percentage');
            updateField('commissionCondition', 'On Total Sales');
        } else if (templateId === 'above_target') {
            updateField('name', 'Above Target Bonus (5%)');
            updateField('type', 'Commission');
            updateField('commissionType', 'Above Target Commission');
            updateField('commissionCondition', 'Above Target');
            updateField('targetAmount', 4000);
            updateField('commissionRate', 5);
            updateField('commissionMethod', 'Percentage');
        }
        setStep(2);
    };

    const handleSave = async () => {
        if (!calcData.name) return alert("Please provide a name.");
        
        // Ensure type is correct
        const finalData = { ...calcData, type: calcData.type || type };

        if (initialData?.id) await updateCalculator(projectId, initialData.id, finalData);
        else await addCalculatorToProject(projectId, finalData as Omit<IncentiveCalculator, 'id'>);
        onSave();
    };

    const InfoBox = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-2xl mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{title}</h4>
            </div>
            <div className="text-[11px] text-slate-300 font-medium leading-relaxed">{children}</div>
        </div>
    );

    // --- RENDER STEPS ---
    const renderStep1 = () => (
        <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-10">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{calcData.type === 'Achievement' ? 'Achievement Bonus Setup' : 'Commission Engine Setup'}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Start from a proven template or build from scratch</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { id: 'tiered_sales', title: 'Tiered Bonus', desc: 'Rewards increase as sales hit milestones.', icon: '🏆', gradient: 'from-amber-500 to-orange-600', type: 'Achievement' },
                    { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'Progressive goals for weekly momentum.', icon: '⚡', gradient: 'from-blue-500 to-indigo-600', type: 'Achievement' },
                    { id: 'flat_commission', title: 'Flat Comm.', desc: 'Standard fixed % across all sales.', icon: '💰', gradient: 'from-emerald-400 to-teal-600', type: 'Commission' },
                    { id: 'above_target', title: 'Above Target', desc: 'Rate applied only on sales above goal.', icon: '🎯', gradient: 'from-purple-500 to-pink-600', type: 'Commission' }
                ].filter(tmp => tmp.type === calcData.type).map(tmp => (
                    <button key={tmp.id} onClick={() => applyTemplate(tmp.id)} className="relative p-[1px] rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/30 transition-all duration-500 group text-left active:scale-95">
                        <div className="h-full bg-[#0f172a]/90 backdrop-blur-xl p-6 rounded-[1.95rem] overflow-hidden relative border border-white/5">
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${tmp.gradient} opacity-10 blur-2xl group-hover:opacity-30 transition-opacity rounded-full -mr-10 -mt-10`}></div>
                            <div className="text-3xl mb-3 group-hover:scale-110 group-hover:-rotate-6 transition-transform drop-shadow-2xl">{tmp.icon}</div>
                            <div className="text-xs font-black text-white uppercase mb-2 tracking-tight">{tmp.title}</div>
                            <div className="text-[9px] text-slate-400 font-bold leading-relaxed">{tmp.desc}</div>
                        </div>
                    </button>
                ))}
            </div>

            <div className="relative flex items-center py-6">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-4 py-1 rounded-full border border-slate-800">Or Build Custom</span>
                <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <div className="relative">
                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Calculator Name</label>
                <input 
                    type="text" value={calcData.name} onChange={e => updateField('name', e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-6 py-4 text-white font-bold focus:border-indigo-500 transition-all outline-none"
                    placeholder="e.g. Q3 Sales Hero Bonus..."
                />
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-8 animate-fade-in">
            <h3 className="text-xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
                Basic Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Status</label>
                        <div className="flex gap-2">
                            {['Active', 'Draft', 'Disable'].map(s => (
                                <button key={s} onClick={() => updateField('status', s)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${calcData.status === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>{s}</button>
                            ))}
                        </div>
                    </div>

                    {calcData.type === 'Commission' && (
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Commission Type</label>
                            <select 
                                value={calcData.commissionType} onChange={e => updateField('commissionType', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500"
                            >
                                <option value="Flat Commission">Flat Commission</option>
                                <option value="Above Target Commission">Above Target Commission</option>
                                <option value="Tiered Commission">Tiered Commission</option>
                                <option value="Product-Based Commission">Product-Based Commission</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Incentive Info / Description</label>
                        <textarea 
                            value={calcData.rulesJson ? JSON.parse(calcData.rulesJson).description : ''} 
                            onChange={e => {
                                const currentRules = calcData.rulesJson ? JSON.parse(calcData.rulesJson) : {};
                                updateField('rulesJson', JSON.stringify({ ...currentRules, description: e.target.value }));
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white min-h-[100px] outline-none"
                            placeholder="Add details about this incentive program..."
                        ></textarea>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Evaluation Period</label>
                        <select 
                            value={calcData.calculationPeriod} onChange={e => updateField('calculationPeriod', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-indigo-500"
                        >
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Per Order">Per Order</option>
                            <option value="Custom Range">Custom Range</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <div>
                            <h4 className="text-xs font-black text-white">Reset Progress</h4>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Clear counts every new period</p>
                        </div>
                        <input type="checkbox" checked={calcData.resetEveryPeriod} onChange={e => updateField('resetEveryPeriod', e.target.checked)} className="w-5 h-5 accent-indigo-500" />
                    </div>

                    {calcData.calculationPeriod === 'Weekly' && (
                         <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800">
                         <div>
                             <h4 className="text-xs font-black text-white italic tracking-tighter">Marathon Mode</h4>
                             <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Cumulative Weekly Progress</p>
                         </div>
                         <input type="checkbox" checked={calcData.isMarathon} onChange={e => updateField('isMarathon', e.target.checked)} className="w-5 h-5 accent-orange-500" />
                     </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-8 animate-fade-in">
             <h3 className="text-xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">3</span>
                Eligible Entities & Metrics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Apply To (Eligible Users)</label>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-h-[300px] overflow-y-auto space-y-4">
                        {/* Roles */}
                        <div>
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Roles</span>
                            <div className="flex flex-wrap gap-2">
                                {appData.roles?.map(r => (
                                    <button key={r.roleName} type="button" onClick={() => toggleApplyTo(`Role:${r.roleName}`)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${calcData.applyTo?.includes(`Role:${r.roleName}`) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        {r.roleName}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Teams */}
                        <div>
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2 block">Teams</span>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(appData.pages?.map(p => p.Team))).filter(t => t).map(team => (
                                    <button key={team} type="button" onClick={() => toggleApplyTo(`Team:${team}`)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${calcData.applyTo?.includes(`Team:${team}`) ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        {team}
                                    </button>
                                ))}
                            </div>
                        </div>
                         {/* Individual Users */}
                         <div>
                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2 block">Individuals</span>
                            <div className="grid grid-cols-2 gap-2">
                                {appData.users?.slice(0, 10).map(u => (
                                    <button key={u.UserName} type="button" onClick={() => toggleApplyTo(`User:${u.UserName}`)} className={`text-left px-3 py-1.5 rounded-lg text-[10px] font-bold border truncate transition-all ${calcData.applyTo?.includes(`User:${u.UserName}`) ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        {u.FullName}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Performance Metric</label>
                        <select 
                            value={calcData.metricType} onChange={e => updateField('metricType', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none"
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
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Unit</label>
                        <div className="flex gap-2">
                            {['USD', 'Count', '%'].map(u => (
                                <button key={u} onClick={() => updateField('metricUnit', u)} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${calcData.metricUnit === u ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>{u}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => {
        if (calcData.type === 'Achievement') {
            const sortedTiers = [...(calcData.achievementTiers || [])].sort((a, b) => a.target - b.target);
            return (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">4</span>
                            Milestone / Tier Setup
                        </h3>
                        <button onClick={() => {
                            const nt = [...(calcData.achievementTiers || [])];
                            const lastTarget = nt.length > 0 ? Math.max(...nt.map(t => t.target)) : 0;
                            nt.push({ id: `t${Date.now()}`, target: lastTarget + 1000, rewardAmount: 0, rewardType: 'Fixed Cash', name: `Tier ${nt.length + 1}` });
                            updateField('achievementTiers', nt);
                        }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">+ Add Tier</button>
                    </div>

                    <div className="space-y-3">
                        {sortedTiers.map((tier, idx) => (
                            <div key={tier.id} className="flex items-center gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-all">
                                <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">{idx + 1}</div>
                                <input type="text" value={tier.name || ''} placeholder="Tier Name" onChange={e => {
                                    const nt = [...(calcData.achievementTiers||[])];
                                    const i = nt.findIndex(t => t.id === tier.id);
                                    nt[i].name = e.target.value;
                                    updateField('achievementTiers', nt);
                                }} className="bg-transparent border-none text-xs font-bold text-white focus:ring-0 w-32" />
                                <div className="flex-1 grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">Goal</span>
                                        <input type="number" value={tier.target} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].target = Number(e.target.value);
                                             updateField('achievementTiers', nt);
                                        }} className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-12 pr-4 py-2 text-xs font-black text-white" />
                                    </div>
                                    <div className="flex bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
                                        <input type="number" value={tier.rewardAmount} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].rewardAmount = Number(e.target.value);
                                             updateField('achievementTiers', nt);
                                        }} className="w-full bg-transparent border-none px-3 py-2 text-xs font-black text-emerald-400 text-right focus:ring-0" />
                                        <select value={tier.rewardType} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].rewardType = e.target.value as any;
                                             updateField('achievementTiers', nt);
                                        }} className="bg-slate-800 border-none px-2 text-[9px] font-black text-slate-400 outline-none">
                                            <option value="Fixed Cash">$</option>
                                            <option value="Percentage">%</option>
                                            <option value="Point">Pts</option>
                                        </select>
                                    </div>
                                </div>
                                <button onClick={() => updateField('achievementTiers', (calcData.achievementTiers||[]).filter(t => t.id !== tier.id))} className="text-slate-600 hover:text-red-500 transition-colors px-2">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        } else {
            // Commission Rules Setup
            return (
                <div className="space-y-8 animate-fade-in">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">4</span>
                        Commission Rules & Logic
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Calculation Method</label>
                                <div className="flex gap-2">
                                    {['Percentage', 'Fixed Amount'].map(m => (
                                        <button key={m} onClick={() => updateField('commissionMethod', m)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${calcData.commissionMethod === m ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>{m}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Commission Condition</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {['On Total Sales', 'Above Target', 'Per Transaction'].map(c => (
                                        <button key={c} onClick={() => updateField('commissionCondition', c)} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${calcData.commissionCondition === c ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                            <div className={`w-3 h-3 rounded-full border ${calcData.commissionCondition === c ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}></div>
                                            <span className="text-xs font-black uppercase tracking-widest">{c}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {calcData.commissionCondition === 'Above Target' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Amount (Threshold)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                        <input type="number" value={calcData.targetAmount} onChange={e => updateField('targetAmount', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm font-black text-white" />
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase mt-2 italic">Formula: (Sales - Target) × Rate</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Commission Rate ({calcData.commissionMethod === 'Percentage' ? '%' : '$'})</label>
                                <input type="number" value={calcData.commissionRate} onChange={e => updateField('commissionRate', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-lg font-black text-emerald-400" />
                            </div>

                            {calcData.commissionType === 'Tiered Commission' && (
                                <div className="pt-4 border-t border-slate-800">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tier Configurations</label>
                                        <button onClick={() => {
                                            const nt = [...(calcData.commissionTiers || [])];
                                            const lastTo = nt.length > 0 ? nt[nt.length-1].to || 0 : 0;
                                            nt.push({ id: `ct${Date.now()}`, from: lastTo, to: lastTo + 5000, rate: 1 });
                                            updateField('commissionTiers', nt);
                                        }} className="text-[9px] font-black text-emerald-400 uppercase">+ Add Tier</button>
                                    </div>
                                    <div className="space-y-2">
                                        {calcData.commissionTiers?.map((ct, i) => (
                                            <div key={ct.id} className="grid grid-cols-4 gap-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800 items-center">
                                                <input type="number" value={ct.from} placeholder="From" onChange={e => {
                                                    const nt = [...(calcData.commissionTiers||[])];
                                                    nt[i].from = Number(e.target.value);
                                                    updateField('commissionTiers', nt);
                                                }} className="bg-transparent border-none text-[10px] text-white p-1 text-center" />
                                                <input type="number" value={ct.to || ''} placeholder="To" onChange={e => {
                                                    const nt = [...(calcData.commissionTiers||[])];
                                                    nt[i].to = Number(e.target.value);
                                                    updateField('commissionTiers', nt);
                                                }} className="bg-transparent border-none text-[10px] text-white p-1 text-center" />
                                                <input type="number" value={ct.rate} placeholder="Rate" onChange={e => {
                                                    const nt = [...(calcData.commissionTiers||[])];
                                                    nt[i].rate = Number(e.target.value);
                                                    updateField('commissionTiers', nt);
                                                }} className="bg-transparent border-none text-[10px] text-emerald-400 p-1 text-center font-bold" />
                                                <button onClick={() => updateField('commissionTiers', calcData.commissionTiers?.filter(t => t.id !== ct.id))} className="text-red-900 text-[10px]">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
    };

    const renderStep5 = () => {
        // Calculation for Preview
        let result = 0;
        if (calcData.type === 'Achievement') {
            const tiers = [...(calcData.achievementTiers || [])].sort((a, b) => a.target - b.target);
            const achieved = tiers.filter(t => previewInput >= t.target).pop();
            if (achieved) {
                result = achieved.rewardType === 'Percentage' ? previewInput * (achieved.rewardAmount/100) : achieved.rewardAmount;
            }
        } else {
            if (calcData.commissionType === 'Tiered Commission' && calcData.commissionTiers && calcData.commissionTiers.length > 0) {
                const ct = calcData.commissionTiers.find(t => previewInput >= t.from && (t.to === null || previewInput < t.to));
                if (ct) result = (calcData.commissionMethod === 'Percentage') ? previewInput * (ct.rate/100) : ct.rate;
            } else if (calcData.commissionCondition === 'Above Target') {
                const diff = Math.max(0, previewInput - (calcData.targetAmount || 0));
                result = (calcData.commissionMethod === 'Percentage') ? diff * ((calcData.commissionRate || 0)/100) : (diff > 0 ? (calcData.commissionRate || 0) : 0);
            } else {
                result = (calcData.commissionMethod === 'Percentage') ? previewInput * ((calcData.commissionRate || 0)/100) : (calcData.commissionRate || 0);
            }
        }

        return (
            <div className="space-y-8 animate-fade-in">
                 <h3 className="text-xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">5</span>
                    Preview & Distribution
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission Preview Simulator</label>
                        <div className="bg-slate-900/60 p-8 rounded-[2rem] border border-white/5 text-center relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-30"></div>
                             <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Input Metric Value</div>
                             <div className="flex items-center justify-center gap-3 mb-8">
                                <span className="text-2xl font-black text-slate-600">$</span>
                                <input type="number" value={previewInput} onChange={e => setPreviewInput(Number(e.target.value))} className="bg-transparent border-none text-4xl font-black text-white text-center w-48 focus:ring-0" />
                             </div>
                             <div className="pt-6 border-t border-white/5">
                                <div className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-1">Estimated Reward</div>
                                <div className="text-5xl font-black text-white tracking-tighter">
                                    <span className="text-2xl text-slate-500 mr-1">$</span>
                                    {result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Splitting Rule</label>
                        <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 space-y-4">
                            {['Equal Split', 'Percentage Allocation', 'Performance-Based Split'].map(m => (
                                <button key={m} onClick={() => updateField('distributionRule', { ...calcData.distributionRule, method: m })} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${calcData.distributionRule?.method === m ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                                    <span className="text-xs font-black uppercase tracking-widest">{m}</span>
                                    {calcData.distributionRule?.method === m && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                </button>
                            ))}
                        </div>
                        <InfoBox title="Distribution Tip">
                            Choose how the total reward earned by a team is split among individual members. <b>Equal Split</b> divides the sum equally by member count.
                        </InfoBox>
                    </div>
                </div>

                {/* Advanced Rules Toggle */}
                <div className="pt-6 border-t border-slate-800">
                    <button className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                         Advanced Calculation Rules (Optional)
                    </button>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                        {[
                            { label: 'Require Approval', field: 'requireApproval' },
                            { label: 'Exclude Refunded', field: 'excludeRefunded' },
                            { label: 'Include Tax', field: 'includeTax' },
                            { label: 'Sub-Period Check', field: 'subPeriodCheck' }
                        ].map(opt => (
                            <div key={opt.field} className="flex items-center gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                                <input type="checkbox" checked={!!(calcData as any)[opt.field]} onChange={e => updateField(opt.field as any, e.target.checked)} className="w-4 h-4 accent-indigo-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-8 animate-fade-in pb-32">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${type === 'Achievement' ? 'bg-indigo-600 shadow-indigo-900/40' : 'bg-emerald-600 shadow-emerald-900/40'}`}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {type === 'Achievement' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01m-2.286 11.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            )}
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{type === 'Achievement' ? 'Achievement Bonus' : 'Commission Rate'} <span className="text-indigo-500 italic">v2.1</span></h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Project ID: {projectId}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white font-black uppercase text-xs tracking-widest transition-colors flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">✕ Close</button>
            </div>

            {/* Stepper */}
            <div className="flex justify-between mb-12 px-10 relative">
                <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-800 z-0"></div>
                <div className="absolute top-5 left-10 h-0.5 bg-indigo-500 z-0 transition-all duration-500" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
                {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black z-10 border-4 transition-all ${step >= s ? 'bg-indigo-600 border-slate-950 text-white shadow-xl scale-110' : 'bg-slate-800 border-slate-950 text-slate-500'}`}>{s}</div>
                ))}
            </div>

            {/* Content Container */}
            <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl ring-1 ring-white/10 min-h-[500px]">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
            </div>

            {/* Navigation Footer */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex justify-center z-50">
                <div className="max-w-5xl w-full flex justify-between items-center gap-4">
                    <button 
                        disabled={step === 1} onClick={() => setStep(s => s - 1)}
                        className="px-8 py-4 bg-slate-900 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-0 transition-all hover:bg-slate-800"
                    >Back</button>
                    
                    {step < 5 ? (
                        <button 
                            disabled={step === 1 && !calcData.name}
                            onClick={() => setStep(s => s + 1)}
                            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-900/40 active:scale-95 transition-all hover:bg-indigo-500 disabled:opacity-50"
                        >Next Step</button>
                    ) : (
                        <button 
                            onClick={handleSave}
                            className="px-12 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-900/40 active:scale-95 transition-all hover:bg-emerald-400"
                        >Save Calculator</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalculatorBuilder;