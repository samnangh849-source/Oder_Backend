import React, { useState, useEffect, useMemo, useContext } from 'react';
import { IncentiveProject, ParsedOrder } from '../../types';
import { translations } from '../../translations';
import { AppContext } from '../../context/AppContext';
import { X } from 'lucide-react';

interface ManualDataInputProps {
    project: IncentiveProject;
    onSave: (data: any) => void;
    onClose: () => void;
}

const ManualDataInput: React.FC<ManualDataInputProps> = ({ project, onSave, onClose }) => {
    const { language, appData } = useContext(AppContext);
    const t = translations[language];
    
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [data, setData] = useState<Record<string, Record<string, number>>>({}); // { [metric]: { [team]: value } }
    
    // Identify all unique manual metrics required by active calculators
    const requiredMetrics = useMemo(() => {
        const metrics = new Set<string>();
        (project.calculators || []).forEach(calc => {
            if (calc.status === 'Active') {
                metrics.add(calc.metricType || '');
            }
        });
        return Array.from(metrics).filter(Boolean);
    }, [project.calculators]);

    const teams = useMemo(() => Array.from(new Set(appData.users?.map(u => u.Team).filter(Boolean))), [appData.users]);

    useEffect(() => {
        // Load existing manual data for this project and period
        const savedData = localStorage.getItem(`manual_data_${project.id}_${period}`);
        if (savedData) {
            setData(JSON.parse(savedData));
        } else {
            setData({});
        }
    }, [project.id, period]);

    const handleInputChange = (metric: string, team: string, value: string) => {
        setData(prev => ({
            ...prev,
            [metric]: {
                ...(prev[metric] || {}),
                [team]: Number(value) || 0
            }
        }));
    };

    const handleSave = () => {
        localStorage.setItem(`manual_data_${project.id}_${period}`, JSON.stringify(data));
        onSave(data);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 ui-binance">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-card-bg border border-[#2B3139] rounded-md p-8 shadow-2xl relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-[#EAECEF] uppercase tracking-wider">Manual Data Entry</h2>
                        <p className="text-[10px] text-secondary font-bold mt-1 uppercase tracking-widest">Input performance values for active metrics</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 bg-bg-black hover:bg-[#474D57] text-secondary hover:text-[#EAECEF] rounded-md border border-[#2B3139] transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="mb-8 flex items-center gap-4 bg-bg-black p-4 rounded-md border border-[#2B3139]">
                    <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Select Period:</label>
                    <input
                        type="month"
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="bg-transparent border-none text-xs font-bold text-primary p-0 focus:ring-0 cursor-pointer"
                    />
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-8 mb-8">
                    {requiredMetrics.length === 0 ? (
                        <div className="text-center py-12 text-secondary font-bold text-xs uppercase tracking-widest">No active calculators found for this project.</div>
                    ) : requiredMetrics.map(metric => (
                        <div key={metric} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-grow bg-[#2B3139]"></div>
                                <h3 className="text-[10px] font-bold text-[#EAECEF] uppercase tracking-widest whitespace-nowrap">{metric}</h3>
                                <div className="h-px flex-grow bg-[#2B3139]"></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teams.map(team => (
                                    <div key={`${metric}-${team}`} className="bg-bg-black p-3 rounded-md border border-[#2B3139] group focus-within:border-primary transition-all">
                                        <label className="block text-[9px] font-bold text-secondary uppercase tracking-widest mb-2 group-focus-within:text-primary">{team}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={data[metric]?.[team] || ''}
                                                onChange={e => handleInputChange(metric, team, e.target.value)}
                                                className="w-full bg-transparent border-none px-0 py-1 text-[#EAECEF] font-mono text-sm focus:ring-0 text-right"
                                            />
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] font-bold text-secondary uppercase">Input</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 pt-4 border-t border-[#2B3139]">
                    <button onClick={onClose} className="flex-1 py-3 bg-bg-black text-secondary hover:text-[#EAECEF] border border-[#2B3139] rounded-md font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">Cancel</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-primary text-bg-black rounded-md font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 hover:bg-[#f0c51d]">Save & Apply Data</button>
                </div>
            </div>
        </div>
    );
};

export default ManualDataInput;
