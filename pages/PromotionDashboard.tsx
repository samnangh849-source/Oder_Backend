import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { useOrder } from '../context/OrderContext';
import { Promotion, MasterProduct } from '../types';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import { convertGoogleDriveUrl, fileToDataUrl } from '../utils/fileUtils';
import { compressImage } from '../utils/imageCompressor';
import Modal from '../components/common/Modal';
import SearchableProductDropdown from '../components/common/SearchableProductDropdown';

interface PromotionDashboardProps {
    onBack: () => void;
}

const BINANCE_COLORS = {
    bg: '#181A20',
    card: '#1E2329',
    border: '#2B3139',
    text: '#EAECEF',
    textSecondary: '#848E9C',
    yellow: '#FCD535',
    yellowHover: '#EAB308',
    green: '#0ECB81',
    red: '#F6465D'
};

const PromotionDashboard: React.FC<PromotionDashboardProps> = ({ onBack }) => {
    const { currentUser, hasPermission, language, showNotification, lastMessage } = useContext(AppContext);
    const { appData, fetchPromotions } = useOrder();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Category management state
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
    const [editingCatValue, setEditingCatValue] = useState('');

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

    // Get categories from settings or derive from promotions if setting doesn't exist
    const categoriesFromSettings = useMemo(() => {
        const settingVal = appData.settings?.PromotionCategories || '';
        if (!settingVal) return [];
        try {
            return JSON.parse(settingVal) as string[];
        } catch (e) {
            return settingVal.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
    }, [appData.settings]);

    const categories = useMemo(() => {
        const derivedCats = new Set(promotions.map(p => p.Category));
        const allCats = new Set(['All', ...categoriesFromSettings, ...Array.from(derivedCats)]);
        return Array.from(allCats).filter(c => c);
    }, [promotions, categoriesFromSettings]);

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

    const saveCategoriesSetting = async (newList: string[]) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sheetName: 'Settings',
                    primaryKey: { Key: 'PromotionCategories' },
                    newData: { Value: JSON.stringify(newList) }
                })
            });

            if (response.ok) {
                showNotification('រក្សាទុកប្រភេទជោគជ័យ', 'success');
                // We might need to refresh static data here, but usually it's handled by WebSocket or polling
            } else {
                showNotification('រក្សាទុកប្រភេទបរាជ័យ', 'error');
            }
        } catch (error) {
            showNotification('Error updating settings', 'error');
        }
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        const newList = [...categoriesFromSettings, newCategoryName.trim()];
        saveCategoriesSetting(newList);
        setNewCategoryName('');
    };

    const handleUpdateCategory = () => {
        if (editingCatIndex === null || !editingCatValue.trim()) return;
        const newList = [...categoriesFromSettings];
        newList[editingCatIndex] = editingCatValue.trim();
        saveCategoriesSetting(newList);
        setEditingCatIndex(null);
    };

    const handleDeleteCategory = (index: number) => {
        if (!window.confirm('តើអ្នកពិតជាចង់លុបប្រភេទនេះមែនទេ?')) return;
        const newList = categoriesFromSettings.filter((_, i) => i !== index);
        saveCategoriesSetting(newList);
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

    const handleProductSelect = (productName: string) => {
        const product = appData.products?.find(p => p.ProductName === productName);
        if (product) {
            setTitle(product.ProductName);
            if (product.Tags) {
                setDescription(product.Tags);
            }
            if (product.ImageURL && !imageUrl) {
                setImageUrl(product.ImageURL);
            }
        }
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
            const compressedBlob = await compressImage(file, 'high-detail');
            const base64Data = await fileToDataUrl(compressedBlob);

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
                    MimeType: 'image/jpeg',
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
        <div className="flex flex-col h-full w-full bg-[#181A20] text-[#EAECEF] font-['Kantumruy_Pro'] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B3139] bg-[#1E2329]/80 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="w-10 h-10 rounded-lg bg-[#2B3139] hover:bg-[#474D57] flex items-center justify-center transition-all active:scale-90"
                    >
                        <svg className="w-5 h-5 text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase italic tracking-tighter text-[#FCD535]">
                            {language === 'km' ? 'ព័ត៌មានប្រម៉ូសិន' : 'Promotion Info'}
                        </h1>
                        <p className="text-[10px] text-[#848E9C] font-bold uppercase tracking-widest italic">
                            {language === 'km' ? 'បច្ចុប្បន្នភាពចុងក្រោយ' : 'Latest Updates'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Category Filter Dropdown */}
                    <div className="relative group">
                        <select 
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="appearance-none bg-[#2B3139] text-[#EAECEF] px-4 pr-10 py-2 rounded-lg text-sm font-bold border border-transparent focus:border-[#FCD535] outline-none transition-all cursor-pointer"
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#848E9C]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={2.5} /></svg>
                        </div>
                    </div>

                    {canManage && (
                        <>
                            <button 
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="p-2.5 bg-[#2B3139] hover:bg-[#474D57] rounded-lg transition-all text-[#848E9C] hover:text-[#FCD535]"
                                title="Manage Categories"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2} /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2} /></svg>
                            </button>
                            <button 
                                onClick={() => { resetForm(); setEditingPromotion(null); setIsUploadModalOpen(true); }}
                                className="flex items-center gap-2 px-4 py-2 bg-[#FCD535] hover:bg-[#EAB308] text-[#181A20] rounded-lg transition-all active:scale-95 font-black uppercase italic"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2.5} /></svg>
                                <span className="text-sm">{language === 'km' ? 'បន្ថែមថ្មី' : 'Add New'}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#181A20]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Spinner size="lg" />
                        <p className="text-[#848E9C] text-xs font-black uppercase tracking-widest animate-pulse">Loading Promotions...</p>
                    </div>
                ) : filteredPromotions.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredPromotions.map((p, idx) => (
                            <div 
                                key={p.ID}
                                className="group relative bg-[#1E2329] rounded-2xl overflow-hidden border border-[#2B3139] hover:border-[#FCD535]/30 transition-all duration-300 shadow-xl"
                            >
                                {/* Image Container */}
                                <div 
                                    className="aspect-[3/4] overflow-hidden relative cursor-pointer"
                                    onClick={() => setPreviewImage(p.ImageURL)}
                                >
                                    <img 
                                        src={convertGoogleDriveUrl(p.ImageURL)} 
                                        alt={p.Title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#181A20] via-transparent to-transparent opacity-60"></div>
                                    
                                    {/* Fullscreen Badge */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                        <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" strokeWidth={2} /></svg>
                                        </div>
                                    </div>

                                    {/* Quick Actions Overlay */}
                                    <div className="absolute top-3 right-3 flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleCopyImage(p.ImageURL); }}
                                            className="w-9 h-9 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#FCD535] hover:text-[#181A20] flex items-center justify-center border border-white/5 transition-all text-[#848E9C]"
                                            title="Copy Image"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDownload(p.ImageURL, `${p.Title}.jpg`); }}
                                            className="w-9 h-9 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#FCD535] hover:text-[#181A20] flex items-center justify-center border border-white/5 transition-all text-[#848E9C]"
                                            title="Download Image"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth={2} /></svg>
                                        </button>
                                        {canManage && (
                                            <>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                                                    className="w-9 h-9 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#FCD535] hover:text-[#181A20] flex items-center justify-center border border-white/5 transition-all text-[#848E9C]"
                                                    title="Edit"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={2} /></svg>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(p.ID); }}
                                                    disabled={isDeleting === p.ID}
                                                    className="w-9 h-9 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#F6465D] hover:text-white flex items-center justify-center border border-white/5 transition-all text-[#F6465D] disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {isDeleting === p.ID ? <Spinner size="sm" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2} /></svg>}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4 flex flex-col gap-1.5 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <span className="px-2 py-0.5 rounded-md bg-[#FCD535]/10 text-[#FCD535] text-[9px] font-black uppercase tracking-wider border border-[#FCD535]/20">
                                            {p.Category}
                                        </span>
                                        <span className="text-[9px] text-[#848E9C] font-bold uppercase tracking-widest">
                                            By {p.UpdatedBy}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-black uppercase italic leading-tight group-hover:text-[#FCD535] transition-colors line-clamp-1">
                                        {p.Title}
                                    </h3>
                                    <p className="text-[#848E9C] text-[10px] font-medium line-clamp-2 min-h-[30px]">
                                        {p.Description}
                                    </p>
                                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#2B3139]">
                                        <span className="text-[9px] text-[#848E9C]/60 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} /></svg>
                                            {new Date(p.UpdatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 gap-6 opacity-20">
                        <div className="w-24 h-24 rounded-full bg-[#2B3139] flex items-center justify-center">
                            <svg className="w-12 h-12 text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={1} /></svg>
                        </div>
                        <p className="text-xl font-black uppercase italic tracking-tighter text-[#EAECEF]">No Promotions Found</p>
                    </div>
                )}
            </div>

            {/* Upload/Edit Modal */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title={editingPromotion ? 'កែប្រែប្រូម៉ូសិន' : 'បន្ថែមប្រូម៉ូសិនថ្មី'}>
                <form onSubmit={handleUpload} className="flex flex-col gap-4 p-2 font-['Kantumruy_Pro']">
                    
                    {/* Product Selection */}
                    {!editingPromotion && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#848E9C] italic ml-1">Select Existing Product / ជ្រើសរើសទំនិញ</label>
                            <SearchableProductDropdown 
                                products={appData.products || []}
                                selectedProductName={title}
                                onSelect={handleProductSelect}
                                allowAddNew={false}
                                showTagEditor={false}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Image Preview / Upload Area */}
                        <div className="relative aspect-[3/4] bg-[#0B0E11] rounded-xl overflow-hidden border border-[#2B3139] group">
                            {imageUrl ? (
                                <img src={convertGoogleDriveUrl(imageUrl)} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-4 text-[#474D57]">
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
                                <div className="px-3 py-1.5 bg-[#FCD535] text-[#181A20] rounded-lg text-[10px] font-black uppercase italic">Change Image</div>
                            </div>
                            {isSubmitting && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                    <Spinner size="lg" />
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#848E9C] italic ml-1">Title / ចំណងជើង</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-[#0B0E11] border border-[#2B3139] rounded-lg px-4 py-2.5 text-sm focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF]"
                                    placeholder="ចំណងជើងប្រូម៉ូសិន..."
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#848E9C] italic ml-1">Category / ប្រភេទ</label>
                                <div className="relative">
                                    <select 
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full appearance-none bg-[#0B0E11] border border-[#2B3139] rounded-lg px-4 py-2.5 text-sm focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF] cursor-pointer"
                                    >
                                        <option value="">ជ្រើសរើសប្រភេទ...</option>
                                        {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#848E9C]">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={2.5} /></svg>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#848E9C] italic ml-1">Description / ការពិពណ៌នា</label>
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="bg-[#0B0E11] border border-[#2B3139] rounded-lg px-4 py-2.5 text-sm focus:border-[#FCD535] outline-none transition-all font-bold resize-none h-32 text-[#EAECEF]"
                                    placeholder="ព័ត៌មានបន្ថែម..."
                                />
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-2 w-full bg-[#FCD535] hover:bg-[#EAB308] disabled:bg-[#2B3139] disabled:text-[#474D57] py-4 rounded-xl text-base font-black uppercase italic tracking-tighter transition-all flex items-center justify-center gap-3 text-[#181A20] active:scale-95 shadow-xl shadow-[#FCD535]/10"
                    >
                        {isSubmitting ? <Spinner size="sm" /> : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={3} /></svg>
                                {editingPromotion ? 'រក្សាទុកការកែប្រែ' : 'បង្កើតប្រូម៉ូសិន'}
                            </>
                        )}
                    </button>
                </form>
            </Modal>

            {/* Category Management Modal */}
            <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="គ្រប់គ្រងប្រភេទប្រូម៉ូសិន">
                <div className="flex flex-col gap-4 p-2 font-['Kantumruy_Pro']">
                    {/* Add New Category */}
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="ឈ្មោះប្រភេទថ្មី..."
                            className="flex-grow bg-[#0B0E11] border border-[#2B3139] rounded-lg px-4 py-2 text-sm focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF]"
                        />
                        <button 
                            onClick={handleAddCategory}
                            className="px-4 py-2 bg-[#FCD535] text-[#181A20] rounded-lg font-bold text-sm hover:bg-[#EAB308] transition-all"
                        >
                            បន្ថែម
                        </button>
                    </div>

                    {/* Category List */}
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {categoriesFromSettings.map((cat, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-[#0B0E11] rounded-lg border border-[#2B3139] group">
                                {editingCatIndex === idx ? (
                                    <>
                                        <input 
                                            type="text"
                                            value={editingCatValue}
                                            onChange={(e) => setEditingCatValue(e.target.value)}
                                            className="flex-grow bg-[#1E2329] border border-[#FCD535] rounded px-3 py-1 text-sm outline-none text-[#EAECEF]"
                                            autoFocus
                                        />
                                        <button onClick={handleUpdateCategory} className="text-[#0ECB81] p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2} /></svg></button>
                                        <button onClick={() => setEditingCatIndex(null)} className="text-[#F6465D] p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} /></svg></button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-grow px-2 text-sm font-bold text-[#EAECEF]">{cat}</span>
                                        <button 
                                            onClick={() => { setEditingCatIndex(idx); setEditingCatValue(cat); }}
                                            className="opacity-0 group-hover:opacity-100 text-[#848E9C] hover:text-[#FCD535] transition-all p-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={2} /></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteCategory(idx)}
                                            className="opacity-0 group-hover:opacity-100 text-[#848E9C] hover:text-[#F6465D] transition-all p-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2} /></svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                        {categoriesFromSettings.length === 0 && (
                            <p className="text-center py-8 text-[#474D57] text-xs font-bold uppercase tracking-widest">No categories set up</p>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Fullscreen Preview */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-[#181A20] flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in"
                    onClick={() => setPreviewImage(null)}
                >
                    <button 
                        className="absolute top-6 right-6 w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
                        onClick={() => setPreviewImage(null)}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} /></svg>
                    </button>
                    
                    <div className="w-full h-full max-w-4xl max-h-screen relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <img 
                            src={convertGoogleDriveUrl(previewImage)} 
                            alt="Full Preview" 
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-scale-in"
                        />
                    </div>

                    <div className="absolute bottom-8 flex gap-4 animate-fade-in-up">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDownload(previewImage, 'promotion.jpg'); }}
                            className="px-6 py-3 bg-[#FCD535] text-[#181A20] rounded-xl font-black uppercase italic text-sm flex items-center gap-2 hover:bg-[#EAB308] transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth={2.5} /></svg>
                            Download
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleCopyImage(previewImage); }}
                            className="px-6 py-3 bg-[#2B3139] text-[#EAECEF] rounded-xl font-black uppercase italic text-sm flex items-center gap-2 hover:bg-[#474D57] transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg>
                            Copy Link
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes fade-in-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #2B3139; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #474D57; }
            `}</style>
        </div>
    );
};

export default PromotionDashboard;
