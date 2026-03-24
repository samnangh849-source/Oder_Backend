import React, { useState, useEffect, useContext, useMemo } from 'react';
import { IncentiveProject } from '../types';
import { getIncentiveProjects, deleteProject, duplicateProject } from '../services/incentiveService';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { 
    TrendingUp, BarChart3, Plus, LayoutGrid, Copy, Settings2, 
    ArrowUpRight, ChevronLeft, Search, Filter, Briefcase, 
    Users, Calendar, Zap, MoreHorizontal, ShieldCheck
} from 'lucide-react';

interface IncentivesDashboardProps {
    onOpenProject: (projectId: string, mode: 'manage' | 'execute') => void;
    onBack: () => void;
}

const IncentivesDashboard: React.FC<IncentivesDashboardProps> = ({ onOpenProject, onBack }) => {
    const { language } = useContext(AppContext);
    const t = translations[language];

    const [projects, setProjects] = useState<IncentiveProject[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Draft'>('All');

    const loadProjects = async () => {
        const data = await getIncentiveProjects();
        if (Array.isArray(data)) setProjects(data);
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = p.projectName?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [projects, searchQuery, filterStatus]);

    const handleDuplicate = async (id: string | number) => {
        await duplicateProject(Number(id));
        loadProjects();
    };

    return (
        <div className="min-h-screen bg-[#0B0E11] text-[#EAECEF] font-sans selection:bg-[#F3BA2F]/30 pb-20 overflow-x-hidden">
            {/* Binance Style Top Header */}
            <header className="sticky top-0 z-50 bg-[#12161C] border-b border-[#2B3139] px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onBack} 
                        className="p-2 hover:bg-[#1E2329] rounded-lg transition-all border border-[#2B3139] text-[#929AA5] hover:text-[#F3BA2F] active:scale-95"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#F3BA2F] flex items-center justify-center text-[#0B0E11] shadow-lg shadow-[#F3BA2F]/20">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight uppercase leading-none">{t.incentives}</h1>
                            <div className="flex items-center gap-2 text-[10px] text-[#929AA5] font-bold mt-1 uppercase tracking-widest">
                                <span className="text-[#0ECB81]">Official</span>
                                <span className="opacity-30">|</span>
                                <span>Management Protocol</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                    <div className="hidden lg:flex items-center gap-1.5 p-1 bg-[#0B0E11] rounded-xl border border-[#2B3139]">
                        <button 
                            onClick={() => setFilterStatus('All')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'All' ? 'bg-[#2B3139] text-[#F3BA2F]' : 'text-[#929AA5] hover:text-[#EAECEF]'}`}
                        >
                            {t.all_time}
                        </button>
                        <button 
                            onClick={() => setFilterStatus('Active')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Active' ? 'bg-[#2B3139] text-[#F3BA2F]' : 'text-[#929AA5] hover:text-[#EAECEF]'}`}
                        >
                            {t.active_projects}
                        </button>
                        <button 
                            onClick={() => setFilterStatus('Draft')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Draft' ? 'bg-[#2B3139] text-[#F3BA2F]' : 'text-[#929AA5] hover:text-[#EAECEF]'}`}
                        >
                            Draft
                        </button>
                    </div>
                    
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2 bg-[#F3BA2F] hover:bg-[#F3BA2F]/90 text-[#0B0E11] rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-lg active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        {t.new_project}
                    </button>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 sm:p-8 space-y-8 animate-fade-in">
                
                {/* Dashboard Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-xs font-bold text-[#929AA5] uppercase tracking-widest">{t.total_projects}</p>
                            <LayoutGrid className="w-4 h-4 text-[#F3BA2F]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-[#EAECEF]">{projects.length}</p>
                            <span className="text-[10px] font-bold text-[#929AA5] uppercase">Projects</span>
                        </div>
                    </div>

                    <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-xs font-bold text-[#929AA5] uppercase tracking-widest">{t.active_projects}</p>
                            <Zap className="w-4 h-4 text-[#0ECB81]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-[#0ECB81]">{projects.filter(p => p.status === 'Active').length}</p>
                            <span className="text-[10px] font-bold text-[#929AA5] uppercase">Active</span>
                        </div>
                    </div>

                    <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-xs font-bold text-[#929AA5] uppercase tracking-widest">{t.total_calculators}</p>
                            <BarChart3 className="w-4 h-4 text-[#F3BA2F]" />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-[#F3BA2F]">{projects.reduce((sum, p) => sum + (p.calculators?.length || 0), 0)}</p>
                            <span className="text-[10px] font-bold text-[#929AA5] uppercase">Formulas</span>
                        </div>
                    </div>
                </div>

                {/* Sub Header / Filters */}
                <div className="flex flex-wrap items-center justify-between gap-6 pt-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-[0.2em]">{t.project_directory}</h3>
                        <span className="px-2 py-0.5 bg-[#1E2329] rounded text-[10px] font-bold text-[#929AA5]">{filteredProjects.length} PROJECTS</span>
                    </div>

                    <div className="flex items-center gap-4 flex-grow max-w-md">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707A8A]" />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-[#1E2329] border border-[#2B3139] rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-[#EAECEF] focus:border-[#F3BA2F]/50 focus:ring-0 transition-all placeholder:text-[#474D57]"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Projects Grid */}
                {filteredProjects.length === 0 ? (
                    <div className="bg-[#1E2329]/30 border border-[#2B3139] rounded-[2.5rem] flex flex-col items-center justify-center py-32 text-center px-4">
                        <div className="w-20 h-20 bg-[#0B0E11] rounded-3xl flex items-center justify-center mb-6 border border-[#2B3139] text-[#474D57]">
                            <LayoutGrid className="w-10 h-10 opacity-20" />
                        </div>
                        <h3 className="text-xl font-bold text-[#EAECEF] mb-2 uppercase tracking-tight opacity-50">{t.no_projects_found}</h3>
                        <p className="text-xs text-[#929AA5] font-medium max-w-xs leading-relaxed uppercase tracking-widest">{t.no_projects_desc}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredProjects.map((project) => (
                            <div 
                                key={project.id}
                                className="group bg-[#1E2329] border border-[#2B3139] hover:border-[#F3BA2F]/40 rounded-3xl transition-all duration-300 shadow-xl relative overflow-hidden flex flex-col h-full hover:shadow-[#F3BA2F]/5"
                            >
                                <div className="p-6 space-y-6 flex flex-col h-full">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-[#0B0E11] border border-[#2B3139] flex items-center justify-center group-hover:border-[#F3BA2F]/20 transition-all">
                                                <TrendingUp className="w-6 h-6" style={{ color: project.colorCode || '#F3BA2F' }} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-[#EAECEF] group-hover:text-[#F3BA2F] transition-colors line-clamp-1">{project.projectName}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-[#474D57] font-bold uppercase tracking-widest">ID {String(project.id).padStart(4, '0')}</span>
                                                    <span className="w-1 h-1 bg-[#2B3139] rounded-full"></span>
                                                    <span className="text-[9px] text-[#929AA5] font-bold uppercase">{project.targetTeam || 'MANAGEMENT'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#2B3139]/50">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#474D57] uppercase tracking-widest">
                                                <Users className="w-3" />
                                                Formulas
                                            </div>
                                            <p className="text-sm font-bold text-[#EAECEF]">{project.calculators?.length || 0}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#474D57] uppercase tracking-widest">
                                                <Calendar className="w-3" />
                                                {t.created}
                                            </div>
                                            <p className="text-sm font-bold text-[#929AA5]">{new Date(project.createdAt || '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${project.status === 'Active' ? 'bg-[#0ECB81] animate-pulse' : 'bg-[#F6465D]'}`}></div>
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${project.status === 'Active' ? 'text-[#0ECB81]' : 'text-[#F6465D]'}`}>{project.status}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-[#929AA5] uppercase">
                                            Type: <span className="text-[#EAECEF]">Monthly</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        <button 
                                            onClick={() => onOpenProject(String(project.id), 'execute')}
                                            className="flex-1 py-3 bg-[#F3BA2F] hover:bg-[#F3BA2F]/90 text-[#0B0E11] rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            <ArrowUpRight className="w-4 h-4" />
                                            {t.apply_recalculate}
                                        </button>
                                        <button 
                                            onClick={() => onOpenProject(String(project.id), 'manage')}
                                            className="p-3 bg-[#2B3139] hover:bg-[#323a45] text-[#EAECEF] rounded-xl transition-all border border-[#474D57]/30 active:scale-95"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDuplicate(String(project.id))}
                                            className="p-3 bg-[#2B3139] hover:bg-[#323a45] text-[#EAECEF] rounded-xl transition-all border border-[#474D57]/30 active:scale-95"
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
        </div>
    );
};

export default IncentivesDashboard;
