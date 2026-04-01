import React, { useState, useEffect, useMemo, useContext } from 'react';
import { IncentiveProject, ParsedOrder } from '../../types';
import { translations } from '../../translations';
import { AppContext } from '../../context/AppContext';
import { X, Terminal, Database, Calendar, Save, MousePointer2 } from 'lucide-react';

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#050505]/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="bg-[#121212] border border-[#1A1A1A] shadow-2xl relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col rounded overflow-hidden">
                {/* Technical Header */}
                <div className="flex justify-between items-center px-6 py-4 bg-[#080808] border-b border-[#1A1A1A]">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center shadow-inner">
                            <Terminal className="w-5 h-5 text-[#F0B90B]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-[#EAECEF] uppercase tracking-[0.3em]">Performance_Input_Buffer</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8px] font-mono text-[#707A8A] uppercase tracking-widest">Protocol:</span>
                                <span className="text-[8px] font-mono text-[#F0B90B] uppercase tracking-widest">{project.projectName}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[#2B3139] rounded transition-all text-[#707A8A] hover:text-[#EAECEF] border border-transparent hover:border-[#1A1A1A]">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Configuration Strip */}
                <div className="px-6 py-3 bg-[#050505] border-b border-[#1A1A1A] flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-3.5 h-3.5 text-[#707A8A]" />
                        <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Target_Cycle:</label>
                        <div className="bg-[#121212] px-3 py-1 rounded border border-[#1A1A1A]">
                            <input
                                type="month"
                                value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="bg-transparent border-none text-[10px] font-mono font-black text-[#F0B90B] p-0 focus:ring-0 cursor-pointer uppercase"
                            />
                        </div>
                    </div>
                    <div className="h-4 w-px bg-[#1A1A1A]"></div>
                    <div className="flex items-center gap-3">
                        <Database className="w-3.5 h-3.5 text-[#707A8A]" />
                        <span className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Active_Nodes: <span className="text-[#EAECEF]">{requiredMetrics.length}</span></span>
                    </div>
                </div>

                {/* Main Entry Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
                    {requiredMetrics.length === 0 ? (
                        <div className="h-64 border border-[#1A1A1A] border-dashed rounded flex flex-col items-center justify-center opacity-30">
                            <Terminal className="w-10 h-10 mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">No_Active_Calculators_Detected</p>
                        </div>
                    ) : requiredMetrics.map(metric => (
                        <div key={metric} className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#F0B90B] shadow-[0_0_8px_#F0B90B]"></div>
                                <h3 className="text-[10px] font-black text-[#EAECEF] uppercase tracking-[0.2em]">{metric}_DATA_STREAM</h3>
                                <div className="h-px flex-grow bg-[#1A1A1A]"></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {teams.map(team => (
                                    <div key={`${metric}-${team}`} className="bg-[#080808] p-4 rounded border border-[#1A1A1A] group focus-within:border-[#F0B90B]/30 transition-all relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-[#1A1A1A] group-focus-within:bg-[#F0B90B] transition-colors"></div>
                                        <label className="block text-[8px] font-black text-[#707A8A] uppercase tracking-widest mb-3 truncate group-focus-within:text-[#F0B90B]">{team}</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                placeholder="0.00"
                                                value={data[metric]?.[team] || ''}
                                                onChange={e => handleInputChange(metric, team, e.target.value)}
                                                className="w-full bg-transparent border-none p-0 text-[#EAECEF] font-mono text-lg font-black focus:ring-0 text-right placeholder:opacity-5"
                                            />
                                            <span className="absolute left-0 text-[8px] font-bold text-[#1A1A1A] uppercase group-hover:text-[#2B3139] transition-colors">KPI_VAL</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Command Bar */}
                <div className="px-6 py-4 bg-[#080808] border-t border-[#1A1A1A] flex gap-3">
                    <button onClick={onClose} className="h-10 px-6 bg-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF] rounded font-black uppercase tracking-[0.2em] text-[9px] transition-all border border-transparent hover:border-[#2B3139]">
                        Abort_Entry
                    </button>
                    <button onClick={handleSave} className="flex-1 h-10 bg-[#F0B90B] hover:bg-[#D4A50A] text-black rounded font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-[#F0B90B]/5">
                        <Save className="w-4 h-4 stroke-[3]" />
                        Commit_Data_To_Buffer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualDataInput;
