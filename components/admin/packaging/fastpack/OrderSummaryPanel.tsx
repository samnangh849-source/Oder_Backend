import React, { useRef, useState, useContext } from 'react';
import { ParsedOrder, AppData } from '@/types';
import { convertGoogleDriveUrl, fileToBase64 } from '@/utils/fileUtils';
import { AppContext } from '@/context/AppContext';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import { compressImage } from '@/utils/imageCompressor';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';

type PackStep = 'VERIFYING' | 'LABELING' | 'PHOTO';

interface OrderSummaryPanelProps {
    order: ParsedOrder;
    appData: AppData;
    step: PackStep;
    verifiedItems: Record<string, number>;
    isOrderVerified: boolean;
    verifyItem: (productName: string) => void;
    showFullImage: (url: string) => void;
}

const OrderSummaryPanel: React.FC<OrderSummaryPanelProps> = ({
    order, appData, step, verifiedItems, isOrderVerified, verifyItem, showFullImage
}) => {
    const { refreshData, currentUser } = useContext(AppContext);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingProduct, setEditingProduct] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState<string | null>(null);

    const handleProductImageEdit = async (productName: string, file: File) => {
        if (!file) return;
        setUploadingImage(productName);
        try {
            const compressedBlob = await compressImage(file, 'balanced');
            const base64Data = await fileToBase64(compressedBlob);
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;

            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    fileData: base64Data, 
                    fileName: `Product_${Date.now()}.jpg`, 
                    mimeType: 'image/jpeg',
                    sheetName: 'Products',
                    primaryKey: { 'ProductName': productName },
                    targetColumn: 'ImageURL'
                })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Upload failed');
            
            await refreshData();
        } catch (err: any) { 
            alert('Failed to update product image: ' + err.message); 
        } finally { 
            setUploadingImage(null); 
            setEditingProduct(null);
        }
    };

    const renderStepIndicator = () => {
        const steps: { id: PackStep, label: string, sub: string, icon: React.ReactNode }[] = [
            { id: 'VERIFYING', label: 'VERIFY', sub: 'SCANNING', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
            { id: 'LABELING', label: 'IDENTITY', sub: 'PRINTING', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg> },
            { id: 'PHOTO', label: 'EVIDENCE', sub: 'CAPTURING', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        ];
        const currentIdx = steps.findIndex(st => st.id === step);
        const progressWidth = currentIdx === 0 ? 0 : currentIdx === 1 ? 50 : 100;

        return (
            <div className="mb-16 px-2 relative">
                {/* Holographic Track Background */}
                <div className="absolute top-8 left-10 right-10 h-[1px] bg-white/[0.05]"></div>
                
                {/* Animated Data-Flow Track */}
                <div 
                    className="absolute top-8 left-10 h-[1px] bg-gradient-to-r from-[#FCD535] to-[#0ECB81] transition-all duration-1000 ease-in-out shadow-[0_0_15px_rgba(252,213,53,0.5)]"
                    style={{ width: progressWidth > 0 ? `calc(${progressWidth}% - 20px)` : '0' }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff] animate-ping"></div>
                </div>
                
                <div className="relative flex items-center justify-between">
                    {steps.map((s, idx) => {
                        const isActive = step === s.id;
                        const isPast = currentIdx > idx;
                        
                        return (
                            <div key={s.id} className="flex flex-col items-center relative z-10 w-24">
                                {/* Icon Container with Spinning Protocol */}
                                <div className="relative w-16 h-16 flex items-center justify-center">
                                    {/* Active Pulse Ring */}
                                    {isActive && (
                                        <div className="absolute inset-0 rounded-full border border-[#FCD535]/30 animate-[spin_4s_linear_infinite]">
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#FCD535] rounded-full shadow-[0_0_10px_#FCD535]"></div>
                                        </div>
                                    )}

                                    {/* Glass Orb Body */}
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-700 relative overflow-hidden ${
                                        isPast ? 'bg-[#0ECB81] border-[#0ECB81] text-black shadow-[0_0_20px_rgba(14,203,129,0.3)]'
                                        : isActive ? 'bg-[#1E2329] border-[#FCD535] text-[#FCD535] shadow-[0_0_25px_rgba(252,213,53,0.2)]'
                                        : 'bg-[#0B0E11] border-white/10 text-white/10'
                                    }`}>
                                        {/* Glass Shine */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] to-transparent pointer-events-none"></div>
                                        
                                        {isPast ? (
                                            <svg className="w-6 h-6 animate-in zoom-in duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        ) : (
                                            <span className="relative z-10">{s.icon}</span>
                                        )}
                                    </div>

                                    {/* Step Index Badge */}
                                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border transition-all duration-500 ${
                                        isPast ? 'bg-[#0ECB81] border-[#0ECB81] text-black'
                                        : isActive ? 'bg-[#FCD535] border-[#FCD535] text-black'
                                        : 'bg-[#1E2329] border-white/10 text-white/20'
                                    }`}>
                                        0{idx + 1}
                                    </div>
                                </div>

                                {/* Typography with State coloring */}
                                <div className="mt-4 flex flex-col items-center">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${
                                        isActive ? 'text-white' : isPast ? 'text-[#0ECB81]' : 'text-white/10'
                                    }`}>
                                        {s.label}
                                    </span>
                                    <div className={`h-0.5 w-4 mt-1 rounded-full transition-all duration-500 ${
                                        isActive ? 'bg-[#FCD535] w-8' : isPast ? 'bg-[#0ECB81]/40' : 'bg-white/5'
                                    }`}></div>
                                    <span className={`text-[7px] font-bold uppercase tracking-[0.3em] mt-1.5 transition-all duration-500 ${
                                        isActive ? 'text-[#FCD535]' : 'text-white/5'
                                    }`}>
                                        {s.sub}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderChecklist = () => (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar px-1">
            {order.Products.map((p, i) => {
                const verified = verifiedItems[p.name] || 0;
                const isComplete = verified >= p.quantity;
                const masterP = appData.products?.find(mp => mp.ProductName === p.name);
                
                return (
                    <div key={i} className={`flex flex-col p-5 rounded-2xl border transition-all duration-500 group ${isComplete ? 'bg-[#0ECB81]/5 border-[#0ECB81]/20 shadow-[inset_0_0_20px_rgba(14,203,129,0.03)]' : 'bg-[#181A20] border-white/5 hover:border-white/10 hover:bg-[#1E2329]'}`}>
                        <div className="flex items-start gap-5">
                            <div 
                                className="relative flex-shrink-0 group/img cursor-pointer"
                                onClick={() => {
                                    setEditingProduct(p.name);
                                    fileInputRef.current?.click();
                                }}
                            >
                                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/5 relative">
                                    {p.image ? (
                                        <img src={convertGoogleDriveUrl(p.image)} className={`w-full h-full object-cover transition-all duration-500 ${uploadingImage === p.name ? 'opacity-30 blur-md' : 'group-hover/img:scale-110'}`} alt={p.name} />
                                    ) : (
                                        <div className="w-full h-full bg-[#0B0E11] flex items-center justify-center text-gray-700">
                                            <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        </div>
                                    )}
                                    
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all duration-300 bg-black/60 backdrop-blur-[2px]">
                                        {uploadingImage === p.name ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                                <span className="text-[7px] font-black text-white uppercase tracking-widest">UPDATE</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isComplete && (
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#0ECB81] rounded-xl flex items-center justify-center text-black border-4 border-[#181A20] z-10 shadow-lg">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-grow min-w-0 pt-1">
                                <div className="flex justify-between items-start mb-1">
                                    <p className={`font-black text-[13px] leading-tight uppercase tracking-wide truncate pr-4 ${isComplete ? 'text-[#0ECB81]' : 'text-white group-hover:text-[#FCD535] transition-colors'}`}>{p.name}</p>
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-tighter">REF: {i + 1}</span>
                                </div>
                                
                                {masterP?.Barcode && (
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">SN: {masterP.Barcode}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-4 gap-0.5 mt-2 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                                    <div className="flex flex-col p-2 items-center">
                                        <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest mb-1">BASE</span>
                                        <span className="text-[10px] font-mono text-gray-600 line-through">${(Number(p.cost) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col p-2 items-center border-l border-white/5">
                                        <span className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-1">FINAL</span>
                                        <span className="text-[10px] font-mono text-white/70">${(Number(p.finalPrice) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col p-2 items-center border-l border-white/5 bg-white/[0.02]">
                                        <span className="text-[7px] font-black text-[#FCD535] uppercase tracking-widest mb-1">TOTAL</span>
                                        <span className="text-[11px] font-mono font-bold text-[#FCD535]">${((Number(p.finalPrice) || 0) * (Number(p.quantity) || 1)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col p-2 items-center border-l border-white/5 bg-[#FCD535]/5">
                                        <span className="text-[7px] font-black text-[#FCD535] uppercase tracking-widest mb-1">QTY</span>
                                        <p className="text-sm font-black text-white leading-none mt-0.5">{p.quantity}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/5">
                            <div className="flex-grow h-2 bg-black rounded-full overflow-hidden p-[2px]">
                                <div className={`h-full rounded-full transition-all duration-700 ease-out ${isComplete ? 'bg-[#0ECB81] shadow-[0_0_10px_rgba(14,203,129,0.5)]' : 'bg-[#FCD535] shadow-[0_0_10px_rgba(252,213,53,0.3)]'}`} style={{ width: `${(verified / p.quantity) * 100}%` }}></div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{verified} / {p.quantity} <span className="text-[8px] opacity-50">VERIFIED</span></span>
                                {!isComplete && (
                                    <button 
                                        onClick={() => verifyItem(p.name)} 
                                        className="px-5 py-2 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg"
                                    >
                                        VERIFY
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="w-full xl:w-[45%] flex flex-col border-b xl:border-r border-white/5 bg-[#0B0E11] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FCD535]/[0.02] rounded-full blur-[100px] pointer-events-none"></div>

            <div className="flex-grow p-8 overflow-y-auto custom-scrollbar flex flex-col relative z-10">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-[#FCD535]/10 border border-[#FCD535]/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">PACK TERMINAL</h2>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">PROTOCOL VERSION 4.2.0</p>
                    </div>
                </div>

                {renderStepIndicator()}
                
                <div className="flex-grow flex flex-col">
                    <div className="mb-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1 border-l-2 border-[#FCD535] pl-4 py-1">
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">ORDER ID</span>
                                <span className="text-sm font-mono font-black text-white">{order['Order ID']}</span>
                            </div>
                            <div className="flex flex-col gap-1 border-l-2 border-white/10 pl-4 py-1">
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">TEAM NODE</span>
                                <span className="text-xs font-bold text-white/70 uppercase">{order.Team} / {order['Fulfillment Store'] || 'Central'}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 border-l-2 border-white/10 pl-4">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">COUNTERPARTY</span>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-white/90">{order['Customer Name']}</span>
                                <span className="text-xs font-mono text-[#FCD535]">{order['Customer Phone']}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 border-l-2 border-white/10 pl-4">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">ROUTING</span>
                            <span className="text-xs text-white/80 leading-relaxed font-bold">{order.Location}</span>
                            {order['Address Details'] && <span className="text-[10px] text-white/40 italic leading-snug mt-1">{order['Address Details']}</span>}
                        </div>

                        {order.Note && (
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col gap-1">
                                <span className="text-[8px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    SPECIAL PROTOCOL NOTE
                                </span>
                                <p className="text-[11px] text-red-200/80 leading-tight font-mono">"{order.Note}"</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between mb-6 px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FCD535] animate-pulse"></div>
                            <h4 className="text-[11px] font-black text-white/60 uppercase tracking-[0.3em]">MANIFEST COMPONENTS</h4>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border transition-all duration-500 ${isOrderVerified ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20 shadow-[0_0_15px_rgba(14,203,129,0.1)]' : 'bg-white/5 text-gray-500 border-white/5'}`}>
                            {isOrderVerified ? 'SECURED ✓' : 'LOCKED'}
                        </span>
                    </div>
                    {renderChecklist()}

                    {(() => {
                        const originalSubtotal = order.Products.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.quantity) || 1), 0);
                        const shipping = Number(order['Shipping Fee (Customer)']) || 0;
                        const grandTotal = Number(order['Grand Total']) || 0;
                        const totalDiscount = (originalSubtotal + shipping) - grandTotal;

                        return (
                            <div className="mt-8 p-6 rounded-2xl bg-white/[0.03] border border-white/5 shadow-2xl relative overflow-hidden group shrink-0">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0ECB81]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#0ECB81]/10 transition-colors"></div>
                                
                                <div className="space-y-3 relative z-10">
                                    <div className="flex justify-between items-center text-gray-500">
                                        <span className="text-[10px] uppercase font-black tracking-widest">ORIGINAL VALUE</span>
                                        <span className="text-xs font-mono line-through opacity-50">${originalSubtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-gray-400">
                                        <span className="text-[10px] uppercase font-black tracking-widest">LOGISTICS FEE</span>
                                        <span className="text-xs font-mono">${shipping.toFixed(2)}</span>
                                    </div>
                                    {totalDiscount > 0 && (
                                        <div className="flex justify-between items-center text-[#0ECB81] bg-[#0ECB81]/5 px-3 py-2 rounded-xl border border-[#0ECB81]/10">
                                            <span className="text-[10px] uppercase font-black tracking-widest">OPTIMIZATION SAVE</span>
                                            <span className="text-xs font-mono font-bold">- ${totalDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end mt-6 pt-6 border-t border-white/5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] uppercase font-black text-[#FCD535] tracking-[0.3em]">GRAND SETTLEMENT</span>
                                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">ALL TAXES INCLUDED</span>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-3xl sm:text-4xl font-mono font-black text-[#0ECB81] tracking-tighter drop-shadow-[0_0_15px_rgba(14,203,129,0.4)]">${grandTotal.toFixed(2)}</span>
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="w-1 h-1 rounded-full bg-[#0ECB81] animate-pulse"></div>
                                                <span className="text-[8px] font-black text-[#0ECB81] uppercase tracking-[0.2em]">READY FOR DISPATCH</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
            {/* Hidden Input for Editing Images */}
            <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={(e) => {
                    if (e.target.files && editingProduct) {
                        handleProductImageEdit(editingProduct, e.target.files[0]);
                    }
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }} 
            />
        </div>
    );
};

export default OrderSummaryPanel;
