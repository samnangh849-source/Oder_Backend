import React, { useState, useEffect, useContext } from 'react';
import { IncentiveProject, IncentiveCalculator } from '../types';
import { getProjectById, updateProject, deleteCalculator, duplicateCalculator } from '../services/incentiveService';
import CalculatorBuilder from '../components/incentives/CalculatorBuilder';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';

interface IncentiveProjectDetailsProps {
    projectId: string;
    onBack: () => void;
}

const IncentiveProjectDetails: React.FC<IncentiveProjectDetailsProps> = ({ projectId, onBack }) => {
    const { language, parsedOrders } = useContext(AppContext);
    const t = translations[language];

    const [project, setProject] = useState<IncentiveProject | null>(null);
    const [editingCalculator, setEditingCalculator] = useState<IncentiveCalculator | null>(null);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [calculatorType, setCalculatorType] = useState<'Achievement' | 'Commission'>('Achievement');

    const loadProject = async () => {
        const p = await getProjectById(Number(projectId));
        if (p) setProject(p);
    };

    useEffect(() => {
        loadProject();
    }, [projectId]);

    const handleUpdateStatus = async (newStatus: 'Active' | 'Disable' | 'Draft') => {
        if (!project || !project.id) return;
        await updateProject(project.id, { status: newStatus });
        loadProject();
    };

    const handleDeleteCalc = async (calcId: string) => {
        if (window.confirm('Are you sure you want to delete this calculator?')) {
            await deleteCalculator(Number(projectId), Number(calcId));
            loadProject();
        }
    };

    const handleDuplicateCalc = async (calcId: string) => {
        await duplicateCalculator(Number(projectId), Number(calcId));
        loadProject();
    };

    const openBuilderNew = (type: 'Achievement' | 'Commission') => {
        setEditingCalculator(null);
        setCalculatorType(type);
        setIsBuilderOpen(true);
    };

    const openBuilderEdit = (calc: IncentiveCalculator) => {
        setEditingCalculator(calc);
        setCalculatorType(calc.type);
        setIsBuilderOpen(true);
    };

    if (!project) return <div className="p-8 text-white">{t.loading}</div>;

    if (isBuilderOpen) {
        return (
            <CalculatorBuilder 
                projectId={project.id}
                initialData={editingCalculator || undefined}
                type={calculatorType}
                onClose={() => setIsBuilderOpen(false)}
                onSave={() => {
                    setIsBuilderOpen(false);
                    loadProject();
                }}
            />
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            {/* Header Actions */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all text-slate-400 hover:text-white border border-slate-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <div className="flex-grow flex justify-between items-center bg-slate-900/60 p-4 rounded-3xl border border-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 shadow-inner" style={{ backgroundColor: `${project.colorCode}20` }}>
                            <svg className="w-5 h-5" style={{ color: project.colorCode }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">{project.name}</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Configuration Mode | Source: {project.dataSource}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-700 active:scale-95 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Project Settings
                        </button>
                        <div className="h-8 w-px bg-slate-800 mx-2"></div>
                        <select 
                            value={project.status} 
                            onChange={(e) => handleUpdateStatus(e.target.value as any)}
                            className={`form-select text-xs font-black uppercase tracking-widest rounded-xl border-none py-2 pl-3 pr-8 ${
                                project.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 
                                project.status === 'Draft' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                            }`}
                        >
                            <option value="Draft">Draft</option>
                            <option value="Active">Active</option>
                            <option value="Disable">Disable</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* CALCULATORS ENGINE Section */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
                            {t.calculators_engine}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold mt-1">{t.calculators_engine_desc}</p>
                    </div>
                    
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => openBuilderNew('Achievement')}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            {t.achievement_bonus}
                        </button>
                        <button 
                            onClick={() => openBuilderNew('Commission')}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            {t.commission_rate}
                        </button>
                    </div>
                </div>

                {(!project.calculators || project.calculators.length === 0) ? (
                    <div className="bg-slate-900/40 border border-dashed border-slate-700/50 rounded-3xl p-12 text-center">
                        <p className="text-slate-500 font-bold">{t.no_calculators}</p>
                        <p className="text-xs text-slate-600 mt-2">{t.add_calculator_desc}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {project.calculators.map(calc => (
                            <div key={calc.id} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${calc.type === 'Achievement' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {calc.type === 'Achievement' ? (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                ) : (
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01m-2.286 11.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                )}
                                            </svg>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-white uppercase tracking-tight text-lg">{calc.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${calc.type === 'Achievement' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                                    {calc.type === 'Achievement' ? t.achievement_bonus : t.commission_rate}
                                                </span>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${calc.status === 'Active' ? 'text-emerald-500' : calc.status === 'Draft' ? 'text-amber-500' : 'text-red-500'}`}>
                                                    • {calc.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                                        <button onClick={() => handleDuplicateCalc(calc.id)} className="p-2 hover:bg-blue-600/10 hover:text-blue-400 rounded-lg transition-all" title="Duplicate Calculator">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7M8 7h6a2 2 0 012 2v2M9 11h6" /></svg>
                                        </button>
                                        <button onClick={() => openBuilderEdit(calc)} className="p-2 hover:bg-emerald-600/10 hover:text-emerald-400 rounded-lg transition-all" title="Edit Calculator">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button onClick={() => handleDeleteCalc(calc.id)} className="p-2 hover:bg-red-600/10 hover:text-red-400 rounded-lg transition-all" title="Delete Calculator">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-6 bg-slate-950/50 p-4 rounded-2xl border border-white/5">
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t.metric}</p>
                                        <p className="text-xs font-black text-gray-200">{calc.metricType}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t.period}</p>
                                        <p className="text-xs font-black text-gray-200">{calc.calculationPeriod}</p>
                                    </div>
                                    {calc.type === 'Achievement' && calc.achievementTiers && (
                                        <div className="col-span-2 border-t border-slate-800 pt-3">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">{t.tiers_config}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {calc.achievementTiers.map((t, i) => (
                                                    <span key={t.id} className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded-lg border border-slate-700">
                                                        T{i+1}: {t.target} {calc.metricUnit} → {t.rewardType === 'Percentage' ? `${t.rewardAmount}%` : `$${t.rewardAmount}`}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {calc.type === 'Commission' && calc.commissionType && (
                                        <div className="col-span-2 border-t border-slate-800 pt-3">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t.commission_rule}</p>
                                            <p className="text-xs font-bold text-gray-300">{calc.commissionType} - {calc.commissionMethod} {calc.commissionCondition}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Project Settings Modal */}
            <CreateProjectModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSuccess={() => {
                    setIsSettingsOpen(false);
                    loadProject();
                }}
                initialData={project}
            />
        </div>
    );
};

export default IncentiveProjectDetails;
