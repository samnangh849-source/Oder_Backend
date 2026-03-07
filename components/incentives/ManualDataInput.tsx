import React, { useState, useEffect, useMemo, useContext } from 'react';
import { IncentiveProject, ParsedOrder } from '../../types';
import { translations } from '../../translations';
import { AppContext } from '../../context/AppContext';

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
                metrics.add(calc.metricType);
            }
        });
        return Array.from(metrics);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Manual Data Entry</h2>
                        <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">Input performance values for active metrics</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="mb-8 flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Select Period:</label>
                    <input 
                        type="month" 
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="bg-slate-800 border-none text-sm font-black text-blue-400 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-8 mb-8">
                    {requiredMetrics.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-bold italic">No active calculators found for this project.</div>
                    ) : requiredMetrics.map(metric => (
                        <div key={metric} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-px flex-grow bg-slate-800"></div>
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] whitespace-nowrap">{metric}</h3>
                                <div className="h-px flex-grow bg-slate-800"></div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teams.map(team => (
                                    <div key={`${metric}-${team}`} className="bg-black/30 p-4 rounded-2xl border border-white/5 group focus-within:border-blue-500/50 transition-all">
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 group-focus-within:text-blue-400">{team}</label>
                                        <div className="relative">
                                            <input 
                                                type="number"
                                                placeholder="0.00"
                                                value={data[metric]?.[team] || ''}
                                                onChange={e => handleInputChange(metric, team, e.target.value)}
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 text-white font-black focus:ring-0 focus:border-blue-500 text-right"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 uppercase">Input</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95">Cancel</button>
                    <button onClick={handleSave} className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95 shadow-xl shadow-blue-900/20">Save & Apply Data</button>
                </div>
            </div>
        </div>
    );
};

export default ManualDataInput;
