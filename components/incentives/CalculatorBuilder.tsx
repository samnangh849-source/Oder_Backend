import React, { useState, useContext, useEffect } from 'react';
import { IncentiveCalculator, CalculatorType, IncentiveTier, CommissionTier } from '../../types';
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
    const { language } = useContext(AppContext);
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
        distributionRule: { method: 'Equal Split' }
    });

    const updateField = (field: keyof IncentiveCalculator, value: any) => {
        setCalcData(prev => ({ ...prev, [field]: value }));
    };

    // Templates Logic
    const applyTemplate = (templateName: string) => {
        if (templateName === 'tiered_sales') {
            updateField('name', 'Tiered Sales Bonus');
            updateField('calculationPeriod', 'Monthly');
            updateField('achievementTiers', [
                { id: 't1', target: 3000, rewardAmount: 20, rewardType: 'Fixed Cash', name: 'Bronze' },
                { id: 't2', target: 6000, rewardAmount: 50, rewardType: 'Fixed Cash', name: 'Silver' },
                { id: 't3', target: 10000, rewardAmount: 100, rewardType: 'Fixed Cash', name: 'Gold' }
            ]);
        } else if (templateName === 'weekly_progressive') {
            updateField('name', 'Weekly Sprint Incentive');
            updateField('calculationPeriod', 'Weekly');
            updateField('isMarathon', true);
            updateField('achievementTiers', [
                { id: 'w1', target: 1500, rewardAmount: 10, rewardType: 'Fixed Cash', subPeriod: 'W1', name: 'Week 1 Goal' },
                { id: 'w2', target: 3000, rewardAmount: 15, rewardType: 'Fixed Cash', subPeriod: 'W2', name: 'Week 2 Goal' },
                { id: 'w3', target: 4500, rewardAmount: 20, rewardType: 'Fixed Cash', subPeriod: 'W3', name: 'Week 3 Goal' },
                { id: 'w4', target: 6000, rewardAmount: 30, rewardType: 'Fixed Cash', subPeriod: 'W4', name: 'Week 4 Goal' }
            ]);
        } else if (templateName === 'flat_commission') {
            updateField('name', 'Standard 1% Commission');
            updateField('type', 'Commission');
            updateField('commissionType', 'Flat Commission');
            updateField('commissionRate', 1);
            updateField('commissionMethod', 'Percentage');
        }
        setStep(2); // Jump to metrics
    };

    const handleSave = async () => {
        if (!calcData.name) return alert("Please provide a name.");
        if (initialData?.id) await updateCalculator(projectId, initialData.id, calcData);
        else await addCalculatorToProject(projectId, calcData as Omit<IncentiveCalculator, 'id'>);
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
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{type === 'Achievement' ? 'Achievement Bonus Setup' : 'Commission Engine Setup'}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Start from a proven template or build from scratch</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                    { id: 'tiered_sales', title: 'Tiered Bonus', desc: 'Rewards increase as sales hit higher milestones.', icon: '🏆', gradient: 'from-amber-500 to-orange-600' },
                    { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'Progressive goals designed to maintain weekly momentum.', icon: '⚡', gradient: 'from-blue-500 to-indigo-600' },
                    { id: 'flat_commission', title: 'Flat Comm.', desc: 'Standard fixed percentage across all sales.', icon: '💰', gradient: 'from-emerald-400 to-teal-600' }
                ].map(tmp => (
                    <button key={tmp.id} onClick={() => applyTemplate(tmp.id)} className="relative p-[1px] rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/30 transition-all duration-500 group text-left active:scale-95">
                        <div className="h-full bg-[#0f172a]/90 backdrop-blur-xl p-6 rounded-[1.95rem] overflow-hidden relative border border-white/5">
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${tmp.gradient} opacity-10 blur-2xl group-hover:opacity-30 transition-opacity rounded-full -mr-10 -mt-10`}></div>
                            <div className="text-4xl mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-transform drop-shadow-2xl">{tmp.icon}</div>
                            <div className="text-sm font-black text-white uppercase mb-2 tracking-tight">{tmp.title}</div>
                            <div className="text-[10px] text-slate-400 font-bold leading-relaxed">{tmp.desc}</div>
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
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path></svg>
                    </div>
                    <input 
                        type="text" value={calcData.name} onChange={e => updateField('name', e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl pl-12 pr-5 py-4 text-white font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-inner outline-none"
                        placeholder="e.g. Q3 Sales Hero Bonus..."
                    />
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-8 animate-fade-in">
            <h3 className="text-xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">2</span>
                Metrics & Period
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Metric</label>
                    <div className="grid grid-cols-1 gap-3">
                        {['Sales Amount', 'Number of Orders', 'Revenue'].map(m => (
                            <button 
                                key={m} onClick={() => updateField('metricType', m)}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${calcData.metricType === m ? 'bg-indigo-600/10 border-indigo-500' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}`}
                            >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${calcData.metricType === m ? 'border-indigo-500' : 'border-slate-600'}`}>
                                    {calcData.metricType === m && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>}
                                </div>
                                <span className={`text-sm font-bold ${calcData.metricType === m ? 'text-indigo-400' : 'text-slate-300'}`}>{m}</span>
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Evaluation Period</label>
                    <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800">
                        {['Weekly', 'Monthly'].map(p => (
                            <button 
                                key={p} onClick={() => updateField('calculationPeriod', p)}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${calcData.calculationPeriod === p ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {calcData.calculationPeriod === 'Weekly' && (
                        <div className="mt-6 animate-fade-in-up">
                            <InfoBox title="Marathon Mode">
                                When enabled, weekly targets and achievements are <b>cumulative</b> (W1 + W2 + W3 + W4). Ideal for month-long progressive sprints.
                            </InfoBox>
                            <div className="flex items-center justify-between p-5 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer group hover:bg-slate-800/50 transition-colors" onClick={() => updateField('isMarathon', !calcData.isMarathon)}>
                                <div>
                                    <h4 className="text-sm font-black text-white">Enable Marathon Mode</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Accumulate progress across weeks</p>
                                </div>
                                <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${calcData.isMarathon ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-md ${calcData.isMarathon ? 'left-7' : 'left-1'}`}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => {
        // Auto-sort tiers by target to create a logical progression
        const sortedTiers = [...(calcData.achievementTiers || [])].sort((a, b) => a.target - b.target);

        return (
            <div className="space-y-8 animate-fade-in">
                <div className="flex justify-between items-end border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">3</span>
                            Milestones & Tiers
                        </h3>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Define targets from lowest to highest</p>
                    </div>
                    <button onClick={() => {
                        const nt = [...(calcData.achievementTiers || [])];
                        const lastTarget = nt.length > 0 ? Math.max(...nt.map(t => t.target)) : 0;
                        nt.push({ 
                            id: `t${Date.now()}`, 
                            target: lastTarget > 0 ? lastTarget + 1000 : 1000, 
                            rewardAmount: 0, 
                            rewardType: 'Fixed Cash', 
                            name: `Tier ${nt.length + 1}`,
                            subPeriod: calcData.calculationPeriod === 'Weekly' ? 'W1' : undefined 
                        });
                        updateField('achievementTiers', nt);
                    }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/40 active:scale-95 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                        Add Tier
                    </button>
                </div>

                <div className="space-y-4 relative">
                    {/* Vertical connecting line */}
                    {sortedTiers.length > 1 && (
                        <div className="absolute left-8 top-10 bottom-10 w-0.5 bg-gradient-to-b from-indigo-500/50 via-indigo-500/20 to-transparent z-0"></div>
                    )}

                    {sortedTiers.map((tier, idx) => (
                        <div key={tier.id} className="relative z-10 flex items-center gap-6 bg-[#0f172a] p-5 rounded-3xl border border-slate-800 shadow-xl group hover:border-indigo-500/30 transition-all">
                            
                            {/* Tier Indicator */}
                            <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 flex flex-col items-center justify-center shadow-inner relative overflow-hidden group-hover:from-indigo-900/50 group-hover:to-slate-900 transition-colors">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Tier</span>
                                <span className="text-xl font-black text-white italic leading-none">{idx + 1}</span>
                                {idx === sortedTiers.length - 1 && sortedTiers.length > 1 && (
                                    <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/20 blur-xl"></div>
                                )}
                            </div>

                            {/* Inputs Grid */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Name Input */}
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-2">Tier Name</label>
                                    <input type="text" value={tier.name || ''} onChange={e => {
                                        const nt = [...(calcData.achievementTiers||[])]; 
                                        const originalIndex = nt.findIndex(t => t.id === tier.id);
                                        nt[originalIndex].name = e.target.value; 
                                        updateField('achievementTiers', nt);
                                    }} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-xs text-white font-bold focus:border-indigo-500 focus:ring-0 transition-all" placeholder={`e.g. Bronze`} />
                                </div>

                                {/* Target Input */}
                                <div>
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-2">Target Goal</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-slate-400 font-bold">$</span>
                                        </div>
                                        <input type="number" value={tier.target || ''} onChange={e => {
                                            const nt = [...(calcData.achievementTiers||[])]; 
                                            const originalIndex = nt.findIndex(t => t.id === tier.id);
                                            nt[originalIndex].target = Number(e.target.value); 
                                            updateField('achievementTiers', nt);
                                        }} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white font-black focus:border-indigo-500 focus:ring-0 transition-all" placeholder="0" />
                                    </div>
                                </div>

                                {/* Reward Input */}
                                <div>
                                    <label className="block text-[9px] font-black text-emerald-500/70 uppercase tracking-widest mb-1.5 ml-2">Reward Payout</label>
                                    <div className="flex border border-slate-700/50 rounded-xl overflow-hidden bg-slate-900/50 focus-within:border-emerald-500/50 transition-colors">
                                        <input type="number" value={tier.rewardAmount || ''} onChange={e => {
                                            const nt = [...(calcData.achievementTiers||[])]; 
                                            const originalIndex = nt.findIndex(t => t.id === tier.id);
                                            nt[originalIndex].rewardAmount = Number(e.target.value); 
                                            updateField('achievementTiers', nt);
                                        }} className="w-full bg-transparent border-none px-4 py-2.5 text-sm text-emerald-400 font-black focus:ring-0 text-right" placeholder="0" />
                                        
                                        <select value={tier.rewardType} onChange={e => {
                                            const nt = [...(calcData.achievementTiers||[])]; 
                                            const originalIndex = nt.findIndex(t => t.id === tier.id);
                                            nt[originalIndex].rewardType = e.target.value as any; 
                                            updateField('achievementTiers', nt);
                                        }} className="bg-slate-800 border-none px-3 py-2.5 text-xs text-slate-300 font-black uppercase focus:ring-0 cursor-pointer outline-none">
                                            <option value="Fixed Cash">$</option>
                                            <option value="Percentage">%</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => updateField('achievementTiers', (calcData.achievementTiers||[]).filter(t => t.id !== tier.id))} className="w-10 h-10 shrink-0 rounded-full bg-red-500/5 text-red-500/50 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-all ml-2" title="Remove Tier">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    ))}

                    {sortedTiers.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                            <div className="text-4xl mb-3 opacity-50">🎯</div>
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">No milestones defined yet</h4>
                            <p className="text-xs text-slate-600 mt-1">Click "Add Tier" to create your first goal.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderStep4 = () => {
        const tiers = [...(calcData.achievementTiers || [])].sort((a, b) => a.target - b.target);
        
        // Calculation Logic
        let achievedTier = null;
        let nextTier = null;
        
        for (let i = 0; i < tiers.length; i++) {
            if (previewInput >= tiers[i].target) {
                achievedTier = tiers[i];
            }
            if (previewInput < tiers[i].target && !nextTier) {
                nextTier = tiers[i];
            }
        }

        const reward = achievedTier ? (achievedTier.rewardType === 'Percentage' ? previewInput * (achievedTier.rewardAmount/100) : achievedTier.rewardAmount) : 0;
        
        // Progress Bar Logic
        let progressPercent = 0;
        let currentTarget = achievedTier ? achievedTier.target : 0;
        let nextTarget = nextTier ? nextTier.target : (tiers.length > 0 ? tiers[0].target : 0);
        
        if (nextTier) {
            const range = nextTarget - currentTarget;
            const progress = previewInput - currentTarget;
            progressPercent = Math.max(0, Math.min(100, (progress / range) * 100));
        } else if (achievedTier) {
            progressPercent = 100; // Maxed out
        }

        return (
            <div className="space-y-8 animate-fade-in">
                <h3 className="text-xl font-black text-white uppercase tracking-tight border-b border-slate-800 pb-4 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">4</span>
                    Simulation Engine
                </h3>
                
                {/* Input Section */}
                <div className="bg-gradient-to-b from-indigo-900/30 to-transparent p-8 rounded-[2.5rem] border border-indigo-500/20 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-50"></div>
                    
                    <label className="block text-xs font-black text-indigo-300 uppercase tracking-[0.2em] mb-6 text-center drop-shadow-md">Simulated Sales Performance</label>
                    
                    <div className="flex items-center justify-center gap-4 bg-black/40 w-max mx-auto px-8 py-4 rounded-3xl border border-white/5 shadow-inner">
                        <span className="text-3xl font-black text-slate-500">$</span>
                        <input 
                            type="number" value={previewInput || ''} onChange={e => setPreviewInput(Number(e.target.value))}
                            className="bg-transparent border-none text-5xl font-black text-white text-center w-64 focus:ring-0 focus:outline-none placeholder-slate-700"
                            placeholder="0"
                        />
                    </div>

                    {/* Progress Bar UI */}
                    {tiers.length > 0 && (
                        <div className="mt-10 max-w-2xl mx-auto">
                            <div className="flex justify-between items-end mb-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {achievedTier ? (
                                        <span className="text-emerald-400 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> {achievedTier.name || 'Unlocked'}</span>
                                    ) : (
                                        <span>Start</span>
                                    )}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                    {nextTier ? `Next: ${nextTier.name || `Tier`}` : 'MAX LEVEL'}
                                </div>
                            </div>
                            
                            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                                <div 
                                    className={`h-full absolute left-0 top-0 rounded-full transition-all duration-700 ease-out ${progressPercent === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-indigo-600 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`}
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                            
                            <div className="flex justify-between mt-2 text-[9px] font-black tracking-widest text-slate-500">
                                <span>${currentTarget.toLocaleString()}</span>
                                <span>{nextTier ? `$${nextTarget.toLocaleString()}` : ''}</span>
                            </div>

                            {nextTier && (
                                <div className="text-center mt-4 text-xs font-bold text-slate-400">
                                    Need <span className="text-indigo-400 font-black">${(nextTarget - previewInput).toLocaleString()}</span> more to unlock <span className="text-white italic">{nextTier.name || 'next tier'}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Results Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden flex flex-col justify-center">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Highest Tier Reached</div>
                        <div className={`text-2xl font-black uppercase italic ${achievedTier ? 'text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'text-slate-600'}`}>
                            {achievedTier?.name || '---'}
                        </div>
                        {achievedTier && <div className="absolute -bottom-4 -right-4 text-6xl opacity-5">🏆</div>}
                    </div>
                    
                    <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 p-6 rounded-3xl border border-emerald-500/20 text-center relative overflow-hidden">
                        <div className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-3">Calculated Payout</div>
                        <div className="text-5xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] tracking-tighter">
                            <span className="text-3xl text-emerald-500/50 mr-1">$</span>
                            {reward.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {achievedTier && achievedTier.rewardType === 'Percentage' && (
                            <div className="text-[9px] font-bold text-emerald-500/50 uppercase tracking-widest mt-2">
                                Based on {achievedTier.rewardAmount}% of total
                            </div>
                        )}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full mix-blend-screen pointer-events-none"></div>
                    </div>
                </div>

            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 animate-fade-in pb-32">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Incentive Engine <span className="text-indigo-500 italic">v2.0</span></h2>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white font-black uppercase text-xs tracking-widest transition-colors">✕ បិទវិញ</button>
            </div>

            {/* Stepper */}
            <div className="flex justify-between mb-12 px-4 relative">
                <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-800 z-0"></div>
                <div className="absolute top-4 left-0 h-0.5 bg-indigo-500 z-0 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black z-10 border-4 ${step >= s ? 'bg-indigo-600 border-slate-900 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-800 border-slate-900 text-slate-500'}`}>{s}</div>
                ))}
            </div>

            {/* Content Container */}
            <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl ring-1 ring-white/10 min-h-[450px]">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </div>

            {/* Navigation Footer */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex justify-center z-50">
                <div className="max-w-4xl w-full flex justify-between items-center gap-4">
                    <button 
                        disabled={step === 1} onClick={() => setStep(s => s - 1)}
                        className="px-8 py-4 bg-slate-900 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-0 transition-all"
                    >ត្រឡប់ក្រោយ</button>
                    
                    {step < 4 ? (
                        <button 
                            onClick={() => setStep(s => s + 1)}
                            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-900/40 active:scale-95 transition-all"
                        >បន្តទៅមុខទៀត</button>
                    ) : (
                        <button 
                            onClick={handleSave}
                            className="px-12 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-900/40 active:scale-95 transition-all"
                        >រក្សាទុកម៉ាស៊ីនគណនា</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalculatorBuilder;