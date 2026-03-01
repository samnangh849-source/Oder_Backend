import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { compressImage } from '@/utils/imageCompressor';

interface FastPackModalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: () => void;
}

const FastPackModal: React.FC<FastPackModalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser } = useContext(AppContext);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-open file picker when modal opens, if no preview yet
    useEffect(() => {
        if (order && !previewImage && !uploading) {
            // Optional: Automatically trigger file input on open.
            // fileInputRef.current?.click();
        }
    }, [order, previewImage, uploading]);

    if (!order) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressedBlob = await compressImage(file, 0.7, 800);
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
        if (!previewImage) return;
        setUploading(true);
        try {
            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: previewImage })
            });
            const uploadResult = await uploadRes.json();
            if (!uploadRes.ok || !uploadResult.url) throw new Error("Image cloud upload failed");

            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'AllOrders',
                    primaryKey: { 'Order ID': order['Order ID'] },
                    newData: { 
                        'Fulfillment Status': 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Station Packer',
                        'Package Photo URL': uploadResult.url,
                        'Packed Time': new Date().toLocaleString('km-KH')
                    }
                })
            });

            if (!updateRes.ok) throw new Error("Metadata update failed");
            alert(`Order #${order['Order ID'].substring(0,8)} successfully packed!`);
            onSuccess();
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center relative bg-gradient-to-r from-blue-600/20 to-transparent">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Pack Order</h3>
                        <p className="text-blue-400 font-mono text-xs mt-1 font-bold">#{order['Order ID'].substring(0, 10)}</p>
                    </div>
                    <button onClick={onClose} disabled={uploading} className="w-10 h-10 bg-black/40 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all disabled:opacity-50 border border-white/5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow custom-scrollbar">
                    {/* Customer Info */}
                    <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <div>
                            <p className="text-white font-black">{order['Customer Name']}</p>
                            <p className="text-gray-400 text-xs font-bold">{order.Products.length} Items to pack</p>
                        </div>
                    </div>

                    {/* Camera/Photo Area */}
                    <div className="space-y-4">
                        <input 
                            type="file" accept="image/*" capture="environment" 
                            ref={fileInputRef} onChange={handleFileChange} className="hidden"
                        />
                        
                        {previewImage ? (
                            <div className="relative group rounded-[2rem] overflow-hidden border-2 border-emerald-500/30 shadow-2xl bg-black/40 aspect-[4/3]">
                                <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                                {!uploading && (
                                    <button 
                                        onClick={() => setPreviewImage(null)}
                                        className="absolute top-4 right-4 w-10 h-10 bg-red-600/90 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border border-white/20 hover:bg-red-500"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-16 border-2 border-dashed border-gray-700 rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-blue-500/5 transition-all active:scale-[0.98] group"
                            >
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/30 group-hover:scale-110 transition-transform">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-gray-300 uppercase tracking-widest">Take Package Photo</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 font-bold">Tap to open camera</p>
                                </div>
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 mt-auto bg-[#0f172a]">
                    <button 
                        onClick={handleSubmit}
                        disabled={!previewImage || uploading}
                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 relative overflow-hidden group
                            ${!previewImage || uploading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'}`}
                    >
                        {uploading ? <Spinner size="sm" /> : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                Finish & Sync
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FastPackModal;