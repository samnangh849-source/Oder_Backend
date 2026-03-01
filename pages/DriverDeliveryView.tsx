import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

const DriverDeliveryView: React.FC = () => {
    const { setMobilePageTitle, refreshData, previewImage: showFullImage } = useContext(AppContext);
    const [orderIdInput, setOrderIdInput] = useState('');
    const [foundOrder, setFoundOrder] = useState<ParsedOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMobilePageTitle('DELIVERY PROOF');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle]);

    const handleSearchOrder = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const input = orderIdInput.trim();
        if (!input) return;

        setLoading(true);
        setFoundOrder(null);
        setPreviewImage(null);
        
        try {
            const res = await fetch(`${WEB_APP_URL}/api/admin/all-orders`);
            const result = await res.json();
            if (result.status === 'success') {
                const order = result.data.find((o: any) => 
                    o['Order ID'].toLowerCase() === input.toLowerCase() ||
                    o['Order ID'].toLowerCase().endsWith(input.toLowerCase())
                );
                
                if (order) {
                    let products = [];
                    try { if (order['Products (JSON)']) products = JSON.parse(order['Products (JSON)']); } catch(e) {}
                    setFoundOrder({ ...order, Products: products });
                } else {
                    alert("Order ID not found.");
                }
            }
        } catch (err) {
            alert("Connection error.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitDelivery = async () => {
        if (!foundOrder || !previewImage) return;

        setUploading(true);
        try {
            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: previewImage })
            });
            const uploadResult = await uploadRes.json();
            if (!uploadRes.ok || !uploadResult.url) throw new Error("Upload failed");

            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'AllOrders',
                    primaryKey: { 'Order ID': foundOrder['Order ID'] },
                    newData: { 
                        'Fulfillment Status': 'Delivered',
                        'Delivery Photo URL': uploadResult.url,
                        'Delivered Time': new Date().toLocaleString('km-KH')
                    }
                })
            });

            if (!updateRes.ok) throw new Error("Update failed");

            alert("Delivery confirmed for #" + foundOrder['Order ID'].substring(0,8));
            setFoundOrder(null);
            setOrderIdInput('');
            setPreviewImage(null);
            refreshData();
        } catch (err: any) {
            alert("Failed: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 space-y-6 pb-24 animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2rem] p-6 shadow-2xl">
                <form onSubmit={handleSearchOrder} className="space-y-4">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] ml-1">Drop-off Validation</label>
                    <div className="flex gap-3">
                        <input 
                            type="text" value={orderIdInput}
                            onChange={(e) => setOrderIdInput(e.target.value)}
                            placeholder="Enter Order ID..."
                            className="flex-grow bg-black/40 border-2 border-gray-800 rounded-2xl px-5 py-4 text-white font-mono focus:border-purple-600 outline-none transition-all shadow-inner"
                        />
                        <button 
                            type="submit" disabled={loading}
                            className="bg-purple-600 hover:bg-purple-700 text-white w-16 h-16 rounded-2xl shadow-xl active:scale-90 transition-all flex items-center justify-center border border-white/10"
                        >
                            {loading ? <Spinner size="sm" /> : <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                        </button>
                    </div>
                </form>
            </div>

            {foundOrder && (
                <div className="animate-slide-up space-y-6">
                    <div className="bg-[#1e1b4b]/60 backdrop-blur-xl border border-purple-500/20 rounded-[2.5rem] p-6 shadow-3xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white">{foundOrder['Customer Name']}</h2>
                                <p className="text-purple-400 font-mono font-bold tracking-widest mt-1">{foundOrder['Customer Phone']}</p>
                            </div>
                            <div className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-xl text-[9px] font-black uppercase border border-purple-500/30">
                                {foundOrder.FulfillmentStatus || 'In Transit'}
                            </div>
                        </div>

                        <div className="bg-black/40 rounded-[1.8rem] p-5 border border-white/5 mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                </div>
                                <div className="min-w-0 flex-grow">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Delivery Address</p>
                                    <p className="text-xs text-gray-200 font-bold line-clamp-2 mt-0.5">{foundOrder.Location} - {foundOrder['Address Details']}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3 pt-3 border-t border-white/5">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Package Contents</p>
                                {foundOrder.Products.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-300 font-bold truncate pr-4">{p.name}</span>
                                        <span className="text-purple-400 font-black whitespace-nowrap">x{p.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-5">
                            <input 
                                type="file" accept="image/*" capture="environment" 
                                ref={fileInputRef} onChange={handleFileChange} className="hidden"
                            />
                            
                            {previewImage ? (
                                <div className="relative group animate-reveal">
                                    <div className="w-full aspect-[4/3] rounded-[2rem] overflow-hidden border-4 border-emerald-500/30 shadow-2xl">
                                        <img src={previewImage} className="w-full h-full object-cover" alt="POD Preview" />
                                    </div>
                                    <button 
                                        onClick={() => setPreviewImage(null)}
                                        className="absolute top-4 right-4 w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-16 border-4 border-dashed border-gray-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-5 hover:border-purple-600 hover:bg-purple-600/5 transition-all active:scale-[0.98] group/pod"
                                >
                                    <div className="w-20 h-20 bg-purple-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-purple-900/40 border border-white/10 group-hover/pod:scale-110 group-hover/pod:rotate-6 transition-all duration-500">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-black text-gray-300 uppercase tracking-widest">Capture POD Photo</p>
                                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">Required for delivery confirmation</p>
                                    </div>
                                </button>
                            )}

                            <button 
                                onClick={handleSubmitDelivery}
                                disabled={!previewImage || uploading}
                                className={`w-full py-5 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl flex items-center justify-center gap-3 relative overflow-hidden group ${!previewImage || uploading ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-white/5' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-900/30'}`}
                            >
                                {uploading ? <Spinner size="sm" /> : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        Submit Proof & Complete
                                    </>
                                )}
                                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverDeliveryView;