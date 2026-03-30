import React, { useState, useEffect, useContext, useCallback } from 'react';
import { IncentiveProject, IncentiveCalculator } from '../types';
import { getProjectById, updateProject, deleteCalculator, duplicateCalculator } from '../services/incentiveService';
import CalculatorBuilder from '../components/incentives/CalculatorBuilder';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { 
    ChevronLeft, Settings, Zap, Award, DollarSign, 
    Copy, Edit3, Trash2, Calendar, Database,
    LayoutGrid, Activity, AlertCircle, RefreshCw, TrendingUp,
    ShieldCheck, Star, Target, Layers, ArrowRight, MousePointer2
} from 'lucide-react';

interface IncentiveProjectDetailsProps {
    projectId: string;
    onBack: () => void;
}

const IncentiveProjectDetails: React.FC<IncentiveProjectDetailsProps> = ({ projectId, onBack }) => {
    const { language } = useContext(AppContext);
    const t = translations[language];

    const [project, setProject] = useState<IncentiveProject | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingCalculator, setEditingCalculator] = useState<IncentiveCalculator | null>(null);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [calculatorType, setCalculatorType] = useState<'Achievement' | 'Commission'>('Achievement');

    const loadProject = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const p = await getProjectById(Number(projectId));
            if (p) {
                if (!p.projectName && (p as any).name) {
                    p.projectName = (p as any).name;
                }
                setProject(p);
            } else {
                throw new Error('Project not found');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load project details');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProject();
    }, [loadProject]);

    const handleUpdateStatus = async (newStatus: 'Active' | 'Disable' | 'Draft') => {
        if (!project || !project.id) return;
        try {
            await updateProject(project.id, { status: newStatus });
            loadProject();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const handleDeleteCalc = async (calcId: string) => {
        if (window.confirm('តើអ្នកពិតជាចង់លុប Formula នេះមែនទេ?')) {
            try {
                await deleteCalculator(Number(projectId), Number(calcId));
                loadProject();
            } catch (err) {
                alert('Failed to delete calculator');
            }
        }
    };

    const handleDuplicateCalc = async (calcId: string) => {
        try {
            await duplicateCalculator(Number(projectId), Number(calcId));
            loadProject();
        } catch (err) {
            alert('Failed to duplicate calculator');
        }
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

    if (isLoading && !project) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-[#050505] p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-16 h-16 text-red-500/50 mb-6" />
                <h2 className="text-2xl font-black text-white uppercase mb-2 italic">Sync Failure</h2>
                <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] mb-10 max-w-md">{error || 'Project data corrupted'}</p>
                <button onClick={loadProject} className="h-12 px-8 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest transition-all border border-white/10 flex items-center gap-3">
                    <RefreshCw className="w-4 h-4" />
                    Retry Load
                </button>
            </div>
        );
    }

    if (isBuilderOpen) {
        return (
            <div className="bg-[#050505] min-h-screen">
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
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-[#050505] text-[#F5F5F7] font-sans selection:bg-primary/30">
            {/* Dynamic Hero Section */}
            <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="max-w-[1600px] mx-auto px-6 py-12 relative z-10">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                        <div className="flex items-center gap-8">
                            <button 
                                onClick={onBack} 
                                className="w-14 h-14 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 group"
                            >
                                <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                            </button>
                            
                            <div className="flex items-center gap-6">
                                <div 
                                    className="w-20 h-20 rounded-3xl flex items-center justify-center border bg-black transition-transform hover:scale-105 shadow-2xl"
                                    style={{ 
                                        boxShadow: `0 0 40px ${project.colorCode}20`,
                                        borderColor: `${project.colorCode}40`
                                    }}
                                >
                                    <Activity className="w-10 h-10" style={{ color: project.colorCode || 'var(--primary)' }} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-4 mb-2">
                                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">{project.projectName}</h2>
                                        <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-[0.2em] border border-primary/20">NODE_{String(project.id).padStart(3, '0')}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                                            <Database className="w-4 h-4 text-primary/60" />
                                            {project.dataSource}
                                        </div>
                                        <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                                        <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(project.createdAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                        </div>
                                        <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                                        <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">
                                            <Target className="w-4 h-4" />
                                            {project.targetTeam || 'GLOBAL'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setIsSettingsOpen(true)}
                                className="h-14 px-8 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all border border-white/10 flex items-center gap-3 shadow-lg group"
                            >
                                <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                                {t.settings}
                            </button>
                            <div className="relative">
                                <select 
                                    value={project.status} 
                                    onChange={(e) => handleUpdateStatus(e.target.value as any)}
                                    className={`h-14 px-8 pl-12 rounded-2xl border text-[11px] font-black uppercase tracking-[0.2em] bg-black/40 cursor-pointer focus:ring-0 transition-all appearance-none ${
                                        project.status === 'Active' ? 'text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(52,211,153,0.1)]' : 
                                        project.status === 'Draft' ? 'text-primary border-primary/30 shadow-[0_0_20px_rgba(252,213,53,0.1)]' : 'text-red-400 border-red-500/30'
                                    }`}
                                >
                                    <option value="Draft">DRAFT</option>
                                    <option value="Active">ACTIVE</option>
                                    <option value="Disable">DISABLE</option>
                                </select>
                                <div className={`absolute left-6 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                                    project.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 
                                    project.status === 'Draft' ? 'bg-primary' : 'bg-red-400'
                                }`}></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-16 pb-32">
                {/* Engine Configuration Section */}
                <div className="space-y-12">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-4 mb-3">
                                <h3 className="text-2xl font-black text-white uppercase italic tracking-wider flex items-center gap-4">
                                    <span className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(252,213,53,0.5)]"></span>
                                    {t.calculators}
                                </h3>
                                <div className="h-6 w-px bg-white/10"></div>
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                                    {project.calculators?.length || 0} Core Engines Active
                                </span>
                            </div>
                            <p className="text-white/40 text-xs font-bold uppercase tracking-[0.2em] max-w-2xl">{t.calculators_engine_desc}</p>
                        </div>
                        
                        <div className="flex gap-4">
                            <button 
                                onClick={() => openBuilderNew('Achievement')}
                                className="h-14 px-8 bg-primary text-black hover:bg-[#FCD535] rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-[0_8px_30px_rgba(252,213,53,0.2)] active:scale-95 group"
                            >
                                <Award className="w-5 h-5 stroke-[3] group-hover:scale-110 transition-transform" />
                                {t.achievement_bonus}
                            </button>
                            <button 
                                onClick={() => openBuilderNew('Commission')}
                                className="h-14 px-8 bg-white/5 text-primary border border-primary/30 hover:bg-primary hover:text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95 group"
                            >
                                <DollarSign className="w-5 h-5 stroke-[3] group-hover:scale-110 transition-transform" />
                                {t.commission_rate}
                            </button>
                        </div>
                    </div>

                    {(!project.calculators || project.calculators.length === 0) ? (
                        <div className="bg-white/[0.02] border-2 border-dashed border-white/5 rounded-[40px] py-40 text-center flex flex-col items-center justify-center group hover:border-primary/20 transition-all duration-500">
                            <div className="w-24 h-24 rounded-[32px] bg-black border border-white/10 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-2xl">
                                <Layers className="w-12 h-12 text-white/10 group-hover:text-primary/40" />
                            </div>
                            <p className="text-white/60 font-black uppercase tracking-[0.3em] text-lg mb-4">{t.no_calculators}</p>
                            <p className="text-white/30 text-xs font-bold uppercase tracking-[0.2em] max-w-md mb-12 italic">{t.add_calculator_desc}</p>
                            <button onClick={() => openBuilderNew('Achievement')} className="h-14 px-12 bg-white/5 hover:bg-white/10 text-primary font-black uppercase rounded-2xl border border-white/10 transition-all tracking-[0.3em] shadow-xl active:scale-95">Initialize Node Protocol</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {project.calculators.map((calc) => (
                                <div 
                                    key={calc.id} 
                                    className="bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all duration-500 rounded-[32px] overflow-hidden group hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col"
                                >
                                    <div className="p-8 space-y-8 flex-grow">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-6">
                                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 group-hover:rotate-6 shadow-2xl ${
                                                    calc.type === 'Achievement' ? 'border-primary/30 bg-black text-primary shadow-primary/10' : 'border-emerald-500/30 bg-black text-emerald-400 shadow-emerald-500/10'
                                                }`}>
                                                    {calc.type === 'Achievement' ? <Zap className="w-8 h-8" /> : <TrendingUp className="w-8 h-8" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-xl text-white group-hover:text-primary transition-colors uppercase tracking-tight mb-2">{calc.name}</h4>
                                                    <div className="flex items-center gap-4">
                                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border ${
                                                            calc.type === 'Achievement' ? 'border-primary/20 bg-primary/5 text-primary' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                                                        }`}>
                                                            {calc.type === 'Achievement' ? t.achievement_bonus : t.commission_rate}
                                                        </span>
                                                        <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] ${
                                                            calc.status === 'Active' ? 'text-emerald-400' : calc.status === 'Draft' ? 'text-primary' : 'text-red-400'
                                                        }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${calc.status === 'Active' ? 'bg-emerald-400 animate-pulse' : calc.status === 'Draft' ? 'bg-primary' : 'bg-red-400'}`}></div>
                                                            {calc.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleDuplicateCalc(calc.id)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl transition-all border border-white/10" title="Duplicate">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openBuilderEdit(calc)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-xl transition-all border border-white/10" title="Edit">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteCalc(calc.id)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-xl transition-all border border-white/10" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 bg-black/40 p-8 rounded-3xl border border-white/5 relative overflow-hidden group/inner">
                                            <div className="space-y-2 relative z-10">
                                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                                    <Target className="w-4 h-4 text-primary/50" />
                                                    {t.metric}
                                                </p>
                                                <p className="text-sm font-black text-white uppercase tracking-wider">{calc.metricType}</p>
                                            </div>
                                            <div className="space-y-2 text-right relative z-10">
                                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] flex items-center justify-end gap-3">
                                                    <Calendar className="w-4 h-4" />
                                                    {t.period}
                                                </p>
                                                <p className="text-sm font-black text-white uppercase tracking-wider">{calc.calculationPeriod}</p>
                                            </div>
                                            
                                            {calc.type === 'Achievement' && calc.achievementTiers && (
                                                <div className="col-span-2 border-t border-white/5 mt-4 pt-8 space-y-6">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                                            <ShieldCheck className="w-4 h-4 text-emerald-500/60" />
                                                            {t.tiers_config}
                                                        </p>
                                                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{calc.achievementTiers.length} Levels Defined</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {[...calc.achievementTiers].sort((a,b) => a.target - b.target).map((tier, i) => (
                                                            <div key={tier.id} className="group/tier flex items-center justify-between bg-white/5 px-5 py-4 rounded-2xl border border-white/5 hover:border-primary/40 hover:bg-white/10 transition-all duration-300">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-8 h-8 rounded-xl bg-black border border-white/10 text-primary flex items-center justify-center text-[10px] font-black font-mono group-hover/tier:scale-110 transition-transform shadow-lg">{i+1}</div>
                                                                    <div>
                                                                        <span className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] group-hover/tier:text-primary transition-colors block mb-1">{tier.name || `LVL-${i+1}`}</span>
                                                                        <span className="text-sm font-mono font-black text-white">${tier.target.toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em] block mb-1 italic">Reward</span>
                                                                    <span className="text-lg font-black text-primary font-mono group-hover/tier:scale-110 transition-transform inline-block drop-shadow-[0_0_10px_rgba(252,213,53,0.3)]">
                                                                        {tier.rewardType === 'Percentage' ? `${tier.rewardAmount}%` : `$${tier.rewardAmount.toLocaleString()}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {calc.type === 'Commission' && calc.commissionType && (
                                                <div className="col-span-2 border-t border-white/5 mt-4 pt-8">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                                            <Star className="w-4 h-4 text-orange-400/60" />
                                                            {t.commission_rule}
                                                        </p>
                                                        <div className="px-4 py-1.5 bg-emerald-500/10 rounded-full text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] border border-emerald-500/20 shadow-lg">NODE_OPERATIONAL</div>
                                                    </div>
                                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 group-hover/inner:border-primary/20 transition-all">
                                                        <p className="text-sm font-black text-white uppercase tracking-[0.1em] leading-relaxed flex flex-wrap items-center gap-3">
                                                            <span className="text-primary">{calc.commissionType}</span>
                                                            <span className="text-white/10">•</span>
                                                            <span className="text-white/60">{calc.commissionMethod}</span>
                                                            <span className="text-white/10">•</span>
                                                            <span className="px-3 py-1 bg-black rounded-lg border border-primary/30 text-primary font-mono text-xs">{calc.commissionCondition}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="h-2 w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
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
            
            {/* Quick Action FAB */}
            <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-50">
                <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="w-14 h-14 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all hover:-translate-y-1 active:scale-95 group"
                >
                    <ArrowRight className="w-6 h-6 -rotate-90 group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
};

export default IncentiveProjectDetails;
