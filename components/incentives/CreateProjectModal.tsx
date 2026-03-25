import React, { useState, useContext, useEffect } from 'react';
import Modal from '../common/Modal';
import { createProject, updateProject, deleteProject } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { IncentiveProject } from '../../types';
import { X, Trash2, Save, Plus } from 'lucide-react';

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
    const [colorCode, setColorCode] = useState('#FCD535'); // default yellow
    const [requirePeriod, setRequirePeriod] = useState(false);
    const [dataSource, setDataSource] = useState<'system' | 'manual'>('system');
    const [status, setStatus] = useState<string>('Draft');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [targetTeam, setTargetTeam] = useState('');

    useEffect(() => {
        if (initialData) {
            setProjectName(initialData.projectName || '');
            setColorCode(initialData.colorCode || '#FCD535');
            setRequirePeriod(!!initialData.requirePeriodSelection);
            setDataSource(initialData.dataSource || 'system');
            setStatus(initialData.status || 'Draft');
            setStartDate(initialData.startDate || '');
            setEndDate(initialData.endDate || '');
            setTargetTeam(initialData.targetTeam || '');
        } else {
            setProjectName('');
            setColorCode('#FCD535');
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
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="ui-binance bg-card-bg rounded-md border border-[#2B3139] shadow-2xl overflow-hidden text-[#EAECEF] font-sans">
                <div className="flex justify-between items-center px-6 py-4 bg-bg-black border-b border-[#2B3139]">
                    <div>
                        <h2 className="text-sm font-bold text-[#EAECEF] uppercase tracking-widest">
                            {initialData ? t.edit : t.create_project}
                        </h2>
                        <p className="text-[9px] text-secondary font-bold uppercase tracking-wider mt-0.5">Configure Engine Node</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 bg-bg-black hover:bg-[#474D57] rounded transition-colors text-secondary hover:text-[#EAECEF] border border-[#2B3139]">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">{t.project_name}</label>
                        <input 
                            type="text" 
                            value={projectName}
                            onChange={e => setProjectName(e.target.value)}
                            className="w-full bg-bg-black border border-[#2B3139] rounded px-3 py-2.5 text-[11px] font-bold text-[#EAECEF] focus:border-primary outline-none transition-all uppercase"
                            placeholder="e.g. PERFORMANCE ENGINE Q3"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">{t.color_theme}</label>
                            <div className="flex items-center gap-3 bg-bg-black p-1.5 rounded border border-[#2B3139]">
                                <input 
                                    type="color" 
                                    value={colorCode}
                                    onChange={e => setColorCode(e.target.value)}
                                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                                />
                                <span className="text-[10px] font-mono text-secondary font-bold uppercase">{colorCode}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">{t.status}</label>
                            <select 
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                                className="w-full bg-bg-black border border-[#2B3139] rounded px-2 py-1.5 text-[11px] font-bold text-[#EAECEF] focus:border-primary outline-none"
                            >
                                <option value="Draft">DRAFT</option>
                                <option value="Active">ACTIVE</option>
                                <option value="Disable">DISABLE</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-bg-black rounded border border-[#2B3139] p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-[11px] font-bold text-[#EAECEF] uppercase tracking-wide block">{t.require_period}</label>
                                <span className="text-[9px] text-secondary font-bold uppercase tracking-wider block mt-0.5">{t.require_period_desc}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={requirePeriod} onChange={e => setRequirePeriod(e.target.checked)} className="sr-only peer" />
                                <div className="w-9 h-5 bg-[#474D57] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="pt-3 border-t border-[#2B3139]">
                            <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">{t.data_source}</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDataSource('system')}
                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all ${dataSource === 'system' ? 'bg-primary text-bg-black border-primary' : 'bg-bg-black border-[#2B3139] text-secondary hover:text-[#EAECEF]'}`}
                                >
                                    {t.system_data}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDataSource('manual')}
                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all ${dataSource === 'manual' ? 'bg-primary text-bg-black border-primary' : 'bg-bg-black border-[#2B3139] text-secondary hover:text-[#EAECEF]'}`}
                                >
                                    {t.manual_input}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <button 
                            type="submit"
                            disabled={!projectName.trim()}
                            className="w-full py-2.5 bg-primary hover:bg-[#f0c51d] disabled:opacity-50 text-bg-black font-bold rounded text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            {initialData ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {initialData ? t.save : t.create_project}
                        </button>
                        
                        {initialData && (
                            <button 
                                type="button"
                                onClick={handleDelete}
                                className="w-full py-2 text-red-500 hover:bg-red-500/10 border border-transparent rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t.delete}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default CreateProjectModal;
