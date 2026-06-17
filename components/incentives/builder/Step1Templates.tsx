import React from 'react';
import { Layout, Terminal, Star, Zap, Target, Coins, MousePointer2, Trophy, Flame } from 'lucide-react';
import { AppContext } from '../../../context/AppContext';
import { translations } from '../../../translations';

interface TemplateProps {
    id: string;
    title: string;
    desc: string;
    icon: React.ReactNode;
    color: string;
    type: string;
}

interface Step1TemplatesProps {
    calcType: string;
    calcName: string;
    onApplyTemplate: (templateId: string) => void;
    onNameChange: (name: string) => void;
}

const Step1Templates: React.FC<Step1TemplatesProps> = ({ calcType, calcName, onApplyTemplate, onNameChange }) => {
    const { language } = React.useContext(AppContext);
    const t = translations[language];

    const templates: TemplateProps[] = [
        { id: 'marathon_sale', title: 'Marathon Sale Incentives', desc: 'Weekly Cumulative Rewards (Staff Benefit 1)', icon: <Trophy className="w-6 h-6" />, color: 'text-[#F0B90B]', type: 'Achievement' },
        { id: 'tiered_sales', title: 'Standard Tiered Bonus', desc: 'Rewards increase at milestones.', icon: <Star className="w-6 h-6" />, color: 'text-[#F0B90B]', type: 'Achievement' },
        { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'Progressive weekly goals.', icon: <Zap className="w-6 h-6" />, color: 'text-[#F0B90B]', type: 'Achievement' },
        
        { id: 'above_4000_commission', title: '5% Commission (> $4000)', desc: 'Applied only above $4000 goal (Staff Benefit 2)', icon: <Flame className="w-6 h-6" />, color: 'text-[#0ECB81]', type: 'Commission' },
        { id: 'flat_commission', title: 'Flat Comm.', desc: 'Fixed % across all sales.', icon: <Coins className="w-6 h-6" />, color: 'text-[#0ECB81]', type: 'Commission' },
        { id: 'above_target', title: 'Generic Above Target', desc: 'Applied only above goal.', icon: <Target className="w-6 h-6" />, color: 'text-[#0ECB81]', type: 'Commission' }
    ];

    // Debugging: console.log("Current CalcType:", calcType);

    return (
        <div className="space-y-10">
            <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <Layout className="w-5 h-5 text-[#F0B90B]" />
                    <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">{calcType === 'Achievement' ? t.achievement_bonus : t.commission_rate}</h3>
                </div>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Load template or manual configuration</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.filter(tmp => tmp.type === calcType).map(tmp => (
                    <button key={tmp.id} onClick={() => onApplyTemplate(tmp.id)} className="bg-black/40 border border-white/10 hover:border-[#F0B90B]/50 p-6 rounded-[32px] transition-all group text-left relative overflow-hidden backdrop-blur-xl">
                        <div className={`mb-4 ${tmp.color} transition-transform group-hover:scale-110 duration-300`}>{tmp.icon}</div>
                        <div className="text-xs font-black text-white uppercase mb-1 tracking-[0.15em]">{tmp.title}</div>
                        <div className="text-[9px] text-white/40 font-black uppercase tracking-widest leading-relaxed">{tmp.desc}</div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MousePointer2 className="w-4 h-4 text-[#F0B90B]" />
                        </div>
                    </button>
                ))}
            </div>

            <div className="pt-8 border-t border-white/5">
                <div className="flex items-center gap-2 mb-3">
                    <Terminal className="w-3.5 h-3.5 text-white/30" />
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{t.calc_name}</label>
                </div>
                <input 
                    type="text" value={calcName} onChange={e => onNameChange(e.target.value)}
                    className="w-full h-14 bg-black border border-white/10 rounded-2xl px-6 text-white font-black focus:border-[#F0B90B]/50 outline-none transition-all uppercase tracking-[0.2em] text-[11px]"
                    placeholder="..."
                />
            </div>
        </div>
    );
};

export default Step1Templates;
