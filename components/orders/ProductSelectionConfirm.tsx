
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl, fileToBase64 } from '../../utils/fileUtils';
import { compressImage } from '../../utils/imageCompressor';
import Modal from '../common/Modal';
import { AppContext } from '../../context/AppContext';
import { WEB_APP_URL } from '../../constants';
import Spinner from '../common/Spinner';

interface ProductSelectionConfirmProps {
    product: MasterProduct | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (productName: string, tags: string) => void;
    showTagEditor?: boolean;
}

const ProductSelectionConfirm: React.FC<ProductSelectionConfirmProps> = ({
    product,
    isOpen,
    onClose,
    onConfirm,
    showTagEditor = true
}) => {
    const { refreshData } = useContext(AppContext);
    const [localTags, setLocalTags] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [isSavingTags, setIsSavingTags] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (product && isOpen) {
            setLocalTags(product.Tags || '');
            setPreviewUrl(product.ImageURL);
            setUploadSuccess(false);
        }
    }, [product, isOpen]);

    const hasRealImage = useMemo(() => {
        if (!product) return false;
        const currentImg = previewUrl || product.ImageURL;
        return currentImg && !currentImg.includes('placehold.co') && !currentImg.includes('text=N/A');
    }, [product, previewUrl]);

    const tagsArray = useMemo(() => {
        return localTags.split(',').map(t => t.trim()).filter(t => t !== '');
    }, [localTags]);

    const removeTag = (tagToRemove: string) => {
        const newTags = tagsArray.filter(t => t !== tagToRemove).join(', ');
        setLocalTags(newTags);
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.currentTarget;
            const val = input.value.trim();
            if (val) {
                if (!tagsArray.includes(val)) {
                    const newTags = localTags ? `${localTags}, ${val}` : val;
                    setLocalTags(newTags);
                }
                input.value = '';
            }
        }
    };

    const handleFinalConfirm = async () => {
        if (!product) return;
        setIsSavingTags(true);
        try {
            const cleanedTags = tagsArray.join(', ');
            if (cleanedTags !== (product.Tags || '')) {
                const response = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sheetName: 'Products',
                        primaryKey: { 'ProductName': product.ProductName },
                        newData: { 'Tags': cleanedTags }
                    })
                });
                if (!response.ok) throw new Error('Failed');
                await refreshData();
                onConfirm(product.ProductName, cleanedTags);
            } else {
                onConfirm(product.ProductName, cleanedTags);
            }
        } catch (err: any) {
            onConfirm(product.ProductName, localTags);
        } finally {
            setIsSavingTags(false);
        }
    };

    const handleImageUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !product) return;
        setIsUploading(true);
        try {
            const compressedBlob = await compressImage(file, 0.7, 1024);
            const base64Data = await fileToBase64(compressedBlob);
            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileData: base64Data, fileName: file.name, mimeType: compressedBlob.type, orderId: '', targetColumn: '' })
            });
            const result = await uploadRes.json();
            if (result.status === 'success') {
                const newImg = result.url || result.tempUrl;
                await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sheetName: 'Products',
                        primaryKey: { 'ProductName': product.ProductName },
                        newData: { 'ImageURL': newImg }
                    })
                });
                setPreviewUrl(newImg);
                setUploadSuccess(true);
                setTimeout(() => setUploadSuccess(false), 2000);
                await refreshData();
            }
        } catch (err) {} finally {
            setIsUploading(false);
        }
    };

    if (!product) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth={isMobile ? "max-w-[95vw]" : "max-w-5xl"}>
            <div className={`relative flex flex-col w-full bg-[#020617] border border-white/10 overflow-hidden shadow-2xl transition-all duration-500 ${isMobile ? 'h-[90vh] rounded-[2.5rem]' : 'h-[650px] rounded-[3rem] md:flex-row'}`}>
                
                {/* 1. TOP INDICATOR (Z-50) */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600/20 z-50">
                    <div className="h-full bg-blue-500 w-full animate-pulse shadow-[0_0_20px_#3b82f6]"></div>
                </div>

                {/* 2. LEFT SIDE / IMAGE (Z-10) */}
                <div className={`relative flex items-center justify-center bg-black/40 backdrop-blur-xl flex-shrink-0 z-10 ${isMobile ? 'h-[35%] w-full border-b border-white/5' : 'w-[45%] h-full border-r border-white/5'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 pointer-events-none"></div>
                    <div className="relative w-full h-full p-8 flex items-center justify-center cursor-pointer group" onClick={() => !isUploading && fileInputRef.current?.click()}>
                        {hasRealImage ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img 
                                    src={convertGoogleDriveUrl(previewUrl || product.ImageURL)} 
                                    className={`max-w-full max-h-full object-contain rounded-3xl transition-all duration-700 ${isUploading ? 'opacity-20 blur-md scale-90' : 'group-hover:scale-105 drop-shadow-[0_20px_60px_rgba(59,130,246,0.2)]'}`} 
                                    alt="" 
                                />
                                {!isUploading && !uploadSuccess && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/20 backdrop-blur-[2px] z-20 rounded-3xl">
                                        <div className="bg-white/10 px-5 py-2.5 rounded-2xl border border-white/20 backdrop-blur-xl flex items-center gap-3 shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></div>
                                            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Change Media</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-gray-600 group-hover:text-blue-400 transition-all bg-white/5 w-full h-full rounded-[2rem] border-2 border-dashed border-gray-800 group-hover:border-blue-500/30 flex items-center justify-center">
                                <div className="w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center border border-gray-800 shadow-2xl transition-all"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                <span className="text-[11px] font-black uppercase tracking-[0.3em]">Upload Asset</span>
                            </div>
                        )}

                        {isUploading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md z-40 rounded-3xl"><Spinner size="lg" /><span className="text-[10px] font-black text-blue-400 mt-4 uppercase tracking-[0.4em] animate-pulse">Syncing...</span></div>
                        )}

                        {uploadSuccess && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/20 backdrop-blur-md z-40 rounded-3xl animate-fade-in"><div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)] animate-scale-in"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7"/></svg></div><span className="text-[11px] font-black text-emerald-400 mt-4 uppercase tracking-[0.4em]">Media Updated</span></div>
                        )}
                    </div>
                </div>

                {/* 3. RIGHT SIDE / INFO (Z-10) */}
                <div className={`flex flex-col min-w-0 flex-grow z-10 ${isMobile ? 'h-[65%]' : 'w-[55%] h-full'}`}>
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-8 sm:p-14 space-y-10">
                        {/* Header Details */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em]">Operational Review</h3>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-mono font-black text-white/30 bg-white/5 px-3 py-1 rounded-lg border border-white/5 uppercase">{product.Barcode || 'GENERIC'}</span>
                            </div>
                        </div>

                        {/* Title & Valuation */}
                        <div className="space-y-6">
                            <h2 className={`font-black text-white leading-[1.1] tracking-tighter ${isMobile ? 'text-3xl' : 'text-5xl'} line-clamp-3 drop-shadow-sm`}>{product.ProductName}</h2>
                            <div className="grid grid-cols-2 gap-6 bg-white/[0.02] border border-white/5 p-6 rounded-3xl shadow-inner">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2">Market Value</span>
                                    <span className="text-3xl font-black text-emerald-400 tracking-tighter italic drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                                        <span className="text-sm align-top mr-0.5">$</span>{product.Price.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex flex-col border-l border-white/5 pl-6">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2">Internal Cost</span>
                                    <span className="text-xl font-black text-white/30 tracking-tight italic font-mono">${product.Cost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {showTagEditor && (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Classification Indicators</label>
                                    <span className="text-[9px] font-bold text-gray-700 bg-gray-950 px-3 py-1 rounded-full border border-white/5">{tagsArray.length} Active</span>
                                </div>
                                <div className="bg-black/40 border border-white/5 rounded-[2.2rem] p-6 min-h-[140px] flex flex-col gap-6 shadow-inner transition-all hover:bg-black/50 hover:border-white/10">
                                    <div className="flex flex-wrap gap-2.5">
                                        {tagsArray.length > 0 ? tagsArray.map((tag, idx) => (
                                            <div key={idx} className="group/tag flex items-center gap-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 py-2.5 pl-4 pr-2.5 rounded-2xl transition-all animate-fade-in-scale">
                                                <span className="text-[11px] font-black text-blue-400 uppercase tracking-tight">{tag}</span>
                                                <button onClick={() => removeTag(tag)} className="w-6 h-6 rounded-xl hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </div>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center w-full py-2 gap-2"><p className="text-[11px] text-gray-700 font-bold italic">Waiting for classification tags...</p></div>
                                        )}
                                    </div>
                                    <div className="relative group/input border-t border-white/5 pt-5 mt-auto">
                                        <div className="absolute left-0 top-[22px] w-1.5 h-1.5 bg-blue-500 rounded-full scale-0 group-focus-within/input:scale-100 transition-transform"></div>
                                        <input type="text" onKeyDown={handleTagKeyDown} className="w-full bg-transparent pl-4 pr-20 py-2 text-sm font-black text-white focus:outline-none placeholder:text-gray-800 tracking-tight" placeholder="PRESS ENTER TO ASSIGN TAG..." />
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-950 border border-white/5 rounded-xl text-[9px] font-black text-gray-600 opacity-0 group-focus-within/input:opacity-100 transition-all tracking-widest translate-x-4 group-focus-within/input:translate-x-0">RETURN</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. FOOTER (Z-30) */}
                    <div className="relative p-8 sm:p-12 border-t border-white/5 bg-black/20 backdrop-blur-xl flex gap-4 sm:gap-6 mt-auto z-30">
                        <button onClick={onClose} className="px-10 py-5 rounded-[1.8rem] bg-white/5 border border-white/10 text-gray-500 font-black text-[11px] uppercase tracking-[0.25em] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-95 shadow-xl">Cancel</button>
                        <button onClick={handleFinalConfirm} disabled={isSavingTags} className="flex-1 px-10 py-5 rounded-[1.8rem] bg-blue-600 text-white font-black text-[13px] uppercase tracking-[0.3em] hover:bg-blue-500 transition-all active:scale-[0.98] shadow-[0_20px_60px_rgba(37,99,235,0.3)] flex items-center justify-center gap-4 group relative overflow-hidden disabled:opacity-50">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
                            {isSavingTags ? <Spinner size="sm" /> : (
                                <>
                                    <span className="relative z-10">Confirm Selection</span>
                                    <div className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center relative z-10 group-hover:translate-x-1 transition-transform duration-500 shadow-inner"><svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M5 12h14M12 5l7 7-7 7" /></svg></div>
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpdate} />

                <style>{`
                    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
                    .group-hover\\:animate-shimmer { animation: shimmer 1.5s infinite linear; }
                    @keyframes scale-in { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                    .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
                `}</style>
            </div>
        </Modal>
    );
};

export default ProductSelectionConfirm;
