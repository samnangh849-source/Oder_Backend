import React from 'react';
import { IncentiveCalculator } from '../../../types';
import { Layers, Plus, Target, Terminal, X, Zap, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { AppContext } from '../../../context/AppContext';
import { translations } from '../../../translations';

interface Step4LogicProps {
    calcData: Partial<IncentiveCalculator>;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
}

const Step4Logic: React.FC<Step4LogicProps> = ({ calcData, updateField }) => {
    const { language } = React.useContext(AppContext);
    const t = translations[language];

    if (calcData.type === 'Achievement') {
        const tiers = calcData.achievementTiers || [];
        
        // Group tiers by subPeriod
        const groups: Record<string, typeof tiers> = {};
        tiers.forEach(tier => {
            const key = tier.subPeriod || 'Default';
            if (!groups[key]) groups[key] = [];
            groups[key].push(tier);
        });

        // Sort subPeriods (W1, W2, etc.)
        const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
            if (a === 'Default') return 1;
            if (b === 'Default') return -1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        const handleAddTier = (period?: string) => {
            const nt = [...tiers];
            const lastTarget = nt.length > 0 ? Math.max(...nt.map(t => t.target)) : 0;
            nt.push({ 
                id: `t${Date.now()}`, 
                target: lastTarget + 1000, 
                rewardAmount: 0, 
                rewardType: 'Fixed Cash', 
                name: `LVL_${nt.length + 1}`,
                subPeriod: period || ''
            });
            updateField('achievementTiers', nt);
        };

        const updateTier = (id: string, field: string, value: any) => {
            const nt = [...tiers];
            const i = nt.findIndex(t => t.id === id);
            (nt[i] as any)[field] = value;
            updateField('achievementTiers', nt);
        };

        const removeTier = (id: string) => {
            updateField('achievementTiers', tiers.filter(t => t.id !== id));
        };

        return (
            <div className="space-y-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-black border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(252,213,53,0.1)]">
                            <Target className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-[0.2em]">{t.milestone_architecture || 'Milestone_Architecture'}</h3>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">{t.milestone_setup || 'Define progressive reward tiers and yield lock points'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleAddTier()}
                        className="h-12 px-8 bg-primary hover:bg-[#FCD535] text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95 shadow-[0_10px_30px_rgba(252,213,53,0.2)]"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" /> {t.add_tier || 'ADD_TIER'}
                    </button>
                </div>

                <div className="space-y-12">
                    {sortedGroupKeys.map((groupKey) => (
                        <div key={groupKey} className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/5"></div>
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] bg-primary/5 px-4 py-1.5 rounded-full border border-primary/20 shadow-[0_0_15px_rgba(252,213,53,0.05)]">
                                    {groupKey === 'Default' ? 'GLOBAL_TARGETS' : groupKey}
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/5"></div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {groups[groupKey].sort((a,b) => a.target - b.target).map((tier) => (
                                    <div key={tier.id} className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-primary/30 rounded-[32px] p-6 transition-all duration-500">
                                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1.5fr_auto] gap-8 items-center">
                                            {/* Tier Identity */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="w-3 h-3 text-white/20" />
                                                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{t.field_id}</label>
                                                </div>
                                                <input 
                                                    type="text" value={tier.name || ''} placeholder="ID_KEY"
                                                    onChange={e => updateTier(tier.id, 'name', e.target.value)}
                                                    className="w-full bg-black border border-white/5 rounded-xl h-12 px-4 text-[11px] font-black text-white focus:border-primary/50 outline-none transition-all uppercase tracking-widest"
                                                />
                                            </div>

                                            {/* Target Threshold */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Target className="w-3 h-3 text-white/20" />
                                                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{t.target_threshold}</label>
                                                </div>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-black text-[10px]">$</div>
                                                    <input 
                                                        type="number" value={tier.target}
                                                        onChange={e => updateTier(tier.id, 'target', Number(e.target.value))}
                                                        className="w-full bg-black border border-white/5 rounded-xl h-12 pl-8 pr-4 text-[13px] font-mono font-black text-white focus:border-primary/50 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Payout Logic */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-3 h-3 text-white/20" />
                                                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{t.yield_payout}</label>
                                                </div>
                                                <div className="flex bg-black border border-white/5 rounded-xl overflow-hidden focus-within:border-emerald-500/50 transition-all">
                                                    <input 
                                                        type="number" value={tier.rewardAmount}
                                                        onChange={e => updateTier(tier.id, 'rewardAmount', Number(e.target.value))}
                                                        className="flex-1 bg-transparent border-none h-12 px-4 text-[13px] font-mono font-black text-emerald-400 outline-none"
                                                    />
                                                    <select 
                                                        value={tier.rewardType}
                                                        onChange={e => updateTier(tier.id, 'rewardType', e.target.value)}
                                                        className="bg-white/5 border-none px-4 text-[10px] font-black text-white/40 outline-none cursor-pointer uppercase tracking-widest hover:text-white transition-colors"
                                                    >
                                                        <option value="Fixed Cash">USD</option>
                                                        <option value="Percentage">PCT</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Delete Action */}
                                            <button 
                                                onClick={() => removeTier(tier.id)}
                                                className="w-12 h-12 flex items-center justify-center bg-black hover:bg-red-500/10 text-white/20 hover:text-red-500 rounded-2xl border border-white/5 transition-all group/del"
                                            >
                                                <X className="w-5 h-5 group-hover/del:rotate-90 transition-transform duration-300" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => handleAddTier(groupKey === 'Default' ? '' : groupKey)}
                                    className="h-14 border border-white/5 border-dashed rounded-[24px] flex items-center justify-center gap-3 text-white/20 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all text-[10px] font-black uppercase tracking-[0.3em] group/add"
                                >
                                    <Plus className="w-4 h-4 group-hover/add:scale-125 transition-transform" /> 
                                    Insert_Tier_into_{groupKey}
                                </button>
                            </div>
                        </div>
                    ))}

                    {tiers.length === 0 && (
                        <div className="h-64 border border-white/5 border-dashed rounded-[48px] flex flex-col items-center justify-center text-white/10 group">
                            <Terminal className="w-12 h-12 mb-4 opacity-10 group-hover:opacity-20 transition-opacity" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">{t.no_calculators}</p>
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
                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">{t.commission_rule || 'Commission_Logic_Studio'}</h3>
                    <p className="text-[9px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">{t.calculators_engine_desc}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.reward_method || 'Calculation_Method'}</label>
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
                                <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.target_threshold || 'Target_Threshold_Locked'}</label>
                            </div>
                            <input type="number" value={calcData.targetAmount} onChange={e => updateField('targetAmount', Number(e.target.value))} className="w-full h-11 bg-[#050505] border border-[#1A1A1A] rounded px-4 text-[13px] font-mono font-bold text-[#EAECEF] outline-none focus:border-[#F0B90B]/50 transition-all" />
                            <p className="text-[8px] font-bold text-[#707A8A] uppercase tracking-widest italic opacity-60">Rule: (PERF_KPI - TARGET) × RATE_VAL</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.multiplier_value || 'Multiplier_Value'} ({calcData.commissionMethod === 'Percentage' ? '%' : '$'})</label>
                        </div>
                        <input type="number" value={calcData.commissionRate} onChange={e => updateField('commissionRate', Number(e.target.value))} className="w-full h-14 bg-[#050505] border border-[#1A1A1A] rounded px-6 text-2xl font-mono font-black text-[#F0B90B] outline-none focus:border-[#F0B90B] transition-all shadow-inner" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step4Logic;