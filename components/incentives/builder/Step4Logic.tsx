import React from 'react';
import { IncentiveCalculator } from '../../../types';

interface Step4LogicProps {
    calcData: Partial<IncentiveCalculator>;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
}

const Step4Logic: React.FC<Step4LogicProps> = ({ calcData, updateField }) => {
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
    }

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
};

export default Step4Logic;
