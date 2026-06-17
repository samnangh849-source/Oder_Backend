import React from 'react';
import { IncentiveCalculator } from '../../../types';
import { Settings, Activity, Calendar, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { AppContext } from '../../../context/AppContext';
import { translations } from '../../../translations';

interface Step2ConfigurationProps {
    calcData: Partial<IncentiveCalculator>;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
}

const Step2Configuration: React.FC<Step2ConfigurationProps> = ({ calcData, updateField }) => {
    const { language } = React.useContext(AppContext);
    const t = translations[language];

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-4 border-b border-[#1A1A1A] pb-6">
                <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[#F0B90B]" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">{t.calc_basic_info}</h3>
                    <p className="text-[9px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">{t.calculators_engine_desc}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.status}</label>
                        </div>
                        <div className="flex p-1 bg-[#050505] rounded border border-[#1A1A1A]">
                            {['Active', 'Draft', 'Disable'].map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => updateField('status', s)} 
                                    className={`flex-1 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${calcData.status === s ? 'bg-[#2B3139] text-[#F0B90B] shadow-lg' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}
                                >
                                    {s === 'Active' ? 'LIVE' : s === 'Draft' ? 'DRAFT' : 'OFFLINE'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {calcData.type === 'Commission' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-[#707A8A]" />
                                <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.commission_type}</label>
                            </div>
                            <select 
                                value={calcData.commissionType} onChange={e => updateField('commissionType', e.target.value)}
                                className="w-full h-11 bg-[#050505] border border-[#1A1A1A] rounded px-4 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-[#F0B90B]/50 transition-all cursor-pointer uppercase tracking-widest"
                            >
                                <option value="Flat Commission">{t.flat_commission || 'FLAT_COMMISSION'}</option>
                                <option value="Above Target Commission">{t.above_target_protocol || 'ABOVE_TARGET_PROTOCOL'}</option>
                                <option value="Tiered Commission">{t.tiered_distribution || 'TIERED_DISTRIBUTION'}</option>
                                <option value="Product-Based Commission">PRODUCT_SPECIFIC_LOGIC</option>
                            </select>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.description_label}</label>
                        </div>
                        <textarea 
                            value={calcData.description || ''} 
                            onChange={e => updateField('description', e.target.value)}
                            className="w-full bg-[#050505] border border-[#1A1A1A] rounded p-4 text-[11px] font-bold text-[#EAECEF] min-h-[100px] outline-none focus:border-[#F0B90B]/50 transition-all uppercase tracking-widest placeholder:opacity-20"
                            placeholder="..."
                        ></textarea>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.calc_period}</label>
                        </div>
                        <select 
                            value={calcData.calculationPeriod} onChange={e => updateField('calculationPeriod', e.target.value)}
                            className="w-full h-11 bg-[#050505] border border-[#1A1A1A] rounded px-4 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-[#F0B90B]/50 transition-all cursor-pointer uppercase tracking-widest"
                        >
                            <option value="Daily">DAILY_INTERVAL</option>
                            <option value="Weekly">WEEKLY_INTERVAL</option>
                            <option value="Monthly">MONTHLY_INTERVAL</option>
                            <option value="Per Order">TRANSACTIONAL_LOCK</option>
                        </select>
                    </div>

                    <div className="p-5 bg-[#080808] rounded border border-[#1A1A1A] group hover:border-[#0ECB81]/30 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <RefreshCw className="w-5 h-5 text-[#707A8A] group-hover:text-[#0ECB81] transition-colors" />
                                <div>
                                    <h4 className="text-[11px] font-black text-[#EAECEF] uppercase tracking-widest">{t.reset_progress}</h4>
                                    <p className="text-[8px] font-bold text-[#707A8A] uppercase tracking-widest mt-0.5">Flush counters on new cycle</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={calcData.resetEveryPeriod} onChange={e => updateField('resetEveryPeriod', e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-5 bg-[#1A1A1A] border border-[#2B3139] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#707A8A] after:rounded-full after:h-3.5 after:w-4 after:transition-all peer-checked:bg-[#0ECB81]/20 peer-checked:border-[#0ECB81]/40 peer-checked:after:bg-[#0ECB81]"></div>
                            </label>
                        </div>
                    </div>

                    {calcData.calculationPeriod === 'Weekly' && (
                         <div className="p-5 bg-[#080808] rounded border border-[#1A1A1A] group hover:border-[#F0B90B]/30 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Activity className="w-5 h-5 text-[#707A8A] group-hover:text-[#F0B90B] transition-colors" />
                                    <div>
                                        <h4 className="text-[11px] font-black text-[#EAECEF] uppercase tracking-widest">{t.marathon_mode || 'MARATHON_MODE'}</h4>
                                        <p className="text-[8px] font-bold text-[#707A8A] uppercase tracking-widest mt-0.5">{t.marathon_desc || 'Cumulative weekly progress'}</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={calcData.isMarathon} onChange={e => updateField('isMarathon', e.target.checked)} className="sr-only peer" />
                                    <div className="w-10 h-5 bg-[#1A1A1A] border border-[#2B3139] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#707A8A] after:rounded-full after:h-3.5 after:w-4 after:transition-all peer-checked:bg-[#F0B90B]/20 peer-checked:border-[#F0B90B]/40 peer-checked:after:bg-[#F0B90B]"></div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Step2Configuration;