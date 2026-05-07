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
    Terminal, Box
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

const statusBadgeClass = (status?: string) => {
    if (status === 'Active') return 'bg-[#0ECB81]/10 border-[#0ECB81]/25 text-[#0ECB81]';
    if (status === 'Draft') return 'bg-[#F0B90B]/10 border-[#F0B90B]/25 text-[#F0B90B]';
    return 'bg-[#1A1A1A] border-[#2B3139] text-[#B7BDC6]';
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

    const handleUpdateStatus = async (newStatus: 'Active' | 'Disable' | 'Draft') => {
        if (!project || !project.id) return;
        try {
            await updateProject(project.id, { status: newStatus });
            loadProject();
        } catch (err) {
            alert('Failed to update status');
        }
    };

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
        setCalculatorType(calc.type);
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
        <div className="w-full h-screen bg-[#050505] text-[#EAECEF] font-sans selection:bg-[#F0B90B]/30 flex flex-col overflow-hidden">
            <header className="bg-[#121212] border-b border-[#1A1A1A] px-4 sm:px-6 py-3 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                    <button 
                        onClick={onBack} 
                            className="w-9 h-9 flex items-center justify-center hover:bg-[#2B3139] rounded transition-all text-[#B7BDC6] hover:text-[#F0B90B] shrink-0"
                            title="Back"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                        <div className="h-8 w-px bg-[#1A1A1A] hidden sm:block"></div>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded bg-[#F0B90B]/10 border border-[#F0B90B]/25 flex items-center justify-center shrink-0">
                                <Terminal className="w-4 h-4 text-[#F0B90B]" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold truncate">{project.projectName}</h2>
                                <p className="text-xs text-[#707A8A] truncate">Project ID {String(project.id).padStart(3, '0')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 border ${statusBadgeClass(project.status)}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'Active' ? 'bg-[#0ECB81] animate-pulse' : 'bg-current'}`}></div>
                        {project.status}
                    </div>
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                            className="h-9 px-4 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#B7BDC6] hover:text-[#EAECEF] rounded text-xs font-bold transition-all border border-[#2B3139] flex items-center gap-2"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Project settings
                    </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] min-h-full">
                <aside className="bg-[#121212] border-b lg:border-b-0 lg:border-r border-[#1A1A1A] flex flex-col">
                    <div className="p-5 sm:p-6 space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[#B7BDC6] flex items-center gap-2">
                                <Box className="w-3 h-3" />
                                Project overview
                            </h3>
                            <div className="space-y-3">
                                <div className="bg-[#050505] p-3 rounded border border-[#1A1A1A]">
                                    <p className="text-[11px] font-semibold text-[#707A8A] mb-1 flex items-center gap-2">
                                        <Database className="w-3 h-3" /> Data Source
                                    </p>
                                    <p className="text-sm font-bold text-[#EAECEF] capitalize">{project.dataSource || 'system'}</p>
                                </div>
                                <div className="bg-[#050505] p-3 rounded border border-[#1A1A1A]">
                                    <p className="text-[11px] font-semibold text-[#707A8A] mb-1 flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> Created
                                    </p>
                                    <p className="text-sm font-bold text-[#EAECEF]">{formatDate(project.createdAt)}</p>
                                </div>
                                <div className="bg-[#050505] p-3 rounded border border-[#1A1A1A]">
                                    <p className="text-[11px] font-semibold text-[#707A8A] mb-1 flex items-center gap-2">
                                        <Target className="w-3 h-3" /> Target Group
                                    </p>
                                    <p className="text-sm font-bold text-[#EAECEF]">{project.targetTeam || 'All teams'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-[#B7BDC6] flex items-center gap-2">
                                <Activity className="w-3 h-3" /> Calculator summary
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-[#050505] p-3 rounded border border-[#1A1A1A]">
                                    <p className="text-[11px] font-semibold text-[#707A8A] mb-1">Total</p>
                                    <p className="text-lg font-mono font-bold text-[#F0B90B]">{project.calculators?.length || 0}</p>
                                </div>
                                <div className="bg-[#050505] p-3 rounded border border-[#1A1A1A]">
                                    <p className="text-[11px] font-semibold text-[#707A8A] mb-1">Active</p>
                                    <p className="text-lg font-mono font-bold text-[#0ECB81]">{project.calculators?.filter(c => c.status === 'Active').length || 0}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-4 border-t border-[#1A1A1A] bg-[#080808]">
                        <p className="text-xs text-[#707A8A] leading-relaxed">
                            Build formulas here, then run payouts from the execution view.
                        </p>
                    </div>
                </aside>

                <main className="bg-[#050505] p-4 sm:p-6">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[#1A1A1A] pb-6">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-1.5 h-6 bg-[#F0B90B] rounded-full"></div>
                                <h3 className="text-lg font-bold text-[#EAECEF]">{t.calculators}</h3>
                                <div className="h-4 w-px bg-[#1A1A1A]"></div>
                                <span className="text-xs text-[#707A8A] truncate">{project.calculators?.length || 0} rules configured</span>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button 
                                    onClick={() => openBuilderNew('Achievement')}
                                    className="h-10 px-4 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#F0B90B] rounded text-xs font-bold border border-[#F0B90B]/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Award className="w-3.5 h-3.5" />
                                    {t.achievement_bonus}
                                </button>
                                <button 
                                    onClick={() => openBuilderNew('Commission')}
                                    className="h-10 px-4 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#0ECB81] rounded text-xs font-bold border border-[#0ECB81]/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <DollarSign className="w-3.5 h-3.5" />
                                    {t.commission_rate}
                                </button>
                            </div>
                        </div>

                        {(!project.calculators || project.calculators.length === 0) ? (
                            <div className="min-h-[360px] bg-[#121212] border border-[#1A1A1A] border-dashed rounded flex flex-col items-center justify-center text-center p-8">
                                <div className="w-14 h-14 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center mb-5">
                                    <Layers className="w-7 h-7 text-[#707A8A]" />
                                </div>
                                <p className="text-[#EAECEF] font-bold text-sm mb-2">{t.no_calculators}</p>
                                <p className="text-[#707A8A] text-xs max-w-xs mb-8">{t.add_calculator_desc}</p>
                                <button onClick={() => openBuilderNew('Achievement')} className="h-10 px-6 bg-[#2B3139] hover:bg-[#F0B90B] text-[#EAECEF] hover:text-black rounded text-xs font-bold transition-all flex items-center gap-2">
                                    <Award className="w-3.5 h-3.5" />
                                    Add first calculator
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {project.calculators.map((calc) => (
                                    <div 
                                        key={calc.id} 
                                        className="bg-[#121212] border border-[#1A1A1A] hover:border-[#2B3139] transition-all rounded overflow-hidden group"
                                    >
                                        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[minmax(220px,1.2fr)_minmax(0,2fr)_auto] gap-5 lg:items-center">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className={`w-12 h-12 rounded bg-[#050505] border flex items-center justify-center shrink-0 ${
                                                    calc.type === 'Achievement' ? 'border-[#F0B90B]/20 text-[#F0B90B]' : 'border-[#0ECB81]/20 text-[#0ECB81]'
                                                }`}>
                                                    {calc.type === 'Achievement' ? <Zap className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-[#EAECEF] text-sm truncate">{calc.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                                            calc.type === 'Achievement' ? 'bg-[#F0B90B]/5 border-[#F0B90B]/20 text-[#F0B90B]' : 'bg-[#0ECB81]/5 border-[#0ECB81]/20 text-[#0ECB81]'
                                                        }`}>
                                                            {calc.type === 'Achievement' ? 'Achievement' : 'Commission'}
                                                        </span>
                                                        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${
                                                            calc.status === 'Active' ? 'text-[#0ECB81]' : 'text-[#707A8A]'
                                                        }`}>
                                                            <div className={`w-1 h-1 rounded-full ${calc.status === 'Active' ? 'bg-[#0ECB81]' : 'bg-[#707A8A]'}`}></div>
                                                            {calc.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:border-l border-[#1A1A1A] lg:pl-5">
                                                <div className="space-y-1">
                                                    <p className="text-[11px] text-[#707A8A] font-semibold flex items-center gap-1.5">
                                                        <Target className="w-2.5 h-2.5" /> Metric
                                                    </p>
                                                    <p className="text-xs font-bold text-[#EAECEF] truncate">{calc.metricType || 'Custom KPI'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[11px] text-[#707A8A] font-semibold flex items-center gap-1.5">
                                                        <Calendar className="w-2.5 h-2.5" /> Cycle
                                                    </p>
                                                    <p className="text-xs font-bold text-[#EAECEF]">{calc.calculationPeriod || 'Monthly'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[11px] text-[#707A8A] font-semibold flex items-center gap-1.5">
                                                        <Terminal className="w-2.5 h-2.5" /> Rule
                                                    </p>
                                                    <p className="text-xs font-mono font-bold text-[#F0B90B] truncate">
                                                        {calc.type === 'Achievement' ? `${calc.achievementTiers?.length || 0} tiers` : calc.commissionType || 'Commission'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center lg:justify-end gap-1.5">
                                                <button onClick={() => handleDuplicateCalc(calc.id)} className="w-9 h-9 flex items-center justify-center bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#EAECEF] rounded transition-all border border-[#1A1A1A]" title="Duplicate">
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => openBuilderEdit(calc)} className="w-9 h-9 flex items-center justify-center bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#EAECEF] rounded transition-all border border-[#1A1A1A]" title="Edit">
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteCalc(calc.id)} className="w-9 h-9 flex items-center justify-center bg-[#1A1A1A] hover:bg-[#F6465D]/10 text-[#707A8A] hover:text-[#F6465D] rounded transition-all border border-[#1A1A1A]" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {calc.type === 'Achievement' && calc.achievementTiers && (
                                            <div className="bg-[#080808] px-4 sm:px-5 py-3 border-t border-[#1A1A1A] flex items-center gap-4 overflow-x-auto custom-scrollbar">
                                                <span className="text-[11px] font-semibold text-[#707A8A] shrink-0">Tier preview</span>
                                                <div className="flex items-center gap-2">
                                                    {[...calc.achievementTiers].sort((a,b) => a.target - b.target).map((tier, i) => (
                                                        <div key={tier.id} className="flex items-center gap-2 shrink-0">
                                                            <div className="px-2 py-1 bg-[#121212] border border-[#1A1A1A] rounded flex items-center gap-2">
                                                                <span className="text-[10px] font-mono text-[#F0B90B] font-bold">${tier.target.toLocaleString()}</span>
                                                                <ArrowRight className="w-2 h-2 text-[#707A8A]" />
                                                                <span className="text-[10px] font-mono text-[#0ECB81] font-bold">{tier.rewardType === 'Percentage' ? `${tier.rewardAmount}%` : `$${tier.rewardAmount}`}</span>
                                                            </div>
                                                            {i < calc.achievementTiers!.length - 1 && <div className="w-2 h-px bg-[#1A1A1A]"></div>}
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
