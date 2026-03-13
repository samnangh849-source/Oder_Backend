import React, { useState, useEffect, useContext } from 'react';
import { IncentiveProject } from '../types';
import { getIncentiveProjects, deleteProject, duplicateProject } from '../services/incentiveService';
import CreateProjectModal from '../components/incentives/CreateProjectModal';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';

interface IncentivesDashboardProps {
    onOpenProject: (projectId: string, mode: 'manage' | 'execute') => void;
}

const IncentivesDashboard: React.FC<IncentivesDashboardProps> = ({ onOpenProject }) => {
    const { language } = useContext(AppContext);
    const t = translations[language];

    const [projects, setProjects] = useState<IncentiveProject[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const loadProjects = async () => {
        const data = await getIncentiveProjects();
        setProjects(data);
    };

    const handleDuplicate = async (id: string) => {
        await duplicateProject(Number(id));
        loadProjects();
    };

    useEffect(() => {
        loadProjects();
    }, []);

    return (
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
                        <span className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
                        {t.incentives}
                    </h1>
                    <p className="text-sm text-slate-400 font-bold mt-2 tracking-widest uppercase">{t.incentives_subtitle}</p>
                </div>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    {t.new_project}
                </button>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{t.total_projects}</p>
                    <p className="text-4xl font-black text-white">{projects.length}</p>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{t.active_projects}</p>
                    <p className="text-4xl font-black text-emerald-400">{projects.filter(p => p.status === 'Active').length}</p>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{t.total_calculators}</p>
                    <p className="text-4xl font-black text-purple-400">{projects.reduce((sum, p) => sum + (p.calculators?.length || 0), 0)}</p>
                </div>
            </div>

            {/* Project List */}
            <div className="space-y-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    {t.project_directory}
                </h3>

                {projects.length === 0 ? (
                    <div className="bg-slate-900/40 border-2 border-dashed border-slate-700/50 rounded-[2.5rem] flex flex-col items-center justify-center py-24 text-center px-4">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">{t.no_projects_found}</h3>
                        <p className="text-sm text-slate-400 font-bold max-w-md">{t.no_projects_desc}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <div 
                                key={project.id}
                                className="group bg-slate-900/60 backdrop-blur-xl border border-white/5 hover:border-blue-500/30 rounded-[2rem] p-6 transition-all duration-300 shadow-xl hover:shadow-blue-900/20 relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: project.colorCode }}></div>
                                
                                <div className="flex justify-between items-start mb-6 pt-2">
                                    <div className="p-3 rounded-2xl" style={{ backgroundColor: `${project.colorCode}20`, color: project.colorCode }}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                        project.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                        project.status === 'Draft' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {project.status}
                                    </span>
                                </div>

                                <div className="space-y-1 mb-6">
                                    <h4 className="text-lg font-black text-white truncate">{project.name}</h4>
                                    <p className="text-xs text-slate-500 font-bold truncate">ID: {project.id}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-5 border-t border-slate-800/50 mb-6">
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-black block mb-1">{t.calculators}</span>
                                        <span className="text-sm font-black text-white">{project.calculators?.length || 0}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-black block mb-1">{t.created}</span>
                                        <span className="text-sm font-bold text-slate-300">
                                            {new Date(project.createdAt).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onOpenProject(project.id, 'execute')}
                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                        Open
                                    </button>
                                    <button 
                                        onClick={() => onOpenProject(project.id, 'manage')}
                                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border border-slate-700 active:scale-95"
                                        title="Edit Project"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDuplicate(project.id)}
                                        className="px-3 py-3 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-700 active:scale-95"
                                        title="Duplicate Project"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V7M8 7h6a2 2 0 012 2v2M9 11h6" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <CreateProjectModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                onSuccess={loadProjects} 
            />
        </div>
    );
};

export default IncentivesDashboard;
