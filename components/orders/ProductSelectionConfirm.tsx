
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
            const compressedBlob = await compressImage(file, 'balanced');
            const base64Data = await fileToBase64(compressedBlob);
            const token = localStorage.getItem('token');
            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    fileData: base64Data, 
                    fileName: file.name, 
                    mimeType: compressedBlob.type, 
                    sheetName: 'Products',
                    primaryKey: { 'ProductName': product.ProductName },
                    targetColumn: 'Image URL'
                })
            });
            const result = await uploadRes.json();
            if (result.status === 'success') {
                const newImg = result.url;
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
            <div className={`relative flex flex-col w-full bg-[#1E2329] border-2 border-[#FCD535] overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,0.4)] transition-all duration-500 ${isMobile ? 'h-[90vh] rounded-none' : 'h-[650px] rounded-none md:flex-row'}`}>
                
                {/* 1. TOP INDICATOR (Z-50) */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#FCD535]/20 z-50">
                    <div className="h-full bg-[#FCD535] w-full animate-pulse shadow-[0_0_15px_#FCD535]"></div>
                </div>

                {/* 2. LEFT SIDE / IMAGE (Z-10) */}
                <div className={`relative flex items-center justify-center bg-[#0B0E11] flex-shrink-0 z-10 ${isMobile ? 'h-[35%] w-full border-b-2 border-[#2B3139]' : 'w-[45%] h-full border-r-2 border-[#2B3139]'}`}>
                    <div className="relative w-full h-full p-8 flex items-center justify-center cursor-pointer group" onClick={() => !isUploading && fileInputRef.current?.click()}>
                        {hasRealImage ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img 
                                    src={convertGoogleDriveUrl(previewUrl || product.ImageURL)} 
                                    className={`max-w-full max-h-full object-contain rounded-none border-2 border-[#2B3139] transition-all duration-500 ${isUploading ? 'opacity-20 blur-md scale-95' : 'group-hover:border-[#FCD535] group-hover:scale-[1.02]'}`} 
                                    alt="" 
                                />
                                {!isUploading && !uploadSuccess && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#FCD535]/5 backdrop-blur-[1px] z-20">
                                        <div className="bg-[#FCD535] px-5 py-2.5 rounded-none border-2 border-[#181A20] flex items-center gap-3 shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                            <div className="w-8 h-8 bg-[#181A20] rounded-none flex items-center justify-center shadow-lg"><svg className="w-4 h-4 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></div>
                                            <span className="text-[11px] font-black text-[#181A20] uppercase tracking-widest">Update Media</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-[#474D57] group-hover:text-[#FCD535] transition-all bg-[#1E2329]/50 w-full h-full rounded-none border-2 border-dashed border-[#2B3139] group-hover:border-[#FCD535]/50 flex items-center justify-center">
                                <div className="w-20 h-20 rounded-none bg-[#0B0E11] flex items-center justify-center border-2 border-[#2B3139] shadow-2xl transition-all group-hover:border-[#FCD535]"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                <span className="text-[11px] font-black uppercase tracking-[0.3em]">No Asset Detected</span>
                            </div>
                        )}

                        {isUploading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#181A20]/80 z-40 rounded-none"><Spinner size="lg" /><span className="text-[10px] font-black text-[#FCD535] mt-4 uppercase tracking-[0.4em] animate-pulse">Syncing...</span></div>
                        )}

                        {uploadSuccess && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0ECB81]/20 backdrop-blur-md z-40 rounded-none animate-fade-in"><div className="w-20 h-20 bg-[#0ECB81] text-white rounded-none flex items-center justify-center shadow-[0_0_50px_rgba(14,203,129,0.4)] animate-scale-in"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7"/></svg></div><span className="text-[11px] font-black text-[#0ECB81] mt-4 uppercase tracking-[0.4em]">Sync Successful</span></div>
                        )}
                    </div>
                </div>

                {/* 3. RIGHT SIDE / INFO (Z-10) */}
                <div className={`flex flex-col min-w-0 flex-grow z-10 bg-[#1E2329] ${isMobile ? 'h-[65%]' : 'w-[55%] h-full'}`}>
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-8 sm:p-12 space-y-8">
                        {/* Header Details */}
                        <div className="flex items-center justify-between border-b-2 border-[#2B3139] pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-6 bg-[#FCD535]"></div>
                                <h3 className="text-[12px] font-black text-[#FCD535] uppercase tracking-[0.2em]">Operational Review</h3>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-mono font-black text-[#848E9C] bg-[#0B0E11] px-3 py-1 rounded-none border border-[#2B3139] uppercase tracking-tighter">{product.Barcode || 'GENERIC-ID'}</span>
                            </div>
                        </div>

                        {/* Title & Valuation */}
                        <div className="space-y-6">
                            <h2 className={`font-black text-[#EAECEF] leading-[1.1] tracking-tighter ${isMobile ? 'text-2xl' : 'text-4xl'} line-clamp-3 uppercase`}>{product.ProductName}</h2>
                            <div className="grid grid-cols-2 gap-0 bg-[#0B0E11] border-2 border-[#2B3139] shadow-inner">
                                <div className="flex flex-col p-6 border-r-2 border-[#2B3139]">
                                    <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest mb-2">Market Valuation</span>
                                    <span className="text-4xl font-black text-[#FCD535] tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(252,213,53,0.2)]">
                                        <span className="text-xl align-top mr-1 font-bold">$</span>{product.Price.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex flex-col p-6 bg-[#181A20]/50">
                                    <span className="text-[10px] font-black text-[#474D57] uppercase tracking-widest mb-2">Internal Cost</span>
                                    <span className="text-2xl font-black text-[#474D57] tracking-tight font-mono tabular-nums">${product.Cost.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {showTagEditor && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Classification Indicators</label>
                                    <span className="text-[9px] font-black text-[#181A20] bg-[#FCD535] px-3 py-0.5 rounded-none uppercase tracking-widest">{tagsArray.length} Active</span>
                                </div>
                                <div className="bg-[#0B0E11] border-2 border-[#2B3139] rounded-none p-5 min-h-[160px] flex flex-col gap-5 shadow-inner group/tags-box focus-within:border-[#FCD535]/50 transition-all">
                                    <div className="flex flex-wrap gap-2.5">
                                        {tagsArray.length > 0 ? tagsArray.map((tag, idx) => (
                                            <div key={idx} className="group/tag flex items-center gap-2.5 bg-[#FCD535]/10 hover:bg-[#FCD535]/20 border border-[#FCD535]/30 py-2 pl-3.5 pr-1.5 rounded-none transition-all animate-fade-in-scale">
                                                <span className="text-[11px] font-black text-[#FCD535] uppercase tracking-tight">{tag}</span>
                                                <button onClick={() => removeTag(tag)} className="w-7 h-7 rounded-none hover:bg-[#F6465D] text-[#848E9C] hover:text-white transition-all flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </div>
                                        )) : (
                                            <div className="flex flex-col items-center justify-center w-full py-4 gap-2"><p className="text-[11px] text-[#474D57] font-black uppercase tracking-widest italic opacity-60">No classification indicators assigned</p></div>
                                        )}
                                    </div>
                                    <div className="relative group/input border-t border-[#2B3139] pt-4 mt-auto">
                                        <input 
                                            type="text" 
                                            onKeyDown={handleTagKeyDown} 
                                            className="w-full bg-transparent pl-0 pr-20 py-2 text-sm font-black text-[#EAECEF] focus:outline-none placeholder:text-[#2B3139] tracking-tight uppercase" 
                                            placeholder="TYPE TAG AND PRESS ENTER..." 
                                        />
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#2B3139] border border-[#363C44] rounded-none text-[9px] font-black text-[#848E9C] opacity-40 group-focus-within/input:opacity-100 transition-all tracking-[0.2em]">RETURN</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. FOOTER (Z-30) */}
                    <div className="relative p-8 sm:p-10 border-t-2 border-[#2B3139] bg-[#181A20] flex gap-4 sm:gap-6 mt-auto z-30">
                        <button onClick={onClose} className="px-8 py-4 rounded-none bg-[#2B3139] border-2 border-transparent text-[#848E9C] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-[#F6465D]/10 hover:text-[#F6465D] hover:border-[#F6465D]/20 transition-all active:translate-y-[2px]">Discard</button>
                        <button onClick={handleFinalConfirm} disabled={isSavingTags} className="flex-1 px-10 py-4 rounded-none bg-[#FCD535] text-[#181A20] font-black text-[12px] uppercase tracking-[0.3em] hover:bg-[#F0B90B] transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[6px_6px_0px_0px_rgba(252,213,53,0.2)] active:shadow-none flex items-center justify-center gap-4 group disabled:opacity-50 border-2 border-[#FCD535]">
                            {isSavingTags ? <Spinner size="sm" /> : (
                                <>
                                    <span className="relative z-10">Confirm Allocation</span>
                                    <div className="w-7 h-7 bg-[#181A20] rounded-none flex items-center justify-center relative z-10 group-hover:translate-x-1 transition-transform duration-300 shadow-lg"><svg className="w-4 h-4 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 12h14M12 5l7 7-7 7" /></svg></div>
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
