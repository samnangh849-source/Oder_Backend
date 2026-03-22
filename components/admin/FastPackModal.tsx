
import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { compressImage } from '@/utils/imageCompressor';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { useSmartZoom } from '@/hooks/useSmartZoom';
import { packageDetector, DetectionResult } from '@/utils/visionAlgorithm';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import Modal from '@/components/common/Modal';
import OrderGracePeriod from '@/components/orders/OrderGracePeriod';

type PackStep = 'VERIFYING' | 'LABELING' | 'CAPTURING';

interface FastPackModalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: (tempUrl?: string) => void;
}

const FastPackModal: React.FC<FastPackModalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser, appData, previewImage: showFullImage, advancedSettings } = useContext(AppContext);
    
    // Workflow State
    const [step, setStep] = useState<PackStep>('VERIFYING');
    const [verifiedItems, setVerifiedItems] = useState<Record<string, number>>({}); // Track quantity verified per product name

    const isOrderVerified = useMemo(() => {
        if (!order) return false;
        return order.Products.every(p => (verifiedItems[p.name] || 0) >= p.quantity);
    }, [order, verifiedItems]);

    // Transition to LABELING automatically if verified
    useEffect(() => {
        if (isOrderVerified && step === 'VERIFYING') {
            setTimeout(() => setStep('LABELING'), 800);
        }
    }, [isOrderVerified, step]);

    const verifyItem = useCallback((productName: string, quantity: number = 1) => {
        setVerifiedItems(prev => {
            const current = prev[productName] || 0;
            const target = order?.Products.find(p => p.name === productName)?.quantity || 1;
            if (current >= target) return prev;
            if (navigator.vibrate) navigator.vibrate(50);
            return { ...prev, [productName]: Math.min(target, current + quantity) };
        });
    }, [order]);

    const renderStepIndicator = () => {
        const steps: { id: PackStep, label: string, icon: string }[] = [
            { id: 'VERIFYING', label: 'ពិនិត្យទំនិញ', icon: '🔍' },
            { id: 'LABELING', label: 'បោះពុម្ពប័ណ្ណ', icon: '🏷️' },
            { id: 'CAPTURING', label: 'ថតរូបកញ្ចប់', icon: '📸' }
        ];

        return (
            <div className="flex items-center justify-center gap-4 mb-10">
                {steps.map((s, idx) => {
                    const isActive = step === s.id;
                    const isPast = steps.findIndex(st => st.id === step) > idx;
                    return (
                        <React.Fragment key={s.id}>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 ${isActive ? 'bg-[#1DB954] text-black shadow-[0_0_30px_rgba(29,185,84,0.4)] scale-110 ring-4 ring-[#1DB954]/20' : isPast ? 'bg-[#1DB954] text-black' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                                    {isPast ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg> : s.icon}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${isActive ? 'text-[#1DB954]' : 'text-gray-500'}`}>{s.label}</span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`w-20 h-1 rounded-full ${isPast ? 'bg-[#1DB954]' : 'bg-white/5'}`}></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const renderChecklist = () => (
        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar spotify-scroll">
            {order?.Products.map((p, i) => {
                const verified = verifiedItems[p.name] || 0;
                const isComplete = verified >= p.quantity;
                const masterP = appData.products?.find(mp => mp.ProductName === p.name);
                
                return (
                    <div key={i} className={`group flex flex-col gap-6 p-8 rounded-[3rem] border ring-1 ring-white/5 transition-all duration-500 ${isComplete ? 'bg-[#1DB954]/5 border-[#1DB954]/30 shadow-[0_20px_60px_rgba(29,185,84,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/20 shadow-2xl'}`}>
                        <div className="flex items-center gap-8">
                            <div className="relative flex-shrink-0">
                                <img src={convertGoogleDriveUrl(p.image)} className="w-28 h-28 rounded-[2rem] object-cover border-2 border-white/10 shadow-2xl group-hover:scale-105 transition-transform" alt={p.name} onClick={() => showFullImage(convertGoogleDriveUrl(p.image))} />
                                {isComplete && (
                                    <div className="absolute -top-2 -right-2 w-10 h-10 bg-[#1DB954] rounded-full flex items-center justify-center text-black shadow-lg border-4 border-[#121212] animate-pop-in">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>
                                    </div>
                                )}
                            </div>
                            <div className="flex-grow min-w-0 space-y-3">
                                <p className={`font-black text-2xl truncate tracking-tighter transition-colors uppercase italic ${isComplete ? 'text-[#1DB954]' : 'text-white'}`}>{p.name}</p>
                                {masterP?.Barcode && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Barcode:</span>
                                        <span className="text-sm font-mono font-bold text-[#1DB954] bg-[#1DB954]/10 px-4 py-1 rounded-full border border-[#1DB954]/20">{masterP.Barcode}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-8 pt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Cost</span>
                                        <span className="text-lg font-black text-gray-500 font-mono line-through opacity-50">${(Number(p.cost) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-[#1DB954] uppercase tracking-[0.4em]">Final</span>
                                        <span className="text-2xl font-black text-white font-mono">${(Number(p.finalPrice) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="ml-auto flex flex-col items-end">
                                        <span className="text-[10px] font-black text-[#1DB954] uppercase tracking-[0.4em]">Quantity</span>
                                        <span className="text-4xl font-black text-white font-mono leading-none">{p.quantity}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6 bg-black/40 p-5 rounded-[2rem] ring-1 ring-white/5 shadow-inner">
                            <div className="flex-grow h-4 bg-white/5 rounded-full overflow-hidden p-1">
                                <div className={`h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_20px_rgba(29,185,84,0.4)] ${isComplete ? 'bg-[#1DB954]' : 'bg-[#1DB954]/70'}`} style={{ width: `${(verified / p.quantity) * 100}%` }}></div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`text-xs font-black font-mono px-5 py-2 rounded-full border transition-all ${isComplete ? 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                    {verified} / {p.quantity} Verified
                                </span>
                                {!isComplete && (
                                    <button onClick={() => verifyItem(p.name)} className="w-14 h-14 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-[1.5rem] flex items-center justify-center shadow-xl active:scale-90 transition-all transform hover:rotate-90 group">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3}/></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    
    // AI & Smart Features State
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [detection, setDetection] = useState<DetectionResult | null>(null);
    const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [aiFrameCount, setAiFrameCount] = useState(0);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const aiLoopRef = useRef<number | null>(null);
    const lastActionTime = useRef<number>(0);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const { zoom, applyZoom } = useSmartZoom();
    const [rawFile, setRawFile] = useState<File | null>(null);

    // Undo Timer State
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [maxUndoTimer, setMaxUndoTimer] = useState<number>(3);
    const [isUndoing, setIsUndoing] = useState(false);
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const submitIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            
            // Draw video frame
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Add Branded Watermark (Professional look like រូបកញ្ចប់ឥវ៉ាន់.png)
            const padding = 40;
            const fontSize = Math.max(20, canvas.width / 40);
            
            // 1. Store Name (Top Left)
            context.fillStyle = 'rgba(0, 0, 0, 0.5)';
            const storeText = `HUB: ${order?.['Fulfillment Store'] || 'UNKNOWN'}`;
            context.font = `black ${fontSize}px Inter, sans-serif`;
            const storeTextWidth = context.measureText(storeText).width;
            context.fillRect(padding - 10, padding - fontSize - 5, storeTextWidth + 20, fontSize + 15);
            context.fillStyle = '#ffffff';
            context.fillText(storeText, padding, padding);

            // 2. Packaging Hub / Order ID (Bottom Right)
            const idText = `ORDER ID: ${order?.['Order ID'].substring(0, 10)}`;
            const hubText = "SMART PACKAGING HUB";
            context.font = `black ${fontSize * 0.8}px Inter, sans-serif`;
            const idTextWidth = context.measureText(idText).width;
            const hubTextWidth = context.measureText(hubText).width;
            const maxWidth = Math.max(idTextWidth, hubTextWidth);
            
            context.fillStyle = 'rgba(29, 185, 84, 0.9)'; // Spotify Green
            context.fillRect(canvas.width - maxWidth - padding - 20, canvas.height - (fontSize * 2) - padding - 15, maxWidth + 30, (fontSize * 2) + 25);
            
            context.fillStyle = '#000000';
            context.fillText(hubText, canvas.width - maxWidth - padding, canvas.height - fontSize - padding - 5);
            context.font = `bold ${fontSize * 0.6}px monospace`;
            context.fillText(idText, canvas.width - maxWidth - padding, canvas.height - padding);
            
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                
                // Mode 'high-detail' for Packaging
                const compressedBlob = await compressImage(file, 'high-detail');
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewImage(reader.result as string);
                    setRawFile(file);
                    stopCamera();
                };
                reader.readAsDataURL(compressedBlob);
            }, 'image/jpeg', 0.9);
        }
    }, [stopCamera, uploading, order]);

    // Helper function for robust upload with progress
    const uploadWithProgress = async (base64Data: string, fileName: string): Promise<any> => {
        const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
        const token = session?.token || '';

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${WEB_APP_URL}/api/upload-image`, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(percent);
                }
            };

            xhr.onload = () => {
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (xhr.status === 200 && resp.status === 'success') resolve(resp);
                    else reject(new Error(resp.message || 'Upload Failed'));
                } catch (e) { reject(new Error('Response Parse Error')); }
            };

            xhr.onerror = () => reject(new Error('Network Connection Error'));
            
            xhr.send(JSON.stringify({ 
                fileData: base64Data,
                fileName: fileName,
                mimeType: 'image/jpeg',
                userName: currentUser?.FullName || 'Packer',
                orderId: order!['Order ID'],
                targetColumn: 'Package Photo URL'
            }));
        });
    };

    const handleSubmit = useCallback(async () => {
        if (!previewImage || !rawFile) return;
        setUploading(true);
        setUploadProgress(0);

        const gracePeriod = advancedSettings?.packagingGracePeriod || 3;
        setMaxUndoTimer(gracePeriod);
        setUndoTimer(gracePeriod);

        let secondsLeft = gracePeriod;
        if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
        submitIntervalRef.current = setInterval(() => {
            secondsLeft -= 1;
            setUndoTimer(secondsLeft);
            if (secondsLeft <= 0) {
                if (submitIntervalRef.current) {
                    clearInterval(submitIntervalRef.current);
                    submitIntervalRef.current = null;
                }
            }
        }, 1000);

        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = setTimeout(async () => {
            if (submitIntervalRef.current) {
                clearInterval(submitIntervalRef.current);
                submitIntervalRef.current = null;
            }
            setUndoTimer(null);
            await executeFinalSubmit();
        }, gracePeriod * 1000);
    }, [previewImage, rawFile, order, currentUser, advancedSettings]);

    const handleUndo = () => {
        if (submitTimeoutRef.current) {
            clearTimeout(submitTimeoutRef.current);
            submitTimeoutRef.current = null;
        }
        if (submitIntervalRef.current) {
            clearInterval(submitIntervalRef.current);
            submitIntervalRef.current = null;
        }
        setIsUndoing(true);
        setTimeout(() => {
            setUndoTimer(null);
            setUploading(false);
            setIsUndoing(false);
        }, 500);
    };

    const executeFinalSubmit = async () => {
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';

            const base64Data = previewImage!.includes(',') ? previewImage!.split(',')[1] : previewImage!;
            const fileName = `Package_${order!['Order ID']}_${Date.now()}.jpg`;

            // 1. Ensure upload request is AT LEAST accepted by proxy
            // Backend returns { status: 'success', tempUrl: '...' }
            const uploadResult = await uploadWithProgress(base64Data, fileName);
            const tempUrl = uploadResult.tempUrl;

            // 2. Update order status
            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    orderId: order!['Order ID'],
                    team: order!.Team, 
                    userName: currentUser?.FullName || 'Packer',
                    newData: { 
                        'Fulfillment Status': 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Packer',
                        'Packed Time': new Date().toLocaleString('km-KH'),
                        'Package Photo URL': tempUrl // Set temp URL immediately
                    }
                })
            });

            const updateData = await updateRes.json();
            if (updateRes.status === 401) throw new Error("Token expired. Please login again.");
            if (updateData.status !== 'success') throw new Error("Order update failed!");
            
            // Pass tempUrl to parent for instant local state update
            onSuccess(tempUrl);
            
            // Send background chat
            const id = order!['Order ID'].substring(0,8);
            const chatMsg = `📦 **[PACKED]** កញ្ចប់ #${id} (${order!['Customer Name']}) វេចខ្ចប់រួចរាល់`;
            fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: chatMsg })
            }).catch(() => {});

        } catch (err: any) {
            alert("❌ ការបញ្ជូនបរាជ័យ: " + err.message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

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

    const runAiLoop = useCallback(async () => {
        if (!videoRef.current || !isCameraActive || previewImage) return;
        const result = await packageDetector.detect(videoRef.current);
        setDetection(result);
        setAiFrameCount(prev => (prev + 1) % 100);
        if (isAiEnabled) {
            if (result.gesture === 'five_fingers' && countdown === null) startCountdown();
            if (result.gesture === 'thumbs_up' && previewImage && !uploading) handleSubmit();
            if (result.found && result.box) {
                const track = (videoRef.current.srcObject as MediaStream)?.getVideoTracks()[0];
                if (track && Date.now() - lastActionTime.current > 1200) {
                    const videoArea = videoRef.current.videoWidth * videoRef.current.videoHeight;
                    const objectArea = result.box.w * result.box.h;
                    const areaRatio = objectArea / videoArea;
                    const minThreshold = result.isHand ? 0.35 : 0.25;
                    const maxThreshold = result.isHand ? 0.80 : 0.70;
                    if (areaRatio < minThreshold) applyZoom(track, zoom + 0.5);
                    else if (areaRatio > maxThreshold) applyZoom(track, zoom - 0.5);
                    lastActionTime.current = Date.now();
                }
                
                // ENFORCED CLEAN PROOF: Only auto-capture if NO HANDS are in frame
                if (countdown === null && result.stability > 0.95 && !previewImage && !result.isHand) {
                    setAutoCaptureProgress(prev => {
                        const next = prev + 3;
                        if (next >= 100) { capturePhoto(); return 0; }
                        return next;
                    });
                } else setAutoCaptureProgress(0);
            }
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
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, 
                audio: false 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => { runAiLoop(); };
            }
        } catch (err) {
            alert("មិនអាចបើកកាមេរ៉ាបានទេ។");
            setIsCameraActive(false);
            setIsAiLoading(false);
        }
    };

    useEffect(() => { return () => stopCamera(); }, [stopCamera]);

    const fulfillmentStore = appData.stores?.find(s => s.StoreName === order?.['Fulfillment Store']);
    const basePrinterURL = fulfillmentStore?.LabelPrinterURL;

    const getFullPrinterURL = () => {
        if (!basePrinterURL || !order) return '';
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
            note: order.Note || ''
        });
        return `${basePrinterURL}?${params.toString()}`;
    };

    const fullPrinterURL = getFullPrinterURL();

    // Data Enrichment for Logos
    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order?.['Internal Shipping Method']);
    const driver = appData.drivers?.find(d => d.DriverName === (order?.['Driver Name'] || order?.['Internal Shipping Details']));
    const bank = appData.bankAccounts?.find(b => b.BankName === order?.['Payment Info']);
    const page = appData.pages?.find(p => p.PageName === order?.Page);
    const phone = order?.['Customer Phone'] || '';
    const phoneCarrier = appData.phoneCarriers?.find(c => (c.Prefixes || '').split(',').some(p => phone.startsWith(p.trim())));

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => alert(`ចម្លង${label}បានជោគជ័យ`));
    };

    const handleCopyName = () => { if (order) handleCopy(order['Customer Name'], 'ឈ្មោះ'); };
    const handleCopyPhone = () => { if (order) handleCopy(order['Customer Phone'], 'លេខទូរស័ព្ទ'); };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRawFile(file);
            try {
                const compressedBlob = await compressImage(file, 'balanced');
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

    const renderVerificationSummary = () => (
        <div className="bg-white/5 rounded-[3rem] p-10 border border-white/10 ring-1 ring-white/5 flex-grow flex flex-col shadow-2xl overflow-y-auto custom-scrollbar gap-10">
            <div className="flex items-center justify-between">
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Order Summary</h3>
                <div className="flex items-center gap-3 px-6 py-2.5 bg-[#1DB954]/10 border border-[#1DB954]/20 rounded-full">
                    <span className="text-[10px] font-black text-[#1DB954] uppercase tracking-[0.4em]">រៀបចំដោយ:</span>
                    <span className="text-sm font-black text-white">{order?.User || 'N/A'}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Logistics Section */}
                <div className="space-y-6">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Logistics Details</p>
                    <div className="bg-black/40 p-8 rounded-[2.5rem] ring-1 ring-white/5 space-y-6 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Shipping Method</span>
                            <span className="text-sm font-black text-white uppercase tracking-tight">{order?.['Internal Shipping Method'] || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Assigned Driver</span>
                            <span className="text-sm font-black text-white uppercase tracking-tight">{order?.['Driver Name'] || order?.['Internal Shipping Details'] || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center pt-6 border-t border-white/5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Driver Cost</span>
                            <span className="text-2xl font-black text-[#1DB954] font-mono tracking-tighter italic">${(Number(order?.['Internal Cost']) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Financial Section */}
                <div className="space-y-6">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Financial Metrics</p>
                    <div className="bg-black/40 p-8 rounded-[2.5rem] ring-1 ring-white/5 space-y-6 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Payment Provider</span>
                            <span className="text-sm font-black text-white uppercase tracking-tight">{order?.['Payment Info'] || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Transaction Status</span>
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest transition-all ${order?.['Payment Status'] === 'Paid' ? 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                {order?.['Payment Status'] || 'Unpaid'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-6 border-t border-white/5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Grand Total</span>
                            <span className="text-4xl font-black text-[#1DB954] font-mono tracking-tighter italic">${(Number(order?.['Grand Total']) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Note Section */}
            {order?.Note && (
                <div className="space-y-6">
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Special Instructions</p>
                    <div className="bg-white/5 p-8 rounded-[2.5rem] ring-1 ring-white/5 shadow-inner border-l-[6px] border-[#1DB954]/40">
                        <p className="text-lg text-gray-300 leading-relaxed italic font-medium">"{order.Note}"</p>
                    </div>
                </div>
            )}

            <div className="mt-auto pt-10 border-t border-white/5 text-center">
                <p className="text-[11px] font-black text-gray-600 uppercase tracking-[0.6em] animate-pulse">Neural verification in progress... please confirm all items</p>
            </div>
        </div>
    );

    if (!order) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-[#121212] flex flex-col animate-fade-in overflow-hidden font-sans selection:bg-[#1DB954]/30">
            <style>{`
                @keyframes scan-y { 0% { top: 0; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                .animate-scan-y { position: absolute; animation: scan-y 3s linear infinite; }
                @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .animate-bounce-slow { animation: bounce-slow 2s infinite ease-in-out; }
                @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
                .spotify-scroll::-webkit-scrollbar { width: 12px; }
                .spotify-scroll::-webkit-scrollbar-track { background: transparent; }
                .spotify-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; border: 3px solid #121212; }
                .spotify-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
            
            {/* Immersive Background Elements */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#1DB954]/10 rounded-full blur-[120px] animate-pulse-soft"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[100px]"></div>
            </div>

            {/* FIXED HEADER: Refined Spotify Aesthetic */}
            <header className="relative z-30 px-8 py-6 bg-black/40 backdrop-blur-md border-b border-white/5 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-8">
                    <button onClick={onClose} className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/10 group">
                        <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex items-center gap-6">
                        {page ? (
                            <img 
                                src={convertGoogleDriveUrl(page.PageLogoURL)} 
                                className="w-14 h-14 rounded-2xl border border-white/10 shadow-2xl object-cover ring-4 ring-black" 
                                alt="Page Logo" 
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-[#1DB954] flex items-center justify-center text-black border-4 border-black shadow-xl">
                                <span className="text-2xl">📦</span>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Smart Packaging Hub</h1>
                                <span className="px-2 py-0.5 bg-[#1DB954] text-black text-[8px] font-black rounded uppercase tracking-widest">v4.2</span>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-[#1DB954] font-mono text-sm font-bold tracking-widest">#{order['Order ID'].substring(0, 15)}</span>
                                <div className="h-3 w-px bg-white/10"></div>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">{order.Page} • {order.Team} Team</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-full border border-white/5 ring-1 ring-white/5">
                        {bank && <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-6 h-6 object-contain" title={bank.BankName} alt="" />}
                        {shippingMethod && <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-6 h-6 object-contain" title={shippingMethod.MethodName} alt="" />}
                        {driver && <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-6 h-6 object-cover rounded-full ring-2 ring-black" title={driver.DriverName} alt="" />}
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl flex items-center justify-center transition-all border border-red-500/20 active:scale-90">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT: Split View */}
            <main className="flex-grow flex overflow-hidden relative z-10">
                {/* LEFT SIDEBAR: Order Info & Items */}
                <div className="w-full xl:w-[40%] flex flex-col border-r border-white/5 bg-black/20">
                    <div className="p-8 spotify-scroll overflow-y-auto space-y-10 flex-grow">
                        {renderStepIndicator()}

                        <div className="bg-gradient-to-br from-white/10 to-transparent p-10 rounded-[3rem] border border-white/10 ring-1 ring-white/5 shadow-3xl space-y-8 relative overflow-hidden">
                            <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-[#1DB954]/10 rounded-full blur-[80px]"></div>
                            <div className="flex items-start gap-8 relative z-10">
                                <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center text-[#1DB954] border border-white/10 shadow-2xl flex-shrink-0">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div className="min-w-0 space-y-4">
                                    <h2 className="text-5xl font-black text-white tracking-tighter italic leading-none truncate uppercase">{order['Customer Name']}</h2>
                                    <div className="flex items-center gap-4">
                                        {phoneCarrier && <img src={convertGoogleDriveUrl(phoneCarrier.CarrierLogoURL)} className="w-8 h-8 object-contain" alt="" />}
                                        <p className="text-[#1DB954] font-mono text-2xl font-black tracking-[0.1em]">{order['Customer Phone']}</p>
                                        <button onClick={handleCopyPhone} className="p-2.5 bg-white/5 hover:bg-[#1DB954] text-gray-500 hover:text-black rounded-xl transition-all border border-white/10 active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-6 relative z-10">
                                <div className="bg-black/60 p-8 rounded-[2.5rem] ring-1 ring-white/5 shadow-inner flex justify-between items-center group">
                                    <p className="text-white text-xl font-black tracking-tight uppercase italic flex-grow">{order.Location}</p>
                                    <button onClick={() => handleCopy(order.Location, 'ទីតាំង')} className="p-4 bg-white/5 hover:bg-[#1DB954] text-gray-500 hover:text-black rounded-2xl transition-all border border-white/10 shadow-2xl active:scale-90 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></button>
                                </div>
                                <div className="flex justify-between items-center px-6">
                                    <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Customer Logistic Fee</span>
                                    <span className="text-3xl font-black text-white font-mono tracking-tighter italic">${(Number(order['Shipping Fee (Customer)']) || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Inventory Checklist</h4>
                                <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${isOrderVerified ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                                    {isOrderVerified ? 'Secured' : 'Pending'}
                                </span>
                            </div>
                            {renderChecklist()}
                        </div>
                    </div>
                </div>

                {/* RIGHT CONTENT: Dynamic Stages */}
                <div className="flex-grow flex flex-col bg-gradient-to-b from-[#181818] to-[#121212] p-10 spotify-scroll overflow-y-auto">
                    <div className="max-w-5xl mx-auto w-full h-full flex flex-col">
                        {uploading && undoTimer === null && (
                            <div className="bg-[#1DB954]/10 border border-[#1DB954]/20 rounded-[3rem] p-8 animate-pulse mb-10 shadow-3xl">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-5">
                                        <Spinner size="lg" />
                                        <span className="text-xs font-black text-[#1DB954] uppercase tracking-[0.5em]">Uploading Secure Proof to Neural Stream...</span>
                                    </div>
                                    <span className="text-2xl font-mono font-black text-[#1DB954]">{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden p-1 border border-white/5">
                                    <div className="h-full bg-[#1DB954] transition-all duration-300 rounded-full shadow-[0_0_30px_#1DB954]" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            </div>
                        )}

                        <div className="flex-grow flex flex-col">
                            {step === 'VERIFYING' && renderVerificationSummary()}

                            {step === 'LABELING' && (
                                <div className="bg-white/5 rounded-[4rem] p-16 border border-white/10 ring-1 ring-white/5 flex-grow flex flex-col shadow-3xl items-center justify-center gap-16 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-[#1DB954]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                    <div className="w-56 h-56 bg-[#1DB954]/10 rounded-[4rem] flex items-center justify-center text-[#1DB954] border-2 border-[#1DB954]/30 shadow-[0_0_100px_rgba(29,185,84,0.2)] transform -rotate-6 group-hover:rotate-0 transition-transform duration-700">
                                        <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={2.5}/></svg>
                                    </div>
                                    <div className="text-center space-y-6">
                                        <h3 className="text-6xl font-black text-white uppercase tracking-tighter italic">បោះពុម្ពប័ណ្ណដឹកជញ្ជូន</h3>
                                        <p className="text-gray-500 text-sm font-black uppercase tracking-[0.6em]">Verify label attachment before final capture</p>
                                    </div>
                                    {fullPrinterURL && (
                                        <button onClick={() => window.open(fullPrinterURL, '_blank')} className="px-20 py-10 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full font-black uppercase text-xl tracking-[0.5em] shadow-3xl shadow-[#1DB954]/20 flex items-center gap-8 border-[6px] border-black transition-all active:scale-95 group">
                                            <svg className="w-10 h-10 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={3}/></svg>
                                            PRINT LABEL
                                        </button>
                                    )}
                                </div>
                            )}

                            {step === 'CAPTURING' && (
                                <div className="bg-white/5 rounded-[4rem] p-10 border border-white/10 ring-1 ring-white/5 flex-grow flex flex-col shadow-3xl relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-10 px-6 relative z-20">
                                        <div className="flex items-center gap-5">
                                            <div className="w-4 h-4 rounded-full bg-[#1DB954] shadow-[0_0_25px_#1DB954] animate-pulse"></div>
                                            <p className="text-xs font-black text-white uppercase tracking-[0.5em]">Neural Visual Matrix Active</p>
                                        </div>
                                        <button onClick={() => setIsAiEnabled(!isAiEnabled)} className={`px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-[0.3em] transition-all border ring-2 flex items-center gap-5 shadow-3xl active:scale-95 ${isAiEnabled ? 'bg-[#1DB954] text-black border-black/20 ring-[#1DB954]/30' : 'bg-white/5 text-gray-500 border-white/10 ring-white/5'}`}>
                                            <div className={`w-3 h-3 rounded-full ${isAiEnabled ? (isAiLoading ? 'bg-black/40 animate-pulse' : 'bg-black/60') : 'bg-gray-600'}`}></div>
                                            {isAiLoading ? 'SYNCING...' : (isAiEnabled ? 'AI CORE ACTIVE' : 'AI OFFLINE')}
                                        </button>
                                    </div>
                                    
                                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                    <canvas ref={canvasRef} className="hidden" />

                                    <div className="relative flex-grow min-h-[500px] group/cam">
                                        {previewImage ? (
                                            <div className="absolute inset-0 group rounded-[4rem] overflow-hidden border-[6px] border-[#1DB954]/40 shadow-3xl bg-black cursor-pointer ring-[12px] ring-black" onClick={() => showFullImage(previewImage)}>
                                                <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                                                <button onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }} className="absolute top-10 right-10 w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center shadow-3xl border-8 border-black active:scale-90 z-20 transition-all hover:scale-110"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={4}/></svg></button>
                                                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#1DB954] text-black px-16 py-6 rounded-full text-sm font-black uppercase tracking-[0.6em] border-8 border-black shadow-3xl z-10 animate-fade-in-up">PROOF SECURED</div>
                                            </div>
                                        ) : isCameraActive ? (
                                            <div className="absolute inset-0 rounded-[4rem] overflow-hidden border-2 border-white/10 ring-[12px] ring-black shadow-inner bg-black">
                                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: `scale(${zoom})` }} />
                                                
                                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                    <div className="w-[85%] h-[80%] border-2 border-white/10 rounded-[3.5rem] relative">
                                                        <div className="absolute top-0 left-0 w-20 h-20 border-t-[8px] border-l-[8px] border-[#1DB954] rounded-tl-[2rem] shadow-[0_0_30px_#1DB954]"></div>
                                                        <div className="absolute top-0 right-0 w-20 h-20 border-t-[8px] border-r-[8px] border-[#1DB954] rounded-tr-[2rem] shadow-[0_0_30px_#1DB954]"></div>
                                                        <div className="absolute bottom-0 left-0 w-20 h-20 border-b-[8px] border-l-[8px] border-[#1DB954] rounded-bl-[2rem] shadow-[0_0_30px_#1DB954]"></div>
                                                        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-[8px] border-r-[8px] border-[#1DB954] rounded-br-[2rem] shadow-[0_0_30px_#1DB954]"></div>
                                                        
                                                        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-[#1DB954] px-10 py-3 rounded-full border-[6px] border-black shadow-3xl">
                                                            <p className="text-xs font-black text-black uppercase tracking-[0.5em]">POSITION PACKAGE IN FRAME</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="absolute inset-0 pointer-events-none overflow-hidden"><div className="w-full h-1 bg-[#1DB954]/50 absolute top-0 left-0 animate-scan-y shadow-[0_0_30px_#1DB954]"></div></div>
                                                
                                                {countdown !== null && (
                                                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-xl">
                                                        <div className="w-64 h-64 rounded-full border-[20px] border-[#1DB954] flex items-center justify-center bg-black/60 shadow-[0_0_150px_rgba(29,185,84,0.6)] scale-125">
                                                            <span className="text-[10rem] font-black text-white italic">{countdown}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {isAiEnabled && detection?.found && detection.box && (
                                                    <div className="absolute transition-all duration-200 ease-out pointer-events-none" style={{
                                                        left: `${(detection.box.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                                        top: `${(detection.box.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                                        width: `${(detection.box.w / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                                        height: `${(detection.box.h / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                                    }}>
                                                        <div className={`absolute inset-0 border-[6px] rounded-[4rem] transition-all duration-500 ${detection.isHand ? 'border-amber-500 shadow-[0_0_80px_rgba(245,158,11,0.6)]' : 'border-[#1DB954] shadow-[0_0_50px_rgba(29,185,84,0.5)]'}`}>
                                                            <div className={`absolute -top-16 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full text-xs font-black uppercase tracking-[0.4em] whitespace-nowrap border-[6px] border-black shadow-3xl ${detection.isHand ? 'bg-amber-600 text-white' : 'bg-[#1DB954] text-black'}`}>
                                                                {detection.isHand ? '✋ HANDS DETECTED' : '📦 TARGET SECURED'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {autoCaptureProgress > 0 && (
                                                    <div className="absolute top-16 left-1/2 -translate-x-1/2 w-80 h-4 bg-black/60 rounded-full border-[3px] border-white/10 overflow-hidden z-20">
                                                        <div className="h-full bg-[#1DB954] transition-all duration-100 shadow-[0_0_20px_#1DB954]" style={{ width: `${autoCaptureProgress}%` }}></div>
                                                    </div>
                                                )}

                                                <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-16 z-40 px-10">
                                                    <button onClick={stopCamera} className="w-20 h-20 bg-black/60 backdrop-blur-3xl text-white rounded-full flex items-center justify-center border-[4px] border-white/10 shadow-3xl active:scale-90 hover:bg-white/10 transition-all"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                    
                                                    <button onClick={capturePhoto} className="w-36 h-36 bg-white rounded-full p-3 border-[12px] border-[#1DB954]/30 shadow-[0_0_80px_rgba(29,185,84,0.5)] active:scale-95 group transition-all">
                                                        <div className="w-full h-full bg-white rounded-full border-[6px] border-black/10 flex items-center justify-center shadow-inner">
                                                            <div className="w-16 h-16 bg-black/5 rounded-full border-[4px] border-black/10 group-active:scale-90 transition-transform"></div>
                                                        </div>
                                                    </button>
                                                    
                                                    <div className="w-20 h-20 bg-black/60 backdrop-blur-3xl rounded-full flex items-center justify-center border-[4px] border-white/10 shadow-3xl"><span className="text-lg font-black text-[#1DB954] font-mono italic">{zoom.toFixed(1)}x</span></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={startCamera} className="w-full h-full border-[6px] border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center gap-10 hover:border-[#1DB954]/40 hover:bg-[#1DB954]/5 transition-all group shadow-inner relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                <div className="w-40 h-40 bg-[#1DB954] rounded-[3.5rem] flex items-center justify-center text-black shadow-[0_0_80px_rgba(29,185,84,0.4)] border-[10px] border-black transform transition-all group-hover:scale-110 group-hover:rotate-6 relative z-10">
                                                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2.5}/></svg>
                                                </div>
                                                <div className="text-center space-y-4 relative z-10">
                                                    <p className="text-5xl font-black text-white uppercase tracking-tighter italic">ACTIVATE NEURAL CAM</p>
                                                    <p className="text-gray-500 text-xs font-black uppercase tracking-[0.8em]">System Ready for Secure Capture</p>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* STICKY FOOTER: Action Bar */}
            <footer className="relative z-30 px-12 py-10 bg-black border-t border-white/10 flex flex-col md:flex-row gap-10 flex-shrink-0 shadow-[0_-50px_100px_rgba(0,0,0,0.9)]">
                <button onClick={onClose} disabled={uploading} className="flex-1 py-8 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full font-black uppercase text-sm tracking-[0.6em] transition-all active:scale-[0.98] border border-white/10 shadow-2xl">DISCARD</button>
                
                {step === 'VERIFYING' && (
                    <button onClick={() => setStep('LABELING')} disabled={!isOrderVerified} className={`flex-[3] py-8 rounded-full font-black uppercase text-sm tracking-[0.6em] transition-all shadow-3xl flex items-center justify-center gap-8 relative overflow-hidden group ${!isOrderVerified ? 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5 opacity-50' : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[#1DB954]/20 border-[6px] border-black'}`}>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <span className="relative z-10">NEXT: LABEL PRINTING</span>
                        <svg className="w-10 h-10 relative z-10 group-hover:translate-x-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                )}

                {step === 'LABELING' && (
                    <button onClick={() => setStep('CAPTURING')} className={`flex-[3] py-8 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full font-black uppercase text-sm tracking-[0.6em] transition-all shadow-3xl shadow-[#1DB954]/20 border-[6px] border-black flex items-center justify-center gap-8 relative overflow-hidden group`}>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <span className="relative z-10">NEXT: SECURE CAPTURE</span>
                        <svg className="w-10 h-10 relative z-10 group-hover:translate-x-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                )}

                {step === 'CAPTURING' && (
                    <button onClick={handleSubmit} disabled={uploading || !previewImage} className={`flex-[3] py-8 rounded-full font-black uppercase text-sm tracking-[0.6em] transition-all shadow-3xl flex items-center justify-center gap-8 relative overflow-hidden group ${uploading || !previewImage ? 'bg-white/5 text-gray-600 border border-white/5 opacity-50' : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[#1DB954]/30 border-[6px] border-black'}`}>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        {uploading && undoTimer === null ? <Spinner size="lg" /> : <><span className="relative z-10">FINALIZE PACKAGING</span><svg className="w-10 h-10 relative z-10 group-hover:scale-125 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg></>}
                    </button>
                )}
            </footer>

            {/* UNDO / GRACE PERIOD OVERLAY - Highest Z-Index */}
            {undoTimer !== null && (
                <OrderGracePeriod 
                    timer={undoTimer}
                    maxTimer={maxUndoTimer}
                    onUndo={handleUndo}
                    isUndoing={isUndoing}
                    accentColor="emerald"
                    title="SYNCHRONIZING..."
                    subtitle="Packaging data is being committed to the secure stream. Discard now to prevent sync."
                />
            )}

        </div>
    );
};

export default FastPackModal;
