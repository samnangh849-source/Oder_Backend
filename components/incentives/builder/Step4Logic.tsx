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
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">{t.milestone_setup || 'Define progressive reward tiers'}</span>
                                {calcData.isMarathon && (
                                    <div className="flex items-center gap-1 bg-[#F0B90B]/10 border border-[#F0B90B]/20 px-2 py-0.5 rounded-full">
                                        <Zap className="w-2.5 h-2.5 text-[#F0B90B] fill-[#F0B90B]" />
                                        <span className="text-[8px] font-black text-[#F0B90B] uppercase tracking-widest">Marathon_Active</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-[#121212] p-2 rounded-2xl border border-white/5">
                        <div className="px-4 text-center">
                            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Total_Steps</p>
                            <p className="text-sm font-black text-white">{tiers.length}</p>
                        </div>
                        <div className="w-px h-8 bg-white/5"></div>
                        <button 
                            onClick={() => handleAddTier()}
                            className="h-10 px-6 bg-primary hover:bg-[#FCD535] text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95 shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-3.5 h-3.5 stroke-[4]" /> {t.add_tier || 'ADD_TIER'}
                        </button>
                    </div>
                </div>

                <div className="space-y-16">
                    {sortedGroupKeys.map((groupKey) => {
                        const groupTiers = groups[groupKey].sort((a,b) => a.target - b.target);
                        const maxGroupTarget = groupTiers.length > 0 ? groupTiers[groupTiers.length - 1].target : 1;

                        return (
                            <div key={groupKey} className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="h-[2px] w-8 bg-primary shadow-[0_0_10px_rgba(252,213,53,0.5)]"></div>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-xs font-black text-white uppercase tracking-[0.4em]">
                                            {groupKey === 'Default' ? 'GLOBAL_PROTOCOL' : groupKey}
                                        </span>
                                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{groupTiers.length} THRESHOLDS</span>
                                    </div>
                                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 relative">
                                    {/* Vertical logic line */}
                                    <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-primary/50 via-white/5 to-transparent z-0 hidden lg:block"></div>

                                    {groupTiers.map((tier, idx) => (
                                        <div key={tier.id} className="group relative z-10">
                                            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
                                                {/* Sequence Node */}
                                                <div className="hidden lg:flex w-12 h-12 rounded-full bg-[#050505] border-2 border-white/5 group-hover:border-primary/50 items-center justify-center transition-colors duration-500 overflow-hidden">
                                                    <span className="text-[10px] font-black text-white/20 group-hover:text-primary transition-colors">{String(idx + 1).padStart(2, '0')}</span>
                                                </div>

                                                <div className="bg-[#0A0A0A] hover:bg-[#0F0F0F] border border-white/5 hover:border-primary/20 rounded-[24px] p-5 transition-all duration-500 shadow-xl group-hover:shadow-primary/5">
                                                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-6 items-end">
                                                        {/* Tier Name */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Terminal className="w-2.5 h-2.5 text-white/20" />
                                                                <label className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">IDENTIFIER</label>
                                                            </div>
                                                            <input 
                                                                type="text" value={tier.name || ''} placeholder="RULE_NAME"
                                                                onChange={e => updateTier(tier.id, 'name', e.target.value)}
                                                                className="w-full bg-[#050505] border border-white/5 rounded-xl h-11 px-4 text-[10px] font-bold text-white focus:border-primary/40 outline-none transition-all uppercase tracking-widest placeholder:opacity-10"
                                                            />
                                                        </div>

                                                        {/* Target Threshold */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Activity className="w-2.5 h-2.5 text-primary/50" />
                                                                <label className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">THRESHOLD_TARGET</label>
                                                            </div>
                                                            <div className="relative group/input">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black text-[10px]">$</div>
                                                                <input 
                                                                    type="number" value={tier.target}
                                                                    onChange={e => updateTier(tier.id, 'target', Number(e.target.value))}
                                                                    className="w-full bg-[#050505] border border-white/5 group-hover/input:border-primary/20 rounded-xl h-11 pl-8 pr-4 text-xs font-mono font-black text-white focus:border-primary/50 outline-none transition-all"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Reward Yield */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Zap className="w-2.5 h-2.5 text-emerald-500/50" />
                                                                <label className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">REWARD_YIELD</label>
                                                            </div>
                                                            <div className="flex bg-[#050505] border border-white/5 rounded-xl overflow-hidden focus-within:border-emerald-500/40 transition-all">
                                                                <input 
                                                                    type="number" value={tier.rewardAmount}
                                                                    onChange={e => updateTier(tier.id, 'rewardAmount', Number(e.target.value))}
                                                                    className="flex-1 bg-transparent border-none h-11 px-4 text-xs font-mono font-black text-emerald-400 outline-none"
                                                                />
                                                                <select 
                                                                    value={tier.rewardType}
                                                                    onChange={e => updateTier(tier.id, 'rewardType', e.target.value)}
                                                                    className="bg-white/5 border-l border-white/5 px-3 text-[9px] font-black text-white/40 outline-none cursor-pointer uppercase tracking-widest hover:text-white transition-colors"
                                                                >
                                                                    <option value="Fixed Cash">USD</option>
                                                                    <option value="Percentage">PCT</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Delete Action */}
                                                        <button 
                                                            onClick={() => removeTier(tier.id)}
                                                            className="w-11 h-11 flex items-center justify-center bg-[#050505] hover:bg-red-500/10 text-white/10 hover:text-red-500 rounded-xl border border-white/5 hover:border-red-500/20 transition-all group/del"
                                                        >
                                                            <X className="w-4 h-4 group-hover/del:rotate-90 transition-transform duration-300" />
                                                        </button>
                                                    </div>

                                                    {/* Progress Visualizer Line */}
                                                    <div className="mt-5 h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-1000 ease-out" 
                                                            style={{ width: `${(tier.target / maxGroupTarget) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
                                        <div className="hidden lg:block w-12"></div>
                                        <button 
                                            onClick={() => handleAddTier(groupKey === 'Default' ? '' : groupKey)}
                                            className="h-14 border border-white/5 border-dashed rounded-[20px] flex items-center justify-center gap-3 text-white/20 hover:text-primary hover:border-primary/20 hover:bg-primary/5 transition-all text-[9px] font-black uppercase tracking-[0.3em] group/add"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover/add:bg-primary/20 transition-colors">
                                                <Plus className="w-3 h-3 group-hover/add:scale-125 transition-transform" /> 
                                            </div>
                                            APPEND_NEW_THRESHOLD_TO_{groupKey}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {tiers.length === 0 && (
                        <div className="h-80 border-2 border-white/5 border-dashed rounded-[48px] flex flex-col items-center justify-center text-white/5 group bg-white/[0.01]">
                            <div className="w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-700">
                                <Terminal className="w-10 h-10 opacity-20" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.5em]">{t.no_calculators}</p>
                            <button 
                                onClick={() => handleAddTier()}
                                className="mt-8 h-12 px-10 bg-white/5 hover:bg-primary hover:text-black rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 hover:border-primary"
                            >
                                Initialize_Logic_Stream
                            </button>
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