import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { compressImage } from '@/utils/imageCompressor';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

interface FastPackModalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: () => void;
}

const FastPackModal: React.FC<FastPackModalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser, appData, previewImage: showFullImage } = useContext(AppContext);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [rawFile, setRawFile] = useState<File | null>(null);

    // Look up the label printer URL from the store configuration
    const fulfillmentStore = appData.stores?.find(s => s.StoreName === order?.['Fulfillment Store']);
    const basePrinterURL = fulfillmentStore?.LabelPrinterURL;

    // Construct the full printer URL with parameters like in the backend script
    const getFullPrinterURL = () => {
        if (!basePrinterURL || !order) return '';
        
        // Extract map link using regex if not present
        const fullText = `${order['Address Details'] || ''} ${order.Location || ''} ${order.Note || ''}`;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = fullText.match(urlRegex);
        const mapLink = matches && matches.length > 0 ? matches[0] : '';

        const params = new URLSearchParams({
            id: order['Order ID'],
            name: order['Customer Name'],
            phone: order['Customer Phone'],
            location: order.Location,
            address: order['Address Details'] || '',
            total: String(order['Grand Total']),
            payment: order['Payment Status'] || '',
            shipping: order['Internal Shipping Method'] || '',
            user: order.User,
            page: order.Page,
            store: order['Fulfillment Store'],
            map: mapLink,
            note: order.Note || ''
        });

        return `${basePrinterURL}?${params.toString()}`;
    };

    const fullPrinterURL = getFullPrinterURL();

    const handleCopyName = () => {
        if (!order) return;
        const text = order['Customer Name'];
        navigator.clipboard.writeText(text).then(() => {
            alert('ចម្លងឈ្មោះបានជោគជ័យ: ' + text);
        });
    };

    const handleCopyPhone = () => {
        if (!order) return;
        const text = order['Customer Phone'];
        navigator.clipboard.writeText(text).then(() => {
            alert('ចម្លងលេខទូរស័ព្ទបានជោគជ័យ: ' + text);
        });
    };

    if (!order) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRawFile(file);
            try {
                // Target < 50KB: low quality (0.4) and moderate dimensions (640px)
                const compressedBlob = await compressImage(file, 0.4, 640);
                const reader = new FileReader();
                reader.onloadend = () => setPreviewImage(reader.result as string);
                reader.readAsDataURL(compressedBlob);
            } catch (error) {
                console.error("Compression failed:", error);
                const reader = new FileReader();
                reader.onloadend = () => setPreviewImage(reader.result as string);
                reader.readAsDataURL(file);
            }
        }
    };

    const handleSubmit = async () => {
        if (!previewImage || !rawFile) return;
        setUploading(true);
        try {
            // STEP 1: Upload image
            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fileData: previewImage,
                    fileName: `Package_${order['Order ID']}_${Date.now()}.jpg`,
                    mimeType: rawFile.type || 'image/jpeg',
                    userName: currentUser?.FullName || 'Station Packer'
                })
            });
            const uploadData = await uploadRes.json();
            
            if (uploadData.status !== 'success') {
                throw new Error(uploadData.message || "Upload Failed!");
            }

            const imageUrl = uploadData.url;

            // STEP 2: Update Order
            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order['Order ID'],
                    team: order.Team, 
                    userName: currentUser?.FullName || 'Station Packer',
                    newData: { 
                        'Fulfillment Status': 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Station Packer',
                        'Package Photo URL': imageUrl,
                        'Packed Time': new Date().toLocaleString('km-KH')
                    }
                })
            });

            const updateData = await updateRes.json();
            if (updateData.status !== 'success') {
                 throw new Error(updateData.message || "Order update failed!");
            }
            
            alert(`✅ វេចខ្ចប់ជោគជ័យ និងបានរក្សាទុករូបភាព!`);
            onSuccess();
        } catch (err: any) {
            console.error("Error:", err);
            alert("❌ មានបញ្ហា: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center relative bg-gradient-to-r from-blue-600/20 to-transparent">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Step 2: ព័ត៌មានលម្អិត និងវេចខ្ចប់</h3>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(order['Order ID']).then(() => alert('ចម្លង ID បានជោគជ័យ: ' + order['Order ID']));
                            }}
                            className="text-blue-400 font-mono text-xs mt-1 font-bold hover:text-white transition-colors flex items-center gap-1 group/id"
                            title="ចុចដើម្បីចម្លង ID"
                        >
                            #{order['Order ID'].substring(0, 15)}
                            <svg className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>
                    </div>
                    <button onClick={onClose} disabled={uploading} className="w-10 h-10 bg-black/40 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all disabled:opacity-50 border border-white/5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Side: Order Details */}
                        <div className="space-y-6">
                            {/* Actions */}
                            {fullPrinterURL && (
                                <button 
                                    onClick={() => window.open(fullPrinterURL, '_blank')}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2 border border-white/10"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    បោះពុម្ភវិក្កយបត្រ (Print Label)
                                </button>
                            )}

                            {/* Customer Info */}
                            <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-3 relative group/info">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20 flex-shrink-0">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-white font-black text-sm truncate">{order['Customer Name']}</p>
                                            <button 
                                                onClick={handleCopyName}
                                                className="p-1.5 bg-white/5 hover:bg-blue-600 text-gray-500 hover:text-white rounded-md transition-all border border-white/5 flex-shrink-0"
                                                title="ចម្លងឈ្មោះ"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            <p className="text-blue-400 font-mono text-[11px] font-bold truncate">{order['Customer Phone']}</p>
                                            <button 
                                                onClick={handleCopyPhone}
                                                className="p-1.5 bg-white/5 hover:bg-blue-600 text-gray-500 hover:text-white rounded-md transition-all border border-white/5 flex-shrink-0"
                                                title="ចម្លងលេខទូរស័ព្ទ"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">ទីតាំងដឹកជញ្ជូន</p>
                                    <p className="text-gray-300 text-xs italic leading-relaxed">{order.Location}</p>
                                    {order['Address Details'] && (
                                        <p className="text-gray-400 text-[10px] mt-1 leading-relaxed bg-black/30 p-2 rounded-lg border border-white/5">{order['Address Details']}</p>
                                    )}
                                </div>
                                {order.Note && (
                                    <div className="pt-2 border-t border-white/5">
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">ចំណាំ (Note)</p>
                                        <p className="text-amber-400 text-xs italic leading-relaxed bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">{order.Note}</p>
                                    </div>
                                )}
                            </div>

                            {/* Logistics info */}
                            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-3 shadow-inner">
                                <div className="flex justify-between items-center text-[10px] font-black">
                                    <span className="text-gray-500 uppercase tracking-widest">វិធីសាស្រ្តបង់ប្រាក់</span>
                                    <span className="text-pink-400">{order['Payment Info'] || order['Payment Status'] || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black">
                                    <span className="text-gray-500 uppercase tracking-widest">សេវាដឹកជញ្ជូន</span>
                                    <span className="text-indigo-400">{order['Internal Shipping Method']}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black">
                                    <span className="text-gray-500 uppercase tracking-widest">អ្នកដឹក (Driver)</span>
                                    <span className="text-blue-400">{order['Driver Name'] || order['Internal Shipping Details'] || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-black border-t border-white/5 pt-2">
                                    <span className="text-gray-500 uppercase tracking-widest">សាខាបញ្ចេញឥវ៉ាន់</span>
                                    <span className="text-orange-400">{order['Fulfillment Store']}</span>
                                </div>
                            </div>

                            {/* Items Summary */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">បញ្ជីផលិតផល ({order.Products.length})</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {order.Products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 bg-white/[0.03] rounded-xl border border-white/5">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 border border-gray-800 cursor-pointer" onClick={() => showFullImage(convertGoogleDriveUrl(p.image))}>
                                                <img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <p className="text-[11px] font-bold text-gray-200 truncate leading-tight">{p.name}</p>
                                                <div className="flex justify-between mt-1">
                                                    <span className="text-[10px] text-blue-500 font-black">x{p.quantity}</span>
                                                    {p.colorInfo && <span className="text-[9px] text-purple-500 italic truncate max-w-[80px]">{p.colorInfo}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Photo Capture */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-center md:text-left">រូបភាពបញ្ជាក់ការវេចខ្ចប់</p>
                            
                            <input 
                                type="file" accept="image/*" capture="environment"
                                ref={fileInputRef} onChange={handleFileChange} className="hidden"
                            />
                            
                            {previewImage ? (
                                <div className="relative group rounded-[2rem] overflow-hidden border-2 border-emerald-500/30 shadow-2xl bg-black/40 aspect-[4/3] md:aspect-square cursor-pointer" onClick={() => showFullImage(previewImage)}>
                                    <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                                    {!uploading && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                                            className="absolute top-4 right-4 w-10 h-10 bg-red-600/90 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border border-white/20 hover:bg-red-500 z-10"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 shadow-xl z-10">រូបភាពបានបញ្ចូល - ចុចដើម្បីពង្រីក</div>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-16 md:py-24 border-2 border-dashed border-gray-700 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 hover:border-blue-500 hover:bg-blue-500/5 transition-all active:scale-[0.98] group"
                                >
                                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] border border-white/10 scale-110 group-hover:scale-110 transition-all">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-black text-gray-300 uppercase tracking-widest">ចុចដើម្បីថតរូបកញ្ចប់</p>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Accessing Camera Directly</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 mt-auto bg-[#0f172a] border-t border-white/5 pt-4 flex gap-3">
                    <button 
                        onClick={onClose}
                        disabled={uploading}
                        className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-[0.98] border border-white/5"
                    >
                        បោះបង់ (Cancel)
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={!previewImage || uploading}
                        className={`flex-[2] py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 relative overflow-hidden group
                            ${!previewImage || uploading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'}`}
                    >
                        {uploading ? <Spinner size="sm" /> : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                ខ្ចប់រួចរាល់ & រក្សាទុក (Ready)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FastPackModal;