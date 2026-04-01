import React from 'react';
import { IncentiveCalculator } from '../../../types';
import { Info, Rocket, MousePointer2, GitBranch, Terminal, Activity } from 'lucide-react';

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
        <div className="space-y-10">
            <div className="flex items-center gap-4 border-b border-[#1A1A1A] pb-6">
                <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-[#F0B90B]" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">Protocol_Simulation_Lab</h3>
                    <p className="text-[9px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">Validate logic output and define distribution topology</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Terminal className="w-3.5 h-3.5 text-[#707A8A]" />
                        <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Input_Stress_Test</label>
                    </div>
                    <div className="bg-[#080808] p-8 rounded border border-[#1A1A1A] text-center relative overflow-hidden group">
                         <div className="absolute top-0 left-0 w-1 h-full bg-[#F0B90B]/20"></div>
                         <div className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em] mb-6">Simulated_KPI_Metric</div>
                         <div className="flex items-center justify-center gap-3 mb-8">
                            <span className="text-xl font-black text-[#1A1A1A] font-mono group-hover:text-[#F0B90B]/20 transition-colors">$</span>
                            <input type="number" value={previewInput} onChange={e => setPreviewInput(Number(e.target.value))} className="bg-[#050505] border border-[#1A1A1A] rounded h-14 text-3xl font-mono font-black text-[#EAECEF] text-center w-48 focus:border-[#F0B90B]/50 transition-all outline-none shadow-inner" />
                         </div>
                         <div className="pt-6 border-t border-[#1A1A1A]">
                            <div className="text-[9px] font-black text-[#0ECB81] uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                                <Activity className="w-3 h-3" /> Projected_Yield_Output
                            </div>
                            <div className="text-4xl font-mono font-black text-[#0ECB81] tracking-tighter drop-shadow-[0_0_15px_rgba(14,203,129,0.2)]">
                                <span className="text-lg text-[#707A8A] mr-2 opacity-30">$</span>
                                {result.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                         </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <GitBranch className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Distribution_Protocol</label>
                        </div>
                        <div className="bg-[#050505] p-2 rounded border border-[#1A1A1A] space-y-1">
                            {['Equal Split', 'Percentage Allocation'].map(m => (
                                <button key={m} onClick={() => updateField('distributionRule', { ...calcData.distributionRule, method: m as any })} className={`w-full h-11 flex items-center justify-between px-4 rounded transition-all uppercase tracking-widest ${calcData.distributionRule?.method === m ? 'bg-[#2B3139] text-[#F0B90B]' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}>
                                    <span className="text-[10px] font-black">{m.replace(' ', '_')}</span>
                                    {calcData.distributionRule?.method === m && <div className="w-1.5 h-1.5 rounded-full bg-[#F0B90B] shadow-[0_0_8px_#F0B90B]" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#080808] border border-[#1A1A1A] p-5 rounded relative group overflow-hidden">
                        <div className="flex items-center gap-3 mb-3">
                            <Info className="w-4 h-4 text-[#F0B90B]" />
                            <h4 className="text-[10px] font-black text-[#EAECEF] uppercase tracking-[0.2em]">Topo_Guideline</h4>
                        </div>
                        <div className="text-[10px] text-[#707A8A] font-bold leading-relaxed uppercase tracking-widest">
                            Define how earned yield assets are distributed among identified entity nodes in the target group.
                        </div>
                        <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <GitBranch className="w-20 h-20 rotate-45" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step5Simulation;