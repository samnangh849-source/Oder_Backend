import React, { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { compressImage } from '@/utils/imageCompressor';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { useSmartZoom } from '@/hooks/useSmartZoom';
import { packageDetector, DetectionResult } from '@/utils/visionAlgorithm';

interface FastPackModalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: () => void;
}

const FastPackModal: React.FC<FastPackModalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser, appData, previewImage: showFullImage } = useContext(AppContext);
    const [uploading, setUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    
    // AI & Smart Features State
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [detection, setDetection] = useState<DetectionResult | null>(null);
    const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
    const [countdown, setCountdown] = useState<number | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const aiLoopRef = useRef<number | null>(null);
    const lastActionTime = useRef<number>(0);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const { zoom, applyZoom } = useSmartZoom();
    const [rawFile, setRawFile] = useState<File | null>(null);

    const stopCamera = useCallback(() => {
        if (aiLoopRef.current) cancelAnimationFrame(aiLoopRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
        setDetection(null);
        setAutoCaptureProgress(0);
        setCountdown(null);
    }, []);

    const capturePhoto = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || uploading) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            const response = await fetch(imageData);
            const blob = await response.blob();
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            
            const compressedBlob = await compressImage(file, 0.4, 640);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
                setRawFile(file);
                stopCamera();
            };
            reader.readAsDataURL(compressedBlob);
        }
    }, [stopCamera, uploading]);

    const handleSubmit = useCallback(async () => {
        if (!previewImage || !rawFile) return;
        setUploading(true);
        try {
            const uploadRes = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fileData: previewImage,
                    fileName: `Package_${order!['Order ID']}_${Date.now()}.jpg`,
                    mimeType: rawFile.type || 'image/jpeg',
                    userName: currentUser?.FullName || 'Station Packer'
                })
            });
            const uploadData = await uploadRes.json();
            if (uploadData.status !== 'success') throw new Error("Upload Failed!");

            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order!['Order ID'],
                    team: order!.Team, 
                    userName: currentUser?.FullName || 'Station Packer',
                    newData: { 
                        'Fulfillment Status': 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Station Packer',
                        'Package Photo URL': uploadData.url,
                        'Packed Time': new Date().toLocaleString('km-KH')
                    }
                })
            });

            const updateData = await updateRes.json();
            if (updateData.status !== 'success') throw new Error("Order update failed!");
            
            // Broadcast to Chat
            try {
                const id = order!['Order ID'].substring(0,8);
                const chatMsg = `📦 **[PACKED]** កញ្ចប់ #${id} (${order!['Customer Name']}) វេចខ្ចប់រួចរាល់ដោយ **${currentUser?.FullName || 'Station Packer'}**`;
                await fetch(`${WEB_APP_URL}/api/chat/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userName: 'System', type: 'text', content: chatMsg, MessageType: 'text', Content: chatMsg })
                });
            } catch (e) { console.warn("Chat broadcast failed", e); }

            alert(`✅ វេចខ្ចប់ជោគជ័យ និងបានរក្សាទុករូបភាព!`);
            onSuccess();
        } catch (err: any) {
            alert("❌ មានបញ្ហា: " + err.message);
        } finally {
            setUploading(false);
        }
    }, [previewImage, rawFile, order, currentUser, onSuccess]);

    const startCountdown = useCallback(() => {
        if (countdown !== null) return;
        setCountdown(3);
        
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        
        let count = 3;
        countdownIntervalRef.current = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                setCountdown(null);
                capturePhoto();
            }
        }, 1000);
    }, [countdown, capturePhoto]);

    // AI Processing Loop
    const runAiLoop = useCallback(async () => {
        if (!videoRef.current || !isCameraActive || previewImage) return;

        const result = await packageDetector.detect(videoRef.current);
        setDetection(result);

        if (isAiEnabled) {
            // 1. Gesture: Five Fingers (Countdown to Capture)
            if (result.gesture === 'five_fingers' && countdown === null) {
                startCountdown();
            }
            
            // 2. Gesture: Thumbs Up (Auto Submit - only if image is already captured)
            if (result.gesture === 'thumbs_up' && previewImage && !uploading) {
                handleSubmit();
            }

            // 3. Smart Auto Zoom
            if (result.found && result.box) {
                const track = (videoRef.current.srcObject as MediaStream)?.getVideoTracks()[0];
                if (track && Date.now() - lastActionTime.current > 1500) {
                    const area = (result.box.w * result.box.h) / (videoRef.current.videoWidth * videoRef.current.videoHeight);
                    if (area < 0.12) applyZoom(track, zoom + 0.5);
                    else if (area > 0.5) applyZoom(track, zoom - 0.5);
                    lastActionTime.current = Date.now();
                }

                // 4. Auto Capture Progress (If NO Gesture Active and stable)
                if (countdown === null && result.stability > 0.9 && !previewImage) {
                    setAutoCaptureProgress(prev => {
                        const next = prev + 1.5;
                        if (next >= 100) {
                            capturePhoto();
                            return 0;
                        }
                        return next;
                    });
                } else {
                    setAutoCaptureProgress(0);
                }
            } else {
                setAutoCaptureProgress(0);
            }
        } else {
            setAutoCaptureProgress(0);
        }

        aiLoopRef.current = requestAnimationFrame(runAiLoop);
    }, [isCameraActive, isAiEnabled, previewImage, zoom, applyZoom, capturePhoto, countdown, startCountdown, handleSubmit, uploading]);

    const startCamera = async () => {
        setIsCameraActive(true);
        setPreviewImage(null);
        
        if (!packageDetector.isReady()) {
            setIsAiLoading(true);
            await packageDetector.init();
            setIsAiLoading(false);
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    runAiLoop();
                };
            }
        } catch (err) {
            console.error("Camera access error:", err);
            alert("មិនអាចបើកកាមេរ៉ាបានទេ។");
            setIsCameraActive(false);
            setIsAiLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    const fulfillmentStore = appData.stores?.find(s => s.StoreName === order?.['Fulfillment Store']);
    const basePrinterURL = fulfillmentStore?.LabelPrinterURL;

    const getFullPrinterURL = () => {
        if (!basePrinterURL || !order) return '';
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
        navigator.clipboard.writeText(text).then(() => alert('ចម្លងឈ្មោះបានជោគជ័យ'));
    };

    const handleCopyPhone = () => {
        if (!order) return;
        const text = order['Customer Phone'];
        navigator.clipboard.writeText(text).then(() => alert('ចម្លងលេខទូរស័ព្ទបានជោគជ័យ'));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRawFile(file);
            try {
                const compressedBlob = await compressImage(file, 0.4, 640);
                const reader = new FileReader();
                reader.onloadend = () => setPreviewImage(reader.result as string);
                reader.readAsDataURL(compressedBlob);
            } catch (error) {
                const reader = new FileReader();
                reader.onloadend = () => setPreviewImage(reader.result as string);
                reader.readAsDataURL(file);
            }
        }
    };

    if (!order) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center relative bg-gradient-to-r from-blue-600/20 to-transparent">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Smart Packaging Hub</h3>
                            <div className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] font-black text-blue-400 uppercase tracking-widest">AI Core v1.0</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(order['Order ID']).then(() => alert('ចម្លង ID បានជោគជ័យ'));
                                }}
                                className="text-blue-400 font-mono text-xs font-bold hover:text-white transition-colors flex items-center gap-1 group/id"
                            >
                                #{order['Order ID'].substring(0, 15)}
                                <svg className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-blue-600 text-white text-xs font-black uppercase rounded-lg shadow-md tracking-wider">Team: {order.Team}</span>
                                <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase rounded border border-purple-500/20">Page: {order.Page}</span>
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase rounded border border-emerald-500/20">User: {order.User}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={uploading} className="w-10 h-10 bg-black/40 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all border border-white/5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-grow custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {fullPrinterURL && (
                                <button 
                                    onClick={() => window.open(fullPrinterURL, '_blank')}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-3 border border-white/10"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    បោះពុម្ភវិក្កយបត្រ (Print Label)
                                </button>
                            )}

                            <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/5 space-y-4 relative">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 flex-shrink-0">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-white font-black text-base truncate">{order['Customer Name']}</p>
                                            <button onClick={handleCopyName} className="p-2 bg-white/5 hover:bg-blue-600 text-gray-500 hover:text-white rounded-lg transition-all border border-white/5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth={2}/></svg></button>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            <p className="text-blue-400 font-mono text-sm font-bold truncate">{order['Customer Phone']}</p>
                                            <button onClick={handleCopyPhone} className="p-2 bg-white/5 hover:bg-blue-600 text-gray-500 hover:text-white rounded-lg transition-all border border-white/5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth={2}/></svg></button>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">ដឹកទៅកាន់ (Shipping To)</p>
                                    <p className="text-gray-200 text-sm font-bold leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">{order.Location} - {order['Address Details'] || 'គ្មានអាសយដ្ឋានលម្អិត'}</p>
                                </div>
                                {order.Note && (
                                    <div className="pt-4 border-t border-white/5">
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">ចំណាំ (Note)</p>
                                        <p className="text-amber-400 text-sm italic leading-relaxed bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">{order.Note}</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-black/40 rounded-2xl p-5 border border-white/5 space-y-4 shadow-inner">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">Logistics Manifest</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Payment</span>
                                        <p className="text-pink-400 font-bold text-xs truncate">{order['Payment Info'] || order['Payment Status']}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Shipping</span>
                                        <p className="text-indigo-400 font-bold text-xs truncate">{order['Internal Shipping Method']}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Driver</span>
                                        <p className="text-blue-400 font-bold text-xs truncate">{order['Driver Name'] || order['Internal Shipping Details'] || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Store</span>
                                        <p className="text-orange-400 font-bold text-xs truncate">{order['Fulfillment Store']}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">បញ្ជីផលិតផល ({order.Products.length})</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                    {order.Products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all">
                                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-900 border border-gray-800 cursor-pointer" onClick={() => showFullImage(convertGoogleDriveUrl(p.image))}>
                                                <img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" />
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <p className="text-sm font-black text-gray-200 truncate leading-tight">{p.name}</p>
                                                <div className="flex justify-between items-end mt-1.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-blue-500 font-black">x{p.quantity}</span>
                                                        {p.colorInfo && <span className="text-[9px] text-purple-500 italic font-bold">{p.colorInfo}</span>}
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-gray-500 line-through">${(p.originalPrice || p.price || 0).toFixed(2)}</p>
                                                        <p className="text-emerald-400 font-mono font-black text-sm">${(p.finalPrice || p.price || 0).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-600/5 rounded-2xl p-5 border border-blue-500/10 space-y-3">
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-500 font-bold uppercase">តម្លៃពេញសរុប (Total Full)</span>
                                    <span className="text-gray-300 font-mono font-black">${(order.Subtotal + (order['Discount ($)'] || 0)).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-500 font-bold uppercase">បញ្ចុះតម្លៃសរុប (Total Discount)</span>
                                    <span className="text-red-400 font-mono font-black">-${(order['Discount ($)'] || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px] border-t border-white/5 pt-2">
                                    <span className="text-gray-500 font-bold uppercase">តម្លៃទំនិញសុទ្ធ (Subtotal)</span>
                                    <span className="text-blue-400 font-mono font-black">${order.Subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-gray-500 font-bold uppercase">សេវាដឹកពីភ្ញៀវ (Shipping Fee)</span>
                                    <span className="text-indigo-400 font-mono font-black">+${order['Shipping Fee (Customer)'].toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t-2 border-dashed border-white/10">
                                    <span className="text-xs font-black text-white uppercase tracking-tighter">សរុបចុងក្រោយ (Grand Total)</span>
                                    <span className="text-xl font-black text-emerald-400 font-mono tracking-tighter">${order['Grand Total'].toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: AI Camera */}
                        <div className="flex flex-col h-full gap-4">
                            <div className="flex items-center justify-between px-2">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Vision Tracking</p>
                                <button 
                                    onClick={() => setIsAiEnabled(!isAiEnabled)}
                                    className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-tighter transition-all border flex items-center gap-2 ${isAiEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-800 text-gray-500 border-white/5'}`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${isAiEnabled ? (isAiLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500') : 'bg-gray-600'}`}></div>
                                    AI {isAiLoading ? 'Initializing...' : (isAiEnabled ? 'Active' : 'Disabled')}
                                </button>
                            </div>
                            
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <canvas ref={canvasRef} className="hidden" />

                            <div className="relative flex-grow min-h-[400px]">
                                {previewImage ? (
                                    <div className="absolute inset-0 group rounded-[2.5rem] overflow-hidden border-4 border-emerald-500/30 shadow-2xl bg-black cursor-pointer" onClick={() => showFullImage(previewImage)}>
                                        <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                                        {!uploading && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                                                className="absolute top-6 right-6 w-12 h-12 bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-2 border-white/20 hover:bg-red-500 z-10"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        )}
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/20 shadow-xl z-10">Proof Captured</div>
                                    </div>
                                ) : isCameraActive ? (
                                    <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden border-2 border-blue-500 shadow-[0_0_50px_rgba(37,99,235,0.2)] bg-black">
                                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                        
                                        {isAiLoading && (
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                                                <Spinner />
                                                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] animate-pulse">Initializing AI Neural Engine...</p>
                                            </div>
                                        )}
                                        {/* AI Dynamic Targeting Overlay */}
                                        {isAiEnabled && detection?.found && detection.box && (
                                            <div 
                                                className="absolute border-2 border-dashed transition-all duration-75 pointer-events-none"
                                                style={{
                                                    left: `${(detection.box.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                                    top: `${(detection.box.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                                    width: `${(detection.box.w / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                                    height: `${(detection.box.h / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                                    borderColor: detection.gesture === 'five_fingers' ? '#10b981' : (detection.gesture === 'thumbs_up' ? '#3b82f6' : '#3b82f6'),
                                                    boxShadow: `0 0 20px ${detection.gesture === 'five_fingers' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                                                    borderRadius: '1.5rem'
                                                }}
                                            >
                                                <div className={`absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${detection.gesture === 'five_fingers' ? 'border-emerald-500' : 'border-blue-500'}`} />
                                                <div className={`absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${detection.gesture === 'five_fingers' ? 'border-emerald-500' : 'border-blue-500'}`} />
                                                <div className={`absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${detection.gesture === 'five_fingers' ? 'border-emerald-500' : 'border-blue-500'}`} />
                                                <div className={`absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${detection.gesture === 'five_fingers' ? 'border-emerald-500' : 'border-blue-500'}`} />
                                                
                                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl border ${detection.gesture === 'five_fingers' ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-blue-600/80 border-blue-400 text-white'}`}>
                                                        {detection.gesture === 'five_fingers' ? (countdown !== null ? `Capturing in ${countdown}s...` : 'Ready to Capture!') : (detection.gesture === 'thumbs_up' ? 'Confirming...' : 'Tracking Hand...')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Thumbs Up Confirming Overlay */}
                                        {previewImage && detection?.gesture === 'thumbs_up' && (
                                            <div className="absolute inset-0 flex items-center justify-center z-50 bg-blue-600/20 backdrop-blur-sm animate-pulse">
                                                <div className="bg-blue-600 text-white p-8 rounded-full shadow-[0_0_50px_rgba(59,130,246,0.6)]">
                                                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                                                    <p className="text-center font-black uppercase text-xs mt-4 tracking-widest">Submitting...</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Countdown Large Text Overlay */}
                                        {countdown !== null && (
                                            <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/20 backdrop-blur-[2px]">
                                                <div className="relative">
                                                    <div className="w-32 h-32 rounded-full border-4 border-white/20 flex items-center justify-center animate-ping absolute inset-0"></div>
                                                    <div className="w-32 h-32 rounded-full border-4 border-emerald-500 flex items-center justify-center bg-black/40 backdrop-blur-md shadow-[0_0_50px_rgba(16,185,129,0.5)]">
                                                        <span className="text-6xl font-black text-white animate-bounce-slow">{countdown}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Auto-Capture Progress Ring */}
                                        {autoCaptureProgress > 0 && countdown === null && (
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                                                <div className="w-24 h-24 rounded-full border-4 border-white/10 flex items-center justify-center">
                                                    <div 
                                                        className="absolute inset-0 rounded-full border-4 border-emerald-500 transition-all duration-100"
                                                        style={{ clipPath: `inset(${100 - autoCaptureProgress}% 0 0 0)` }}
                                                    />
                                                    <svg className="w-10 h-10 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 z-40">
                                            <button onClick={stopCamera} className="w-14 h-14 bg-black/60 text-white rounded-full flex items-center justify-center border border-white/10 hover:bg-red-600 transition-all shadow-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            <button onClick={capturePhoto} className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-8 border-blue-600/20 shadow-2xl active:scale-90 transition-all ring-4 ring-white/10"><div className="w-16 h-16 bg-blue-600 rounded-full" /></button>
                                            <div className="w-14 h-14" />
                                        </div>
                                        
                                        <div className="absolute top-6 left-6 flex flex-col gap-2">
                                            <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Zoom: {zoom.toFixed(1)}x</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 h-full">
                                        <button 
                                            onClick={startCamera}
                                            className="w-full h-full border-2 border-dashed border-blue-500/20 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 hover:border-blue-500 hover:bg-blue-500/5 transition-all active:scale-[0.98] group"
                                        >
                                            <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-[0_0_40px_rgba(37,99,235,0.4)] border border-white/10 scale-110 group-hover:scale-110 transition-all duration-500">
                                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="text-lg font-black text-white uppercase tracking-tighter">បើកកាមេរ៉ា AI</p>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Auto-Detect • Smart Zoom • Auto-Snap</p>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full py-5 bg-gray-800/40 hover:bg-gray-800 text-gray-400 rounded-3xl border border-white/5 font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            Select From Device (Upload)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-[#0f172a] border-t border-white/5 flex gap-4">
                    <button 
                        onClick={onClose}
                        disabled={uploading}
                        className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-[0.98] border border-white/5 shadow-xl"
                    >
                        បោះបង់ (Cancel)
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={!previewImage || uploading}
                        className={`flex-[2.5] py-5 rounded-3xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3 relative overflow-hidden group
                            ${!previewImage || uploading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'}`}
                    >
                        {uploading ? <Spinner size="sm" /> : (
                            <>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
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