import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { IncentiveProject } from '../types';
import { getIncentiveProjects, duplicateProject } from '../services/incentiveService';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { 
    TrendingUp, BarChart3, Plus, LayoutGrid, Copy, Settings2, 
    ArrowUpRight, ChevronLeft, Search, Zap, Calendar, 
    ArrowUpDown, AlertCircle, RefreshCw, Gift, Award, 
    ShieldCheck, Target, Activity, Flame, Trophy, Coins
} from 'lucide-react';

interface IncentivesDashboardProps {
    onOpenProject: (projectId: string, mode: 'manage' | 'execute') => void;
    onBack: () => void;
}

type SortOption = 'newest' | 'oldest' | 'name' | 'status';

const IncentivesDashboard: React.FC<IncentivesDashboardProps> = ({ onOpenProject, onBack }) => {
    const { language } = useContext(AppContext);
    const t = translations[language];

    const [projects, setProjects] = useState<IncentiveProject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Draft'>('All');
    const [sortBy, setSortBy] = useState<SortOption>('newest');

    const loadProjects = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getIncentiveProjects();
            if (Array.isArray(data)) {
                setProjects(data);
            } else {
                throw new Error('Invalid data format received');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const stats = useMemo(() => {
        return {
            total: projects.length,
            active: projects.filter(p => p.status === 'Active').length,
            calculators: projects.reduce((sum, p) => sum + (p.calculators?.length || 0), 0)
        };
    }, [projects]);

    const filteredAndSortedProjects = useMemo(() => {
        let result = projects.filter(p => {
            const matchesSearch = (p.projectName || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
            return matchesSearch && matchesStatus;
        });

        return result.sort((a, b) => {
            switch (sortBy) {
                case 'name': return (a.projectName || '').localeCompare(b.projectName || '');
                case 'status': return (a.status || '').localeCompare(b.status || '');
                case 'oldest': return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                case 'newest':
                default: return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
        });
    }, [projects, searchQuery, filterStatus, sortBy]);

    const handleDuplicate = async (id: string | number) => {
        try {
            await duplicateProject(Number(id));
            loadProjects();
        } catch (err) {
            alert('Failed to duplicate project');
        }
    };

    if (isLoading && projects.length === 0) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-[#F5F5F7] font-sans selection:bg-primary/30 pb-20">
            {/* Premium Header */}
            <div className="relative overflow-hidden bg-gradient-to-b from-primary/10 to-transparent border-b border-white/5">
                <div className="max-w-[1600px] mx-auto px-6 py-10 flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={onBack} 
                            className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 group"
                        >
                            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-md">Alpha v2.5</span>
                                <span className="text-white/30 text-[10px]">•</span>
                                <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Encrypted Protocol</span>
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">{t.incentives}</h1>
                            <p className="text-white/50 text-xs font-medium mt-1 tracking-wide">{t.incentives_subtitle}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden lg:flex flex-col items-end mr-6 text-right">
                            <span className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Global Yield Pool</span>
                            <span className="text-2xl font-mono font-black text-white">$42,900.00</span>
                        </div>
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-14 px-8 bg-primary hover:bg-[#FCD535] text-black rounded-2xl font-black uppercase tracking-[0.1em] text-[13px] transition-all flex items-center gap-3 shadow-[0_8px_30px_rgba(252,213,53,0.3)] active:scale-95 group"
                        >
                            <Plus className="w-5 h-5 stroke-[3]" />
                            {t.new_project}
                        </button>
                    </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>

            <main className="max-w-[1600px] mx-auto px-6 py-12 space-y-12">
                {/* High-Impact Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: t.total_projects, value: stats.total, icon: LayoutGrid, color: 'blue', desc: 'Managed assets' },
                        { label: t.active_projects, value: stats.active, icon: Flame, color: 'emerald', desc: 'Live yield nodes' },
                        { label: t.total_calculators, value: stats.calculators, icon: Award, color: 'primary', desc: 'Calculation engines' }
                    ].map((stat, i) => (
                        <div key={i} className="group relative overflow-hidden bg-white/[0.03] border border-white/10 p-8 rounded-[32px] transition-all hover:bg-white/[0.05] hover:border-white/20">
                            <div className={`absolute top-0 right-0 p-10 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity`}>
                                <stat.icon className="w-24 h-24" />
                            </div>
                            <div className="flex justify-between items-start mb-8">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                    stat.color === 'blue' ? 'bg-blue-500/10 text-blue-400' : 
                                    stat.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : 
                                    'bg-primary/10 text-primary'
                                }`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                            </div>
                            <div>
                                <p className="text-4xl font-mono font-black text-white mb-2">{stat.value.toString().padStart(2, '0')}</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{stat.label}</span>
                                    <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{stat.desc}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter & Command Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-10 border-t border-white/5">
                    <div className="flex items-center gap-6">
                        <div className="flex p-1.5 bg-white/5 rounded-2xl border border-white/5">
                            {(['All', 'Active', 'Draft'] as const).map(status => (
                                <button 
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterStatus === status ? 'bg-white/10 text-primary shadow-lg' : 'text-white/40 hover:text-white'}`}
                                >
                                    {status === 'All' ? t.all_time : status === 'Active' ? t.active_projects : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-grow max-w-3xl items-center gap-4">
                        <div className="relative flex-grow group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-primary transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Search Protocol Directory..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 text-sm font-bold text-white placeholder:text-white/20 focus:border-primary/50 focus:ring-0 transition-all outline-none uppercase tracking-wider"
                            />
                        </div>
                        
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 h-14">
                            <ArrowUpDown className="w-4 h-4 text-white/20" />
                            <select 
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as SortOption)}
                                className="bg-transparent border-none text-[10px] font-black text-white/60 uppercase tracking-[0.2em] focus:ring-0 cursor-pointer p-0"
                            >
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="name">Name</option>
                                <option value="status">Status</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Modern Project Grid */}
                {filteredAndSortedProjects.length === 0 ? (
                    <div className="py-40 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-8 border border-white/10">
                            <Search className="w-10 h-10 text-white/10" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">{t.no_projects_found}</h3>
                        <p className="text-white/30 text-xs font-medium uppercase tracking-widest">{t.no_projects_desc}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {filteredAndSortedProjects.map((project) => (
                            <div 
                                key={project.id}
                                className="group flex flex-col bg-white/[0.03] border border-white/10 rounded-[32px] overflow-hidden transition-all hover:bg-white/[0.06] hover:border-primary/30 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                            >
                                <div className="p-8 flex flex-col h-full space-y-8">
                                    <div className="flex justify-between items-start">
                                        <div 
                                            className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner"
                                            style={{ boxShadow: `0 0 20px ${project.colorCode}15` }}
                                        >
                                            <TrendingUp className="w-7 h-7" style={{ color: project.colorCode || 'var(--primary)' }} />
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${
                                            project.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'
                                        }`}>
                                            <div className={`w-1 h-1 rounded-full ${project.status === 'Active' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/20'}`}></div>
                                            {project.status}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-lg font-black text-white uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-primary transition-colors">{project.projectName}</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-white/30 tracking-widest">NODE_{String(project.id).padStart(4, '0')}</span>
                                            <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{project.targetTeam || 'GLOBAL'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-6 border-y border-white/5">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2"><Target className="w-3 h-3" /> Logic</span>
                                            <p className="text-sm font-mono font-bold text-white">{project.calculators?.length || 0} Engines</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center justify-end gap-2"><Calendar className="w-3 h-3" /> Created</span>
                                            <p className="text-sm font-mono font-bold text-white/60">{new Date(project.createdAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 pt-2">
                                        <button 
                                            onClick={() => onOpenProject(String(project.id), 'execute')}
                                            className="w-full h-12 bg-primary hover:bg-[#FCD535] text-black rounded-xl font-black uppercase tracking-[0.1em] text-[11px] transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(252,213,53,0.1)]"
                                        >
                                            <Activity className="w-4 h-4 stroke-[3]" />
                                            {t.apply_recalculate}
                                        </button>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => onOpenProject(String(project.id), 'manage')}
                                                className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
                                            >
                                                <Settings2 className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">{t.settings}</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDuplicate(String(project.id))}
                                                className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/10 flex items-center justify-center"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <CreateProjectModal 
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadProjects}
            />
        </div>
    );
};

export default IncentivesDashboard;
