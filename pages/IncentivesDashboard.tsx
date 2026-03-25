import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { IncentiveProject } from '../types';
import { getIncentiveProjects, duplicateProject } from '../services/incentiveService';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { 
    TrendingUp, BarChart3, Plus, LayoutGrid, Copy, Settings2, 
    ArrowUpRight, ChevronLeft, Search, Briefcase, 
    Zap, Calendar, ArrowUpDown, AlertCircle, RefreshCw
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
            <div className="ui-binance min-h-screen bg-bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-[11px] font-bold text-primary uppercase tracking-[0.2em]">Synchronizing Network...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ui-binance min-h-screen bg-bg-black flex items-center justify-center p-6">
                <div className="bg-card-bg border border-[#2B3139] rounded-md p-10 text-center max-w-md shadow-sm">
                    <AlertCircle className="w-12 h-12 text-[#F6465D] mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-[#EAECEF] uppercase tracking-wider mb-2">Protocol Error</h2>
                    <p className="text-secondary text-[11px] uppercase tracking-widest mb-8">{error}</p>
                    <button 
                        onClick={loadProjects}
                        className="flex items-center gap-2 px-8 py-2.5 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 text-[#F6465D] rounded-md font-bold uppercase tracking-widest text-[11px] transition-all mx-auto border border-[#F6465D]/20"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Restart Sync
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-binance min-h-screen bg-bg-black text-[#EAECEF] font-sans selection:bg-primary/30 pb-20">
            {/* Binance Style Top Header */}
            <header className="sticky top-0 z-50 bg-[#1E2329]/95 border-b border-[#2B3139] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-1.5 hover:bg-[#2B3139] rounded-md transition-all text-secondary hover:text-primary border border-transparent"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-bg-black">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-wider uppercase leading-none">{t.incentives}</h1>
                            <div className="flex items-center gap-2 text-[10px] text-secondary font-bold mt-1 uppercase tracking-wider">
                                <span className="text-primary">CORE</span>
                                <span className="opacity-30">|</span>
                                <span>Yield Protocol</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-1 p-1 bg-bg-black rounded-md border border-[#2B3139]">
                        {(['All', 'Active', 'Draft'] as const).map(status => (
                            <button 
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${filterStatus === status ? 'bg-[#2B3139] text-primary' : 'text-secondary hover:text-[#EAECEF]'}`}
                            >
                                {status === 'All' ? t.all_time : status === 'Active' ? t.active_projects : status}
                            </button>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-[#f0c51d] text-bg-black rounded-md font-bold uppercase tracking-wider text-[11px] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        {t.new_project}
                    </button>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Dashboard Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">{t.total_projects}</p>
                            <LayoutGrid className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-mono font-bold text-[#EAECEF]">{stats.total}</p>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Total</span>
                        </div>
                    </div>

                    <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">{t.active_projects}</p>
                            <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-mono font-bold text-primary">{stats.active}</p>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Active</span>
                        </div>
                    </div>

                    <div className="bg-card-bg border border-[#2B3139] p-5 rounded-md">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">{t.total_calculators}</p>
                            <BarChart3 className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-mono font-bold text-[#EAECEF]">{stats.calculators}</p>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Methods</span>
                        </div>
                    </div>
                </div>

                {/* Sub Header / Filters */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#2B3139]">
                    <div className="flex items-center gap-3">
                        <h3 className="text-[11px] font-bold text-[#EAECEF] uppercase tracking-widest">{t.project_directory}</h3>
                        <span className="px-2 py-0.5 bg-[#2B3139] rounded text-[10px] font-bold text-secondary uppercase tracking-wider">{filteredAndSortedProjects.length} Assets</span>
                    </div>

                    <div className="flex items-center gap-3 flex-grow max-w-2xl">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                            <input 
                                type="text" 
                                placeholder="Search markets..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-card-bg border border-[#2B3139] rounded-md py-2 pl-10 pr-4 text-[11px] font-bold text-[#EAECEF] focus:border-primary/50 focus:ring-0 transition-all placeholder:text-secondary uppercase tracking-wider"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-card-bg border border-[#2B3139] rounded-md px-3 py-1.5">
                            <ArrowUpDown className="w-3.5 h-3.5 text-secondary" />
                            <select 
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as SortOption)}
                                className="bg-transparent border-none text-[10px] font-bold text-secondary uppercase tracking-wider focus:ring-0 cursor-pointer p-0"
                            >
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="name">Name</option>
                                <option value="status">Status</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Projects Grid */}
                {filteredAndSortedProjects.length === 0 ? (
                    <div className="bg-card-bg border border-dashed border-[#2B3139] rounded-md flex flex-col items-center justify-center py-32 text-center px-4">
                        <LayoutGrid className="w-12 h-12 text-[#2B3139] mb-4" />
                        <h3 className="text-sm font-bold text-secondary mb-2 uppercase tracking-widest">{t.no_projects_found}</h3>
                        <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">{t.no_projects_desc}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAndSortedProjects.map((project) => (
                            <div 
                                key={project.id}
                                className="bg-card-bg border border-[#2B3139] hover:border-[#474D57] rounded-md transition-all overflow-hidden flex flex-col"
                            >
                                <div className="p-5 flex flex-col h-full space-y-5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-md bg-bg-black border border-[#2B3139] flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5" style={{ color: project.colorCode || 'var(--primary)' }} />
                                            </div>
                                            <div>
                                                <h4 className="text-[12px] font-bold text-[#EAECEF] uppercase tracking-wider line-clamp-1">{project.projectName}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-secondary font-mono tracking-wider">#{String(project.id).padStart(4, '0')}</span>
                                                    <span className="w-1 h-1 bg-[#2B3139] rounded-full"></span>
                                                    <span className="text-[9px] text-secondary font-bold uppercase tracking-widest">{project.targetTeam || 'GLOBAL'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#2B3139]">
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1.5">
                                                <Zap className="w-3 text-primary" />
                                                Rules
                                            </div>
                                            <p className="text-[12px] font-mono font-bold text-[#EAECEF]">{project.calculators?.length || 0}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <div className="text-[9px] font-bold text-secondary uppercase tracking-widest flex items-center justify-end gap-1.5">
                                                <Calendar className="w-3" />
                                                Date
                                            </div>
                                            <p className="text-[12px] font-mono font-bold text-secondary">{new Date(project.createdAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'Active' ? 'bg-[#02C076]' : 'bg-[#F6465D]'}`}></div>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${project.status === 'Active' ? 'text-[#02C076]' : 'text-[#F6465D]'}`}>{project.status}</span>
                                        </div>
                                        <div className="text-[9px] font-bold text-secondary uppercase tracking-widest">
                                            ID: <span className="text-[#EAECEF] font-mono">{String(project.id).slice(-4)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex gap-2 pt-2">
                                        <button 
                                            onClick={() => onOpenProject(String(project.id), 'execute')}
                                            className="flex-1 py-2.5 bg-primary hover:bg-[#f0c51d] text-bg-black rounded-md font-bold uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2"
                                        >
                                            <ArrowUpRight className="w-4 h-4" />
                                            {t.apply_recalculate}
                                        </button>
                                        <button 
                                            onClick={() => onOpenProject(String(project.id), 'manage')}
                                            className="p-2.5 bg-bg-black hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md transition-all border border-[#2B3139]"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDuplicate(String(project.id))}
                                            className="p-2.5 bg-bg-black hover:bg-[#2B3139] text-secondary hover:text-[#EAECEF] rounded-md transition-all border border-[#2B3139]"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
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
