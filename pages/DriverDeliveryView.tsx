import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import Modal from '@/components/common/Modal';
import { compressImage } from '@/utils/imageCompressor';

const DriverDeliveryView: React.FC<{ onOpenDeliveryList?: () => void }> = ({ onOpenDeliveryList }) => {
    const { setMobilePageTitle, refreshData, orders, previewImage: showFullImage, appData } = useContext(AppContext);
    
    // Store Selection State
    const [selectedStore, setSelectedStore] = useState<string>('');

    const [orderIdInput, setOrderIdInput] = useState('');
    const [foundOrder, setFoundOrder] = useState<ParsedOrder | null>(null);
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [rawFile, setRawFile] = useState<File | null>(null);
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
            setRawFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmitDelivery = async () => {
        if (!foundOrder || !previewImage || !rawFile) return;

        setUploading(true);
        try {
            const token = localStorage.getItem('token');
            const compressedBlob = await compressImage(rawFile, 'balanced');
            
            // Convert blob to base64
            const base64Data = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve(base64String);
                };
                reader.readAsDataURL(compressedBlob);
            });

            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    fileData: base64Data,
                    fileName: rawFile.name,
                    mimeType: compressedBlob.type,
                    orderId: foundOrder['Order ID'],
                    targetColumn: 'Delivery Photo URL'
                })
            });
            const uploadResult = await uploadRes.json();
            if (!uploadRes.ok || !uploadResult.url) throw new Error(uploadResult.message || "Upload failed");

            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
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
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 bg-[#0B0E11] font-sans">
                <div className="w-full max-w-md bg-[#181A20] border border-[#2B3139] rounded-sm p-8 shadow-2xl text-center space-y-6">
                    <div className="relative z-10 space-y-2">
                        <div className="w-16 h-16 bg-[#2B3139] rounded-sm mx-auto flex items-center justify-center text-[#FCD535]">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-200 uppercase tracking-tight mt-4">Select Node</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Awaiting Logistics Center Assignment</p>
                    </div>

                    <div className="relative z-10 space-y-2 pt-4 border-t border-[#2B3139]">
                        {availableStores.map(store => (
                            <button
                                key={store}
                                onClick={() => setSelectedStore(store)}
                                className="w-full py-3.5 px-4 bg-[#0B0E11] hover:bg-[#FCD535] group border border-[#2B3139] hover:border-[#FCD535] rounded-sm text-gray-300 hover:text-black font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-between"
                            >
                                <span>{store}</span>
                                <svg className="w-4 h-4 text-gray-600 group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-screen bg-[#0B0E11] p-0 sm:p-4 font-sans text-gray-300 pb-24">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Header / Change Store */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#181A20] border border-[#2B3139] rounded-sm p-4 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#2B3139] flex items-center justify-center rounded-sm text-[#FCD535]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-200 uppercase tracking-tight">LOGISTICS OPS</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-[#0ECB81]"></span>
                                <span className="text-[10px] text-[#0ECB81] uppercase tracking-widest font-bold">NODE: {selectedStore}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {onOpenDeliveryList && (
                            <button 
                                onClick={onOpenDeliveryList}
                                className="flex-1 sm:flex-none px-4 py-2 bg-[#2B3139] hover:bg-gray-700 text-white rounded-sm transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-transparent"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                MANIFEST LIST
                            </button>
                        )}
                        <button 
                            onClick={() => { setSelectedStore(''); setFoundOrder(null); setOrderIdInput(''); }}
                            className="flex-1 sm:flex-none px-4 py-2 bg-[#0B0E11] hover:bg-[#F6465D] hover:text-white text-gray-400 border border-[#2B3139] hover:border-[#F6465D] rounded-sm transition-colors text-[10px] font-bold uppercase tracking-widest text-center"
                        >
                            SWITCH NODE
                        </button>
                    </div>
                </div>

                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-6 shadow-sm">
                    <form onSubmit={handleSearchOrder} className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scan or Enter Tracking ID</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" value={orderIdInput}
                                onChange={(e) => setOrderIdInput(e.target.value)}
                                placeholder="Tracking ID..."
                                className="flex-grow bg-[#0B0E11] border border-[#2B3139] rounded-sm px-4 py-3 text-white font-mono text-sm focus:border-[#FCD535] outline-none transition-colors"
                            />
                            <button 
                                type="submit" disabled={loading}
                                className="bg-[#FCD535] hover:bg-[#FCD535]/90 text-black w-14 h-14 rounded-sm transition-colors flex items-center justify-center font-bold disabled:opacity-50"
                            >
                                {loading ? <Spinner size="sm" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                            </button>
                        </div>
                    </form>
                </div>

                {foundOrder && (
                    <div className="animate-fade-in space-y-4">
                        <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-0 shadow-sm overflow-hidden">
                            {/* Order Header */}
                            <div className="p-5 border-b border-[#2B3139] flex justify-between items-start bg-[#0B0E11]/30">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-lg font-bold text-gray-200 truncate uppercase">{foundOrder['Customer Name']}</h2>
                                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase ${foundOrder['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border border-[#0ECB81]/20' : 'bg-[#F6465D]/10 text-[#F6465D] border border-[#F6465D]/20'}`}>
                                            {foundOrder['Payment Status']}
                                        </span>
                                    </div>
                                    <p className="text-[#FCD535] font-mono font-bold tracking-widest text-xs">{foundOrder['Customer Phone']}</p>
                                </div>
                                <button 
                                    onClick={() => setViewingOrder(foundOrder)}
                                    className="p-2 bg-[#2B3139] hover:bg-gray-700 text-gray-400 hover:text-white rounded-sm transition-colors"
                                    title="View Full Details"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                            </div>

                            {/* Delivery Address & Contents */}
                            <div className="p-5 space-y-5">
                                <div className="flex gap-4">
                                    <div className="w-8 h-8 rounded-sm bg-[#2B3139] flex items-center justify-center text-gray-400 shrink-0">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Destination Address</p>
                                        <p className="text-xs text-gray-300 font-bold leading-relaxed">{foundOrder.Location} <br/><span className="text-gray-500 font-normal">{foundOrder['Address Details']}</span></p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 pt-4 border-t border-[#2B3139]">
                                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                                        <span>Consignment Items</span>
                                        <span>Qty</span>
                                    </div>
                                    {foundOrder.Products.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs">
                                            <span className="text-gray-300 truncate pr-4">{p.name} {p.colorInfo && <span className="text-gray-500 ml-1">({p.colorInfo})</span>}</span>
                                            <span className="text-[#FCD535] font-mono">x{p.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* POD Capture */}
                            <div className="p-5 border-t border-[#2B3139] bg-[#0B0E11]/50">
                                <input 
                                    type="file" accept="image/*" capture="environment" 
                                    ref={fileInputRef} onChange={handleFileChange} className="hidden"
                                />
                                
                                {previewImage ? (
                                    <div className="relative border border-[#2B3139] rounded-sm overflow-hidden bg-black mb-4">
                                        <div className="absolute top-0 left-0 bg-[#0ECB81] text-black px-2 py-1 text-[9px] font-bold uppercase tracking-widest z-10">
                                            PROOF ACQUIRED
                                        </div>
                                        <img src={convertGoogleDriveUrl(previewImage)} className="w-full object-contain max-h-64" alt="POD Preview" />
                                        <button 
                                            onClick={() => setPreviewImage(null)}
                                            className="absolute top-2 right-2 w-8 h-8 bg-[#F6465D] hover:bg-red-700 text-white rounded-sm flex items-center justify-center transition-colors shadow-lg z-10"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-8 border border-dashed border-[#2B3139] rounded-sm flex flex-col items-center justify-center gap-3 hover:border-[#FCD535] hover:bg-[#FCD535]/5 transition-colors mb-4 group"
                                    >
                                        <div className="w-12 h-12 bg-[#2B3139] group-hover:bg-[#FCD535] rounded-sm flex items-center justify-center text-gray-400 group-hover:text-black transition-colors">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Capture Proof of Delivery</p>
                                        </div>
                                    </button>
                                )}

                                <button 
                                    onClick={handleSubmitDelivery}
                                    disabled={!previewImage || uploading || undoTimer !== null}
                                    className={`w-full py-4 rounded-sm font-bold uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2 ${!previewImage || uploading || undoTimer !== null ? 'bg-[#2B3139] text-gray-500 cursor-not-allowed' : 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-black'}`}
                                >
                                    {uploading ? <Spinner size="sm" /> : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Complete Delivery
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Detailed View Modal */}
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-2xl">
                    <div className="p-0 flex flex-col h-full bg-[#181A20] font-sans">
                        <div className="px-5 py-4 flex justify-between items-center border-b border-[#2B3139] bg-[#0B0E11]/30">
                            <div>
                                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">Order Specification</h3>
                                <p className="text-gray-500 font-mono text-[10px] mt-0.5">ID: {viewingOrder['Order ID']}</p>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="p-2 bg-transparent text-gray-500 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto custom-scrollbar space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#0B0E11] p-4 rounded-sm border border-[#2B3139]">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-[#2B3139] pb-2">Customer Profile</p>
                                    <p className="text-gray-200 font-bold text-sm">{viewingOrder['Customer Name']}</p>
                                    <p className="text-[#FCD535] font-mono text-xs mt-1">{viewingOrder['Customer Phone']}</p>
                                    <p className="text-gray-400 text-xs mt-2">{viewingOrder.Location} <br/><span className="text-gray-500">{viewingOrder['Address Details']}</span></p>
                                </div>
                                <div className="bg-[#0B0E11] p-4 rounded-sm border border-[#2B3139]">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-[#2B3139] pb-2">System Routing</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><span className="text-[9px] text-gray-500 uppercase block">Sales Team</span><span className="text-gray-200 font-bold text-xs">{viewingOrder.Team}</span></div>
                                        <div><span className="text-[9px] text-gray-500 uppercase block">Page Source</span><span className="text-gray-200 font-bold text-xs">{viewingOrder.Page}</span></div>
                                        <div><span className="text-[9px] text-gray-500 uppercase block">Agent</span><span className="text-gray-200 font-bold text-xs">{viewingOrder.User}</span></div>
                                        <div><span className="text-[9px] text-gray-500 uppercase block">Origin Node</span><span className="text-[#0ECB81] font-bold text-xs">{viewingOrder['Fulfillment Store']}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#0B0E11] p-4 rounded-sm border border-[#2B3139]">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-[#2B3139] pb-2">Supply Chain Status</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between"><span className="text-[10px] text-gray-500 uppercase">Forwarder</span><span className="text-gray-200 font-bold text-xs">{viewingOrder['Internal Shipping Method']}</span></div>
                                    <div className="flex justify-between"><span className="text-[10px] text-gray-500 uppercase">Payment Channel</span><span className="text-[#FCD535] font-bold text-xs">{viewingOrder['Payment Info'] || viewingOrder['Payment Status']}</span></div>
                                    {viewingOrder['Packed By'] && <div className="flex justify-between"><span className="text-[10px] text-gray-500 uppercase">Packed By</span><span className="text-gray-200 font-bold text-xs">{viewingOrder['Packed By']}</span></div>}
                                    {viewingOrder['Dispatched By'] && <div className="flex justify-between"><span className="text-[10px] text-gray-500 uppercase">Dispatched By</span><span className="text-gray-200 font-bold text-xs">{viewingOrder['Dispatched By']}</span></div>}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-[#2B3139] pb-2">Manifest Items</p>
                                <div className="space-y-2">
                                    {viewingOrder.Products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-[#0B0E11] p-3 rounded-sm border border-[#2B3139]">
                                            <img src={convertGoogleDriveUrl(p.image)} className="w-12 h-12 rounded-sm object-cover border border-[#2B3139]" alt="" />
                                            <div className="flex-grow min-w-0">
                                                <p className="text-gray-200 font-bold text-xs truncate">{p.name}</p>
                                                <p className="text-[10px] text-gray-500">{p.colorInfo}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[#FCD535] font-mono text-xs">x{p.quantity}</p>
                                                <p className="text-gray-500 font-bold text-[9px]">${(p.finalPrice || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Undo Timer Placeholder - Redesigned to sharp borders */}
            {undoTimer !== null && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-[#0B0E11]/80 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-[#181A20] border border-[#FCD535]/50 rounded-sm p-8 w-full max-w-sm shadow-2xl text-center">
                        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center border-4 border-[#2B3139] rounded-sm">
                            <div 
                                className="absolute inset-x-0 bottom-0 bg-[#FCD535]/20 transition-all duration-1000 ease-linear"
                                style={{ height: `${(undoTimer / 3) * 100}%` }}
                            ></div>
                            <span className="text-3xl font-mono text-[#FCD535] z-10">{undoTimer}</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-200 uppercase tracking-widest mb-1">Committing...</h3>
                        <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-6">Saving Proof to Ledger</p>
                        <button 
                            onClick={handleUndoAction}
                            className="w-full py-3 bg-[#2B3139] hover:bg-[#F6465D] text-white hover:text-white border border-transparent hover:border-[#F6465D] rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            ABORT TRANSACTION
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverDeliveryView;
