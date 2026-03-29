import React from 'react';
import { IncentiveCalculator, AppData } from '../../../types';

interface Step3TargetEntitiesProps {
    calcData: Partial<IncentiveCalculator>;
    appData: AppData;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
    toggleApplyTo: (item: string) => void;
}

const Step3TargetEntities: React.FC<Step3TargetEntitiesProps> = ({ calcData, appData, updateField, toggleApplyTo }) => {
    return (
        <div className="space-y-6">
             <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-3 flex items-center gap-2">
                <span className="text-primary">03</span> Target Entities
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest">Apply To (Selection)</label>
                    <div className="bg-bg-black border border-[#2B3139] rounded-md p-3 max-h-[250px] overflow-y-auto space-y-4 custom-scrollbar">
                        <div>
                            <span className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2 block">Roles</span>
                            <div className="flex flex-wrap gap-1.5">
                                {appData.roles?.map(r => (
                                    <button key={r.roleName} type="button" onClick={() => toggleApplyTo(`Role:${r.roleName}`)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${calcData.applyTo?.includes(`Role:${r.roleName}`) ? 'bg-primary text-bg-black border-primary' : 'bg-card-bg border-[#2B3139] text-secondary'}`}>
                                        {r.roleName}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-primary uppercase tracking-widest mb-2 block">Teams</span>
                            <div className="flex flex-wrap gap-1.5">
                                {Array.from(new Set(appData.pages?.map(p => p.Team))).filter(t => t).map(team => (
                                    <button key={team} type="button" onClick={() => toggleApplyTo(`Team:${team}`)} className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${calcData.applyTo?.includes(`Team:${team}`) ? 'bg-primary text-bg-black border-primary' : 'bg-card-bg border-[#2B3139] text-secondary'}`}>
                                        {team}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Performance Metric</label>
                        <select 
                            value={calcData.metricType} onChange={e => updateField('metricType', e.target.value)}
                            className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-primary"
                        >
                            <option value="Sales Amount">Sales Amount ($)</option>
                            <option value="Number of Orders">Number of Orders</option>
                            <option value="Revenue">Revenue</option>
                            <option value="Profit">Profit</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Unit</label>
                        <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                            {['USD', 'Count', '%'].map(u => (
                                <button key={u} onClick={() => updateField('metricUnit', u)} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${calcData.metricUnit === u ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{u}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step3TargetEntities;
