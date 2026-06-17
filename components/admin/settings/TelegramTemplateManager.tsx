
import React, { useState, useEffect } from 'react';
import { translations } from '../../../translations';

interface TelegramTemplate {
    id: string;
    name: string;
    trigger: 'order_create' | 'order_update' | 'order_ship' | 'manual';
    content: string;
    isActive: boolean;
}

interface TelegramTemplateManagerProps {
    language: 'en' | 'km';
}

const TelegramTemplateManager: React.FC<TelegramTemplateManagerProps> = ({ language }) => {
    const t = translations[language];
    const [templates, setTemplates] = useState<TelegramTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<TelegramTemplate | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Initial dummy data or load from localStorage/API
    useEffect(() => {
        const saved = localStorage.getItem('telegram_templates');
        if (saved) {
            setTemplates(JSON.parse(saved));
        } else {
            const defaults: TelegramTemplate[] = [
                {
                    id: '1',
                    name: 'Order Confirmation',
                    trigger: 'order_create',
                    content: '🛒 *New Order #{{order_id}}*\n👤 Customer: {{customer_name}}\n📞 Phone: {{phone}}\n📍 Location: {{location}}\n💰 Total: ${{total}}',
                    isActive: true
                },
                {
                    id: '2',
                    name: 'Shipping Alert',
                    trigger: 'order_ship',
                    content: '🚚 *Order #{{order_id}} is on the way!*\n🛵 Driver: {{driver_name}}\n📞 Driver Phone: {{driver_phone}}',
                    isActive: true
                }
            ];
            setTemplates(defaults);
            localStorage.setItem('telegram_templates', JSON.stringify(defaults));
        }
    }, []);

    const saveTemplates = (newTemplates: TelegramTemplate[]) => {
        setTemplates(newTemplates);
        localStorage.setItem('telegram_templates', JSON.stringify(newTemplates));
    };

    const handleEdit = (template: TelegramTemplate) => {
        setEditingTemplate(template);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this template?')) {
            saveTemplates(templates.filter(t => t.id !== id));
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTemplate) return;

        if (editingTemplate.id === 'new') {
            const newT = { ...editingTemplate, id: Date.now().toString() };
            saveTemplates([...templates, newT]);
        } else {
            saveTemplates(templates.map(t => t.id === editingTemplate.id ? editingTemplate : t));
        }
        setIsModalOpen(false);
        setEditingTemplate(null);
    };

    const availableVariables = [
        { key: '{{order_id}}', label: 'Order ID' },
        { key: '{{customer_name}}', label: 'Customer Name' },
        { key: '{{phone}}', label: 'Phone Number' },
        { key: '{{location}}', label: 'Location' },
        { key: '{{total}}', label: 'Grand Total' },
        { key: '{{products}}', label: 'Product List' },
        { key: '{{driver_name}}', label: 'Driver Name' },
        { key: '{{driver_phone}}', label: 'Driver Phone' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Telegram Message Templates</h3>
                <button 
                    onClick={() => {
                        setEditingTemplate({ id: 'new', name: '', trigger: 'manual', content: '', isActive: true });
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                >
                    + Create Template
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                    <div key={template.id} className="bg-gray-900/60 border border-gray-800 rounded-[2rem] p-6 hover:border-blue-500/30 transition-all group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-white font-black uppercase text-sm tracking-tight">{template.name}</h4>
                                <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full uppercase tracking-tighter mt-1 inline-block">
                                    Trigger: {template.trigger.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(template)} className="p-2 bg-gray-800 text-amber-400 rounded-lg hover:bg-amber-400 hover:text-black transition-all">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => handleDelete(template.id)} className="p-2 bg-gray-800 text-red-400 rounded-lg hover:bg-red-400 hover:text-black transition-all">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5 h-32 overflow-y-auto custom-scrollbar">
                            <pre className="text-[11px] text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">{template.content}</pre>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${template.isActive ? 'text-emerald-400' : 'text-gray-600'}`}>
                                {template.isActive ? '● Active' : '○ Inactive'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && editingTemplate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-3xl">
                        <div className="px-8 py-6 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">
                                {editingTemplate.id === 'new' ? 'Create New Template' : 'Edit Template'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Template Name</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={editingTemplate.name} 
                                        onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                        className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 transition-all outline-none"
                                        placeholder="e.g. Order Confirmed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Trigger Event</label>
                                    <select 
                                        value={editingTemplate.trigger}
                                        onChange={e => setEditingTemplate({...editingTemplate, trigger: e.target.value as any})}
                                        className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 transition-all outline-none"
                                    >
                                        <option value="order_create">On Order Create</option>
                                        <option value="order_update">On Order Update</option>
                                        <option value="order_ship">On Order Shipped</option>
                                        <option value="manual">Manual Selection</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Message Content</label>
                                <textarea 
                                    required
                                    rows={6}
                                    value={editingTemplate.content}
                                    onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                                    className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 transition-all outline-none font-mono resize-none"
                                    placeholder="Enter your message here..."
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Available Variables (Click to copy)</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableVariables.map(v => (
                                        <button 
                                            key={v.key}
                                            type="button"
                                            onClick={() => {
                                                const start = editingTemplate.content;
                                                setEditingTemplate({...editingTemplate, content: start + v.key});
                                            }}
                                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-[9px] font-mono text-blue-400 hover:bg-blue-400/10 transition-all"
                                        >
                                            {v.key}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-gray-800 text-gray-400 hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95">Save Template</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramTemplateManager;
