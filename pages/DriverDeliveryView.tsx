import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

const DriverDeliveryView: React.FC = () => {
    const { setMobilePageTitle, refreshData, previewImage: showFullImage, appData } = useContext(AppContext);
    
    // Store Selection State
    const [selectedStore, setSelectedStore] = useState<string>('');

    const [orderIdInput, setOrderIdInput] = useState('');
    const [foundOrder, setFoundOrder] = useState<ParsedOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMobilePageTitle(selectedStore ? `ដឹកជញ្ជូន: ${selectedStore}` : 'ជ្រើសរើសឃ្លាំងដឹកជញ្ជូន');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const availableStores = useMemo(() => {
        const stores = appData.stores ? appData.stores.map((s: any) => s.StoreName) : [];
        return stores;
    }, [appData.stores]);

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
                const order = result.data.find((o: any) => {
                    const idMatch = o['Order ID'].toLowerCase() === input.toLowerCase() || o['Order ID'].toLowerCase().endsWith(input.toLowerCase());
                    if (!idMatch) return false;
                    
                    const orderStore = (o['Fulfillment Store'] || 'Unassigned').toLowerCase();
                    return orderStore === selectedStore.toLowerCase();
                });
                
                if (order) {
                    let products = [];
                    try { if (order['Products (JSON)']) products = JSON.parse(order['Products (JSON)']); } catch(e) {}
                    setFoundOrder({ ...order, Products: products });
                } else {
                    alert("រកមិនឃើញកញ្ចប់ឥវ៉ាន់នេះនៅក្នុងឃ្លាំង " + selectedStore + " ទេ។");
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

            // Broadcast to Chat
            try {
                const id = foundOrder['Order ID'].substring(0,8);
                const chatMsg = `✅ **[DELIVERED]** កញ្ចប់ #${id} (${foundOrder['Customer Name']}) ដឹកជូនអតិថិជនជោគជ័យ!`;
                await fetch(`${WEB_APP_URL}/api/chat/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userName: 'System', type: 'text', content: chatMsg, MessageType: 'text', Content: chatMsg })
                });
            } catch (e) { console.warn("Chat broadcast failed", e); }

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

    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 animate-fade-in">
                <div className="w-full max-w-md bg-[#0f172a]/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 sm:p-10 shadow-3xl text-center space-y-8 relative overflow-hidden">
                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="relative z-10 space-y-4">
                        <div className="w-20 h-20 bg-purple-600/20 rounded-3xl mx-auto flex items-center justify-center border-2 border-purple-500/30 shadow-xl shadow-purple-900/20">
                            <span className="text-4xl">🏬</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter">ជ្រើសរើសឃ្លាំង</h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select Delivery Store</p>
                    </div>

                    <div className="relative z-10 space-y-3">
                        <button
                            onClick={() => setSelectedStore('ALL_STORES')}
                            className="w-full py-4 px-6 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-between group"
                        >
                            <span>គ្រប់ឃ្លាំងទាំងអស់ (ALL STORES)</span>
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>

                        {availableStores.map(store => (
                            <button
                                key={store}
                                onClick={() => setSelectedStore(store)}
                                className="w-full py-4 px-6 bg-gray-900/50 hover:bg-purple-600/20 border border-white/5 hover:border-purple-500/50 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-between group"
                            >
                                <span>{store}</span>
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        ))}

                        <button
                            onClick={() => setSelectedStore('Unassigned')}
                            className="w-full py-4 px-6 bg-gray-800/30 hover:bg-gray-800/50 border border-white/5 rounded-2xl text-gray-400 font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-between group"
                        >
                            <span>មិនទាន់កំណត់ឃ្លាំង (UNASSIGNED)</span>
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md md:max-w-xl min-[1280px]:max-w-2xl min-[1440px]:max-w-3xl min-[1600px]:max-w-4xl min-[1920px]:max-w-5xl mx-auto p-4 space-y-6 pb-24 animate-fade-in">
            {/* Header / Change Store */}
            <div className="flex justify-between items-center bg-[#0f172a]/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-4 sm:p-6 mb-6 shadow-xl">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <span>ដឹកជញ្ជូន</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg border border-purple-500/30">{selectedStore}</span>
                    </h2>
                </div>
                <button 
                    onClick={() => { setSelectedStore(''); setFoundOrder(null); setOrderIdInput(''); }}
                    className="px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    ប្ដូរឃ្លាំង
                </button>
            </div>

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