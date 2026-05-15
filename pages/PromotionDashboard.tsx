import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { useOrder } from '../context/OrderContext';
import { Promotion } from '../types';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import { convertGoogleDriveUrl, fileToDataUrl } from '../utils/fileUtils';
import { compressImage } from '../utils/imageCompressor';
import Modal from '../components/common/Modal';

interface PromotionDashboardProps {
    onBack: () => void;
}

const PromotionDashboard: React.FC<PromotionDashboardProps> = ({ onBack }) => {
    const { currentUser, hasPermission, language, showNotification, lastMessage } = useContext(AppContext);
    const { appData, fetchPromotions } = useOrder();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canManage = hasPermission('manage_promotions') || currentUser?.IsSystemAdmin;

    useEffect(() => {
        setIsLoading(true);
        fetchPromotions().finally(() => setIsLoading(false));
    }, [fetchPromotions]);

    // Handle real-time updates
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'promotion_updated') {
            fetchPromotions();
            if (lastMessage.action === 'create' && lastMessage.data?.UpdatedBy !== currentUser?.FullName) {
                showNotification(`មានប្រូម៉ូសិនថ្មី៖ ${lastMessage.data?.Title}`, 'info', 'បច្ចុប្បន្នភាពប្រូម៉ូសិន');
            }
        }
    }, [lastMessage, fetchPromotions, currentUser?.FullName, showNotification]);

    const promotions = useMemo(() => appData.promotions || [], [appData.promotions]);

    const categories = useMemo(() => {
        const cats = new Set(promotions.map(p => p.Category));
        return ['All', ...Array.from(cats)].filter(c => c);
    }, [promotions]);

    const filteredPromotions = useMemo(() => {
        if (selectedCategory === 'All') return promotions;
        return promotions.filter(p => p.Category === selectedCategory);
    }, [promotions, selectedCategory]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !category || !imageUrl) {
            showNotification('សូមបំពេញព័ត៌មានអោយគ្រប់គ្រាន់', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const method = editingPromotion ? 'PUT' : 'POST';
            const url = editingPromotion 
                ? `${WEB_APP_URL}/api/promotions/${editingPromotion.ID}` 
                : `${WEB_APP_URL}/api/promotions`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    Title: title,
                    Category: category,
                    Description: description,
                    ImageURL: imageUrl,
                    UpdatedBy: currentUser?.FullName
                })
            });

            if (response.ok) {
                showNotification(editingPromotion ? 'កែប្រែជោគជ័យ' : 'Upload ជោគជ័យ', 'success');
                setIsUploadModalOpen(false);
                setEditingPromotion(null);
                resetForm();
                fetchPromotions();
            } else {
                showNotification('មានបញ្ហាក្នុងការរក្សាទុក', 'error');
            }
        } catch (error) {
            showNotification('Error connecting to server', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('តើអ្នកពិតជាចង់លុបមែនទេ?')) return;
        setIsDeleting(id);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/promotions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                showNotification('លុបជោគជ័យ', 'success');
                fetchPromotions();
            } else {
                showNotification('លុបមិនបានសម្រេច', 'error');
            }
        } catch (error) {
            showNotification('Error connecting to server', 'error');
        } finally {
            setIsDeleting(null);
        }
    };

    const resetForm = () => {
        setTitle('');
        setCategory('');
        setDescription('');
        setImageUrl('');
    };

    const openEditModal = (p: Promotion) => {
        setEditingPromotion(p);
        setTitle(p.Title);
        setCategory(p.Category);
        setDescription(p.Description);
        setImageUrl(p.ImageURL);
        setIsUploadModalOpen(true);
    };

    const handleCopyImage = async (url: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            showNotification('Copy រូបភាពជោគជ័យ', 'success');
        } catch (err) {
            // Fallback for some browsers
            const textArea = document.createElement("textarea");
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showNotification('Copy URL ជោគជ័យ', 'success');
        }
    };

    const handleDownload = (url: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'promotion.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('កំពុងទាញយក...', 'info');
    };

    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSubmitting(true);
        try {
            // 1. Compress image for better performance
            const compressedBlob = await compressImage(file, 'high-detail');
            const base64Data = await fileToDataUrl(compressedBlob);

            // 2. Upload to server
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    Action: 'uploadImage',
                    FileData: base64Data,
                    FileName: file.name,
                    MimeType: 'image/jpeg', // compressImage returns jpeg
                    SheetName: 'Promotions',
                    TargetColumn: 'ImageURL',
                    UserName: currentUser?.UserName
                })
            });

            if (response.ok) {
                const result = await response.json();
                setImageUrl(result.url);
                showNotification('Upload រូបភាពរួចរាល់', 'success');
            } else {
                showNotification('Upload រូបភាពបរាជ័យ', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Error uploading image', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0a] text-white font-['Kantumruy_Pro'] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase italic tracking-tighter">
                            {language === 'km' ? 'ព័ត៌មានប្រម៉ូសិន' : 'Promotion Info'}
                        </h1>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest italic">
                            {language === 'km' ? 'បច្ចុប្បន្នភាពចុងក្រោយ' : 'Latest Updates'}
                        </p>
                    </div>
                </div>

                {canManage && (
                    <button 
                        onClick={() => { resetForm(); setEditingPromotion(null); setIsUploadModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2.5} /></svg>
                        <span className="text-sm font-black uppercase italic">{language === 'km' ? 'បន្ថែមថ្មី' : 'Add New'}</span>
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
                {/* Category Filters */}
                <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                selectedCategory === cat 
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Spinner size="lg" />
                        <p className="text-white/20 text-xs font-black uppercase tracking-widest animate-pulse">Loading Promotions...</p>
                    </div>
                ) : filteredPromotions.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredPromotions.map((p, idx) => (
                            <div 
                                key={p.ID}
                                className="group relative bg-white/5 rounded-3xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-500 hover:-translate-y-2"
                                style={{ animationDelay: `${idx * 0.1}s` }}
                            >
                                {/* Image Container */}
                                <div className="aspect-[3/4] overflow-hidden relative">
                                    <img 
                                        src={convertGoogleDriveUrl(p.ImageURL)} 
                                        alt={p.Title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    {/* Quick Actions Overlay */}
                                    <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                                        <button 
                                            onClick={() => handleCopyImage(p.ImageURL)}
                                            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md hover:bg-white/20 flex items-center justify-center border border-white/10 transition-all shadow-xl"
                                            title="Copy Image"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDownload(p.ImageURL, `${p.Title}.jpg`)}
                                            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md hover:bg-white/20 flex items-center justify-center border border-white/10 transition-all shadow-xl"
                                            title="Download Image"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth={2} /></svg>
                                        </button>
                                        {canManage && (
                                            <>
                                                <button 
                                                    onClick={() => openEditModal(p)}
                                                    className="w-10 h-10 rounded-xl bg-amber-500/20 backdrop-blur-md hover:bg-amber-500 text-amber-500 hover:text-white flex items-center justify-center border border-amber-500/20 transition-all shadow-xl"
                                                    title="Edit"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={2} /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(p.ID)}
                                                    disabled={isDeleting === p.ID}
                                                    className="w-10 h-10 rounded-xl bg-red-500/20 backdrop-blur-md hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center border border-red-500/20 transition-all shadow-xl disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {isDeleting === p.ID ? <Spinner size="sm" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2} /></svg>}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 flex flex-col gap-2 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-400 text-[9px] font-black uppercase tracking-wider border border-indigo-600/10">
                                            {p.Category}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-black uppercase italic leading-tight group-hover:text-indigo-400 transition-colors">
                                        {p.Title}
                                    </h3>
                                    <p className="text-white/40 text-[11px] font-medium line-clamp-2">
                                        {p.Description}
                                    </p>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                                        <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} /></svg>
                                            {new Date(p.UpdatedAt).toLocaleDateString()}
                                        </span>
                                        <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest">
                                            By {p.UpdatedBy}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 gap-6 opacity-20">
                        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={1} /></svg>
                        </div>
                        <p className="text-xl font-black uppercase italic tracking-tighter">No Promotions Found</p>
                    </div>
                )}
            </div>

            {/* Upload/Edit Modal */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title={editingPromotion ? 'កែប្រែប្រូម៉ូសិន' : 'បន្ថែមប្រូម៉ូសិនថ្មី'}>
                <form onSubmit={handleUpload} className="flex flex-col gap-5 p-2 font-['Kantumruy_Pro']">
                    {/* Image Preview / Upload Area */}
                    <div className="relative aspect-[3/4] bg-white/5 rounded-2xl overflow-hidden border border-white/10 group">
                        {imageUrl ? (
                            <img src={convertGoogleDriveUrl(imageUrl)} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/20">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={1} /></svg>
                                <span className="text-[10px] font-black uppercase tracking-widest">ជ្រើសរើសរូបភាព</span>
                            </div>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="absolute bottom-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                            <div className="px-3 py-1.5 bg-indigo-600 rounded-lg text-[10px] font-black uppercase italic">Change Image</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 italic ml-1">Title / ចំណងជើង</label>
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500/50 outline-none transition-all font-bold"
                                placeholder="ចំណងជើងប្រូម៉ូសិន..."
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 italic ml-1">Category / ប្រភេទ</label>
                            <input 
                                type="text" 
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500/50 outline-none transition-all font-bold"
                                placeholder="ឧ. បញ្ចុះតម្លៃពិសេស, ស្បែកជើង..."
                                list="category-list"
                            />
                            <datalist id="category-list">
                                {categories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 italic ml-1">Description / ការពិពណ៌នា</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500/50 outline-none transition-all font-bold resize-none h-24"
                                placeholder="ព័ត៌មានបន្ថែម..."
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-white/20 py-4 rounded-2xl text-base font-black uppercase italic tracking-tighter transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 active:scale-95"
                    >
                        {isSubmitting ? <Spinner size="sm" /> : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={3} /></svg>
                                {editingPromotion ? 'រក្សាទុកការកែប្រែ' : 'Upload ឥឡូវនេះ'}
                            </>
                        )}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default PromotionDashboard;
