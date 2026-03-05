import React, { useState, useContext, useEffect } from 'react';
import Modal from '../common/Modal';
import { createProject, updateProject, deleteProject } from '../../services/incentiveService';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import { IncentiveProject } from '../../types';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: IncentiveProject | null;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { language, currentUser } = useContext(AppContext);
    const t = translations[language];

    const [name, setName] = useState('');
    const [colorCode, setColorCode] = useState('#3b82f6'); // default blue
    const [requirePeriod, setRequirePeriod] = useState(false);
    const [dataSource, setDataSource] = useState<'system' | 'manual'>('system');
    const [status, setStatus] = useState<'Active' | 'Disable' | 'Draft'>('Draft');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setColorCode(initialData.colorCode);
            setRequirePeriod(initialData.requirePeriodSelection);
            setDataSource(initialData.dataSource);
            setStatus(initialData.status);
        } else {
            setName('');
            setColorCode('#3b82f6');
            setRequirePeriod(false);
            setDataSource('system');
            setStatus('Draft');
        }
    }, [initialData, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (initialData) {
            updateProject(initialData.id, {
                name,
                colorCode,
                requirePeriodSelection: requirePeriod,
                dataSource,
                status
            });
        } else {
            createProject({
                name,
                colorCode,
                requirePeriodSelection: requirePeriod,
                dataSource,
                status
            });
        }

        onSuccess();
        onClose();
    };

    const handleDelete = () => {
        if (!initialData) return;
        
        const pwd = prompt("សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នកដើម្បីលុប (Please enter your password to delete):");
        if (pwd === currentUser?.Password) {
            if (window.confirm(`តើអ្នកពិតជាចង់លុបគម្រោង "${initialData.name}" មែនទេ? (Are you sure you want to delete this project?)`)) {
                if (deleteProject(initialData.id)) {
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
            <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">
                            {initialData ? t.edit : t.create_project}
                        </h2>
                        <p className="text-xs text-slate-400 font-bold mt-1">Configure your incentive or commission program</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.project_name}</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                            placeholder="e.g., Marathon Sales Campaign 2026"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.color_theme}</label>
                            <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border border-slate-700">
                                <input 
                                    type="color" 
                                    value={colorCode}
                                    onChange={e => setColorCode(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                />
                                <span className="text-[10px] font-mono text-slate-300">{colorCode}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.status}</label>
                            <select 
                                value={status}
                                onChange={e => setStatus(e.target.value as any)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500"
                            >
                                <option value="Draft">Draft</option>
                                <option value="Active">Active</option>
                                <option value="Disable">Disable</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-white block">{t.require_period}</label>
                                <span className="text-[10px] text-slate-400 block mt-0.5">{t.require_period_desc}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={requirePeriod} onChange={e => setRequirePeriod(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="pt-3 border-t border-slate-700/50">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.data_source}</label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDataSource('system')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${dataSource === 'system' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {t.system_data}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDataSource('manual')}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${dataSource === 'manual' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {t.manual_input}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        <button 
                            type="submit"
                            disabled={!name.trim()}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                        >
                            {initialData ? t.save : t.create_project}
                        </button>
                        
                        {initialData && (
                            <button 
                                type="button"
                                onClick={handleDelete}
                                className="w-full py-3 text-red-400 hover:text-white hover:bg-red-600 border border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
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
