import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import Modal from '@/components/common/Modal';
import { useOptimisticImage } from '@/hooks/useOptimisticImage';

const bClasses = {
    surface: 'bg-[#1E2329] border border-[#2B3139]',
    input: 'bg-[#0B0E11] border border-[#2B3139] focus:border-[#FCD535] outline-none text-xs px-4 py-3 rounded-[4px] text-[#EAECEF]',
    btnYellow: 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-[#0B0E11] font-bold rounded-[4px] px-4 py-3 transition-all active:scale-[0.98]',
};

const DriverDeliveryView: React.FC<{ onOpenDeliveryList?: () => void }> = ({ onOpenDeliveryList }) => {
    const { refreshData, orders, appData } = useContext(AppContext);
    
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [orderIdInput, setOrderIdInput] = useState('');
    const [foundOrder, setFoundOrder] = useState<ParsedOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [rawFile, setRawFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { prepareImage, startUpload } = useOptimisticImage({
        onUploadSuccess: () => {},
        onUploadError: (id, err) => alert("Execution Failed: " + err)
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const order = orders.find(o => 
            (o['Order ID'].toLowerCase().endsWith(orderIdInput.toLowerCase())) &&
            (o['Fulfillment Store'] || 'Unassigned').toLowerCase() === selectedStore.toLowerCase()
        );
        if (order) setFoundOrder(order);
        else alert("Protocol record not found in this node.");
        setLoading(false);
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRawFile(file);
            const { previewUrl } = await prepareImage(file, 'balanced');
            setPreviewImage(previewUrl);
        }
    };

    const executeDelivery = async () => {
        if (!foundOrder || !rawFile) return;
        const { blob } = await prepareImage(rawFile, 'balanced');
        await startUpload(`delivery_${foundOrder['Order ID']}`, blob, `Delivery_${foundOrder['Order ID']}.jpg`, {
            orderId: foundOrder['Order ID'],
            targetColumn: 'Delivery Photo URL',
            newData: { 'Fulfillment Status': 'Delivered', 'Delivered Time': new Date().toLocaleString('km-KH') }
        });
        setFoundOrder(null); setOrderIdInput(''); setPreviewImage(null); refreshData();
    };

    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#0B0E11] font-sans">
                <div className="w-full max-w-sm space-y-8 text-center">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-[#EAECEF] uppercase tracking-tighter">Futures Terminal</h2>
                        <p className="text-xs text-[#848E9C]">Select outbound logistics node.</p>
                    </div>
                    <div className="space-y-2">
                        {appData.stores?.map((s: any) => (
                            <button key={s.StoreName} onClick={() => setSelectedStore(s.StoreName)} className={`${bClasses.surface} w-full p-5 flex justify-between items-center hover:bg-[#2B3139] transition-all group`}>
                                <span className="text-sm font-bold text-[#EAECEF] uppercase tracking-widest">{s.StoreName}</span>
                                <span className="text-[#FCD535] group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-[#0B0E11] p-6 b-scroll overflow-y-auto font-sans">
            <div className="max-w-md mx-auto space-y-6">
                <div className={`${bClasses.surface} p-4 flex justify-between items-center bg-[#1E2329]/50`}>
                    <div>
                        <h2 className="text-sm font-black text-[#EAECEF] uppercase tracking-tight">Outbound Terminal</h2>
                        <p className="text-[10px] text-[#FCD535] font-bold uppercase mt-1">Node: {selectedStore}</p>
                    </div>
                    <button onClick={() => setSelectedStore('')} className="px-3 py-1.5 bg-[#0B0E11] border border-[#2B3139] text-[9px] font-bold text-[#848E9C] hover:text-[#EAECEF] uppercase rounded-[2px]">Switch Node</button>
                </div>

                <div className={`${bClasses.surface} p-6`}>
                    <form onSubmit={handleSearch} className="space-y-4">
                        <label className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest">Input Protocol ID</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" value={orderIdInput} onChange={e => setOrderIdInput(e.target.value)}
                                placeholder="Tracking ID..." className={`${bClasses.input} flex-1`}
                            />
                            <button type="submit" className={`${bClasses.btnYellow} px-6`}>
                                {loading ? <Spinner size="sm" /> : 'Search'}
                            </button>
                        </div>
                    </form>
                </div>

                {foundOrder && (
                    <div className="animate-in slide-in-from-bottom-2 duration-300 space-y-4">
                        <div className={`${bClasses.surface} overflow-hidden`}>
                            <div className="p-4 bg-[#0B0E11]/30 border-b border-[#2B3139] flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-[#EAECEF]">{foundOrder['Customer Name']}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[11px] font-mono text-[#FCD535] font-bold">{foundOrder['Customer Phone']}</p>
                                        {foundOrder['Customer Phone'] && (
                                            <div className="flex items-center gap-1.5 ml-2">
                                                <a href={`tel:${foundOrder['Customer Phone'].replace(/\s+/g, '')}`} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 p-1.5 rounded-[4px] transition-colors" title="Call Customer" target="_blank" rel="noopener noreferrer">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                </a>
                                                <a href={`https://t.me/+855${foundOrder['Customer Phone'].replace(/\D/g, '').replace(/^0+/, '')}`} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 p-1.5 rounded-[4px] transition-colors" title="Telegram Customer" target="_blank" rel="noopener noreferrer">
                                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-[#848E9C] font-bold uppercase">Margin</p>
                                    <p className="text-xs font-black text-[#0ECB81] font-mono">${(Number(foundOrder['Grand Total']) || 0).toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest">Visual Verification (POD)</label>
                                    <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFile} className="hidden" />
                                    {previewImage ? (
                                        <div className="relative rounded-[4px] overflow-hidden border border-[#FCD535]/30 bg-[#0B0E11]">
                                            <img src={previewImage} className="w-full max-h-64 object-contain" alt="" />
                                            <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-1.5 bg-[#F6465D] text-white rounded-[2px] shadow-lg">✕</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-10 border border-dashed border-[#2B3139] rounded-[4px] flex flex-col items-center gap-3 hover:border-[#FCD535] hover:bg-[#FCD535]/5 transition-all group">
                                            <div className="w-10 h-10 bg-[#0B0E11] border border-[#2B3139] rounded-[4px] flex items-center justify-center text-[#848E9C] group-hover:text-[#FCD535] transition-all">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                                            </div>
                                            <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest">Execute Visual Capture</p>
                                        </button>
                                    )}
                                    <button onClick={executeDelivery} disabled={!previewImage} className={`${bClasses.btnYellow} w-full disabled:bg-[#2B3139] disabled:text-[#848E9C] uppercase text-[11px] tracking-widest`}>
                                        Execute Final Handover
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverDeliveryView;
