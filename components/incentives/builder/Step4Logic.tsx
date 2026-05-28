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
            <div className="space-y-12 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-[#2B3139] pb-6">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm bg-[#181A20] border border-[#FCD535]/30 flex items-center justify-center shadow-[0_0_20px_rgba(252,213,53,0.1)]">
                            <Target className="w-6 h-6 sm:w-7 sm:h-7 text-[#FCD535]" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-[#EAECEF] uppercase tracking-[0.2em]">{t.milestone_architecture || 'Milestone_Architecture'}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[9px] sm:text-[10px] font-black text-[#848E9C] uppercase tracking-widest sm:tracking-[0.3em]">{t.milestone_setup || 'Define progressive reward tiers'}</span>
                                {calcData.isMarathon && (
                                    <div className="flex items-center gap-1.5 bg-[#FCD535]/10 border border-[#FCD535]/30 px-2 py-0.5 rounded-sm">
                                        <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FCD535] fill-[#FCD535]" />
                                        <span className="text-[8px] font-black text-[#FCD535] uppercase tracking-widest">Marathon_Active</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-[#181A20] p-2 rounded-sm border border-[#2B3139]">
                        <div className="px-4 text-center">
                            <p className="text-[8px] font-black text-[#848E9C] uppercase tracking-widest">Total_Steps</p>
                            <p className="text-sm font-black text-[#EAECEF]">{tiers.length}</p>
                        </div>
                        <div className="w-px h-8 bg-[#2B3139]"></div>
                        <button 
                            onClick={() => handleAddTier()}
                            className="h-10 px-5 sm:px-6 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black rounded-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95 shadow-[0_0_15px_rgba(252,213,53,0.2)]"
                        >
                            <Plus className="w-3.5 h-3.5 stroke-[4]" /> <span className="hidden sm:inline">{t.add_tier || 'ADD_TIER'}</span>
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
                                    <div className="h-[2px] w-8 bg-[#FCD535] shadow-[0_0_10px_rgba(252,213,53,0.5)]"></div>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-xs font-black text-[#EAECEF] uppercase tracking-[0.4em]">
                                            {groupKey === 'Default' ? 'GLOBAL_PROTOCOL' : groupKey}
                                        </span>
                                        <span className="text-[9px] font-bold text-[#848E9C] uppercase tracking-widest">{groupTiers.length} THRESHOLDS</span>
                                    </div>
                                    <div className="h-px flex-1 bg-gradient-to-r from-[#2B3139] to-transparent"></div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 relative">
                                    {/* Vertical logic line */}
                                    <div className="absolute left-6 top-6 bottom-6 w-px bg-gradient-to-b from-[#FCD535]/50 via-[#2B3139] to-transparent z-0 hidden lg:block"></div>

                                    {groupTiers.map((tier, idx) => (
                                        <div key={tier.id} className="group relative z-10">
                                            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
                                                {/* Sequence Node */}
                                                <div className="hidden lg:flex w-12 h-12 rounded-sm bg-[#0B0E11] border-2 border-[#2B3139] group-hover:border-[#FCD535]/50 items-center justify-center transition-colors duration-500 overflow-hidden shadow-lg">
                                                    <span className="text-[10px] font-black text-[#848E9C] group-hover:text-[#FCD535] transition-colors">{String(idx + 1).padStart(2, '0')}</span>
                                                </div>

                                                <div className="bg-[#181A20] hover:bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535]/20 rounded-sm p-5 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)] group-hover:shadow-[0_15px_40px_rgba(252,213,53,0.05)] relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#FCD535]/10 to-transparent"></div>
                                                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-6 items-end pl-2">
                                                        {/* Tier Name */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Terminal className="w-2.5 h-2.5 text-[#848E9C]" />
                                                                <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">IDENTIFIER</label>
                                                            </div>
                                                            <input 
                                                                type="text" value={tier.name || ''} placeholder="RULE_NAME"
                                                                onChange={e => updateTier(tier.id, 'name', e.target.value)}
                                                                className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm h-11 px-4 text-[10px] font-bold text-[#EAECEF] focus:border-[#FCD535]/40 outline-none transition-all uppercase tracking-widest placeholder:text-[#848E9C]/30 focus:shadow-[0_0_10px_rgba(252,213,53,0.1)]"
                                                            />
                                                        </div>

                                                        {/* Target Threshold */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Activity className="w-2.5 h-2.5 text-[#FCD535]/70" />
                                                                <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">THRESHOLD_TARGET</label>
                                                            </div>
                                                            <div className="relative group/input">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FCD535] font-black text-[10px]">$</div>
                                                                <input 
                                                                    type="number" value={tier.target}
                                                                    onChange={e => updateTier(tier.id, 'target', Number(e.target.value))}
                                                                    className="w-full bg-[#0B0E11] border border-[#2B3139] group-hover/input:border-[#FCD535]/20 rounded-sm h-11 pl-8 pr-4 text-xs font-mono font-black text-[#EAECEF] focus:border-[#FCD535]/50 outline-none transition-all focus:shadow-[0_0_10px_rgba(252,213,53,0.1)]"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Reward Yield */}
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center gap-2 px-1">
                                                                <Zap className="w-2.5 h-2.5 text-[#0ECB81]/70" />
                                                                <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">REWARD_YIELD</label>
                                                            </div>
                                                            <div className="flex bg-[#0B0E11] border border-[#2B3139] rounded-sm overflow-hidden focus-within:border-[#0ECB81]/40 focus-within:shadow-[0_0_10px_rgba(14,203,129,0.1)] transition-all">
                                                                <input 
                                                                    type="number" value={tier.rewardAmount}
                                                                    onChange={e => updateTier(tier.id, 'rewardAmount', Number(e.target.value))}
                                                                    className="flex-1 bg-transparent border-none h-11 px-4 text-xs font-mono font-black text-[#0ECB81] outline-none"
                                                                />
                                                                <select 
                                                                    value={tier.rewardType}
                                                                    onChange={e => updateTier(tier.id, 'rewardType', e.target.value)}
                                                                    className="bg-[#181A20] border-l border-[#2B3139] px-3 text-[9px] font-black text-[#848E9C] outline-none cursor-pointer uppercase tracking-widest hover:text-[#EAECEF] transition-colors"
                                                                >
                                                                    <option value="Fixed Cash">USD</option>
                                                                    <option value="Percentage">PCT</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Delete Action */}
                                                        <button 
                                                            onClick={() => removeTier(tier.id)}
                                                            className="w-11 h-11 flex items-center justify-center bg-[#0B0E11] hover:bg-[#F6465D]/10 text-[#848E9C] hover:text-[#F6465D] rounded-sm border border-[#2B3139] hover:border-[#F6465D]/30 transition-all active:scale-90 group/del"
                                                        >
                                                            <X className="w-4 h-4 group-hover/del:rotate-90 transition-transform duration-300" />
                                                        </button>
                                                    </div>

                                                    {/* Progress Visualizer Line */}
                                                    <div className="mt-5 h-1 w-full bg-[#0B0E11] border border-[#2B3139] rounded-full overflow-hidden relative">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-[#FCD535] to-[#0ECB81] transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(252,213,53,0.5)]" 
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
                                            className="h-14 border border-[#2B3139] border-dashed rounded-sm flex items-center justify-center gap-3 text-[#848E9C] hover:text-[#FCD535] hover:border-[#FCD535]/30 hover:bg-[#FCD535]/5 transition-all text-[9px] font-black uppercase tracking-[0.3em] group/add"
                                        >
                                            <div className="w-6 h-6 rounded-sm bg-[#181A20] flex items-center justify-center border border-[#2B3139] group-hover/add:bg-[#FCD535]/20 group-hover/add:border-[#FCD535]/30 transition-colors">
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
                        <div className="h-80 border border-[#2B3139] border-dashed rounded-sm flex flex-col items-center justify-center text-[#848E9C] group bg-[#0B0E11]/50 shadow-inner">
                            <div className="w-20 h-20 rounded-sm bg-[#181A20] border border-[#2B3139] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-[#FCD535]/30 transition-all duration-700 shadow-xl">
                                <Terminal className="w-8 h-8 text-[#848E9C]/30 group-hover:text-[#FCD535]/50 transition-colors" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.5em]">{t.no_calculators}</p>
                            <button 
                                onClick={() => handleAddTier()}
                                className="mt-8 h-12 px-10 bg-[#2B3139] hover:bg-[#FCD535] text-[#EAECEF] hover:text-[#0B0E11] rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:shadow-[0_0_20px_rgba(252,213,53,0.3)] active:scale-95"
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
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b border-[#2B3139] pb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-sm bg-[#181A20] border border-[#0ECB81]/30 flex items-center justify-center shadow-[0_0_20px_rgba(14,203,129,0.1)]">
                    <Layers className="w-6 h-6 sm:w-7 sm:h-7 text-[#0ECB81]" />
                </div>
                <div>
                    <h3 className="text-lg sm:text-xl font-black text-[#EAECEF] uppercase tracking-[0.2em]">{t.commission_rule || 'Commission_Logic_Studio'}</h3>
                    <p className="text-[9px] sm:text-[10px] font-mono font-black text-[#848E9C] uppercase tracking-widest mt-1">{t.calculators_engine_desc}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Terminal className="w-3.5 h-3.5 text-[#848E9C]" />
                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{t.reward_method || 'Calculation_Method'}</label>
                        </div>
                        <div className="flex p-1 bg-[#181A20] rounded-sm border border-[#2B3139] shadow-inner">
                            {['Percentage', 'Fixed Amount'].map(m => (
                                <button key={m} onClick={() => updateField('commissionMethod', m)} className={`flex-1 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${calcData.commissionMethod === m ? 'bg-[#0B0E11] text-[#0ECB81] shadow-[0_0_15px_rgba(14,203,129,0.15)] border border-[#0ECB81]/30' : 'text-[#848E9C] hover:text-[#EAECEF] border border-transparent'}`}>{m}</button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#848E9C]" />
                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Trigger_Condition</label>
                        </div>
                        <div className="space-y-2">
                            {['On Total Sales', 'Above Target', 'Per Transaction'].map(c => (
                                <button key={c} onClick={() => updateField('commissionCondition', c)} className={`w-full h-11 flex items-center justify-between px-4 rounded-sm border transition-all ${calcData.commissionCondition === c ? 'bg-[#0ECB81]/10 border-[#0ECB81]/40 text-[#0ECB81] shadow-[0_0_15px_rgba(14,203,129,0.1)]' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] hover:border-[#474D57]'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{c}</span>
                                    {calcData.commissionCondition === c && <Zap className="w-3.5 h-3.5 fill-[#0ECB81]" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {calcData.commissionCondition === 'Above Target' && (
                        <div className="space-y-3 p-5 bg-[#181A20] border border-[#2B3139] rounded-sm animate-in zoom-in-95 duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
                            <div className="flex items-center gap-2 px-1">
                                <ArrowRight className="w-3.5 h-3.5 text-[#FCD535]" />
                                <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{t.target_threshold || 'Target_Threshold_Locked'}</label>
                            </div>
                            <input type="number" value={calcData.targetAmount} onChange={e => updateField('targetAmount', Number(e.target.value))} className="w-full h-11 bg-[#0B0E11] border border-[#2B3139] rounded-sm px-4 text-[13px] font-mono font-black text-[#FCD535] outline-none focus:border-[#FCD535]/50 transition-all focus:shadow-[0_0_10px_rgba(252,213,53,0.1)]" />
                            <p className="text-[8px] font-black text-[#848E9C] uppercase tracking-widest italic opacity-80 pt-1">Rule: (PERF_KPI - TARGET) × RATE_VAL</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Activity className="w-3.5 h-3.5 text-[#848E9C]" />
                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{t.multiplier_value || 'Multiplier_Value'} ({calcData.commissionMethod === 'Percentage' ? '%' : '$'})</label>
                        </div>
                        <input type="number" value={calcData.commissionRate} onChange={e => updateField('commissionRate', Number(e.target.value))} className="w-full h-14 bg-[#0B0E11] border border-[#2B3139] rounded-sm px-6 text-2xl font-mono font-black text-[#FCD535] outline-none focus:border-[#FCD535]/50 transition-all shadow-inner focus:shadow-[0_0_15px_rgba(252,213,53,0.15)]" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step4Logic;