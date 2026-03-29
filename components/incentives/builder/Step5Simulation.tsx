import React from 'react';
import { IncentiveCalculator } from '../../../types';
import { Info } from 'lucide-react';

interface Step5SimulationProps {
    calcData: Partial<IncentiveCalculator>;
    previewInput: number;
    setPreviewInput: (val: number) => void;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
}

const Step5Simulation: React.FC<Step5SimulationProps> = ({ calcData, previewInput, setPreviewInput, updateField }) => {
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
                            <button key={m} onClick={() => updateField('distributionRule', { ...calcData.distributionRule, method: m as any })} className={`w-full flex items-center justify-between p-3 rounded border transition-all ${calcData.distributionRule?.method === m ? 'bg-primary/5 border-primary text-primary' : 'bg-card-bg border-[#2B3139] text-secondary'}`}>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{m}</span>
                                {calcData.distributionRule?.method === m && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </button>
                        ))}
                    </div>
                    <div className="bg-bg-black border border-[#2B3139] p-4 rounded-md mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="w-4 h-4 text-primary" />
                            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">Splitting Rule</h4>
                        </div>
                        <div className="text-[11px] text-secondary font-medium leading-relaxed">Define how earned rewards are distributed among team members.</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step5Simulation;
