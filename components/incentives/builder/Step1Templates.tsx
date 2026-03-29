import React from 'react';

interface TemplateProps {
    id: string;
    title: string;
    desc: string;
    icon: string;
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
        { id: 'tiered_sales', title: 'Tiered Bonus', desc: 'Rewards increase at milestones.', icon: '🏆', color: 'text-primary', type: 'Achievement' },
        { id: 'weekly_progressive', title: 'Weekly Sprint', desc: 'Progressive weekly goals.', icon: '⚡', color: 'text-primary', type: 'Achievement' },
        { id: 'flat_commission', title: 'Flat Comm.', desc: 'Fixed % across all sales.', icon: '💰', color: 'text-primary', type: 'Commission' },
        { id: 'above_target', title: 'Above Target', desc: 'Applied only above goal.', icon: '🎯', color: 'text-primary', type: 'Commission' }
    ];

    return (
        <div className="space-y-8">
            <div className="text-center mb-10">
                <h3 className="text-xl font-bold text-[#EAECEF] uppercase tracking-wider mb-2">{calcType === 'Achievement' ? 'Achievement Bonus Setup' : 'Commission Engine Setup'}</h3>
                <p className="text-secondary text-[11px] font-bold uppercase tracking-widest">Select a template or build custom</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.filter(tmp => tmp.type === calcType).map(tmp => (
                    <button key={tmp.id} onClick={() => onApplyTemplate(tmp.id)} className="bg-bg-black border border-[#2B3139] hover:border-primary p-5 rounded-md text-left transition-all group">
                        <div className={`text-2xl mb-3 ${tmp.color}`}>{tmp.icon}</div>
                        <div className="text-[12px] font-bold text-[#EAECEF] uppercase mb-1 tracking-wider">{tmp.title}</div>
                        <div className="text-[10px] text-secondary font-bold uppercase tracking-wide">{tmp.desc}</div>
                    </button>
                ))}
            </div>

            <div className="relative">
                <label className="block text-[11px] font-bold text-secondary uppercase tracking-widest mb-2">Calculator Name</label>
                <input 
                    type="text" value={calcName} onChange={e => onNameChange(e.target.value)}
                    className="w-full bg-bg-black border border-[#2B3139] rounded-md px-4 py-3 text-[#EAECEF] font-bold focus:border-primary outline-none text-sm"
                    placeholder="e.g. Q3 Sales Hero Bonus..."
                />
            </div>
        </div>
    );
};

export default Step1Templates;
