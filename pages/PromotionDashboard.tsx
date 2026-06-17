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
    const { appData, fetchPromotions, refreshData } = useOrder();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [zoomScaleUI, setZoomScaleUI] = useState(1); // Only for UI buttons

    // Zoom & Pan Refs
    const imgContainerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);


    // Form state
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [barcode, setBarcode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Category management state
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
    const [editingCatValue, setEditingCatValue] = useState('');
    const [isCategorySaving, setIsCategorySaving] = useState(false);
    
    // Add local optimistic state for categories
    const [localCategories, setLocalCategories] = useState<string[]>([]);

    const canManage = hasPermission('manage_promotions') || currentUser?.IsSystemAdmin;

    useEffect(() => {
        setIsLoading(true);
        fetchPromotions().finally(() => setIsLoading(false));
    }, [fetchPromotions]);

    // Handle real-time updates
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'promotion_updated') {
            fetchPromotions(true);
            if (lastMessage.action === 'create' && lastMessage.data?.UpdatedBy !== currentUser?.FullName) {
                showNotification(`មានប្រូម៉ូសិនថ្មី៖ ${lastMessage.data?.Title}`, 'info', 'បច្ចុប្បន្នភាពប្រូម៉ូសិន');
            }
        }
    }, [lastMessage, fetchPromotions, currentUser?.FullName, showNotification]);

    const promotions = useMemo(() => appData.promotions || [], [appData.promotions]);

    // Initialize local categories from settings
    useEffect(() => {
        const settingVal = appData.settings?.PromotionCategories || '';
        if (settingVal) {
            try {
                setLocalCategories(JSON.parse(settingVal) as string[]);
            } catch (e) {
                setLocalCategories(settingVal.split(',').map((s: string) => s.trim()).filter(Boolean));
            }
        } else {
            setLocalCategories([]);
        }
    }, [appData.settings?.PromotionCategories]);

    const categories = useMemo(() => {
        const derivedCats = new Set(promotions.map(p => p.Category));
        const allCats = new Set(['All', ...localCategories, ...Array.from(derivedCats)]);
        return Array.from(allCats).filter(c => c);
    }, [promotions, localCategories]);

    const filteredPromotions = useMemo(() => {
        let filtered = promotions;
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(p => p.Category === selectedCategory);
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                p.Title.toLowerCase().includes(query) || 
                (p.Barcode && p.Barcode.toLowerCase().includes(query)) ||
                (p.Description && p.Description.toLowerCase().includes(query))
            );
        }
        return filtered;
    }, [promotions, selectedCategory, searchQuery]);

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
                    Barcode: barcode,
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
                fetchPromotions(true);
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
        setIsDeleting(id);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/promotions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                showNotification('លុបជោគជ័យ', 'success');
                fetchPromotions(true);
            } else {
                showNotification('លុបមិនបានសម្រេច', 'error');
            }
        } catch (error) {
            showNotification('Error connecting to server', 'error');
        } finally {
            setIsDeleting(null);
            setPromotionToDelete(null);
        }
    };

    const saveCategoriesSetting = async (newList: string[]) => {
        setIsCategorySaving(true);
        // Optimistic update
        setLocalCategories(newList);
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
                // The optimistic UI is already set. Refresh data silently.
                refreshData();
            } else {
                // Revert optimistic update on failure
                showNotification('រក្សាទុកប្រភេទបរាជ័យ', 'error');
                refreshData(); 
            }
        } catch (error) {
            showNotification('Error updating settings', 'error');
            refreshData(); // Revert
        } finally {
            setIsCategorySaving(false);
        }
    };

    const handleAddCategory = () => {
        const name = newCategoryName.trim();
        if (!name) return;
        
        if (localCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
            showNotification('ប្រភេទនេះមានរួចហើយ', 'error');
            return;
        }

        const newList = [...localCategories, name];
        saveCategoriesSetting(newList);
        setNewCategoryName('');
    };

    const handleUpdateCategory = () => {
        if (editingCatIndex === null) return;
        const name = editingCatValue.trim();
        if (!name) return;

        if (localCategories.some((c, i) => i !== editingCatIndex && c.toLowerCase() === name.toLowerCase())) {
            showNotification('ប្រភេទនេះមានរួចហើយ', 'error');
            return;
        }

        const newList = [...localCategories];
        newList[editingCatIndex] = name;
        saveCategoriesSetting(newList);
        setEditingCatIndex(null);
    };

    const handleDeleteCategory = (index: number) => {
        if (!window.confirm('តើអ្នកពិតជាចង់លុបប្រភេទនេះមែនទេ?')) return;
        const newList = localCategories.filter((_, i) => i !== index);
        saveCategoriesSetting(newList);
    };

    const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
        const newList = [...localCategories];
        if (direction === 'up' && index > 0) {
            [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
        } else if (direction === 'down' && index < newList.length - 1) {
            [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
        } else {
            return;
        }
        saveCategoriesSetting(newList);
    };

    const resetForm = () => {
        setTitle('');
        setCategory('');
        setDescription('');
        setImageUrl('');
        setBarcode('');
        setPreviewImage(null);
    };

    const openEditModal = (p: Promotion) => {
        setEditingPromotion(p);
        setTitle(p.Title);
        setCategory(p.Category);
        setDescription(p.Description);
        setImageUrl(p.ImageURL);
        setBarcode(p.Barcode || '');
        setIsUploadModalOpen(true);
    };

    const handleProductSelect = (productName: string) => {
        const product = appData.products?.find(p => p.ProductName === productName);
        if (product) {
            setTitle(product.ProductName);
            setBarcode(product.Barcode);
            if (product.Tags) {
                setDescription(product.Tags);
            }
            if (product.ImageURL && !imageUrl) {
                setImageUrl(product.ImageURL);
            }
        }
    };

    const handleCopyImage = async (url: string) => {
        let fetchUrl = convertGoogleDriveUrl(url);
        const isSecure = window.isSecureContext;
        
        console.log("📸 [CopyImage] Starting process for R2/Cloudflare:", url);

        try {
            if (!isSecure) throw new Error("Not a secure context (HTTPS required)");
            if (!navigator.clipboard || !window.ClipboardItem) throw new Error("Clipboard API not supported");

            const token = localStorage.getItem('token');
            const isR2 = url.startsWith('r2://');
            
            // If it's R2 or already a direct public Cloudflare/S3 URL, fetch directly.
            // Only use proxy for Google Drive which has strict CORS.
            if (!isR2 && fetchUrl.includes('google.com')) {
                fetchUrl = `${WEB_APP_URL}/api/proxy-image?url=${encodeURIComponent(fetchUrl)}`;
                console.log("📸 [CopyImage] Using Proxy for Google Drive:", fetchUrl);
            }
            
            // 1. Fetch image blob. 
            // For R2, we use 'anonymous' mode to avoid CORS issues if the bucket is public
            console.log("📸 [CopyImage] Fetching from:", fetchUrl);
            const response = await fetch(fetchUrl, {
                headers: (token && fetchUrl.includes(WEB_APP_URL)) ? { 'Authorization': `Bearer ${token}` } : {}
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            
            // 2. Convert to PNG
            const img = new Image();
            img.crossOrigin = "anonymous";
            const objectUrl = URL.createObjectURL(blob);
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error("Image Load Error"));
                img.src = objectUrl;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas Context Error");
            ctx.drawImage(img, 0, 0);
            
            const pngBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
            URL.revokeObjectURL(objectUrl);
            
            if (!pngBlob) throw new Error("PNG Blob Creation Failed");

            // 3. Write to Clipboard
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob })
            ]);
            
            showNotification('បាន Copy រូបភាពរួចរាល់ (Copy Image Success)', 'success');
            return;
            
        } catch (err: any) {
            console.error("❌ [CopyImage] Error:", err.message);
            
            // Fallback: Copy URL
            try {
                const finalUrl = convertGoogleDriveUrl(url);
                await navigator.clipboard.writeText(finalUrl);
                showNotification('បាន Copy Link រូបភាព (Fallback)', 'success');
            } catch (fallbackErr) {
                showNotification('បរាជ័យក្នុងការ Copy', 'error');
            }
        }
    };

    const handleDownload = (url: string, fileName: string) => {
        const driveUrl = convertGoogleDriveUrl(url);
        const link = document.createElement('a');
        link.href = driveUrl;
        link.download = fileName || 'promotion.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('កំពុងទាញយក...', 'info');
    };

    // Zoom & Pan High-Performance Handlers
    useEffect(() => {
        const container = imgContainerRef.current;
        const img = imgRef.current;
        if (!container || !img || !previewImage) return;

        let currentScale = 1;
        let pointX = 0;
        let pointY = 0;
        let startX = 0;
        let startY = 0;
        let isPanning = false;
        let initialPinchDistance: number | null = null;
        let initialScale = 1;

        const updateTransform = (smooth = false) => {
            img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${currentScale})`;
            img.style.transition = smooth ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' : 'none';
            setZoomScaleUI(currentScale);
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const xs = (e.clientX - pointX) / currentScale;
            const ys = (e.clientY - pointY) / currentScale;
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            currentScale = Math.max(1, Math.min(currentScale + delta, 5));
            if (currentScale === 1) {
                pointX = 0;
                pointY = 0;
            } else {
                pointX = e.clientX - xs * currentScale;
                pointY = e.clientY - ys * currentScale;
            }
            updateTransform(true);
        };

        const handlePointerDown = (e: PointerEvent) => {
            if (currentScale === 1) return;
            isPanning = true;
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            img.style.cursor = 'grabbing';
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isPanning) return;
            e.preventDefault();
            pointX = e.clientX - startX;
            pointY = e.clientY - startY;
            updateTransform(false);
        };

        const handlePointerUp = () => {
            isPanning = false;
            if (currentScale > 1) img.style.cursor = 'grab';
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                isPanning = false;
                initialPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialScale = currentScale;
            } else if (e.touches.length === 1 && currentScale > 1) {
                isPanning = true;
                startX = e.touches[0].clientX - pointX;
                startY = e.touches[0].clientY - pointY;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && initialPinchDistance) {
                e.preventDefault();
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                currentScale = Math.max(1, Math.min(initialScale * (currentDistance / initialPinchDistance), 5));
                if (currentScale === 1) { pointX = 0; pointY = 0; }
                updateTransform(false);
            } else if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                pointX = e.touches[0].clientX - startX;
                pointY = e.touches[0].clientY - startY;
                updateTransform(false);
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) initialPinchDistance = null;
            if (e.touches.length === 0) isPanning = false;
        };

        // Attach native events with { passive: false } to allow e.preventDefault()
        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);
        img.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);

        // Expose controls for buttons
        (container as any)._zoomIn = () => {
            currentScale = Math.min(currentScale + 0.5, 4);
            updateTransform(true);
        };
        (container as any)._zoomOut = () => {
            currentScale = Math.max(currentScale - 0.5, 1);
            if (currentScale === 1) { pointX = 0; pointY = 0; }
            updateTransform(true);
        };
        (container as any)._resetZoom = () => {
            currentScale = 1;
            pointX = 0;
            pointY = 0;
            updateTransform(true);
        };

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
            img.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            delete (container as any)._zoomIn;
            delete (container as any)._zoomOut;
            delete (container as any)._resetZoom;
        };
    }, [previewImage]);


    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSubmitting(true);
        setUploadProgress(0);
        try {
            const compressedBlob = await compressImage(file, 'high-detail');
            const base64Data = await fileToDataUrl(compressedBlob);
            const token = localStorage.getItem('token');

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${WEB_APP_URL}/api/upload-image`);
                xhr.setRequestHeader('Content-Type', 'application/json');
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        setUploadProgress(percentComplete);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const result = JSON.parse(xhr.responseText);
                            setImageUrl(result.url);
                            showNotification('Upload រូបភាពរួចរាល់', 'success');
                            resolve(result);
                        } catch (err) {
                            reject(new Error("Invalid JSON response"));
                        }
                    } else {
                        reject(new Error(`HTTP Error: ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network Error"));

                xhr.send(JSON.stringify({
                    Action: 'uploadImage',
                    FileData: base64Data,
                    FileName: file.name,
                    MimeType: 'image/jpeg',
                    SheetName: 'Promotions',
                    TargetColumn: 'ImageURL',
                    UserName: currentUser?.UserName
                }));
            });

        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Error uploading image', 'error');
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setUploadProgress(0), 1000); // Reset after a small delay
        }
    };

    return (
        <div className="relative h-full w-full bg-[#181A20] text-[#EAECEF] font-['Kantumruy_Pro'] flex flex-col overflow-hidden">
            
            {/* Header Area */}
            <div className="flex flex-col gap-3 p-4 sm:p-6 shrink-0 z-30 relative">
                {/* Top Row: Back, Title, Desktop Search, Add Button */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-grow">
                        <button 
                            onClick={onBack}
                            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl bg-[#1E2329]/80 backdrop-blur-xl border border-[#2B3139] hover:border-[#FCD535] flex items-center justify-center transition-all active:scale-90 shadow-2xl group"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#848E9C] group-hover:text-[#FCD535] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3} /></svg>
                        </button>
                        <div className="hidden sm:block shrink-0">
                            <h1 className="text-xl font-black uppercase italic tracking-tighter text-[#FCD535] drop-shadow-lg">
                                {language === 'km' ? 'ប្រម៉ូសិន' : 'Promotions'}
                            </h1>
                        </div>

                        {/* Search Bar (Desktop) */}
                        <div className="relative flex-grow max-w-md hidden md:block ml-2">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search promotions (Title, Barcode)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#1E2329]/60 backdrop-blur-xl border border-[#2B3139] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[#EAECEF] placeholder-[#848E9C] focus:border-[#FCD535] outline-none shadow-2xl transition-all"
                            />
                        </div>
                    </div>

                    {/* Add Button */}
                    <div className="flex items-center gap-3 shrink-0">
                        {canManage && (
                            <button 
                                onClick={() => { resetForm(); setEditingPromotion(null); setIsUploadModalOpen(true); }}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#FCD535] hover:bg-[#EAB308] text-[#181A20] flex items-center justify-center transition-all active:scale-90 shadow-2xl shadow-[#FCD535]/20 group"
                            >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3} /></svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Search Bar */}
                <div className="relative w-full md:hidden">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search promotions (Title, Barcode)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1E2329]/80 backdrop-blur-xl border border-[#2B3139] rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-[#EAECEF] placeholder-[#848E9C] focus:border-[#FCD535] outline-none shadow-2xl transition-all"
                    />
                </div>

                {/* Category Filter Bar (All Devices) */}
                <div className="flex items-center gap-2 bg-[#1E2329]/60 backdrop-blur-xl p-1.5 rounded-2xl border border-[#2B3139] shadow-2xl overflow-x-auto no-scrollbar w-full">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-2 shrink-0 rounded-xl text-[10px] font-black uppercase italic tracking-widest transition-all whitespace-nowrap ${
                                selectedCategory === cat 
                                ? 'bg-[#FCD535] text-[#181A20] shadow-lg shadow-[#FCD535]/20' 
                                : 'text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139]'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto custom-scrollbar px-4 sm:px-6 pb-6 bg-[#181A20]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Spinner size="lg" />
                        <p className="text-[#848E9C] text-xs font-black uppercase tracking-widest animate-pulse">Loading Promotions...</p>
                    </div>
                ) : filteredPromotions.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                        {filteredPromotions.map((p, idx) => (
                            <div 
                                key={p.ID}
                                className="group relative bg-[#1E2329] rounded-xl overflow-hidden border border-[#2B3139] hover:border-[#FCD535]/30 transition-all duration-300 shadow-xl"
                            >
                                {/* Image Container */}
                                <div 
                                    className="aspect-square overflow-hidden relative cursor-pointer"
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
                                        <div className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hidden md:block">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" strokeWidth={2} /></svg>
                                        </div>
                                    </div>

                                    {/* Quick Actions Overlay */}
                                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 translate-x-0 md:translate-x-4 opacity-100 md:opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 z-20">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleCopyImage(p.ImageURL); }}
                                            className="w-8 h-8 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#FCD535] hover:text-[#181A20] flex items-center justify-center border border-white/5 transition-all text-[#848E9C]"
                                            title="Copy Image"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg>
                                        </button>
                                        {canManage && (
                                            <>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                                                    className="w-8 h-8 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#FCD535] hover:text-[#181A20] flex items-center justify-center border border-white/5 transition-all text-[#848E9C]"
                                                    title="Edit"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={2} /></svg>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setPromotionToDelete(p); }}
                                                    disabled={isDeleting === p.ID}
                                                    className="w-8 h-8 rounded-lg bg-[#181A20]/80 backdrop-blur-md hover:bg-[#F6465D] hover:text-white flex items-center justify-center border border-white/5 transition-all text-[#F6465D] disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {isDeleting === p.ID ? <Spinner size="sm" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2} /></svg>}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-2.5 flex flex-col gap-1 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <span className="px-1.5 py-0.5 rounded bg-[#FCD535]/10 text-[#FCD535] text-[8px] font-black uppercase tracking-wider border border-[#FCD535]/20">
                                            {p.Category}
                                        </span>
                                        {p.Barcode && (
                                            <span className="text-[8px] font-mono text-[#FCD535]/60 bg-[#181A20] px-1 rounded border border-white/5">
                                                {p.Barcode}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-[11px] font-black uppercase italic leading-tight group-hover:text-[#FCD535] transition-colors line-clamp-1">
                                        {p.Title}
                                    </h3>
                                    
                                    <div className="flex items-center justify-between mt-0.5 pt-1.5 border-t border-[#2B3139]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[8px] text-[#848E9C]/60 font-bold uppercase tracking-widest flex items-center gap-1">
                                                {new Date(p.UpdatedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {p.Barcode && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const prod = appData.products?.find(pr => pr.Barcode === p.Barcode);
                                                        if (prod) {
                                                            alert(`Product: ${prod.ProductName}\nPrice: $${prod.Price}\nCost: $${prod.Cost}\nTags: ${prod.Tags}`);
                                                        }
                                                    }}
                                                    className="w-5 h-5 rounded-md bg-[#FCD535]/10 hover:bg-[#FCD535] text-[#FCD535] hover:text-[#181A20] flex items-center justify-center transition-all"
                                                    title="View Linked Product"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5} /></svg>
                                                </button>
                                            )}
                                            <span className="text-[8px] text-[#848E9C]/60 font-bold uppercase tracking-widest">
                                                {p.UpdatedBy.split(' ')[0]}
                                            </span>
                                        </div>
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

            {/* Upload/Edit Modal (Full Screen) */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} fullScreen={true}>
                <div className="flex flex-col flex-grow overflow-hidden bg-[#181A20] font-['Kantumruy_Pro']">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#2B3139] bg-[#1E2329]/50 backdrop-blur-xl sticky top-0 z-50">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setIsUploadModalOpen(false)}
                                className="w-10 h-10 rounded-xl bg-[#2B3139] hover:bg-[#474D57] flex items-center justify-center text-[#EAECEF] transition-all active:scale-90"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3} /></svg>
                            </button>
                            <h2 className="text-xl font-black uppercase italic tracking-tighter text-[#FCD535]">
                                {editingPromotion ? 'កែប្រែប្រូម៉ូសិន (Edit Promotion)' : 'បន្ថែមប្រូម៉ូសិនថ្មី (Add New Promotion)'}
                            </h2>
                        </div>
                        <button 
                            onClick={() => setIsUploadModalOpen(false)}
                            className="p-2 text-[#848E9C] hover:text-[#F6465D] transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-4 sm:p-8 md:p-12 lg:p-16">
                        <form onSubmit={handleUpload} className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                            
                            {/* Left Column: Product Selection and Image */}
                            <div className="lg:col-span-5 flex flex-col gap-6">
                                {/* Product Selection */}
                                {!editingPromotion && (
                                    <div className="flex flex-col gap-2 p-6 bg-[#1E2329]/50 rounded-2xl border border-[#2B3139]">
                                        <label className="text-xs font-black uppercase tracking-widest text-[#848E9C] italic">Auto-Fill from Product / ជ្រើសរើសទំនិញ (ស្រេចចិត្ត)</label>
                                        <SearchableProductDropdown 
                                            products={appData.products || []}
                                            selectedProductName={title}
                                            onSelect={handleProductSelect}
                                            allowAddNew={false}
                                            showTagEditor={false}
                                        />
                                        <p className="text-[9px] text-[#5e6673] italic">ជ្រើសរើសដើម្បីបំពេញចំណងជើង និងរូបភាពដោយស្វ័យប្រវត្តិ (Optional: auto-fills title and image)</p>
                                    </div>
                                )}

                                {/* Image Preview / Upload Area */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-[#FCD535] italic ml-1">Promotion Image / រូបភាពប្រូម៉ូសិន</label>
                                    <div className="relative aspect-video sm:aspect-square bg-[#0B0E11] rounded-2xl overflow-hidden border-2 border-[#2B3139] hover:border-[#FCD535]/30 group transition-all shadow-2xl">
                                        {imageUrl ? (
                                            <img src={convertGoogleDriveUrl(imageUrl)} alt="Promotion Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-4 text-[#474D57]">
                                                <div className="w-20 h-20 rounded-full bg-[#1E2329] flex items-center justify-center">
                                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={1} /></svg>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">ជ្រើសរើសរូបភាពប្រូម៉ូសិន</span>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleImageFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <div className="px-6 py-3 bg-[#FCD535] text-[#181A20] rounded-xl text-xs font-black uppercase italic shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">Change Promotion Image</div>
                                        </div>
                                        {isSubmitting && (
                                            <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20 gap-3">
                                                <Spinner size="lg" />
                                                {uploadProgress > 0 && (
                                                    <div className="w-3/4 max-w-[200px] flex flex-col gap-2">
                                                        <div className="flex justify-between text-[10px] font-black uppercase text-[#FCD535]">
                                                            <span>Uploading...</span>
                                                            <span>{uploadProgress}%</span>
                                                        </div>
                                                        <div className="w-full bg-[#2B3139] rounded-full h-1.5 overflow-hidden">
                                                            <div 
                                                                className="bg-[#FCD535] h-1.5 rounded-full transition-all duration-300 ease-out" 
                                                                style={{ width: `${uploadProgress}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-[#848E9C] italic ml-1">* រូបភាពនេះសម្រាប់បង្ហាញក្នុងផ្ទាំងប្រូម៉ូសិន (This is for the promotion display)</p>
                                </div>
                            </div>

                            {/* Right Column: Details and Category */}
                            <div className="lg:col-span-7 flex flex-col gap-8">
                                <div className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-[#FCD535] italic ml-1">Promotion Title / ចំណងជើងប្រូម៉ូសិន</label>
                                        <input 
                                            type="text" 
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="bg-[#0B0E11] border-2 border-[#2B3139] rounded-xl px-6 py-4 text-base focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF] shadow-xl"
                                            placeholder="បញ្ចូលចំណងជើងសម្រាប់ប្រូម៉ូសិននេះ..."
                                        />
                                        <p className="text-[10px] text-[#848E9C] italic ml-1">* នេះជាចំណងជើងប្រូម៉ូសិន មិនប៉ះពាល់ដល់ឈ្មោះទំនិញឡើយ (This only affects the promotion name)</p>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-xs font-black uppercase tracking-widest text-[#FCD535] italic">Promotion Category / ប្រភេទប្រូម៉ូសិន</label>
                                            {canManage && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsCategoryModalOpen(true)}
                                                    className="text-[10px] font-black text-[#848E9C] hover:text-[#FCD535] transition-colors flex items-center gap-1.5"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2} /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2} /></svg>
                                                    Manage All
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Select Category */}
                                            <div className="relative">
                                                <select 
                                                    value={category}
                                                    onChange={(e) => setCategory(e.target.value)}
                                                    className="w-full appearance-none bg-[#0B0E11] border-2 border-[#2B3139] rounded-xl px-6 py-4 text-base focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF] cursor-pointer shadow-xl"
                                                >
                                                    <option value="">ជ្រើសរើសប្រភេទ...</option>
                                                    {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#FCD535]">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
                                                </div>
                                            </div>

                                            {/* Inline Add Category */}
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text"
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    placeholder="បន្ថែមប្រភេទថ្មី..."
                                                    className="flex-grow bg-[#1E2329]/30 border-2 border-[#2B3139] border-dashed rounded-xl px-4 py-3 text-sm focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF]"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={handleAddCategory}
                                                    disabled={isCategorySaving || !newCategoryName.trim()}
                                                    className="px-6 bg-[#2B3139] hover:bg-[#FCD535] hover:text-[#181A20] text-[#EAECEF] rounded-xl font-black uppercase italic text-[10px] transition-all whitespace-nowrap"
                                                >
                                                    {isCategorySaving ? <Spinner size="sm" /> : 'Add'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-[#FCD535] italic ml-1">Promotion Description / ការពិពណ៌នា</label>
                                        <textarea 
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="bg-[#0B0E11] border-2 border-[#2B3139] rounded-xl px-6 py-4 text-base focus:border-[#FCD535] outline-none transition-all font-bold resize-none h-48 text-[#EAECEF] shadow-xl"
                                            placeholder="ព័ត៌មានបន្ថែមអំពីប្រូម៉ូសិន..."
                                        />
                                    </div>
                                </div>

                                <div className="mt-auto pt-8">
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full bg-[#FCD535] hover:bg-[#EAB308] disabled:bg-[#2B3139] disabled:text-[#474D57] py-6 rounded-2xl text-xl font-black uppercase italic tracking-tighter transition-all flex items-center justify-center gap-4 text-[#181A20] active:scale-[0.98] shadow-2xl shadow-[#FCD535]/20"
                                    >
                                        {isSubmitting ? <Spinner size="md" /> : (
                                            <>
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4} /></svg>
                                                {editingPromotion ? 'រក្សាទុកការកែប្រែ (Save Changes)' : 'បង្កើតប្រូម៉ូសិន (Create Promotion)'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </Modal>

            {/* Category Management Modal */}
            <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="គ្រប់គ្រងប្រភេទប្រូម៉ូសិន">
                <div className="flex flex-col gap-6 p-2 font-['Kantumruy_Pro']">
                    {/* Add New Category */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#848E9C] italic ml-1">Add New Category / បន្ថែមប្រភេទថ្មី</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                placeholder="ឈ្មោះប្រភេទថ្មី..."
                                className="flex-grow bg-[#0B0E11] border border-[#2B3139] rounded-xl px-4 py-3 text-sm focus:border-[#FCD535] outline-none transition-all font-bold text-[#EAECEF]"
                            />
                            <button 
                                onClick={handleAddCategory}
                                disabled={isCategorySaving || !newCategoryName.trim()}
                                className="px-6 bg-[#FCD535] text-[#181A20] rounded-xl font-black uppercase italic text-xs hover:bg-[#EAB308] disabled:opacity-50 disabled:bg-[#2B3139] disabled:text-[#474D57] transition-all shadow-lg shadow-[#FCD535]/10"
                            >
                                {isCategorySaving ? <Spinner size="sm" /> : 'បន្ថែម'}
                            </button>
                        </div>
                    </div>

                    {/* Category List */}
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#848E9C] italic ml-1">Current Categories / ប្រភេទបច្ចុប្បន្ន ({localCategories.length})</label>
                        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {localCategories.map((cat, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#0B0E11]/40 hover:bg-[#1E2329] rounded-xl border border-[#2B3139] group transition-all">
                                    {editingCatIndex === idx ? (
                                        <div className="flex-grow flex items-center gap-2">
                                            <input 
                                                type="text"
                                                value={editingCatValue}
                                                onChange={(e) => setEditingCatValue(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory()}
                                                className="flex-grow bg-[#1E2329] border border-[#FCD535] rounded-lg px-3 py-2 text-sm outline-none text-[#EAECEF] font-bold"
                                                autoFocus
                                            />
                                            <button onClick={handleUpdateCategory} className="w-9 h-9 flex items-center justify-center bg-[#0ECB81]/10 text-[#0ECB81] rounded-lg hover:bg-[#0ECB81] hover:text-[#181A20] transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2.5} /></svg></button>
                                            <button onClick={() => setEditingCatIndex(null)} className="w-9 h-9 flex items-center justify-center bg-[#F6465D]/10 text-[#F6465D] rounded-lg hover:bg-[#F6465D] hover:text-white transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg></button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Drag/Move Handles */}
                                            <div className="flex flex-col gap-1">
                                                <button 
                                                    onClick={() => handleMoveCategory(idx, 'up')}
                                                    disabled={idx === 0 || isCategorySaving}
                                                    className="text-[#848E9C] hover:text-[#FCD535] disabled:opacity-20 transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={3} /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleMoveCategory(idx, 'down')}
                                                    disabled={idx === localCategories.length - 1 || isCategorySaving}
                                                    className="text-[#848E9C] hover:text-[#FCD535] disabled:opacity-20 transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
                                                </button>
                                            </div>

                                            <span className="flex-grow px-2 text-sm font-bold text-[#EAECEF] group-hover:text-[#FCD535] transition-colors">{cat}</span>
                                            
                                            <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => { setEditingCatIndex(idx); setEditingCatValue(cat); }}
                                                    className="w-8 h-8 flex items-center justify-center bg-[#2B3139] text-[#848E9C] hover:text-[#FCD535] rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={2} /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteCategory(idx)}
                                                    className="w-8 h-8 flex items-center justify-center bg-[#2B3139] text-[#848E9C] hover:text-[#F6465D] rounded-lg transition-all"
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2} /></svg>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {localCategories.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 border-2 border-dashed border-[#2B3139] rounded-2xl">
                                    <div className="w-12 h-12 bg-[#1E2329] rounded-full flex items-center justify-center text-[#474D57]">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" strokeWidth={2} /></svg>
                                    </div>
                                    <p className="text-[#474D57] text-xs font-black uppercase tracking-widest italic">No categories set up</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Custom Delete Confirmation Modal */}
            {promotionToDelete && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => !isDeleting && setPromotionToDelete(null)}>
                    <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-6 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-full bg-[#F6465D]/10 flex items-center justify-center text-[#F6465D] shrink-0">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase italic tracking-tighter text-[#EAECEF] mb-2">បញ្ជាក់ការលុប</h3>
                                <p className="text-xs font-bold text-[#848E9C] leading-relaxed">តើអ្នកពិតជាចង់លុបប្រូម៉ូសិន <b>"{promotionToDelete.Title}"</b> នេះមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setPromotionToDelete(null)}
                                disabled={isDeleting === promotionToDelete.ID}
                                className="flex-1 px-4 py-3 rounded-xl bg-[#2B3139] text-[#EAECEF] font-black uppercase italic text-[10px] sm:text-xs hover:bg-[#474D57] transition-all disabled:opacity-50"
                            >
                                បោះបង់ (Cancel)
                            </button>
                            <button 
                                onClick={() => handleDelete(promotionToDelete.ID)}
                                disabled={isDeleting === promotionToDelete.ID}
                                className="flex-1 px-4 py-3 rounded-xl bg-[#F6465D] text-white font-black uppercase italic text-[10px] sm:text-xs hover:bg-[#E03A50] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#F6465D]/20"
                            >
                                {isDeleting === promotionToDelete.ID ? <Spinner size="sm" /> : 'យល់ព្រមលុប'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Preview */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-[#181A20] flex flex-col items-center justify-center animate-fade-in"
                    onClick={() => { setPreviewImage(null); setZoomScaleUI(1); }}
                >
                    {/* Close Button */}
                    <button 
                        className="absolute top-6 right-6 w-12 h-12 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-all active:scale-90 z-[120] backdrop-blur-md border border-white/10"
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(null); setZoomScaleUI(1); }}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                    </button>
                    
                    {/* Image Container with High-Performance Zoom & Pan */}
                    <div 
                        ref={imgContainerRef}
                        className="w-full h-full relative flex items-center justify-center overflow-hidden touch-none" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img 
                            ref={imgRef}
                            src={convertGoogleDriveUrl(previewImage)} 
                            alt="Full Preview" 
                            className={`${zoomScaleUI > 1 ? 'cursor-grab' : 'cursor-zoom-in'} w-full h-full max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl animate-scale-in select-none`}
                            draggable={false}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                if (zoomScaleUI === 1 && imgContainerRef.current) (imgContainerRef.current as any)._zoomIn?.(); 
                            }}
                        />
                    </div>

                    {/* Zoom Controls */}
                    <div className="absolute right-6 bottom-32 md:bottom-1/2 md:translate-y-1/2 flex flex-col gap-2 z-[110]">
                        <button onClick={(e) => { e.stopPropagation(); if (imgContainerRef.current) (imgContainerRef.current as any)._zoomIn?.(); }} className="w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white flex items-center justify-center shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2.5} /></svg></button>
                        {zoomScaleUI > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); if (imgContainerRef.current) (imgContainerRef.current as any)._resetZoom?.(); }} className="w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white flex items-center justify-center shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h16M4 20h16M4 12h16" strokeWidth={2} /></svg></button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); if (imgContainerRef.current) (imgContainerRef.current as any)._zoomOut?.(); }} className="w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white flex items-center justify-center shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 12H4" strokeWidth={2.5} /></svg></button>
                    </div>

                    <div className="absolute bottom-8 flex gap-4 animate-fade-in-up z-[110]">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDownload(previewImage, 'promotion.jpg'); }}
                            className="px-6 py-3 bg-[#FCD535] text-[#181A20] rounded-xl font-black uppercase italic text-sm flex items-center gap-2 hover:bg-[#EAB308] transition-all shadow-xl"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth={2.5} /></svg>
                            Download
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleCopyImage(previewImage); }}
                            className="px-6 py-3 bg-[#2B3139] text-[#EAECEF] rounded-xl font-black uppercase italic text-sm flex items-center gap-2 hover:bg-[#474D57] transition-all shadow-xl"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" strokeWidth={2} /></svg>
                            Copy Image
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
