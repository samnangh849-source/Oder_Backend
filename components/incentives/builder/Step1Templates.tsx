import React from 'react';
import { Layout, Terminal, Star, Zap, Target, Coins, MousePointer2 } from 'lucide-react';

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
    const templates: TemplateProps[] = [
        { id: 'tiered_sales', title: 'Tiered Bonus', desc: 'Rewards increase at milestones.', icon: <Star className="w-6 h-6" />, color: 'text-[#F0B90B]', type: 'Achievement' },
        { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'Progressive weekly goals.', icon: <Zap className="w-6 h-6" />, color: 'text-[#F0B90B]', type: 'Achievement' },
        { id: 'flat_commission', title: 'Flat Comm.', desc: 'Fixed % across all sales.', icon: <Coins className="w-6 h-6" />, color: 'text-[#0ECB81]', type: 'Commission' },
        { id: 'above_target', title: 'Above Target', desc: 'Applied only above goal.', icon: <Target className="w-6 h-6" />, color: 'text-[#0ECB81]', type: 'Commission' }
    ];

    return (
        <div className="space-y-10">
            <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <Layout className="w-5 h-5 text-[#F0B90B]" />
                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">{calcType === 'Achievement' ? 'Achievement_Bonus_Init' : 'Commission_Engine_Init'}</h3>
                </div>
                <p className="text-[#707A8A] text-[10px] font-bold uppercase tracking-[0.3em]">Load template or manual configuration</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.filter(tmp => tmp.type === calcType).map(tmp => (
                    <button key={tmp.id} onClick={() => onApplyTemplate(tmp.id)} className="bg-[#050505] border border-[#1A1A1A] hover:border-[#F0B90B]/50 p-6 rounded transition-all group text-left relative overflow-hidden">
                        <div className={`mb-4 ${tmp.color} transition-transform group-hover:scale-110 duration-300`}>{tmp.icon}</div>
                        <div className="text-xs font-black text-[#EAECEF] uppercase mb-1 tracking-[0.15em]">{tmp.title}</div>
                        <div className="text-[9px] text-[#707A8A] font-bold uppercase tracking-widest leading-relaxed">{tmp.desc}</div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MousePointer2 className="w-3 h-3 text-[#F0B90B]" />
                        </div>
                    </button>
                ))}
            </div>

            <div className="pt-8 border-t border-[#1A1A1A]">
                <div className="flex items-center gap-2 mb-3">
                    <Terminal className="w-3.5 h-3.5 text-[#707A8A]" />
                    <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Calculator Identity Key</label>
                </div>
                <input 
                    type="text" value={calcName} onChange={e => onNameChange(e.target.value)}
                    className="w-full h-12 bg-[#050505] border border-[#1A1A1A] rounded px-5 text-[#EAECEF] font-bold focus:border-[#F0B90B]/50 outline-none transition-all uppercase tracking-widest text-xs"
                    placeholder="e.g. Q3_PERFORMANCE_HERO_STATION"
                />
            </div>
        </div>
    );
};

export default Step1Templates;
