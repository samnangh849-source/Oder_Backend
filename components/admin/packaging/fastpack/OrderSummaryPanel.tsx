import React, { useRef, useState, useContext, useEffect } from 'react';
import { ParsedOrder, AppData } from '@/types';
import { convertGoogleDriveUrl, fileToBase64 } from '@/utils/fileUtils';
import { AppContext } from '@/context/AppContext';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import { compressImage } from '@/utils/imageCompressor';
import { WEB_APP_URL } from '@/constants';
import { translations } from '@/translations';

interface PackingChecklistProps {
    order: ParsedOrder;
    appData: AppData;
    verifiedItems: Record<string, number>;
    verifyItem: (productName: string) => void;
}

const OrderSummaryPanel: React.FC<PackingChecklistProps> = ({
    order, appData, verifiedItems, verifyItem
}) => {
    const { refreshData, language } = useContext(AppContext);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [editingProduct, setEditingProduct] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState<string | null>(null);
    const [manualBarcode, setManualBarcode] = useState('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        inputRef.current?.focus();
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ fileData: base64Data, fileName: `Product_${Date.now()}.jpg`, mimeType: 'image/jpeg', sheetName: 'Products', primaryKey: { 'ProductName': productName }, targetColumn: 'ImageURL' })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Upload failed');
            await refreshData();
        } catch (err: any) { alert('Failed: ' + err.message); } 
        finally { setUploadingImage(null); setEditingProduct(null); }
    };

    const handleManualBarcodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = manualBarcode.trim();
        if (!code) return;
        const product = appData.products?.find(p => p.Barcode === code || p.ProductName === code);
        if (product) {
            const orderItem = order.Products.find(op => op.name === product.ProductName);
            if (orderItem) { verifyItem(orderItem.name); setManualBarcode(''); return; }
        } else {
            const orderItem = order.Products.find(op => op.name === code);
            if (orderItem) { verifyItem(orderItem.name); setManualBarcode(''); return; }
        }
        setManualBarcode('');
    };

    const totalExpected = order.Products.reduce((sum, p) => sum + p.quantity, 0);
    const totalVerified = Object.values(verifiedItems).reduce((sum, v) => sum + v, 0);
    const progressPercent = Math.round((totalVerified / totalExpected) * 100);

    const discountAmount = order['Discount ($)'] || 0;
    const subtotal = order.Subtotal || 0;
    const discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;

    return (
        <div className="h-full flex flex-col gap-5 font-sans text-[#EAECEF] bg-[#181A20]">
            {/* --- Binance Style Header --- */}
            <div className="shrink-0 space-y-4 px-1">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            Checklist <span className="text-sm font-normal text-[#848E9C] px-2 py-0.5 bg-[#2B3139] rounded">SPOT</span>
                        </h2>
                        <span className="text-xs font-medium text-[#848E9C] mt-1">Verification Progress</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={`text-3xl font-bold ${progressPercent === 100 ? 'text-[#02C076]' : 'text-[#FCD535]'}`}>
                            {progressPercent}%
                        </span>
                        <span className="text-xs text-[#848E9C]">Finalizing...</span>
                    </div>
                </div>
                
                {/* Clean Progress Bar */}
                <div className="w-full h-2.5 bg-[#2B3139] rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-700 ease-out ${progressPercent === 100 ? 'bg-[#02C076]' : 'bg-[#FCD535]'}`} 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </div>

            {/* --- Search/Scan Input --- */}
            <div className="shrink-0 px-1">
                <form onSubmit={handleManualBarcodeSubmit} className="relative group">
                    <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        ref={inputRef}
                        type="text"
                        value={manualBarcode}
                        onChange={(e) => setManualBarcode(e.target.value)}
                        placeholder="Search Product / Scan Barcode"
                        className="w-full bg-[#2B3139] border border-transparent py-3 pl-11 pr-4 text-base font-medium text-[#EAECEF] placeholder-[#848E9C] focus:outline-none focus:border-[#FCD535] rounded-md transition-all"
                    />
                </form>
            </div>

            {/* --- Asset/Product List --- */}
            <div className="flex-grow overflow-y-auto custom-scrollbar-terminal space-y-1">
                <div className="flex items-center justify-between px-3 py-2 text-[12px] font-medium text-[#848E9C] border-b border-[#2B3139]">
                    <span>Product Name</span>
                    <span className="text-right">Qty / Status</span>
                </div>
                
                {order.Products.map((p, i) => {
                    const verified = verifiedItems[p.name] || 0;
                    const isComplete = verified >= p.quantity;
                    
                    return (
                        <div key={i} className={`flex items-center gap-4 px-3 py-5 transition-colors ${isComplete ? 'bg-[#1E2329]/30 opacity-60' : 'hover:bg-[#1E2329]'}`}>
                            {/* Product Image like Asset Icon */}
                            <div 
                                className="w-12 h-12 shrink-0 bg-[#2B3139] rounded-full relative overflow-hidden cursor-pointer flex items-center justify-center border border-[#2B3139]"
                                onClick={() => { setEditingProduct(p.name); fileInputRef.current?.click(); }}
                            >
                                {p.image ? (
                                    <img src={convertGoogleDriveUrl(p.image)} className={`w-full h-full object-cover ${isComplete ? 'grayscale' : ''}`} alt="" />
                                ) : (
                                    <span className="text-sm font-bold text-[#848E9C]">{p.name.substring(0, 2).toUpperCase()}</span>
                                )}
                                {isComplete && (
                                    <div className="absolute inset-0 bg-[#02C076]/20 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-[#02C076]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                            </div>

                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-base font-bold text-[#EAECEF] truncate leading-tight">
                                        {p.name}
                                    </h4>
                                    <span className="text-base font-bold text-[#EAECEF]">
                                        {verified} <span className="text-[#848E9C] font-medium">/ {p.quantity}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-[#EAECEF] font-bold">${p.finalPrice.toFixed(2)}</span>
                                            {p.originalPrice > p.finalPrice && (
                                                <span className="text-[12px] text-[#848E9C] line-through">${p.originalPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                        {p.originalPrice > p.finalPrice && (
                                            <span className="text-xs text-[#F6465D] font-bold uppercase mt-0.5">
                                                SAVE ${(p.originalPrice - p.finalPrice).toFixed(2)} ({Math.round((1 - p.finalPrice/p.originalPrice) * 100)}%)
                                            </span>
                                        )}
                                    </div>
                                    <div className={`text-xs font-bold px-2 py-0.5 rounded-sm ${isComplete ? 'text-[#02C076] bg-[#02C076]/10' : 'text-[#FCD535] bg-[#FCD535]/10'}`}>
                                        {isComplete ? 'VERIFIED' : 'PENDING'}
                                    </div>
                                </div>
                            </div>

                            {!isComplete && (
                                <button 
                                    onClick={() => verifyItem(p.name)}
                                    className="w-10 h-10 bg-[#2B3139] hover:bg-[#FCD535] hover:text-black text-[#FCD535] rounded flex items-center justify-center transition-all active:scale-90 shadow-lg"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* --- Settlement Summary like Wallet/Trade Details --- */}
            <div className="shrink-0 bg-[#1E2329] rounded-xl p-6 space-y-4 shadow-xl border border-[#2B3139]">
                <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-[#848E9C]">Total Estimated</span>
                        <span className="text-[#EAECEF] font-bold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-[#848E9C]">Total Discounts</span>
                        <span className="text-[#F6465D] font-bold">-${discountAmount.toFixed(2)} <span className="text-xs ml-1">(-{discountPercent.toFixed(1)}%)</span></span>
                    </div>
                </div>

                {(() => {
                    const shippingFee = Number(order['Shipping Fee (Customer)']) || 0;
                    const hasFee = shippingFee > 0;
                    return (
                        <div className={`border rounded-lg flex justify-between items-center p-3.5 transition-all duration-500 ${
                            hasFee 
                                ? 'bg-[#FCD535] border-[#FCD535] shadow-[0_0_20px_rgba(252,213,53,0.2)]' 
                                : 'bg-[#2B3139]/30 border-white/5'
                        }`}>
                            <span className={`text-[13px] font-black uppercase tracking-widest ${hasFee ? 'text-black' : 'text-[#848E9C]'}`}>
                                Shipping Fee | ថ្លៃសេវាដឹក
                            </span>
                            <div className="flex items-baseline gap-1.5">
                                <span className={`text-2xl font-black ${hasFee ? 'text-black' : 'text-[#EAECEF]'}`}>
                                    ${shippingFee.toFixed(2)}
                                </span>
                                <span className={`text-xs font-bold ${hasFee ? 'text-black/60' : 'text-[#848E9C]'}`}>
                                    USD
                                </span>
                            </div>
                        </div>
                    );
                })()}
                
                <div className="pt-4 border-t border-[#2B3139] flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-[#848E9C] mb-1">Total Settlement</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl font-bold text-[#FCD535] tracking-tight">${(order['Grand Total'] || 0).toFixed(2)}</span>
                            <span className="text-sm font-medium text-[#848E9C]">USD</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="px-2.5 py-1 bg-[#2B3139] rounded text-xs font-bold text-[#EAECEF] flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#02C076]"></div>
                            Fulfillment Ready
                        </div>
                        <span className="text-xs text-[#848E9C] font-mono uppercase tracking-tighter">REF: {order['Order ID']?.substring(0, 12)}</span>
                    </div>
                </div>
            </div>

            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => { if (e.target.files && editingProduct) handleProductImageEdit(editingProduct, e.target.files[0]); if (fileInputRef.current) fileInputRef.current.value = ''; }} />

            <style>{`
                .custom-scrollbar-terminal::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar-terminal::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-terminal::-webkit-scrollbar-thumb { background: #2B3139; border-radius: 10px; }
                .custom-scrollbar-terminal::-webkit-scrollbar-thumb:hover { background: #FCD535; }
            `}</style>
        </div>
    );
};

export default OrderSummaryPanel;
