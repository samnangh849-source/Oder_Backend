import React, { useState, useContext, useEffect } from 'react';
import { IncentiveCalculator, CalculatorType } from '../../types';
import { addCalculatorToProject, updateCalculator } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { Zap, TrendingUp, Info, ChevronRight, ChevronLeft, Save, X } from 'lucide-react';

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
        const finalData = { ...calcData, type: calcData.type || type };
        if (initialData?.id) await updateCalculator(projectId, initialData.id, finalData);
        else await addCalculatorToProject(projectId, finalData as Omit<IncentiveCalculator, 'id'>);
        onSave();
    };

    const InfoBox = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <div className="bg-bg-black border border-[#2B3139] p-4 rounded-md mb-6">
            <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" />
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">{title}</h4>
            </div>
            <div className="text-[11px] text-secondary font-medium leading-relaxed">{children}</div>
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-8">
            <div className="text-center mb-10">
                <h3 className="text-xl font-bold text-[#EAECEF] uppercase tracking-wider mb-2">{calcData.type === 'Achievement' ? 'Achievement Bonus Setup' : 'Commission Engine Setup'}</h3>
                <p className="text-secondary text-[11px] font-bold uppercase tracking-widest">Select a template or build custom</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                    { id: 'tiered_sales', title: 'Tiered Bonus', desc: 'Rewards increase at milestones.', icon: '🏆', color: 'text-primary', type: 'Achievement' },
                    { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'Progressive weekly goals.', icon: '⚡', color: 'text-primary', type: 'Achievement' },
                    { id: 'flat_commission', title: 'Flat Comm.', desc: 'Fixed % across all sales.', icon: '💰', color: 'text-primary', type: 'Commission' },
                    { id: 'above_target', title: 'Above Target', desc: 'Applied only above goal.', icon: '🎯', color: 'text-primary', type: 'Commission' }
                ].filter(tmp => tmp.type === calcData.type).map(tmp => (
                    <button key={tmp.id} onClick={() => applyTemplate(tmp.id)} className="bg-bg-black border border-[#2B3139] hover:border-primary p-5 rounded-md text-left transition-all group">
                        <div className={`text-2xl mb-3 ${tmp.color}`}>{tmp.icon}</div>
                        <div className="text-[12px] font-bold text-[#EAECEF] uppercase mb-1 tracking-wider">{tmp.title}</div>
                        <div className="text-[10px] text-secondary font-bold uppercase tracking-wide">{tmp.desc}</div>
                    </button>
                ))}
            </div>

            <div className="relative">
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-widest mb-2">Calculator Name</label>
                <input 
                    type="text" value={calcData.name} onChange={e => updateField('name', e.target.value)}
                    className="w-full bg-bg-black border border-[#2B3139] rounded-md px-4 py-3 text-[#EAECEF] font-bold focus:border-primary outline-none text-sm"
                    placeholder="e.g. Q3 Sales Hero Bonus..."
                />
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-3 flex items-center gap-2">
                <span className="text-primary">02</span> Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Status</label>
                        <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                            {['Active', 'Draft', 'Disable'].map(s => (
                                <button key={s} onClick={() => updateField('status', s)} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${calcData.status === s ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{s}</button>
                            ))}
                        </div>
                    </div>

                    {calcData.type === 'Commission' && (
                        <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Commission Type</label>
                            <select 
                                value={calcData.commissionType} onChange={e => updateField('commissionType', e.target.value)}
                                className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-primary"
                            >
                                <option value="Flat Commission">Flat Commission</option>
                                <option value="Above Target Commission">Above Target Commission</option>
                                <option value="Tiered Commission">Tiered Commission</option>
                                <option value="Product-Based Commission">Product-Based Commission</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Description</label>
                        <textarea 
                            value={calcData.rulesJson ? JSON.parse(calcData.rulesJson).description : ''} 
                            onChange={e => {
                                const currentRules = calcData.rulesJson ? JSON.parse(calcData.rulesJson) : {};
                                updateField('rulesJson', JSON.stringify({ ...currentRules, description: e.target.value }));
                            }}
                            className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] text-[#EAECEF] min-h-[80px] outline-none focus:border-primary"
                            placeholder="Add details about this program..."
                        ></textarea>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Evaluation Period</label>
                        <select 
                            value={calcData.calculationPeriod} onChange={e => updateField('calculationPeriod', e.target.value)}
                            className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-primary"
                        >
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Per Order">Per Order</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-bg-black rounded-md border border-[#2B3139]">
                        <div>
                            <h4 className="text-[11px] font-bold text-[#EAECEF] uppercase">Reset Progress</h4>
                            <p className="text-[9px] text-secondary font-bold uppercase tracking-wider">Clear counts every period</p>
                        </div>
                        <input type="checkbox" checked={calcData.resetEveryPeriod} onChange={e => updateField('resetEveryPeriod', e.target.checked)} className="w-4 h-4 accent-primary" />
                    </div>

                    {calcData.calculationPeriod === 'Weekly' && (
                         <div className="flex items-center justify-between p-3 bg-bg-black rounded-md border border-[#2B3139]">
                         <div>
                             <h4 className="text-[11px] font-bold text-[#EAECEF] uppercase">Marathon Mode</h4>
                             <p className="text-[9px] text-secondary font-bold uppercase tracking-wider">Cumulative Weekly Progress</p>
                         </div>
                         <input type="checkbox" checked={calcData.isMarathon} onChange={e => updateField('isMarathon', e.target.checked)} className="w-4 h-4 accent-primary" />
                     </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
             <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-3 flex items-center gap-2">
                <span className="text-primary">03</span> Target Entities
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Apply To (Selection)</label>
                    <div className="bg-bg-black border border-[#2B3139] rounded-md p-3 max-h-[250px] overflow-y-auto space-y-4 custom-scrollbar">
                        <div>
                            <span className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2 block">Roles</span>
                            <div className="flex flex-wrap gap-1.5">
                                {appData.roles?.map(r => (
                                    <button key={r.roleName} type="button" onClick={() => toggleApplyTo(`Role:${r.roleName}`)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${calcData.applyTo?.includes(`Role:${r.roleName}`) ? 'bg-primary text-bg-black border-primary' : 'bg-card-bg border-[#2B3139] text-secondary'}`}>
                                        {r.roleName}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2 block">Teams</span>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from(new Set(appData.pages?.map(p => p.Team))).filter(t => t).map(team => (
                                    <button key={team} type="button" onClick={() => toggleApplyTo(`Team:${team}`)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${calcData.applyTo?.includes(`Team:${team}`) ? 'bg-primary text-bg-black border-primary' : 'bg-card-bg border-[#2B3139] text-secondary'}`}>
                                        {team}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Performance Metric</label>
                        <select 
                            value={calcData.metricType} onChange={e => updateField('metricType', e.target.value)}
                            className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-primary"
                        >
                            <option value="Sales Amount">Sales Amount ($)</option>
                            <option value="Number of Orders">Number of Orders</option>
                            <option value="Revenue">Revenue</option>
                            <option value="Profit">Profit</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Unit</label>
                        <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                            {['USD', 'Count', '%'].map(u => (
                                <button key={u} onClick={() => updateField('metricUnit', u)} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${calcData.metricUnit === u ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{u}</button>
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
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-[#2B3139] pb-3">
                        <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider flex items-center gap-2">
                            <span className="text-primary">04</span> Milestone Setup
                        </h3>
                        <button onClick={() => {
                            const nt = [...(calcData.achievementTiers || [])];
                            const lastTarget = nt.length > 0 ? Math.max(...nt.map(t => t.target)) : 0;
                            nt.push({ id: `t${Date.now()}`, target: lastTarget + 1000, rewardAmount: 0, rewardType: 'Fixed Cash', name: `Tier ${nt.length + 1}` });
                            updateField('achievementTiers', nt);
                        }} className="px-3 py-1 bg-primary text-bg-black rounded text-[10px] font-bold uppercase tracking-wider transition-all">+ Add Tier</button>
                    </div>

                    <div className="space-y-2">
                        {sortedTiers.map((tier, idx) => (
                            <div key={tier.id} className="flex items-center gap-3 bg-bg-black p-3 rounded-md border border-[#2B3139]">
                                <div className="w-8 h-8 shrink-0 rounded bg-card-bg border border-[#2B3139] flex items-center justify-center text-[10px] font-bold text-secondary font-mono">{idx + 1}</div>
                                <input type="text" value={tier.name || ''} placeholder="Name" onChange={e => {
                                    const nt = [...(calcData.achievementTiers||[])];
                                    const i = nt.findIndex(t => t.id === tier.id);
                                    nt[i].name = e.target.value;
                                    updateField('achievementTiers', nt);
                                }} className="bg-transparent border-none text-[11px] font-bold text-[#EAECEF] focus:ring-0 w-24 uppercase" />
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <div className="relative">
                                        <input type="number" value={tier.target} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].target = Number(e.target.value);
                                             updateField('achievementTiers', nt);
                                        }} className="w-full bg-card-bg border border-[#2B3139] rounded px-2 py-1.5 text-[11px] font-mono font-bold text-[#EAECEF] outline-none" />
                                    </div>
                                    <div className="flex bg-card-bg border border-[#2B3139] rounded overflow-hidden">
                                        <input type="number" value={tier.rewardAmount} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].rewardAmount = Number(e.target.value);
                                             updateField('achievementTiers', nt);
                                        }} className="w-full bg-transparent border-none px-2 py-1 text-[11px] font-mono font-bold text-primary text-right focus:ring-0" />
                                        <select value={tier.rewardType} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].rewardType = e.target.value as any;
                                             updateField('achievementTiers', nt);
                                        }} className="bg-[#2B3139] border-none px-1 text-[9px] font-bold text-secondary outline-none">
                                            <option value="Fixed Cash">$</option>
                                            <option value="Percentage">%</option>
                                        </select>
                                    </div>
                                </div>
                                <button onClick={() => updateField('achievementTiers', (calcData.achievementTiers||[]).filter(t => t.id !== tier.id))} className="text-[#474D57] hover:text-red-500 p-1">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        } else {
            return (
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-3 flex items-center gap-2">
                        <span className="text-primary">04</span> Commission Logic
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Calculation Method</label>
                                <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                                    {['Percentage', 'Fixed Amount'].map(m => (
                                        <button key={m} onClick={() => updateField('commissionMethod', m)} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${calcData.commissionMethod === m ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{m}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Condition</label>
                                <div className="space-y-1.5">
                                    {['On Total Sales', 'Above Target', 'Per Transaction'].map(c => (
                                        <button key={c} onClick={() => updateField('commissionCondition', c)} className={`w-full flex items-center gap-3 p-3 rounded border transition-all ${calcData.commissionCondition === c ? 'bg-primary/5 border-primary text-primary' : 'bg-bg-black border-[#2B3139] text-secondary'}`}>
                                            <div className={`w-2.5 h-2.5 rounded-full border ${calcData.commissionCondition === c ? 'bg-primary border-primary' : 'border-[#474D57]'}`}></div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{c}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {calcData.commissionCondition === 'Above Target' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Target Threshold</label>
                                    <input type="number" value={calcData.targetAmount} onChange={e => updateField('targetAmount', Number(e.target.value))} className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-mono font-bold text-[#EAECEF] outline-none focus:border-primary" />
                                    <p className="text-[9px] text-secondary font-bold uppercase mt-1 italic">Rule: (Performance - Target) × Rate</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Commission Rate ({calcData.commissionMethod === 'Percentage' ? '%' : '$'})</label>
                                <input type="number" value={calcData.commissionRate} onChange={e => updateField('commissionRate', Number(e.target.value))} className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-lg font-mono font-bold text-primary outline-none focus:border-primary" />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    };

    const renderStep5 = () => {
        let result = 0;
        if (calcData.type === 'Achievement') {
            const tiers = [...(calcData.achievementTiers || [])].sort((a, b) => a.target - b.target);
            const achieved = tiers.filter(t => previewInput >= t.target).pop();
            if (achieved) {
                result = achieved.rewardType === 'Percentage' ? previewInput * (achieved.rewardAmount/100) : achieved.rewardAmount;
            }
        } else {
            if (calcData.commissionCondition === 'Above Target') {
                const diff = Math.max(0, previewInput - (calcData.targetAmount || 0));
                result = (calcData.commissionMethod === 'Percentage') ? diff * ((calcData.commissionRate || 0)/100) : (diff > 0 ? (calcData.commissionRate || 0) : 0);
            } else {
                result = (calcData.commissionMethod === 'Percentage') ? previewInput * ((calcData.commissionRate || 0)/100) : (calcData.commissionRate || 0);
            }
        }

        return (
            <div className="space-y-6">
                 <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-3 flex items-center gap-2">
                    <span className="text-primary">05</span> Simulation & Splitting
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Simulator</label>
                        <div className="bg-bg-black p-6 rounded-md border border-[#2B3139] text-center">
                             <div className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-4">Input Metric</div>
                             <div className="flex items-center justify-center gap-2 mb-6">
                                <span className="text-xl font-bold text-[#474D57] font-mono">$</span>
                                <input type="number" value={previewInput} onChange={e => setPreviewInput(Number(e.target.value))} className="bg-transparent border-none text-3xl font-mono font-bold text-[#EAECEF] text-center w-36 focus:ring-0" />
                             </div>
                             <div className="pt-4 border-t border-[#2B3139]">
                                <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Reward Preview</div>
                                <div className="text-4xl font-mono font-bold text-primary tracking-tighter">
                                    <span className="text-lg text-secondary mr-1">$</span>
                                    {result.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Splitting Logic</label>
                        <div className="bg-bg-black p-4 rounded-md border border-[#2B3139] space-y-2">
                            {['Equal Split', 'Percentage Allocation'].map(m => (
                                <button key={m} onClick={() => updateField('distributionRule', { ...calcData.distributionRule, method: m })} className={`w-full flex items-center justify-between p-3 rounded border transition-all ${calcData.distributionRule?.method === m ? 'bg-primary/5 border-primary text-primary' : 'bg-card-bg border-[#2B3139] text-secondary'}`}>
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{m}</span>
                                    {calcData.distributionRule?.method === m && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </button>
                            ))}
                        </div>
                        <InfoBox title="Splitting Rule">
                            Define how earned rewards are distributed among team members.
                        </InfoBox>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="ui-binance w-full min-h-screen bg-bg-black text-[#EAECEF] font-sans">
            <div className="max-w-4xl mx-auto p-4 sm:p-8 pb-32">
                {/* Header */}
                <div className="flex justify-between items-center mb-8 bg-card-bg p-4 rounded-md border border-[#2B3139]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-bg-black border border-[#2B3139] text-primary">
                            {type === 'Achievement' ? <Zap className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#EAECEF] uppercase tracking-wider">{type === 'Achievement' ? 'Achievement Bonus' : 'Commission Engine'}</h2>
                            <p className="text-[9px] text-secondary font-bold uppercase tracking-widest">v2.1 Build Engine</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-secondary hover:text-[#EAECEF] transition-colors p-2 bg-bg-black rounded-md border border-[#2B3139]"><X className="w-5 h-5" /></button>
                </div>

                {/* Stepper */}
                <div className="flex justify-between mb-10 px-4 relative">
                    <div className="absolute top-4 left-4 right-4 h-px bg-[#2B3139] z-0"></div>
                    <div className="absolute top-4 left-4 h-px bg-primary z-0 transition-all duration-300" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
                    {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold z-10 border transition-all ${step >= s ? 'bg-primary border-primary text-bg-black' : 'bg-bg-black border-[#2B3139] text-secondary'}`}>{s}</div>
                    ))}
                </div>

                {/* Content Container */}
                <div className="bg-card-bg border border-[#2B3139] rounded-md p-6 sm:p-8 min-h-[450px]">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}
                    {step === 5 && renderStep5()}
                </div>

                {/* Navigation Footer */}
                <div className="fixed bottom-0 left-0 w-full p-4 bg-bg-black border-t border-[#2B3139] flex justify-center z-50">
                    <div className="max-w-4xl w-full flex justify-between items-center">
                        <button 
                            disabled={step === 1} onClick={() => setStep(s => s - 1)}
                            className="px-6 py-2 bg-card-bg text-secondary rounded-md font-bold uppercase text-[11px] tracking-wider disabled:opacity-0 border border-[#2B3139] flex items-center gap-2"
                        ><ChevronLeft className="w-4 h-4" /> Back</button>
                        
                        {step < 5 ? (
                            <button 
                                disabled={step === 1 && !calcData.name}
                                onClick={() => setStep(s => s + 1)}
                                className="px-6 py-2 bg-primary text-bg-black rounded-md font-bold uppercase text-[11px] tracking-wider flex items-center gap-2"
                            >Next <ChevronRight className="w-4 h-4" /></button>
                        ) : (
                            <button 
                                onClick={handleSave}
                                className="px-8 py-2 bg-primary text-bg-black rounded-md font-bold uppercase text-[11px] tracking-wider flex items-center gap-2"
                            ><Save className="w-4 h-4" /> Save Engine</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculatorBuilder;
