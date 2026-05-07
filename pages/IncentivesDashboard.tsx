import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { IncentiveProject } from '../types';
import { getIncentiveProjects, duplicateProject } from '../services/incentiveService';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import {
    TrendingUp, Plus, Copy, Settings2,
    ChevronLeft, Search,
    ArrowUpDown, AlertCircle, RefreshCw, Gift,
    ShieldCheck, Target, Activity, ExternalLink, Layers
} from 'lucide-react';

interface IncentivesDashboardProps {
    onOpenProject: (projectId: string, mode: 'manage' | 'execute') => void;
    onBack: () => void;
}

type SortOption = 'newest' | 'oldest' | 'name' | 'status';

const formatProjectDate = (value?: string) => {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getStatusClasses = (status?: string) => {
    if (status === 'Active') return 'bg-[#0ECB81]/10 border-[#0ECB81]/25 text-[#0ECB81]';
    if (status === 'Draft') return 'bg-[#F0B90B]/10 border-[#F0B90B]/25 text-[#F0B90B]';
    return 'bg-[#1A1A1A] border-[#2B3139] text-[#B7BDC6]';
};

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
        const draft = projects.filter(p => p.status === 'Draft').length;
        return {
            total: projects.length,
            active: projects.filter(p => p.status === 'Active').length,
            draft,
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
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-[#EAECEF]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[#F0B90B]/20 border-t-[#F0B90B] rounded-full animate-spin"></div>
                    <p className="text-xs font-semibold text-[#707A8A]">Loading incentive projects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-[#EAECEF] font-sans selection:bg-[#F0B90B]/30 flex flex-col h-full overflow-hidden">
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
                                <Gift className="w-5 h-5 text-[#F0B90B]" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold truncate">{t.incentives}</h1>
                                <p className="text-xs text-[#707A8A] truncate">Create, manage, and run staff incentive programs.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                            className="h-10 px-4 bg-[#F0B90B] hover:bg-[#D4A50A] text-black rounded text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        {t.new_project}
                    </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-6 space-y-5">
                {error && (
                    <div className="bg-[#F6465D]/10 border border-[#F6465D]/25 text-[#F6465D] rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="text-sm font-bold">Could not load incentive projects</p>
                                <p className="text-xs text-[#FCA5B1]">{error}</p>
                            </div>
                        </div>
                        <button onClick={loadProjects} className="h-9 px-4 rounded bg-[#1A1A1A] border border-[#F6465D]/25 text-xs font-bold hover:bg-[#2B3139] transition-all flex items-center justify-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                        </button>
                    </div>
                )}

                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                        { label: t.total_projects, value: stats.total, color: '#EAECEF', icon: Layers, detail: 'Programs in workspace' },
                        { label: t.active_projects, value: stats.active, color: '#0ECB81', icon: ShieldCheck, detail: 'Ready for execution' },
                        { label: 'Draft projects', value: stats.draft, color: '#F0B90B', icon: Activity, detail: 'Still being configured' },
                        { label: t.total_calculators, value: stats.calculators, color: '#B7BDC6', icon: Target, detail: 'Rules across projects' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-[#121212] border border-[#1A1A1A] rounded p-4 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-[#707A8A]">{stat.label}</span>
                                <div className="text-2xl font-bold leading-tight" style={{ color: stat.color }}>{stat.value}</div>
                                <p className="text-[11px] text-[#707A8A]">{stat.detail}</p>
                            </div>
                            <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center shrink-0">
                                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                            </div>
                        </div>
                    ))}
                </section>

                <section className="bg-[#121212] border border-[#1A1A1A] p-3 rounded flex flex-col xl:flex-row xl:items-center gap-3">
                    <div className="relative flex-grow group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707A8A]" />
                        <input 
                            type="text" 
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full h-10 bg-[#050505] border border-[#1A1A1A] rounded px-10 text-sm text-[#EAECEF] placeholder:text-[#707A8A] focus:border-[#F0B90B]/50 transition-all outline-none"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-[#1A1A1A] overflow-x-auto no-scrollbar">
                            {(['All', 'Active', 'Draft'] as const).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`h-8 px-3 rounded text-xs font-bold transition-all whitespace-nowrap ${filterStatus === status ? 'bg-[#2B3139] text-[#F0B90B]' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}
                                >
                                    {status === 'All' ? 'All projects' : status === 'Active' ? 'Active' : 'Draft'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <ArrowUpDown className="w-4 h-4 text-[#707A8A]" />
                        <select 
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortOption)}
                                className="bg-[#050505] border border-[#1A1A1A] rounded h-10 px-3 text-xs font-bold text-[#EAECEF] outline-none cursor-pointer min-w-[150px]"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="name">Name A-Z</option>
                            <option value="status">Status</option>
                        </select>
                        </div>
                    </div>
                </section>

                {filteredAndSortedProjects.length === 0 ? (
                    <div className="min-h-[360px] bg-[#121212] border border-[#1A1A1A] border-dashed rounded flex flex-col items-center justify-center text-center p-8">
                        <div className="w-14 h-14 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center mb-4">
                            <Search className="w-7 h-7 text-[#707A8A]" />
                        </div>
                        <p className="text-sm font-bold text-[#EAECEF]">{t.no_projects_found}</p>
                        <p className="text-xs text-[#707A8A] mt-1 max-w-sm">Try a different search or create a new incentive project.</p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-5 h-10 px-4 bg-[#F0B90B] hover:bg-[#D4A50A] text-black rounded text-xs font-bold transition-all flex items-center gap-2"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t.new_project}
                        </button>
                    </div>
                ) : (
                    <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {filteredAndSortedProjects.map((project) => (
                            <div 
                                key={project.id}
                                className="bg-[#121212] border border-[#1A1A1A] hover:border-[#2B3139] rounded transition-all flex flex-col group overflow-hidden"
                            >
                                <div className="p-4 sm:p-5 flex flex-col gap-5 border-b border-[#1A1A1A]">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div 
                                                className="w-11 h-11 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center transition-all group-hover:border-[#F0B90B]/30 shrink-0"
                                            >
                                                <TrendingUp className="w-5 h-5" style={{ color: project.colorCode || '#F0B90B' }} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-[#EAECEF] truncate">{project.projectName}</h4>
                                                <span className="text-[11px] font-mono text-[#707A8A]">ID {String(project.id).padStart(4, '0')}</span>
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded text-[10px] font-bold border shrink-0 ${getStatusClasses(project.status)}`}>
                                            {project.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-[#050505] p-2 rounded border border-[#1A1A1A]">
                                            <p className="text-[11px] font-semibold text-[#707A8A] mb-1">Calculators</p>
                                            <p className="text-lg font-mono font-bold text-[#EAECEF]">{project.calculators?.length || 0}</p>
                                        </div>
                                        <div className="bg-[#050505] p-2 rounded border border-[#1A1A1A]">
                                            <p className="text-[11px] font-semibold text-[#707A8A] mb-1">Created</p>
                                            <p className="text-xs font-mono font-bold text-[#EAECEF] truncate">{formatProjectDate(project.createdAt)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 flex gap-2">
                                    <button 
                                        onClick={() => onOpenProject(String(project.id), 'execute')}
                                        className="flex-1 h-10 bg-[#2B3139] hover:bg-[#F0B90B] text-[#EAECEF] hover:text-black rounded text-xs font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Run payout
                                    </button>
                                    <button 
                                        onClick={() => onOpenProject(String(project.id), 'manage')}
                                        className="w-10 h-10 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#EAECEF] rounded transition-all border border-[#1A1A1A] flex items-center justify-center"
                                        title="Manage project"
                                    >
                                        <Settings2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDuplicate(String(project.id))}
                                        className="w-10 h-10 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#EAECEF] rounded transition-all border border-[#1A1A1A] flex items-center justify-center"
                                        title="Duplicate project"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </section>
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
