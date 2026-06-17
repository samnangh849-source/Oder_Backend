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
    Activity, AlertCircle, RefreshCw, TrendingUp,
    Target, Layers, ArrowRight,
    Terminal, Box, Cpu, Plus
} from 'lucide-react';

interface IncentiveProjectDetailsProps {
    projectId: string;
    onBack: () => void;
}

const formatDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

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

    const handleDeleteCalc = async (calcId: string | number | undefined) => {
        if (calcId === undefined) return;
        if (window.confirm('តើអ្នកពិតជាចង់លុប Formula នេះមែនទេ?')) {
            try {
                await deleteCalculator(Number(projectId), Number(calcId));
                loadProject();
            } catch (err) {
                alert('Failed to delete calculator');
            }
        }
    };

    const handleDuplicateCalc = async (calcId: string | number | undefined) => {
        if (calcId === undefined) return;
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
        setCalculatorType(calc.type as any);
        setIsBuilderOpen(true);
    };

    if (isLoading && !project) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-[#EAECEF]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#F0B90B]/20 border-t-[#F0B90B] rounded-full animate-spin"></div>
                    <p className="text-xs text-[#707A8A] font-semibold">Loading project settings...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-[#050505] p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-12 h-12 text-[#F6465D]/50 mb-4" />
                <h2 className="text-lg font-bold text-[#EAECEF] mb-2">Project could not be loaded</h2>
                <p className="text-[#707A8A] text-sm mb-8 max-w-xs">{error || 'Project data was unavailable.'}</p>
                <button onClick={loadProject} className="h-9 px-6 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#EAECEF] rounded text-xs font-bold transition-all border border-[#2B3139] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
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
        <div className="incentive-surface w-full h-screen bg-[#050505] text-[#EAECEF] font-sans selection:bg-[#F0B90B]/30 flex flex-col overflow-hidden">
            <header className="bg-[#121212] border-b border-white/5 px-6 py-4 shrink-0 relative overflow-hidden group/header">
                {/* Header Background Accent */}
                <div 
                    className="absolute -top-16 -left-16 w-32 h-32 rounded-full blur-[60px] opacity-[0.05] group-hover/header:opacity-[0.1] transition-all duration-700"
                    style={{ backgroundColor: project.colorCode || '#F0B90B' }}
                ></div>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-6 min-w-0">
                        <button 
                            onClick={onBack} 
                            className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-[#B7BDC6] hover:text-white shrink-0 active:scale-90"
                            title="Back"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
                        <div className="flex items-center gap-5 min-w-0">
                            <div 
                                className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center shrink-0 relative overflow-hidden shadow-lg"
                                style={{ boxShadow: `0 0 15px ${project.colorCode || '#F0B90B'}10` }}
                            >
                                <div className="absolute inset-0 opacity-10 blur-xl" style={{ backgroundColor: project.colorCode || '#F0B90B' }}></div>
                                <Terminal className="w-5 h-5 relative z-10" style={{ color: project.colorCode || '#F0B90B' }} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-black text-white italic tracking-tighter leading-none mb-1.5 truncate">
                                    {project.projectName}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Protocol_ID</span>
                                    <span className="text-[10px] font-mono font-bold text-white/40">#{String(project.id).padStart(4, '0')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-500 shadow-lg ${
                            project.status === 'Active' 
                                ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20' 
                                : 'bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20'
                        }`}>
                            <span className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full animate-pulse ${project.status === 'Active' ? 'bg-[#0ECB81]' : 'bg-[#F0B90B]'}`}></div>
                                {project.status === 'Active' ? 'PROTOCOL_ACTIVE' : 'SYSTEM_DRAFT'}
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsSettingsOpen(true)}
                            className="h-11 px-5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center gap-3 active:scale-95"
                        >
                            <Settings className="w-4 h-4" />
                            CONFIG_PROJECT
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] min-h-full">
                <aside className="bg-[#121212]/50 backdrop-blur-xl border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col">
                    <div className="p-8 space-y-8">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                                    CORE_OVERVIEW
                                </h3>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { icon: Database, label: 'DATA_SOURCE', value: project.dataSource || 'system', accent: 'text-primary' },
                                    { icon: Calendar, label: 'INITIALIZED', value: formatDate(project.createdAt), accent: 'text-white/60' },
                                    { icon: Target, label: 'TARGET_ENTITY', value: project.targetTeam || 'GLOBAL_PROTOCOL', accent: 'text-primary' }
                                ].map((item, i) => (
                                    <div key={i} className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 group/item hover:bg-white/[0.05] transition-all">
                                        <p className="text-[9px] font-black text-white/20 mb-2.5 flex items-center gap-2 tracking-widest">
                                            <item.icon className="w-3 h-3" /> {item.label}
                                        </p>
                                        <p className={`text-sm font-black uppercase tracking-wide ${item.accent}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                                    LOGIC_MODULES
                                </h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                    <p className="text-[9px] font-black text-white/20 mb-2 uppercase tracking-widest">Total</p>
                                    <p className="text-3xl font-mono font-black text-primary">{project.calculators?.length || 0}</p>
                                </div>
                                <div className="bg-white/[0.03] p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                    <p className="text-[9px] font-black text-white/20 mb-2 uppercase tracking-widest">Active</p>
                                    <p className="text-3xl font-mono font-black text-emerald-500">{project.calculators?.filter(c => c.status === 'Active').length || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-8 border-t border-white/5 bg-black/20">
                        <div className="flex items-start gap-4 text-white/40">
                            <Activity className="w-5 h-5 shrink-0 mt-1 opacity-20" />
                            <p className="text-xs font-medium leading-relaxed italic">
                                Initialize logic modules to establish incentive protocols. Monitor real-time performance within each node.
                            </p>
                        </div>
                    </div>
                </aside>

                <main className="bg-[#050505] p-8 sm:p-12">
                    <div className="max-w-5xl mx-auto space-y-12">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 border-b border-white/5 pb-10">
                            <div className="flex items-center gap-6 min-w-0">
                                <div className="w-2 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(252,213,53,0.3)]"></div>
                                <div>
                                    <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">
                                        Logic_Studio
                                    </h3>
                                    <p className="text-xs text-white/30 font-black uppercase tracking-[0.3em]">
                                        {project.calculators?.length || 0} Modules_Deployed
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => openBuilderNew('Achievement')}
                                    className="h-12 px-6 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black rounded-sm text-[11px] font-black transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[0_0_20px_rgba(252,213,53,0.2)] hover:shadow-[0_0_30px_rgba(252,213,53,0.4)] uppercase tracking-[0.2em]"
                                >
                                    <Award className="w-5 h-5" />
                                    Deploy_Achievement
                                </button>
                                <button
                                    onClick={() => openBuilderNew('Commission')}
                                    className="h-12 px-6 bg-[#0ECB81] hover:bg-[#0CA66B] text-[#0B0E11] rounded-sm text-[11px] font-black transition-all flex items-center justify-center gap-3 active:scale-95 shadow-[0_0_20px_rgba(14,203,129,0.2)] hover:shadow-[0_0_30px_rgba(14,203,129,0.4)] uppercase tracking-[0.2em]"
                                >
                                    <DollarSign className="w-5 h-5" />
                                    Deploy_Commission
                                </button>
                            </div>                        </div>

                        {(!project.calculators || project.calculators.length === 0) ? (
                            <div className="min-h-[400px] bg-white/[0.02] border border-white/5 border-dashed rounded-[48px] flex flex-col items-center justify-center text-center p-12 group/empty transition-all hover:bg-white/[0.03]">
                                <div className="w-20 h-20 rounded-3xl bg-black border border-white/10 flex items-center justify-center mb-8 shadow-2xl group-hover/empty:scale-110 transition-transform">
                                    <Layers className="w-10 h-10 text-white/10" />
                                </div>
                                <p className="text-white font-black text-xl mb-3 uppercase tracking-tight italic">No_Logic_Found</p>
                                <p className="text-white/30 text-sm max-w-sm mb-10 font-medium">The system protocol requires at least one logic module to begin data processing.</p>
                                <button onClick={() => openBuilderNew('Achievement')} className="h-12 px-8 bg-primary hover:bg-primary/90 text-black rounded-2xl text-[11px] font-black transition-all flex items-center gap-3 shadow-xl active:scale-95 uppercase tracking-widest">
                                    <Plus className="w-5 h-5 stroke-[3]" />
                                    Initialize_First_Module
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 pb-20">
                                {project.calculators.map((calc) => (
                                    <div 
                                        key={calc.id} 
                                        className="bg-[#121212] border border-white/5 hover:border-white/10 transition-all duration-500 rounded-[32px] overflow-hidden group shadow-xl hover:shadow-2xl relative"
                                    >
                                        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(250px,1.2fr)_minmax(0,2fr)_auto] gap-8 lg:items-center relative z-10">
                                            <div className="flex items-center gap-6 min-w-0">
                                                <div 
                                                    className={`w-16 h-16 rounded-2xl bg-black border flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 relative overflow-hidden ${
                                                        calc.type === 'Achievement' ? 'border-primary/20 text-primary' : 'border-emerald-500/20 text-emerald-400'
                                                    }`}
                                                    style={{ boxShadow: `0 0 20px ${calc.type === 'Achievement' ? '#FCD53510' : '#10B98110'}` }}
                                                >
                                                    <div className="absolute inset-0 opacity-10 blur-xl" style={{ backgroundColor: calc.type === 'Achievement' ? '#FCD535' : '#10B981' }}></div>
                                                    {calc.type === 'Achievement' ? <Zap className="w-8 h-8 relative z-10" /> : <TrendingUp className="w-8 h-8 relative z-10" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xl font-black text-white truncate italic tracking-tight mb-2 group-hover:text-primary transition-colors">
                                                        {calc.name}
                                                    </h4>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${
                                                            calc.type === 'Achievement' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                        }`}>
                                                            {calc.type === 'Achievement' ? 'Achievement' : 'Commission'}
                                                        </span>
                                                        <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${
                                                            calc.status === 'Active' ? 'text-emerald-400' : 'text-white/20'
                                                        }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${calc.status === 'Active' ? 'bg-emerald-400 animate-pulse' : 'bg-white/10'}`}></div>
                                                            {calc.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 lg:border-l border-white/5 lg:pl-8">
                                                <div className="space-y-2">
                                                    <p className="text-[9px] text-white/20 font-black uppercase tracking-widest flex items-center gap-2">
                                                        <Target className="w-3 h-3" /> Metric
                                                    </p>
                                                    <p className="text-sm font-black text-white/80 truncate uppercase tracking-tight italic">{calc.metricType || 'Custom KPI'}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-[9px] text-white/20 font-black uppercase tracking-widest flex items-center gap-2">
                                                        <Calendar className="w-3 h-3" /> Cycle
                                                    </p>
                                                    <p className="text-sm font-black text-white/80 uppercase tracking-tight italic">{calc.calculationPeriod || 'Monthly'}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-[9px] text-white/20 font-black uppercase tracking-widest flex items-center gap-2">
                                                        <Terminal className="w-3 h-3" /> Logic_Rule
                                                    </p>
                                                    <p className="text-sm font-mono font-black text-primary truncate">
                                                        {calc.type === 'Achievement' ? `${calc.achievementTiers?.length || 0}_NODES` : (calc.commissionType || 'STATIC').toUpperCase()}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center lg:justify-end gap-3">
                                                <button onClick={() => handleDuplicateCalc(calc.id)} className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/30 hover:text-white rounded-2xl transition-all border border-white/10 active:scale-90" title="Duplicate">
                                                    <Copy className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => openBuilderEdit(calc)} className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/30 hover:text-white rounded-2xl transition-all border border-white/10 active:scale-90" title="Edit">
                                                    <Edit3 className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDeleteCalc(calc.id)} className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-500 rounded-2xl transition-all border border-white/10 active:scale-90" title="Delete">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {calc.type === 'Achievement' && calc.achievementTiers && (
                                            <div className="bg-white/[0.01] px-6 sm:px-8 py-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center gap-6 overflow-hidden">
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="w-1.5 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(252,213,53,0.2)]"></div>
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Protocol_Nodes</span>
                                                </div>
                                                <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar no-scrollbar pb-1 sm:pb-0">
                                                    {[...calc.achievementTiers].sort((a,b) => (a.subPeriod || '').localeCompare(b.subPeriod || '') || a.target - b.target).map((tier, i, arr) => (
                                                        <div key={tier.id} className="flex items-center gap-4 shrink-0">
                                                            <div className="px-5 py-3 bg-black/40 border border-white/5 rounded-[20px] flex items-center gap-4 hover:border-primary/40 hover:bg-black/60 transition-all duration-300 group/node shadow-lg">
                                                                <div className="flex flex-col">
                                                                    {tier.subPeriod && <span className="text-[8px] font-black text-primary uppercase tracking-tighter leading-none mb-1.5 opacity-60">{tier.subPeriod}</span>}
                                                                    <span className="text-xs font-mono text-white/50 font-black leading-none group-hover/node:text-white transition-colors tracking-tight">${tier.target.toLocaleString()}</span>
                                                                </div>
                                                                <div className="w-px h-5 bg-white/10"></div>
                                                                <span className="text-sm font-mono text-emerald-400 font-black tracking-tight">{tier.rewardType === 'Percentage' ? `${tier.rewardAmount}%` : `$${tier.rewardAmount}`}</span>
                                                            </div>
                                                            {i < arr.length - 1 && (
                                                                <div className="w-4 h-[2px] bg-white/5 rounded-full opacity-50 shrink-0"></div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
                </div>
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
