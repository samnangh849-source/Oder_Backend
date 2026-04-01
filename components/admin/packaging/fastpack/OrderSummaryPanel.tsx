import React, { useRef, useState, useContext } from 'react';
import { ParsedOrder, AppData } from '@/types';
import { convertGoogleDriveUrl, fileToBase64 } from '@/utils/fileUtils';
import { AppContext } from '@/context/AppContext';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import { compressImage } from '@/utils/imageCompressor';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';

type PackStep = 'VERIFYING' | 'LABELING' | 'CAPTURING';

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
    const { refreshData } = useContext(AppContext);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingProduct, setEditingProduct] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState<string | null>(null);

    const handleCopyPhone = () => {
        if (!order['Customer Phone']) return;
        navigator.clipboard.writeText(order['Customer Phone']).then(() => alert('Copied Phone Number'));
    };

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
        const steps: { id: PackStep, label: string, icon: React.ReactNode }[] = [
            { id: 'VERIFYING', label: 'Verify', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
            { id: 'LABELING', label: 'Label', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg> },
            { id: 'CAPTURING', label: 'Capture', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        ];
        const currentIdx = steps.findIndex(st => st.id === step);

        return (
            <div className="mb-6">
                <div className="flex items-center">
                    {steps.map((s, idx) => {
                        const isActive = step === s.id;
                        const isPast = currentIdx > idx;
                        const isLast = idx === steps.length - 1;
                        return (
                            <React.Fragment key={s.id}>
                                {/* Step Node */}
                                <div className="flex flex-col items-center gap-1.5 relative z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                                        isPast ? 'bg-[#0ECB81] border-[#0ECB81] text-white'
                                        : isActive ? 'bg-[#FCD535] border-[#FCD535] text-[#0B0E11] shadow-[0_0_12px_rgba(252,213,53,0.3)]'
                                        : 'bg-[#1E2329] border-[#2B3139] text-[#474D57]'
                                    }`}>
                                        {isPast ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        ) : s.icon}
                                    </div>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${
                                        isActive ? 'text-[#FCD535]' : isPast ? 'text-[#0ECB81]' : 'text-[#474D57]'
                                    }`}>{s.label}</span>
                                </div>
                                {/* Connector Line */}
                                {!isLast && (
                                    <div className="flex-1 h-[2px] mx-2 mb-5 relative overflow-hidden rounded-full bg-[#2B3139]/50">
                                        <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                                            isPast ? 'w-full bg-[#0ECB81] shadow-[0_0_8px_rgba(14,203,129,0.8)]'
                                            : isActive ? 'w-1/2 bg-gradient-to-r from-[#FCD535] to-[#FCD535]/0 shadow-[0_0_8px_rgba(252,213,53,0.5)]'
                                            : 'w-0'
                                        }`} />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderChecklist = () => (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {order.Products.map((p, i) => {
                const verified = verifiedItems[p.name] || 0;
                const isComplete = verified >= p.quantity;
                const masterP = appData.products?.find(mp => mp.ProductName === p.name);
                
                return (
                    <div key={i} className={`flex flex-col p-4 rounded-sm border transition-colors ${isComplete ? 'bg-[#0ECB81]/5 border-[#0ECB81]/30' : 'bg-[#181A20] border-[#2B3139] hover:border-gray-600'}`}>
                        <div className="flex items-start gap-4">
                            <div 
                                className="relative flex-shrink-0 group cursor-pointer"
                                onClick={() => {
                                    setEditingProduct(p.name);
                                    fileInputRef.current?.click();
                                }}
                            >
                                {p.image ? (
                                    <img src={convertGoogleDriveUrl(p.image)} className={`w-14 h-14 md:w-16 md:h-16 rounded-sm object-cover border border-[#2B3139] transition-all ${uploadingImage === p.name ? 'opacity-50 grayscale' : 'group-hover:opacity-70 group-hover:blur-sm'}`} alt={p.name} />
                                ) : (
                                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-sm bg-[#181A20] flex items-center justify-center border border-[#2B3139] transition-all ${uploadingImage === p.name ? 'opacity-50 grayscale' : 'group-hover:opacity-70 group-hover:blur-sm'}`}>
                                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                    </div>
                                )}
                                
                                {/* Edit Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-sm">
                                    {uploadingImage === p.name ? (
                                        <Spinner size="sm" />
                                    ) : (
                                        <svg className="w-5 h-5 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    )}
                                </div>

                                {isComplete && uploadingImage !== p.name && (
                                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#0ECB81] rounded-sm flex items-center justify-center text-black border border-black z-10">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={3}/></svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className={`font-bold text-sm truncate uppercase ${isComplete ? 'text-[#0ECB81]' : 'text-white'}`}>{p.name}</p>
                                {masterP?.Barcode && (
                                    <p className="text-[10px] font-mono text-gray-400 mt-1">SN: {masterP.Barcode}</p>
                                )}
                                <div className="grid grid-cols-4 gap-2 mt-3 bg-[#0B0E11] p-2 rounded-sm border border-[#2B3139]">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Base Px</span>
                                        <span className="text-[10px] sm:text-[11px] font-mono text-gray-500 line-through mt-0.5">${(Number(p.cost) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col border-l border-[#2B3139] pl-2">
                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Final</span>
                                        <span className="text-[10px] sm:text-xs font-mono text-white mt-0.5">${(Number(p.finalPrice) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col border-l border-[#2B3139] pl-2">
                                        <span className="text-[8px] font-bold text-[#FCD535] uppercase tracking-widest">Full Px</span>
                                        <span className="text-xs sm:text-sm font-mono text-[#FCD535] mt-0.5">${((Number(p.finalPrice) || 0) * (Number(p.quantity) || 1)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col items-end border-l border-[#2B3139] pl-2">
                                        <span className="text-[8px] font-bold text-[#0ECB81] uppercase tracking-widest">Qty</span>
                                        <p className="text-lg sm:text-xl font-mono text-white leading-none mt-1">{p.quantity}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#2B3139]">
                            <div className="flex-grow h-1.5 bg-[#0B0E11] rounded-sm overflow-hidden">
                                <div className={`h-full transition-all duration-300 ${isComplete ? 'bg-[#0ECB81]' : 'bg-[#FCD535]'}`} style={{ width: `${(verified / p.quantity) * 100}%` }}></div>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 shrink-0">{verified} / {p.quantity} Valid</span>
                            {!isComplete && (
                                <button onClick={() => verifyItem(p.name)} className="px-4 py-1.5 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black rounded-sm text-[10px] font-bold uppercase transition-colors shrink-0">
                                    Verify
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="w-full xl:w-[45%] flex flex-col border-r border-[#2B3139] bg-[#181A20]">
            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar flex flex-col">
                {renderStepIndicator()}
                
                <div className="flex-grow flex flex-col">
                    <div className="flex items-center justify-between mb-4 mt-2">
                        <h4 className="text-[10px] font-bold text-[#FCD535] uppercase tracking-widest">Component Checklist</h4>
                        <span className={`px-2 py-1 rounded-sm text-[9px] font-bold uppercase tracking-widest border ${isOrderVerified ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20' : 'bg-[#0B0E11] text-gray-500 border-[#2B3139]'}`}>
                            {isOrderVerified ? 'Secured' : 'Lock Pending'}
                        </span>
                    </div>
                    {renderChecklist()}

                    {(() => {
                        const originalSubtotal = order.Products.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.quantity) || 1), 0);
                        const shipping = Number(order['Shipping Fee (Customer)']) || 0;
                        const grandTotal = Number(order['Grand Total']) || 0;
                        const totalDiscount = (originalSubtotal + shipping) - grandTotal;

                        return (
                            <div className="mt-4 p-4 border border-[#2B3139] bg-[#0B0E11] rounded-sm shrink-0">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase font-bold text-gray-400">Original Total</span>
                                    <span className="text-xs font-mono text-gray-500 line-through">${originalSubtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase font-bold text-gray-400">Shipping</span>
                                    <span className="text-xs font-mono text-gray-300">${shipping.toFixed(2)}</span>
                                </div>
                                {totalDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] uppercase font-bold text-[#0ECB81]">Total Savings</span>
                                        <span className="text-xs font-mono text-[#0ECB81]">- ${totalDiscount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#2B3139]">
                                    <span className="text-[10px] uppercase font-bold text-[#FCD535] tracking-widest">Grand Total <span className="text-[9px] text-gray-500 font-normal lowercase tracking-normal ml-1">(Total to Pay)</span></span>
                                    <span className="text-2xl sm:text-3xl font-mono font-black text-[#0ECB81] drop-shadow-[0_0_8px_rgba(14,203,129,0.3)]">${grandTotal.toFixed(2)}</span>
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
