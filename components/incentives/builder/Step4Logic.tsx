import React from 'react';
import { IncentiveCalculator } from '../../../types';
import { Layers, Plus, Target, Terminal, X, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

interface Step4LogicProps {
    calcData: Partial<IncentiveCalculator>;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
}

const Step4Logic: React.FC<Step4LogicProps> = ({ calcData, updateField }) => {
    if (calcData.type === 'Achievement') {
        const sortedTiers = [...(calcData.achievementTiers || [])].sort((a, b) => a.target - b.target);
        return (
            <div className="space-y-10">
                <div className="flex justify-between items-center border-b border-[#1A1A1A] pb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                            <Target className="w-5 h-5 text-[#F0B90B]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">Milestone_Architecture</h3>
                            <p className="text-[9px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">Define progressive reward tiers and yield lock points</p>
                        </div>
                    </div>
                    <button onClick={() => {
                        const nt = [...(calcData.achievementTiers || [])];
                        const lastTarget = nt.length > 0 ? Math.max(...nt.map(t => t.target)) : 0;
                        nt.push({ id: `t${Date.now()}`, target: lastTarget + 1000, rewardAmount: 0, rewardType: 'Fixed Cash', name: `LVL_${nt.length + 1}` });
                        updateField('achievementTiers', nt);
                    }} className="h-9 px-4 bg-[#F0B90B] hover:bg-[#D4A50A] text-black rounded text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-[#F0B90B]/10">+ ADD_TIER</button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {sortedTiers.map((tier, idx) => (
                        <div key={tier.id} className="flex items-center gap-4 bg-[#080808] p-4 rounded border border-[#1A1A1A] group hover:border-[#F0B90B]/30 transition-all">
                            <div className="w-10 h-10 shrink-0 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center text-xs font-black text-[#F0B90B] font-mono shadow-inner group-hover:bg-[#F0B90B]/5 transition-colors">{(idx + 1).toString().padStart(2, '0')}</div>
                            
                            <div className="w-32">
                                <label className="text-[8px] font-black text-[#707A8A] uppercase tracking-widest mb-1 block">Identity</label>
                                <input type="text" value={tier.name || ''} placeholder="ID_KEY" onChange={e => {
                                    const nt = [...(calcData.achievementTiers||[])];
                                    const i = nt.findIndex(t => t.id === tier.id);
                                    nt[i].name = e.target.value;
                                    updateField('achievementTiers', nt);
                                }} className="bg-[#050505] border border-[#1A1A1A] rounded h-9 px-3 text-[10px] font-bold text-[#EAECEF] focus:border-[#F0B90B]/50 focus:ring-0 w-full uppercase tracking-widest outline-none transition-all" />
                            </div>

                            <div className="flex-1 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[8px] font-black text-[#707A8A] uppercase tracking-widest mb-1 block">Target_Threshold</label>
                                    <div className="relative">
                                        <input type="number" value={tier.target} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].target = Number(e.target.value);
                                             updateField('achievementTiers', nt);
                                        }} className="w-full bg-[#050505] border border-[#1A1A1A] rounded h-9 px-3 text-[11px] font-mono font-bold text-[#EAECEF] outline-none focus:border-[#F0B90B]/50 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-[#707A8A] uppercase tracking-widest mb-1 block">Yield_Payout</label>
                                    <div className="flex bg-[#050505] border border-[#1A1A1A] rounded overflow-hidden focus-within:border-[#F0B90B]/50 transition-all">
                                        <input type="number" value={tier.rewardAmount} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].rewardAmount = Number(e.target.value);
                                             updateField('achievementTiers', nt);
                                        }} className="w-full bg-transparent border-none h-9 px-3 text-[11px] font-mono font-bold text-[#0ECB81] focus:ring-0 outline-none" />
                                        <select value={tier.rewardType} onChange={e => {
                                             const nt = [...(calcData.achievementTiers||[])];
                                             const i = nt.findIndex(t => t.id === tier.id);
                                             nt[i].rewardType = e.target.value as any;
                                             updateField('achievementTiers', nt);
                                        }} className="bg-[#1A1A1A] border-none px-2 text-[9px] font-bold text-[#707A8A] outline-none cursor-pointer uppercase">
                                            <option value="Fixed Cash">USD</option>
                                            <option value="Percentage">PCT</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <button onClick={() => updateField('achievementTiers', (calcData.achievementTiers||[]).filter(t => t.id !== tier.id))} className="w-8 h-8 flex items-center justify-center text-[#707A8A] hover:text-[#F6465D] hover:bg-[#F6465D]/10 rounded transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {sortedTiers.length === 0 && (
                        <div className="h-32 border border-[#1A1A1A] border-dashed rounded flex flex-col items-center justify-center text-[#707A8A] uppercase tracking-[0.2em] text-[10px] font-bold">
                            <Terminal className="w-6 h-6 mb-2 opacity-20" />
                            No_Milestones_Defined
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-4 border-b border-[#1A1A1A] pb-6">
                <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                    <Layers className="w-5 h-5 text-[#0ECB81]" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">Commission_Logic_Studio</h3>
                    <p className="text-[9px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">Configure transaction-based payout rules and conditions</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Calculation_Method</label>
                        </div>
                        <div className="flex p-1 bg-[#050505] rounded border border-[#1A1A1A]">
                            {['Percentage', 'Fixed Amount'].map(m => (
                                <button key={m} onClick={() => updateField('commissionMethod', m)} className={`flex-1 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${calcData.commissionMethod === m ? 'bg-[#2B3139] text-[#0ECB81] shadow-lg' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}>{m}</button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Trigger_Condition</label>
                        </div>
                        <div className="space-y-2">
                            {['On Total Sales', 'Above Target', 'Per Transaction'].map(c => (
                                <button key={c} onClick={() => updateField('commissionCondition', c)} className={`w-full h-11 flex items-center justify-between px-4 rounded border transition-all ${calcData.commissionCondition === c ? 'bg-[#0ECB81]/5 border-[#0ECB81]/40 text-[#0ECB81]' : 'bg-[#050505] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF]'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{c}</span>
                                    {calcData.commissionCondition === c && <Zap className="w-3.5 h-3.5 fill-[#0ECB81]" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {calcData.commissionCondition === 'Above Target' && (
                        <div className="space-y-3 p-5 bg-[#080808] border border-[#1A1A1A] rounded animate-in zoom-in-95 duration-300">
                            <div className="flex items-center gap-2">
                                <ArrowRight className="w-3.5 h-3.5 text-[#F0B90B]" />
                                <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Target_Threshold_Locked</label>
                            </div>
                            <input type="number" value={calcData.targetAmount} onChange={e => updateField('targetAmount', Number(e.target.value))} className="w-full h-11 bg-[#050505] border border-[#1A1A1A] rounded px-4 text-[13px] font-mono font-bold text-[#EAECEF] outline-none focus:border-[#F0B90B]/50 transition-all" />
                            <p className="text-[8px] font-bold text-[#707A8A] uppercase tracking-widest italic opacity-60">Rule: (PERF_KPI - TARGET) × RATE_VAL</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Multiplier_Value ({calcData.commissionMethod === 'Percentage' ? '%' : '$'})</label>
                        </div>
                        <input type="number" value={calcData.commissionRate} onChange={e => updateField('commissionRate', Number(e.target.value))} className="w-full h-14 bg-[#050505] border border-[#1A1A1A] rounded px-6 text-2xl font-mono font-black text-[#F0B90B] outline-none focus:border-[#F0B90B] transition-all shadow-inner" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step4Logic;