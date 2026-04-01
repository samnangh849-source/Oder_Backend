import React, { useState, useContext, useEffect } from 'react';
import Modal from '../common/Modal';
import { createProject, updateProject, deleteProject } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { IncentiveProject } from '../../types';
import { X, Trash2, Save, Plus, Terminal, Settings, Box, Database, Palette, Activity } from 'lucide-react';

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
        if (!projectName.trim()) return;

        if (initialData && initialData.id) {
            await updateProject(initialData.id, {
                projectName,
                colorCode,
                requirePeriodSelection: requirePeriod,
                dataSource,
                status,
                startDate,
                endDate,
                targetTeam
            });
        } else {
            await createProject({
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
        }

        onSuccess();
        onClose();
    };

    const handleDelete = async () => {
        if (!initialData || !initialData.id) return;
        
        const pwd = prompt("សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នកដើម្បីលុប (Please enter your password to delete):");
        if (pwd === currentUser?.Password) {
            if (window.confirm(`តើអ្នកពិតជាចង់លុបគម្រោង "${initialData.projectName}" មែនទេ? (Are you sure you want to delete this project?)`)) {
                if (await deleteProject(initialData.id)) {
                    onSuccess();
                    onClose();
                }
            }
        } else if (pwd !== null) {
            alert("ពាក្យសម្ងាត់មិនត្រឹមត្រូវ (Incorrect password)");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
            <div className="bg-[#121212] border border-[#1A1A1A] shadow-2xl overflow-hidden text-[#EAECEF] font-sans rounded">
                {/* Modal Header */}
                <div className="flex justify-between items-center px-5 py-4 bg-[#080808] border-b border-[#1A1A1A]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                            <Terminal className="w-4 h-4 text-[#F0B90B]" />
                        </div>
                        <div>
                            <h2 className="text-xs font-black text-[#EAECEF] uppercase tracking-[0.2em]">
                                {initialData ? "Config_Engine_Node" : "Initialize_New_Node"}
                            </h2>
                            <p className="text-[8px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">Station Protocol // ACC_v2.5</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-[#2B3139] rounded transition-all text-[#707A8A] hover:text-[#EAECEF] border border-transparent hover:border-[#1A1A1A]">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-6">
                    {/* Project Name Section */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Box className="w-3 h-3 text-[#707A8A]" />
                            <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.project_name}</label>
                        </div>
                        <input 
                            type="text" 
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            className="w-full h-10 bg-[#050505] border border-[#1A1A1A] rounded px-4 text-[11px] font-bold text-[#EAECEF] focus:border-[#F0B90B]/50 outline-none transition-all uppercase tracking-widest"
                            placeholder="STATION_IDENTITY_KEY"
                            required
                        />
                    </div>

                    {/* Tech Config Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Palette className="w-3 h-3 text-[#707A8A]" />
                                <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.color_theme}</label>
                            </div>
                            <div className="flex items-center gap-3 bg-[#050505] p-2 rounded border border-[#1A1A1A]">
                                <input 
                                    type="color" 
                                    value={colorCode}
                                    onChange={e => setColorCode(e.target.value)}
                                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 overflow-hidden"
                                />
                                <span className="text-[10px] font-mono text-[#EAECEF] font-bold uppercase">{colorCode}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Activity className="w-3 h-3 text-[#707A8A]" />
                                <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.status}</label>
                            </div>
                            <select 
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                                className="w-full h-10 bg-[#050505] border border-[#1A1A1A] rounded px-3 text-[10px] font-bold text-[#EAECEF] focus:border-[#F0B90B]/50 outline-none cursor-pointer"
                            >
                                <option value="Draft">PROTOCOL_DRAFT</option>
                                <option value="Active">LIVE_NODE</option>
                                <option value="Disable">OFFLINE_NODE</option>
                            </select>
                        </div>
                    </div>

                    {/* Data Source & Rules */}
                    <div className="bg-[#080808] rounded border border-[#1A1A1A] p-4 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Settings className="w-4 h-4 text-[#F0B90B]/50" />
                                <div>
                                    <label className="text-[10px] font-black text-[#EAECEF] uppercase tracking-widest block">{t.require_period}</label>
                                    <span className="text-[8px] font-bold text-[#707A8A] uppercase tracking-wider block mt-0.5">Mandatory Interval Control</span>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={requirePeriod} onChange={e => setRequirePeriod(e.target.checked)} className="sr-only peer" />
                                <div className="w-10 h-5 bg-[#1A1A1A] border border-[#2B3139] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#707A8A] after:rounded-full after:h-3.5 after:w-4 after:transition-all peer-checked:bg-[#0ECB81]/20 peer-checked:border-[#0ECB81]/40 peer-checked:after:bg-[#0ECB81]"></div>
                            </label>
                        </div>

                        <div className="pt-4 border-t border-[#1A1A1A]">
                            <div className="flex items-center gap-2 mb-3">
                                <Database className="w-3 h-3 text-[#707A8A]" />
                                <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">{t.data_source}</label>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDataSource('system')}
                                    className={`flex-1 h-9 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${dataSource === 'system' ? 'bg-[#F0B90B] text-black border-[#F0B90B]' : 'bg-[#050505] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF] hover:border-[#2B3139]'}`}
                                >
                                    SYSTEM_CORE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDataSource('manual')}
                                    className={`flex-1 h-9 rounded text-[9px] font-black uppercase tracking-widest border transition-all ${dataSource === 'manual' ? 'bg-[#F0B90B] text-black border-[#F0B90B]' : 'bg-[#050505] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF] hover:border-[#2B3139]'}`}
                                >
                                    MANUAL_OVERRIDE
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex flex-col gap-2 pt-2">
                        <button 
                            type="submit"
                            disabled={!projectName.trim()}
                            className="w-full h-11 bg-[#F0B90B] hover:bg-[#D4A50A] disabled:opacity-30 disabled:grayscale text-black font-black rounded text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {initialData ? <Save className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                            {initialData ? "VERIFY_&_DEPLOY" : "INITIALIZE_PROTOCOL"}
                        </button>
                        
                        {initialData && (
                            <button 
                                type="button"
                                onClick={handleDelete}
                                className="w-full h-9 text-[#F6465D] hover:bg-[#F6465D]/10 border border-transparent hover:border-[#F6465D]/20 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                TERMINATE_NODE
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default CreateProjectModal;
