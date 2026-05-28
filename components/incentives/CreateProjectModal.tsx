import React, { useState, useContext, useEffect } from 'react';
import Modal from '../common/Modal';
import { createProject, updateProject, deleteProject } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { IncentiveProject } from '../../types';
import { WEB_APP_URL } from '../../constants';
import { X, Trash2, Save, Plus, Terminal, Settings, Box, Database, Palette, Activity, Shield, Cpu, Zap } from 'lucide-react';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: IncentiveProject | null;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { language, currentUser } = useContext(AppContext);
    const t = translations[language];

    const [projectName, setProjectName] = useState('');
    const [colorCode, setColorCode] = useState('#F0B90B'); // Binance Yellow
    const [requirePeriod, setRequirePeriod] = useState(false);
    const [dataSource, setDataSource] = useState<'system' | 'manual'>('system');
    const [status, setStatus] = useState<string>('Draft');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [targetTeam, setTargetTeam] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setProjectName(initialData.projectName || '');
            setColorCode(initialData.colorCode || '#F0B90B');
            setRequirePeriod(!!initialData.requirePeriodSelection);
            setDataSource(initialData.dataSource || 'system');
            setStatus(initialData.status || 'Draft');
            setStartDate(initialData.startDate || '');
            setEndDate(initialData.endDate || '');
            setTargetTeam(initialData.targetTeam || '');
        } else {
            setProjectName('');
            setColorCode('#F0B90B');
            setRequirePeriod(false);
            setDataSource('system');
            setStatus('Draft');
            setStartDate('');
            setEndDate('');
            setTargetTeam('');
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim() || isSaving) return;

        setIsSaving(true);
        try {
            if (initialData && initialData.id) {
                const updated = await updateProject(initialData.id, {
                    projectName,
                    colorCode,
                    requirePeriodSelection: requirePeriod,
                    dataSource,
                    status,
                    startDate,
                    endDate,
                    targetTeam
                });
                if (!updated) throw new Error('Project update failed.');
            } else {
                const created = await createProject({
                    projectName,
                    colorCode,
                    requirePeriodSelection: requirePeriod,
                    dataSource,
                    status,
                    startDate,
                    endDate,
                    targetTeam,
                    calculatorId: 0
                });
                if (!created) throw new Error('Project creation failed.');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            alert(error?.message || 'Failed to save incentive project.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!initialData || !initialData.id) return;
        
        if (window.confirm(`តើអ្នកពិតជាចង់លុបគម្រោង "${initialData.projectName}" មែនទេ? (Are you sure you want to delete this project?)`)) {
            setIsSaving(true);
            try {
                if (await deleteProject(initialData.id)) {
                    onSuccess();
                    onClose();
                    
                    // Standard redirection: Go back to Incentives Dashboard
                    try {
                        const url = new URL(window.location.href);
                        url.searchParams.set('tab', 'incentives');
                        url.searchParams.delete('incentiveProjectId'); // Remove specific project ID
                        url.searchParams.set('incentiveMode', 'execute'); // Reset mode
                        
                        window.history.pushState(null, '', url.pathname + url.search);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                    } catch (e) {
                        console.error("Navigation error:", e);
                    }
                }
            } catch (error) {
                console.error("Delete failed:", error);
                alert("ការលុបមិនជោគជ័យ (Deletion failed)");
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-xl">
            <div className="incentive-surface bg-[#050505] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden text-[#EAECEF] font-sans rounded-[40px] relative">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-20" style={{ backgroundColor: colorCode }}></div>

                {/* Modal Header */}
                <div className="flex justify-between items-center px-8 py-6 bg-white/[0.02] border-b border-white/5 backdrop-blur-xl">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Terminal className="w-5 h-5 text-primary relative z-10" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] leading-none mb-1.5">
                                {initialData ? "Config_Engine_Node" : "Initialize_New_Node"}
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em]">Protocol // Station_ACC_v2.5</span>
                                {initialData && (
                                    <>
                                        <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                        <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-widest">ID #{String(initialData.id).padStart(4, '0')}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-red-500/10 text-white/30 hover:text-red-500 transition-all rounded-xl border border-white/5 group active:scale-90"
                    >
                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Project Name Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Box className="w-3.5 h-3.5 text-white/40" />
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t.project_name}</label>
                            </div>
                            {projectName && (
                                <span className="text-[8px] font-mono text-emerald-500 font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Name_Validated</span>
                            )}
                        </div>
                        <div className="relative group">
                            <input 
                                type="text" 
                                value={projectName}
                                onChange={e => setProjectName(e.target.value)}
                                className="w-full h-14 bg-white/[0.03] border border-white/10 rounded-2xl px-6 text-sm font-black text-white placeholder:text-white/10 focus:border-primary/50 focus:bg-white/[0.05] outline-none transition-all italic tracking-tight"
                                placeholder="STATION_CORE_PROJECT"
                                required
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                                <Cpu className="w-4 h-4 text-primary" />
                            </div>
                        </div>
                    </div>

                    {/* Tech Config Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <Palette className="w-3.5 h-3.5 text-white/40" />
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t.color_theme}</label>
                            </div>
                            <div className="flex items-center gap-4 bg-white/[0.03] p-3 rounded-2xl border border-white/10 hover:border-white/20 transition-all group">
                                <div className="relative">
                                    <input 
                                        type="color" 
                                        value={colorCode}
                                        onChange={e => setColorCode(e.target.value)}
                                        className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent p-0 overflow-hidden relative z-10"
                                    />
                                    <div className="absolute inset-0 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: colorCode }}></div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-mono text-white font-black uppercase tracking-widest">{colorCode}</span>
                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Hex_Protocol</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <Activity className="w-3.5 h-3.5 text-white/40" />
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t.status}</label>
                            </div>
                            <div className="relative">
                                <select 
                                    value={status}
                                    onChange={e => setStatus(e.target.value as any)}
                                    className="w-full h-[54px] bg-white/[0.03] border border-white/10 rounded-2xl px-5 text-[11px] font-black text-white focus:border-primary/50 outline-none cursor-pointer appearance-none uppercase tracking-widest"
                                >
                                    <option value="Draft">PROTOCOL_DRAFT</option>
                                    <option value="Active">LIVE_NODE</option>
                                    <option value="Disable">OFFLINE_NODE</option>
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <div className={`w-2 h-2 rounded-full ${status === 'Active' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : status === 'Draft' ? 'bg-primary' : 'bg-red-500'}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Source & Rules - Premium Card */}
                    <div className="bg-white/[0.02] rounded-[32px] border border-white/5 p-6 space-y-6 relative overflow-hidden group/card">
                        <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover/card:opacity-[0.05] transition-opacity">
                            <Shield className="w-32 h-32 text-white" />
                        </div>

                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center shadow-inner">
                                    <Settings className="w-4 h-4 text-primary/60" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-white uppercase tracking-[0.15em] block">{t.require_period}</label>
                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block mt-0.5 italic">Mandatory_Interval_Control</span>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
                                <input type="checkbox" checked={requirePeriod} onChange={e => setRequirePeriod(e.target.checked)} className="sr-only peer" />
                                <div className="w-12 h-6 bg-white/5 border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white/20 after:rounded-full after:h-4 after:w-5 after:transition-all peer-checked:bg-emerald-500/20 peer-checked:border-emerald-500/40 peer-checked:after:bg-emerald-500 peer-checked:after:shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                            </label>
                        </div>

                        <div className="pt-6 border-t border-white/5 relative z-10">
                            <div className="flex items-center gap-2.5 mb-4">
                                <Database className="w-3.5 h-3.5 text-white/40" />
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t.data_source}</label>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDataSource('system')}
                                    className={`flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-300 flex items-center justify-center gap-2 ${
                                        dataSource === 'system' 
                                            ? 'bg-primary text-black border-primary shadow-[0_0_20px_rgba(252,213,53,0.3)]' 
                                            : 'bg-black/40 border-white/5 text-white/30 hover:text-white hover:border-white/20'
                                    }`}
                                >
                                    <Cpu className={`w-3.5 h-3.5 ${dataSource === 'system' ? 'text-black' : 'text-white/20'}`} />
                                    SYSTEM_CORE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDataSource('manual')}
                                    className={`flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all duration-300 flex items-center justify-center gap-2 ${
                                        dataSource === 'manual' 
                                            ? 'bg-primary text-black border-primary shadow-[0_0_20px_rgba(252,213,53,0.3)]' 
                                            : 'bg-black/40 border-white/5 text-white/30 hover:text-white hover:border-white/20'
                                    }`}
                                >
                                    <Zap className={`w-3.5 h-3.5 ${dataSource === 'manual' ? 'text-black' : 'text-white/20'}`} />
                                    MANUAL_OVERRIDE
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex flex-col gap-3 pt-4">
                        <button 
                            type="submit"
                            disabled={!projectName.trim() || isSaving}
                            className="w-full h-14 bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:grayscale text-black font-black rounded-2xl text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-2xl shadow-primary/20 group"
                        >
                            {isSaving ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {initialData ? <Save className="w-5 h-5 stroke-[2.5] group-hover:scale-110 transition-transform" /> : <Plus className="w-5 h-5 stroke-[2.5] group-hover:scale-110 transition-transform" />}
                                    {initialData ? "VERIFY_&_DEPLOY" : "INITIALIZE_PROTOCOL"}
                                </>
                            )}
                        </button>
                        
                        {initialData && (
                            <button 
                                type="button"
                                onClick={handleDelete}
                                className="w-full h-12 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 group"
                            >
                                <Trash2 className="w-4 h-4 group-hover:shake" />
                                TERMINATE_NODE
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </Modal>
    );
};

// Add helper component for RefreshCw which was missing in imports but added in logic
const RefreshCw = (props: any) => (
    <svg 
        {...props}
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
    </svg>
);

export default CreateProjectModal;
