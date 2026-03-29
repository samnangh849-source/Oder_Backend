import React from 'react';
import { IncentiveCalculator } from '../../../types';

interface Step2ConfigurationProps {
    calcData: Partial<IncentiveCalculator>;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
}

const Step2Configuration: React.FC<Step2ConfigurationProps> = ({ calcData, updateField }) => {
    return (
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-3 flex items-center gap-2">
                <span className="text-primary">02</span> Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Status</label>
                        <div className="flex gap-1 bg-bg-black p-1 rounded border border-[#2B3139]">
                            {['Active', 'Draft', 'Disable'].map(s => (
                                <button key={s} onClick={() => updateField('status', s)} className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${calcData.status === s ? 'bg-[#474D57] text-[#EAECEF]' : 'text-secondary hover:text-[#EAECEF]'}`}>{s}</button>
                            ))}
                        </div>
                    </div>

                    {calcData.type === 'Commission' && (
                        <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Commission Type</label>
                            <select 
                                value={calcData.commissionType} onChange={e => updateField('commissionType', e.target.value)}
                                className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-primary"
                            >
                                <option value="Flat Commission">Flat Commission</option>
                                <option value="Above Target Commission">Above Target Commission</option>
                                <option value="Tiered Commission">Tiered Commission</option>
                                <option value="Product-Based Commission">Product-Based Commission</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Description</label>
                        <textarea 
                            value={calcData.description || ''} 
                            onChange={e => updateField('description', e.target.value)}
                            className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] text-[#EAECEF] min-h-[80px] outline-none focus:border-primary"
                            placeholder="Add details about this program..."
                        ></textarea>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Evaluation Period</label>
                        <select 
                            value={calcData.calculationPeriod} onChange={e => updateField('calculationPeriod', e.target.value)}
                            className="w-full bg-bg-black border border-[#2B3139] rounded-md px-3 py-2 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-primary"
                        >
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Per Order">Per Order</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-bg-black rounded-md border border-[#2B3139]">
                        <div>
                            <h4 className="text-[11px] font-bold text-[#EAECEF] uppercase">Reset Progress</h4>
                            <p className="text-[9px] text-secondary font-bold uppercase tracking-wider">Clear counts every period</p>
                        </div>
                        <input type="checkbox" checked={calcData.resetEveryPeriod} onChange={e => updateField('resetEveryPeriod', e.target.checked)} className="w-4 h-4 accent-primary" />
                    </div>

                    {calcData.calculationPeriod === 'Weekly' && (
                         <div className="flex items-center justify-between p-3 bg-bg-black rounded-md border border-[#2B3139]">
                         <div>
                             <h4 className="text-[11px] font-bold text-[#EAECEF] uppercase">Marathon Mode</h4>
                             <p className="text-[9px] text-secondary font-bold uppercase tracking-wider">Cumulative Weekly Progress</p>
                         </div>
                         <input type="checkbox" checked={calcData.isMarathon} onChange={e => updateField('isMarathon', e.target.checked)} className="w-4 h-4 accent-primary" />
                     </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Step2Configuration;
