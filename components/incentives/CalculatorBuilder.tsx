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
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">ចាប់ផ្តើមបង្កើតលក្ខខណ្ឌ</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">ជ្រើសរើសគំរូដែលមានស្រាប់ ដើម្បីចំណេញពេលវេលា</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { id: 'tiered_sales', title: 'Tiered Bonus', desc: 'រង្វាន់កើនតាមកម្រិតលក់', icon: '🏆' },
                    { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'គោលដៅប្រចាំសប្តាហ៍', icon: '⚡' },
                    { id: 'flat_commission', title: 'Flat Comm.', desc: 'កម្រៃជើងសារថេរ', icon: '💰' }
                ].map(tmp => (
                    <button key={tmp.id} onClick={() => applyTemplate(tmp.id)} className="p-6 bg-slate-900/50 border-2 border-slate-800 rounded-3xl hover:border-indigo-500 hover:bg-indigo-500/5 transition-all text-left group">
                        <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">{tmp.icon}</div>
                        <div className="text-sm font-black text-white uppercase mb-1">{tmp.title}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">{tmp.desc}</div>
                    </button>
                ))}
            </div>

            <div className="relative flex items-center py-4">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">ឬ បង្កើតដោយខ្លួនឯង</span>
                <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 italic">ឈ្មោះម៉ាស៊ីនគណនា</label>
                <input 
                    type="text" value={calcData.name} onChange={e => updateField('name', e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold focus:border-indigo-500 focus:ring-0 shadow-inner"
                    placeholder="ឧ. ប្រាក់លើកទឹកចិត្តប្រចាំខែ..."
                />
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6 animate-fade-in">
            <h3 className="text-lg font-black text-white uppercase tracking-tight border-b border-slate-800 pb-3">ស្វែងយល់ពី Metrics & Periods</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Metric Type</label>
                    <select value={calcData.metricType} onChange={e => updateField('metricType', e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-xl px-4 py-3 text-white font-bold">
                        <option value="Sales Amount">Sales Amount ($)</option>
                        <option value="Number of Orders">Order Count</option>
                        <option value="Revenue">Revenue ($)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Calculation Period</label>
                    <select value={calcData.calculationPeriod} onChange={e => updateField('calculationPeriod', e.target.value)} className="w-full bg-slate-900 border-slate-700 rounded-xl px-4 py-3 text-white font-bold">
                        <option value="Weekly">Weekly (W1-W5)</option>
                        <option value="Monthly">Monthly</option>
                    </select>
                </div>
            </div>
            <InfoBox title="Marathon Mode">
                ប្រសិនបើបើក <b>Marathon Mode</b> គោលដៅនឹងត្រូវគណនាដោយបូកសន្សំពីសប្តាហ៍ទី១ ដល់ទី៤។ បើបិទ វានឹងគិតគោលដៅដាច់ដោយឡែករៀងរាល់សប្តាហ៍។
            </InfoBox>
            <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 cursor-pointer" onClick={() => updateField('isMarathon', !calcData.isMarathon)}>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${calcData.isMarathon ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${calcData.isMarathon ? 'left-5' : 'left-1'}`}></div>
                </div>
                <span className="text-xs font-black text-white uppercase tracking-widest">Enable Marathon Mode</span>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">កំណត់លក្ខខណ្ឌ (Rules)</h3>
                <button onClick={() => {
                    const nt = [...(calcData.achievementTiers || [])];
                    nt.push({ id: `t${Date.now()}`, target: 0, rewardAmount: 0, rewardType: 'Fixed Cash', subPeriod: calcData.calculationPeriod === 'Weekly' ? 'W1' : undefined });
                    updateField('achievementTiers', nt);
                }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">+ Add Tier</button>
            </div>

            <div className="space-y-3">
                {(calcData.achievementTiers || []).map((tier, idx) => (
                    <div key={tier.id} className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-600 bg-slate-800 w-6 h-6 rounded-full flex items-center justify-center">{idx + 1}</div>
                        <div className="flex-1">
                            <input type="number" value={tier.target} onChange={e => {
                                const nt = [...(calcData.achievementTiers||[])]; nt[idx].target = Number(e.target.value); updateField('achievementTiers', nt);
                            }} className="w-full bg-transparent border-none p-0 text-sm text-white font-bold focus:ring-0" placeholder="Target Amount" />
                            <div className="text-[8px] text-slate-500 font-black uppercase mt-1">If Sales &gt;= Target</div>
                        </div>
                        <div className="w-px h-8 bg-white/5"></div>
                        <div className="flex-1 flex gap-2">
                            <input type="number" value={tier.rewardAmount} onChange={e => {
                                const nt = [...(calcData.achievementTiers||[])]; nt[idx].rewardAmount = Number(e.target.value); updateField('achievementTiers', nt);
                            }} className="w-full bg-transparent border-none p-0 text-sm text-emerald-400 font-bold focus:ring-0 text-right" placeholder="Reward" />
                            <select value={tier.rewardType} onChange={e => {
                                const nt = [...(calcData.achievementTiers||[])]; nt[idx].rewardType = e.target.value as any; updateField('achievementTiers', nt);
                            }} className="bg-transparent border-none p-0 text-[10px] text-white font-black uppercase focus:ring-0 cursor-pointer">
                                <option value="Fixed Cash">$</option>
                                <option value="Percentage">%</option>
                            </select>
                        </div>
                        <button onClick={() => updateField('achievementTiers', (calcData.achievementTiers||[]).filter((_, i) => i !== idx))} className="text-red-500 hover:text-white p-2">✕</button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderStep4 = () => {
        // Simple preview calculation
        const tiers = [...(calcData.achievementTiers || [])].sort((a, b) => b.target - a.target);
        const achieved = tiers.find(t => previewInput >= t.target);
        const reward = achieved ? (achieved.rewardType === 'Percentage' ? previewInput * (achieved.rewardAmount/100) : achieved.rewardAmount) : 0;

        return (
            <div className="space-y-8 animate-fade-in">
                <h3 className="text-lg font-black text-white uppercase tracking-tight border-b border-slate-800 pb-3">សាកល្បងគណនា (Simulator)</h3>
                
                <div className="bg-indigo-600/10 p-6 rounded-[2.5rem] border border-indigo-500/20 shadow-xl">
                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 text-center">សន្មតតួលេខលក់របស់បុគ្គលិក</label>
                    <div className="flex items-center justify-center gap-4">
                        <span className="text-2xl font-black text-slate-600">$</span>
                        <input 
                            type="number" value={previewInput} onChange={e => setPreviewInput(Number(e.target.value))}
                            className="bg-transparent border-b-4 border-indigo-500 text-4xl font-black text-white text-center w-48 focus:ring-0 focus:outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 text-center">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">កម្រិតសម្រេចបាន</div>
                        <div className="text-xl font-black text-indigo-400 uppercase italic">{achieved?.name || 'Below Target'}</div>
                    </div>
                    <div className="bg-emerald-500/10 p-5 rounded-3xl border border-emerald-500/20 text-center">
                        <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-2">ប្រាក់រង្វាន់ទទួលបាន</div>
                        <div className="text-2xl font-black text-emerald-400">${reward.toFixed(2)}</div>
                    </div>
                </div>

                <div className="p-4 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed italic">
                        * ការបង្ហាញខាងលើនេះគ្រាន់តែជាការសាកល្បងតាម Logic ដែលលោកអ្នកបានកំណត់។ តួលេខពិតប្រាកដនឹងត្រូវគណនានៅពេលលោកអ្នកបញ្ចូលទិន្នន័យជាក់ស្តែង។
                    </p>
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