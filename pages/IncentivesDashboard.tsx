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
    ShieldCheck, Target, Activity, Flame, Trophy, Coins, ExternalLink
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
                <div className="w-10 h-10 border-2 border-[#F0B90B]/20 border-t-[#F0B90B] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-[#EAECEF] font-sans selection:bg-[#F0B90B]/30 flex flex-col h-full overflow-hidden">
            {/* Binance-style Top Navigation Bar */}
            <header className="h-14 bg-[#121212] border-b border-[#1A1A1A] px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-1.5 hover:bg-[#2B3139] rounded transition-all text-[#B7BDC6] hover:text-[#F0B90B]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-[#1A1A1A]"></div>
                    <div className="flex items-center gap-3">
                        <Gift className="w-5 h-5 text-[#F0B90B]" />
                        <h1 className="text-sm font-bold tracking-wider uppercase">{t.incentives}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-[#050505] p-1 rounded border border-[#1A1A1A]">
                        {(['All', 'Active', 'Draft'] as const).map(status => (
                            <button 
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${filterStatus === status ? 'bg-[#2B3139] text-[#F0B90B]' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}
                            >
                                {status === 'All' ? t.all_time : status === 'Active' ? t.active_projects : status}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="h-8 px-4 bg-[#F0B90B] hover:bg-[#D4A50A] text-black rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                    >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        {t.new_project}
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-4 space-y-4">
                {/* Compact KPI Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: t.total_projects, value: stats.total, color: '#B7BDC6' },
                        { label: t.active_projects, value: stats.active, color: '#0ECB81' },
                        { label: t.total_calculators, value: stats.calculators, color: '#F0B90B' },
                        { label: 'Network Health', value: '100%', color: '#0ECB81' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-[#121212] border border-[#1A1A1A] p-4 rounded flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-[#707A8A] uppercase tracking-widest">{stat.label}</span>
                            <span className="text-xl font-mono font-bold" style={{ color: stat.color }}>{stat.value}</span>
                        </div>
                    ))}
                </div>

                {/* Sub Command Bar */}
                <div className="bg-[#121212] border border-[#1A1A1A] p-2 rounded flex items-center gap-4">
                    <div className="relative flex-grow max-w-md group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707A8A]" />
                        <input 
                            type="text" 
                            placeholder="Search Assets..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full h-9 bg-[#050505] border border-[#1A1A1A] rounded px-10 text-[11px] font-bold text-[#EAECEF] focus:border-[#F0B90B]/50 transition-all outline-none"
                        />
                    </div>
                    <div className="h-6 w-px bg-[#1A1A1A]"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#707A8A] uppercase">Sort:</span>
                        <select 
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as SortOption)}
                            className="bg-[#050505] border border-[#1A1A1A] rounded h-9 px-3 text-[10px] font-bold text-[#EAECEF] outline-none cursor-pointer"
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="name">Name A-Z</option>
                            <option value="status">Status</option>
                        </select>
                    </div>
                </div>

                {/* Technical Grid of Projects */}
                {filteredAndSortedProjects.length === 0 ? (
                    <div className="h-[400px] bg-[#121212] border border-[#1A1A1A] border-dashed rounded flex flex-col items-center justify-center text-center">
                        <Search className="w-10 h-10 text-[#1A1A1A] mb-4" />
                        <p className="text-[11px] font-bold text-[#707A8A] uppercase tracking-widest">{t.no_projects_found}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAndSortedProjects.map((project) => (
                            <div 
                                key={project.id}
                                className="bg-[#121212] border border-[#1A1A1A] hover:border-[#2B3139] rounded transition-all flex flex-col group overflow-hidden"
                            >
                                <div className="p-4 flex flex-col gap-4 border-b border-[#1A1A1A]">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-8 h-8 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center transition-all group-hover:border-[#F0B90B]/30"
                                            >
                                                <TrendingUp className="w-4 h-4" style={{ color: project.colorCode || '#F0B90B' }} />
                                            </div>
                                            <div>
                                                <h4 className="text-[12px] font-bold text-[#EAECEF] uppercase truncate max-w-[150px]">{project.projectName}</h4>
                                                <span className="text-[9px] font-mono text-[#707A8A] tracking-tighter">ID: {String(project.id).padStart(4, '0')}</span>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                                            project.status === 'Active' ? 'bg-[#0ECB81]/10 border-[#0ECB81]/20 text-[#0ECB81]' : 'bg-[#1A1A1A] border-[#2B3139] text-[#707A8A]'
                                        }`}>
                                            {project.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-[#050505] p-2 rounded border border-[#1A1A1A]">
                                            <p className="text-[8px] font-bold text-[#707A8A] uppercase mb-1">Logic Nodes</p>
                                            <p className="text-xs font-mono font-bold text-[#EAECEF]">{project.calculators?.length || 0}</p>
                                        </div>
                                        <div className="bg-[#050505] p-2 rounded border border-[#1A1A1A]">
                                            <p className="text-[8px] font-bold text-[#707A8A] uppercase mb-1">Created</p>
                                            <p className="text-[10px] font-mono font-bold text-[#EAECEF]">{new Date(project.createdAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-2 flex gap-2">
                                    <button 
                                        onClick={() => onOpenProject(String(project.id), 'execute')}
                                        className="flex-1 h-9 bg-[#2B3139] hover:bg-[#F0B90B] text-[#EAECEF] hover:text-black rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        {t.apply_recalculate}
                                    </button>
                                    <button 
                                        onClick={() => onOpenProject(String(project.id), 'manage')}
                                        className="w-9 h-9 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#EAECEF] rounded transition-all border border-[#1A1A1A] flex items-center justify-center"
                                    >
                                        <Settings2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDuplicate(String(project.id))}
                                        className="w-9 h-9 bg-[#1A1A1A] hover:bg-[#2B3139] text-[#707A8A] hover:text-[#EAECEF] rounded transition-all border border-[#1A1A1A] flex items-center justify-center"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
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
