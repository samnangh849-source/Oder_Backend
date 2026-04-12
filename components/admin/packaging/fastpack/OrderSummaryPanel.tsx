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
            { id: 'VERIFYING', label: 'Verify Items', sub: 'Scanning', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
            { id: 'LABELING', label: 'Print Label', sub: 'Identification', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg> },
            { id: 'PHOTO', label: 'Take Photo', sub: 'Evidence', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        ];
        const currentIdx = steps.findIndex(st => st.id === step);
        const progressWidth = currentIdx === 0 ? 0 : currentIdx === 1 ? 50 : 100;

        return (
            <div className="mb-12 px-2 relative">
                {/* Track Background */}
                <div className="absolute top-8 left-10 right-10 h-[2px] bg-white/10 rounded-full"></div>
                
                {/* Progress Track */}
                <div 
                    className="absolute top-8 left-10 h-[2px] bg-[#FCD535] transition-all duration-700 ease-in-out shadow-[0_0_10px_rgba(252,213,53,0.4)]"
                    style={{ width: progressWidth > 0 ? `calc(${progressWidth}% - 20px)` : '0' }}
                ></div>
                
                <div className="relative flex items-center justify-between">
                    {steps.map((s, idx) => {
                        const isActive = step === s.id;
                        const isPast = currentIdx > idx;
                        
                        return (
                            <div key={s.id} className="flex flex-col items-center relative z-10 w-28">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                    isPast ? 'bg-[#0ECB81] border-[#0ECB81] text-black shadow-lg shadow-[#0ECB81]/20'
                                    : isActive ? 'bg-[#1E2329] border-[#FCD535] text-[#FCD535] shadow-lg shadow-[#FCD535]/20'
                                    : 'bg-[#0B0E11] border-white/10 text-white/20'
                                }`}>
                                    {isPast ? (
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <span className="scale-110">{s.icon}</span>
                                    )}
                                </div>

                                <div className="mt-3 flex flex-col items-center text-center">
                                    <span className={`text-sm font-bold transition-all duration-500 ${
                                        isActive ? 'text-white' : isPast ? 'text-[#0ECB81]' : 'text-white/20'
                                    }`}>
                                        {s.label}
                                    </span>
                                    <span className={`text-[11px] font-medium mt-0.5 transition-all duration-500 ${
                                        isActive ? 'text-[#FCD535]' : 'text-white/10'
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
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-3 custom-scrollbar px-1">
            {order.Products.map((p, i) => {
                const verified = verifiedItems[p.name] || 0;
                const isComplete = verified >= p.quantity;
                const masterP = appData.products?.find(mp => mp.ProductName === p.name);
                
                return (
                    <div key={i} className={`flex flex-col p-4 rounded-xl border transition-all duration-300 ${isComplete ? 'bg-[#0ECB81]/5 border-[#0ECB81]/20' : 'bg-[#181A20] border-white/5 hover:border-white/10'}`}>
                        <div className="flex items-start gap-4">
                            <div 
                                className="relative flex-shrink-0 cursor-pointer group/img"
                                onClick={() => {
                                    setEditingProduct(p.name);
                                    fileInputRef.current?.click();
                                }}
                            >
                                <div className="w-20 h-20 rounded-lg overflow-hidden border border-white/10">
                                    {p.image ? (
                                        <img src={convertGoogleDriveUrl(p.image)} className={`w-full h-full object-cover transition-transform ${uploadingImage === p.name ? 'opacity-30 blur-sm' : 'group-hover/img:scale-110'}`} alt={p.name} />
                                    ) : (
                                        <div className="w-full h-full bg-[#0B0E11] flex items-center justify-center text-gray-700">
                                            <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Change</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-grow min-w-0">
                                <p className={`font-bold text-base leading-tight mb-1 ${isComplete ? 'text-[#0ECB81]' : 'text-white'}`}>{p.name}</p>
                                {p.colorInfo && <p className="text-xs text-gray-500 mb-1">{p.colorInfo}</p>}
                                {masterP?.Barcode && (
                                    <p className="text-[11px] font-mono text-gray-500 mb-2">Barcode: {masterP.Barcode}</p>
                                )}

                                <div className="flex items-center gap-4 mt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Price</span>
                                        <span className="text-sm font-mono text-white">${(Number(p.finalPrice) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Qty</span>
                                        <span className="text-sm font-bold text-white">x {p.quantity}</span>
                                    </div>
                                    <div className="flex flex-col ml-auto text-right">
                                        <span className="text-[10px] text-[#FCD535] uppercase font-bold tracking-wider">Total</span>
                                        <span className="text-sm font-bold text-[#FCD535]">${((Number(p.finalPrice) || 0) * (Number(p.quantity) || 1)).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
                            <div className="flex-grow h-3 bg-black/50 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-[#0ECB81]' : 'bg-[#FCD535]'}`} style={{ width: `${(verified / p.quantity) * 100}%` }}></div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-400">{verified} / {p.quantity} <span className="text-[10px] opacity-60">Packed</span></span>
                                {!isComplete && (
                                    <button 
                                        onClick={() => verifyItem(p.name)} 
                                        className="h-10 px-6 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md"
                                    >
                                        Pack Item
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
        <div className="w-full xl:w-[45%] flex flex-col border-b xl:border-r border-white/10 bg-[#0B0E11] relative overflow-hidden">
            <div className="flex-grow p-8 overflow-y-auto custom-scrollbar flex flex-col relative z-10">
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-14 h-14 rounded-2xl bg-[#FCD535]/10 border border-[#FCD535]/20 flex items-center justify-center">
                        <svg className="w-8 h-8 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Pack Terminal</h2>
                        <p className="text-xs font-medium text-gray-500">Fast Fulfillment Mode</p>
                    </div>
                </div>

                {renderStepIndicator()}
                
                <div className="flex-grow flex flex-col">
                    <div className="mb-8 space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Order ID</label>
                                <span className="text-lg font-mono font-bold text-white">#{order['Order ID'].substring(0, 12)}</span>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Team / Store</label>
                                <span className="text-base font-bold text-white/80">{order.Team} — {order['Fulfillment Store'] || 'Central'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Customer</label>
                                <div className="flex flex-col">
                                    <span className="text-base font-bold text-white">{order['Customer Name']}</span>
                                    <span className="text-sm font-mono text-[#FCD535]">{order['Customer Phone']}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Delivery Location</label>
                                <span className="text-sm font-bold text-white/80 line-clamp-2">{order.Location}</span>
                            </div>
                        </div>

                        {order.Note && (
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                <div>
                                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider block mb-0.5">Note from Order</span>
                                    <p className="text-sm text-red-200/90 font-medium italic">"{order.Note}"</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Packing Checklist</h4>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isOrderVerified ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20' : 'bg-white/5 text-gray-500 border-white/5'}`}>
                            {isOrderVerified ? 'All Items Packed' : 'Awaiting Items'}
                        </div>
                    </div>
                    
                    {renderChecklist()}

                    {(() => {
                        const originalSubtotal = order.Products.reduce((sum, p) => sum + (Number(p.cost) || 0) * (Number(p.quantity) || 1), 0);
                        const shipping = Number(order['Shipping Fee (Customer)']) || 0;
                        const grandTotal = Number(order['Grand Total']) || 0;
                        const totalDiscount = (originalSubtotal + shipping) - grandTotal;

                        return (
                            <div className="mt-8 p-6 rounded-2xl bg-[#181A20] border border-white/5 shadow-xl shrink-0">
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between items-center text-gray-500 text-xs">
                                        <span>Subtotal</span>
                                        <span className="font-mono">${originalSubtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-gray-500 text-xs">
                                        <span>Logistics</span>
                                        <span className="font-mono">${shipping.toFixed(2)}</span>
                                    </div>
                                    {totalDiscount > 0 && (
                                        <div className="flex justify-between items-center text-[#0ECB81] text-xs">
                                            <span>Discount</span>
                                            <span className="font-mono">- ${totalDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-[#FCD535] uppercase tracking-wider">Total to Collect</span>
                                        <span className="text-[10px] text-gray-500 font-medium">VAT & Fees included</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-4xl font-mono font-bold text-[#0ECB81] tracking-tighter">${grandTotal.toFixed(2)}</span>
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
