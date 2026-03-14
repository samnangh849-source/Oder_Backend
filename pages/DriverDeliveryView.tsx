import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import Modal from '@/components/common/Modal';

const DriverDeliveryView: React.FC<{ onOpenDeliveryList?: () => void }> = ({ onOpenDeliveryList }) => {
    const { setMobilePageTitle, refreshData, orders, previewImage: showFullImage, appData, previewImage: globalPreview } = useContext(AppContext);
    
    // Store Selection State
    const [selectedStore, setSelectedStore] = useState<string>('');

    const [orderIdInput, setOrderIdInput] = useState('');
    const [foundOrder, setFoundOrder] = useState<ParsedOrder | null>(null);
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Grace Period State
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);

    useEffect(() => {
        setMobilePageTitle(selectedStore ? `ដឹកជញ្ជូន: ${selectedStore}` : 'ជ្រើសរើសឃ្លាំងដឹកជញ្ជូន');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const handleUndoAction = () => {
        setIsUndoing(true);
        setTimeout(() => {
            setUndoTimer(null);
            setIsUndoing(false);
        }, 500);
    };

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
            const order = orders.find((o: any) => {
                const idMatch = o['Order ID'].toLowerCase() === input.toLowerCase() || o['Order ID'].toLowerCase().endsWith(input.toLowerCase());
                if (!idMatch) return false;
                
                const orderStore = (o['Fulfillment Store'] || 'Unassigned').toLowerCase();
                return orderStore === selectedStore.toLowerCase();
            });
            
            if (order) {
                setFoundOrder(order);
            } else {
                alert("រកមិនឃើញកញ្ចប់ឥវ៉ាន់នេះនៅក្នុងឃ្លាំង " + selectedStore + " ទេ។");
            }
        } catch (err) {
            alert("Search error.");
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
                    body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: chatMsg })
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
                        {availableStores.map(store => (
                            <button
                                key={store}
                                onClick={() => setSelectedStore(store)}
                                className="w-full py-4 px-6 bg-gray-900/50 hover:bg-purple-600/20 border border-white/5 hover:border-blue-500/50 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-between group"
                            >
                                <span>{store}</span>
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        ))}
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
                <div className="flex items-center gap-2">
                    {onOpenDeliveryList && (
                        <button 
                            onClick={onOpenDeliveryList}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-400/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            Delivery List
                        </button>
                    )}
                    <button 
                        onClick={() => { setSelectedStore(''); setFoundOrder(null); setOrderIdInput(''); }}
                        className="px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        ប្ដូរឃ្លាំង
                    </button>
                </div>
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
                            <div className="min-w-0">
                                <h2 className="text-2xl font-black text-white truncate">{foundOrder['Customer Name']}</h2>
                                <p className="text-purple-400 font-mono font-bold tracking-widest mt-1">{foundOrder['Customer Phone']}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className="px-3 py-1 bg-purple-600 text-white text-xs font-black uppercase rounded-lg shadow-lg shadow-purple-900/30 tracking-wider">Team: {foundOrder.Team}</span>
                                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase rounded-lg border border-indigo-500/20 tracking-wider">Page: {foundOrder.Page}</span>
                                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-500/20 tracking-wider">User: {foundOrder.User}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-xl text-[9px] font-black uppercase border border-purple-500/30">
                                    {foundOrder.FulfillmentStatus || 'In Transit'}
                                </div>
                                <button 
                                    onClick={() => setViewingOrder(foundOrder)}
                                    className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5"
                                    title="View Full Details"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
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
                                        <img src={convertGoogleDriveUrl(previewImage)} className="w-full h-full object-cover" alt="POD Preview" />
                                    </div>
                                    <button 
                                        onClick={() => setPreviewImage(null)}
                                        className="absolute top-4 right-4 w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
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
                                disabled={!previewImage || uploading || undoTimer !== null}
                                className={`w-full py-5 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.25em] transition-all shadow-2xl flex items-center justify-center gap-3 relative overflow-hidden group ${!previewImage || uploading || undoTimer !== null ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-white/5' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-900/30'}`}
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

            {/* Detailed View Modal */}
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-3xl">
                    <div className="p-6 sm:p-10 bg-[#0f172a] rounded-[2.5rem] border border-white/10 shadow-3xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30 text-blue-400">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">ព័ត៌មានលម្អិត</h3>
                                    <p className="text-blue-400 font-mono text-sm font-bold mt-1">ID: #{viewingOrder['Order ID']}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="w-12 h-12 rounded-2xl bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/5">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-8 pr-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-black/20 p-5 rounded-3xl border border-white/5">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Customer Info</p>
                                    <p className="text-white font-black text-lg">{viewingOrder['Customer Name']}</p>
                                    <p className="text-blue-400 font-mono font-bold text-base">{viewingOrder['Customer Phone']}</p>
                                    <p className="text-gray-400 text-sm mt-2">{viewingOrder.Location} - {viewingOrder['Address Details']}</p>
                                </div>
                                <div className="bg-blue-600/5 p-5 rounded-3xl border border-blue-500/10">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">System Context</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><span className="text-[9px] text-gray-500 font-bold uppercase block">Team</span><span className="text-white font-black text-sm">{viewingOrder.Team}</span></div>
                                        <div><span className="text-[9px] text-gray-500 font-bold uppercase block">Page</span><span className="text-white font-black text-xs">{viewingOrder.Page}</span></div>
                                        <div><span className="text-[9px] text-gray-500 font-bold uppercase block">User</span><span className="text-white font-black text-xs">{viewingOrder.User}</span></div>
                                        <div><span className="text-[9px] text-gray-500 font-bold uppercase block">Store</span><span className="text-orange-400 font-black text-xs">{viewingOrder['Fulfillment Store']}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/20 p-5 rounded-3xl border border-white/5">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Logistics</p>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-bold uppercase">Shipping</span><span className="text-indigo-400 font-black text-xs">{viewingOrder['Internal Shipping Method']}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-bold uppercase">Payment</span><span className="text-amber-400 font-black text-xs">{viewingOrder['Payment Info'] || viewingOrder['Payment Status']}</span></div>
                                    {viewingOrder['Packed By'] && <div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-bold uppercase">Packed By</span><span className="text-indigo-400 font-black text-xs">{viewingOrder['Packed By']}</span></div>}
                                    {viewingOrder['Dispatched By'] && <div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-bold uppercase">Dispatched By</span><span className="text-orange-400 font-black text-xs">{viewingOrder['Dispatched By']}</span></div>}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3"><div className="h-px flex-grow bg-gray-800"></div><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Products</span><div className="h-px flex-grow bg-gray-800"></div></div>
                                <div className="space-y-3">
                                    {viewingOrder.Products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                                            <img src={convertGoogleDriveUrl(p.image)} className="w-14 h-14 rounded-xl object-cover border border-white/10" alt="" />
                                            <div className="flex-grow min-w-0">
                                                <p className="text-white font-black text-sm truncate">{p.name}</p>
                                                <p className="text-[10px] text-purple-400 font-bold">{p.colorInfo}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-blue-400 font-black text-sm">x{p.quantity}</p>
                                                <p className="text-gray-500 font-bold text-[10px]">${(p.finalPrice || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                            <button onClick={() => setViewingOrder(null)} className="px-10 py-4 bg-gray-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">បិទ</button>
                        </div>
                    </div>
                </Modal>
            )}

            {undoTimer !== null && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all duration-500">
                    <div className="relative bg-[#0f172a]/90 border border-white/10 rounded-[2.5rem] p-8 sm:p-12 w-full max-w-sm shadow-[0_20px_70px_rgba(0,0,0,0.5)] text-center overflow-hidden ring-1 ring-white/10">
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/20 blur-[80px] rounded-full pointer-events-none"></div>
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 blur-[80px] rounded-full pointer-events-none"></div>
                        <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" className="stroke-gray-800 fill-none" strokeWidth="6" />
                                <circle 
                                    cx="50" cy="50" r="45" 
                                    className="stroke-purple-500 fill-none transition-all duration-1000 ease-linear" 
                                    strokeWidth="6" 
                                    strokeDasharray="282.7" 
                                    strokeDashoffset={282.7 - (282.7 * (undoTimer / 3))} 
                                    strokeLinecap="round" 
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl font-black text-white">{undoTimer}</span>
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">កំពុងរក្សាទុក...</h3>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Saving Proof</p>
                        <button 
                            onClick={handleUndoAction}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-red-900/30 transition-all active:scale-95 flex items-center justify-center gap-3 group"
                        >
                            <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            UNDO (បោះបង់)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverDeliveryView;
