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
                                    <p className="text-[10px] font-mono text-[#FCD535] mt-0.5">{foundOrder['Customer Phone']}</p>
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
