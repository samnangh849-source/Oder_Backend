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
    LayoutGrid, Activity, AlertCircle, RefreshCw, TrendingUp
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
            <div className="ui-binance min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-bg-black">
                <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-[11px] font-bold text-primary uppercase tracking-widest">{t.loading}...</p>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="ui-binance p-8 flex flex-col items-center justify-center text-center bg-bg-black min-h-screen">
                <AlertCircle className="w-12 h-12 text-[#F6465D] mb-4" />
                <h2 className="text-lg font-bold text-[#EAECEF] uppercase mb-2">Sync Failure</h2>
                <p className="text-secondary text-[11px] uppercase tracking-widest mb-6">{error || 'Project data corrupted'}</p>
                <button onClick={loadProject} className="flex items-center gap-2 px-6 py-2 bg-[#2B3139] hover:bg-[#363C4E] text-[#EAECEF] rounded-md font-bold uppercase tracking-wider text-[11px] transition-all border border-[#474D57]">
                    <RefreshCw className="w-4 h-4" />
                    Retry Load
                </button>
            </div>
        );
    }

    if (isBuilderOpen) {
        return (
            <div className="ui-binance bg-bg-black min-h-screen">
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
        <div className="ui-binance w-full min-h-screen bg-bg-black text-[#EAECEF] font-sans selection:bg-primary/30">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
                {/* Header Navigation */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
                    <button 
                        onClick={onBack} 
                        className="p-1.5 bg-card-bg hover:bg-[#2B3139] rounded-md transition-all text-secondary hover:text-primary border border-[#2B3139]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-grow flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card-bg p-5 rounded-md border border-[#2B3139] gap-4 w-full">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-md flex items-center justify-center border border-[#2B3139] bg-bg-black">
                                <Activity className="w-5 h-5" style={{ color: project.colorCode || 'var(--primary)' }} />
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-[16px] font-bold text-[#EAECEF] uppercase tracking-wider">{project.projectName}</h2>
                                    <span className="px-1.5 py-0.5 bg-[#2B3139] text-primary text-[9px] font-bold rounded uppercase tracking-widest border border-primary/20">NODE-{String(project.id).padStart(3, '0')}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest flex items-center gap-1.5">
                                        <Database className="w-3 h-3 text-primary" />
                                        {project.dataSource}
                                    </p>
                                    <span className="text-[#2B3139]">|</span>
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(project.createdAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setIsSettingsOpen(true)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-bg-black hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md text-[11px] font-bold uppercase tracking-wider transition-all border border-[#2B3139] flex items-center justify-center gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                {t.settings}
                            </button>
                            <select 
                                value={project.status} 
                                onChange={(e) => handleUpdateStatus(e.target.value as any)}
                                className={`flex-1 sm:flex-none text-[11px] font-bold uppercase tracking-wider rounded-md border border-[#2B3139] py-2 pl-3 pr-8 bg-bg-black cursor-pointer focus:ring-0 focus:border-primary ${
                                    project.status === 'Active' ? 'text-[#02C076]' : 
                                    project.status === 'Draft' ? 'text-primary' : 'text-[#F6465D]'
                                }`}
                            >
                                <option value="Draft">DRAFT</option>
                                <option value="Active">ACTIVE</option>
                                <option value="Disable">DISABLE</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* CALCULATORS Section */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2B3139] pb-6">
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1 h-3 bg-primary rounded-full"></span>
                                    {t.calculators}
                                </h3>
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2 py-0.5 bg-[#2B3139] rounded">
                                    {project.calculators?.length || 0} ASSETS
                                </span>
                            </div>
                            <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest">{t.calculators_engine_desc}</p>
                        </div>
                        
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => openBuilderNew('Achievement')}
                                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-bg-black hover:bg-[#f0c51d] rounded-md text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Award className="w-4 h-4" />
                                {t.achievement_bonus}
                            </button>
                            <button 
                                onClick={() => openBuilderNew('Commission')}
                                className="flex-1 sm:flex-none px-4 py-2 bg-bg-black text-primary border border-primary hover:bg-primary hover:text-bg-black rounded-md text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <DollarSign className="w-4 h-4" />
                                {t.commission_rate}
                            </button>
                        </div>
                    </div>

                    {(!project.calculators || project.calculators.length === 0) ? (
                        <div className="bg-card-bg border border-dashed border-[#2B3139] rounded-md py-24 text-center flex flex-col items-center justify-center">
                            <LayoutGrid className="w-12 h-12 text-[#2B3139] mb-4" />
                            <p className="text-secondary font-bold uppercase tracking-widest text-[11px]">{t.no_calculators}</p>
                            <p className="text-[10px] text-secondary mt-2 uppercase tracking-widest max-w-xs">{t.add_calculator_desc}</p>
                            <button onClick={() => openBuilderNew('Achievement')} className="mt-8 px-6 py-2 bg-bg-black hover:bg-[#2B3139] text-[11px] font-bold text-primary uppercase rounded-md border border-[#2B3139] transition-all tracking-widest">Create First Formula</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {project.calculators.map((calc) => (
                                <div 
                                    key={calc.id} 
                                    className="bg-card-bg border border-[#2B3139] hover:border-[#474D57] transition-all rounded-md overflow-hidden group"
                                >
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-md flex items-center justify-center border ${calc.type === 'Achievement' ? 'border-primary/20 bg-bg-black text-primary' : 'border-primary/20 bg-bg-black text-primary'}`}>
                                                    {calc.type === 'Achievement' ? <Zap className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-[#EAECEF] group-hover:text-primary transition-colors uppercase tracking-wider text-[13px]">{calc.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary`}>
                                                            {calc.type === 'Achievement' ? t.achievement_bonus : t.commission_rate}
                                                        </span>
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${calc.status === 'Active' ? 'text-[#02C076]' : calc.status === 'Draft' ? 'text-primary' : 'text-[#F6465D]'}`}>
                                                            <span className={`w-1 h-1 rounded-full ${calc.status === 'Active' ? 'bg-[#02C076]' : calc.status === 'Draft' ? 'bg-primary' : 'bg-[#F6465D]'}`}></span>
                                                            {calc.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => handleDuplicateCalc(calc.id)} className="p-2 bg-bg-black hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md transition-all border border-[#2B3139]">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => openBuilderEdit(calc)} className="p-2 bg-bg-black hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md transition-all border border-[#2B3139]">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteCalc(calc.id)} className="p-2 bg-bg-black hover:bg-[#F6465D]/10 text-secondary hover:text-[#F6465D] rounded-md transition-all border border-[#2B3139]">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 bg-bg-black p-4 rounded-md border border-[#2B3139]">
                                            <div className="space-y-1">
                                                <p className="text-[9px] text-secondary font-bold uppercase tracking-widest">{t.metric}</p>
                                                <p className="text-[11px] font-bold text-[#EAECEF] uppercase tracking-wider">{calc.metricType}</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[9px] text-secondary font-bold uppercase tracking-widest">{t.period}</p>
                                                <p className="text-[11px] font-bold text-[#EAECEF] uppercase tracking-wider">{calc.calculationPeriod}</p>
                                            </div>
                                            
                                            {calc.type === 'Achievement' && calc.achievementTiers && (
                                                <div className="col-span-2 border-t border-[#2B3139] mt-3 pt-3">
                                                    <p className="text-[9px] text-secondary font-bold uppercase tracking-widest mb-3">{t.tiers_config}</p>
                                                    <div className="space-y-2">
                                                        {[...calc.achievementTiers].sort((a,b) => a.target - b.target).map((tier, i) => (
                                                            <div key={tier.id} className="flex items-center justify-between bg-card-bg px-3 py-2 rounded-md border border-[#2B3139] hover:border-[#474D57] transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-6 h-6 rounded bg-bg-black border border-[#2B3139] text-primary flex items-center justify-center text-[9px] font-bold font-mono">{i+1}</div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[9px] text-secondary font-bold uppercase tracking-widest">{tier.name || `LVL-${i+1}`}</span>
                                                                        <span className="text-[11px] font-mono font-bold text-[#EAECEF]">${tier.target.toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[9px] text-secondary font-bold uppercase tracking-widest block">Yield</span>
                                                                    <span className="text-[12px] font-bold text-primary font-mono">
                                                                        {tier.rewardType === 'Percentage' ? `${tier.rewardAmount}%` : `$${tier.rewardAmount.toLocaleString()}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {calc.type === 'Commission' && calc.commissionType && (
                                                <div className="col-span-2 border-t border-[#2B3139] mt-3 pt-3">
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[9px] text-secondary font-bold uppercase tracking-widest">{t.commission_rule}</p>
                                                        <div className="px-1.5 py-0.5 bg-primary/10 rounded text-primary text-[8px] font-bold uppercase tracking-widest border border-primary/20">LIVE</div>
                                                    </div>
                                                    <p className="text-[11px] font-bold text-[#EAECEF] mt-2 uppercase tracking-widest leading-relaxed">
                                                        {calc.commissionType} <span className="text-secondary mx-1">•</span> {calc.commissionMethod} <span className="text-primary font-mono ml-1">{calc.commissionCondition}</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
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
        </div>
    );
};

export default IncentiveProjectDetails;
