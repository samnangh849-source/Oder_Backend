
import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { compressImage } from '@/utils/imageCompressor';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { useSmartZoom } from '@/hooks/useSmartZoom';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { packageDetector, DetectionResult } from '@/utils/visionAlgorithm';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import Modal from '@/components/common/Modal';
import OrderGracePeriod from '@/components/orders/OrderGracePeriod';

type PackStep = 'VERIFYING' | 'CAPTURING' | 'LABELING';

interface FastPackModalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: (tempUrl?: string) => void;
}

interface FastPackScannerProps {
    onScan: (code: string) => void;
}

const FastPackScanner: React.FC<FastPackScannerProps> = ({ onScan }) => {
    const { isInitializing, error, switchCamera } = useBarcodeScanner("barcode-reader-container", onScan, 'increment');

    return (
        <div className="bg-[#1a2235] rounded-[2.5rem] p-6 border border-white/5 flex-grow flex flex-col shadow-inner min-h-[500px] relative overflow-hidden">
            <div id="barcode-reader-container" className="absolute inset-0 rounded-[2.5rem] overflow-hidden"></div>
            {isInitializing && (
                <div className="absolute inset-0 bg-black/90 z-10 flex flex-col items-center justify-center gap-6">
                    <Spinner size="lg" /><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] animate-pulse">Initializing Barcode Neural Subsystem...</p>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 bg-red-950/20 z-10 flex flex-col items-center justify-center p-10 text-center">
                    <p className="text-red-400 font-black text-sm uppercase tracking-widest mb-4">Scanner Error: {error}</p>
                    <button onClick={() => window.location.reload()} className="px-8 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry Subsystem</button>
                </div>
            )}
            <div className="absolute top-6 right-6 z-20 flex gap-3">
                <button onClick={switchCamera} className="w-12 h-12 bg-black/60 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" strokeWidth={2.5}/></svg></button>
            </div>
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                <div className="w-64 h-64 border-2 border-dashed border-blue-500/40 rounded-[3rem] animate-pulse flex items-center justify-center">
                    <div className="w-full h-0.5 bg-blue-500/30 animate-scan-y"></div>
                </div>
                <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.5em] mt-8 bg-black/40 px-6 py-2 rounded-full backdrop-blur-md">Position Barcode in Frame</p>
            </div>
        </div>
    );
};

const FastPackModal: React.FC<FastPackModalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser, appData, previewImage: showFullImage, advancedSettings } = useContext(AppContext);
    
    // Workflow State
    const [step, setStep] = useState<PackStep>('VERIFYING');
    const [verifiedItems, setVerifiedItems] = useState<Record<string, number>>({}); // Track quantity verified per product name

    const isOrderVerified = useMemo(() => {
        if (!order) return false;
        return order.Products.every(p => (verifiedItems[p.name] || 0) >= p.quantity);
    }, [order, verifiedItems]);

    // Transition to CAPTURING automatically if verified
    useEffect(() => {
        if (isOrderVerified && step === 'VERIFYING') {
            setTimeout(() => setStep('CAPTURING'), 800);
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
            { id: 'VERIFYING', label: 'Verify Items', icon: '🔍' },
            { id: 'CAPTURING', label: 'Take Photo', icon: '📸' },
            { id: 'LABELING', label: 'Print Label', icon: '🏷️' }
        ];

        return (
            <div className="flex items-center justify-center gap-4 mb-8">
                {steps.map((s, idx) => {
                    const isActive = step === s.id;
                    const isPast = steps.findIndex(st => st.id === step) > idx;
                    return (
                        <React.Fragment key={s.id}>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 ${isActive ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] scale-110' : isPast ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-500 border border-white/5'}`}>
                                    {isPast ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg> : s.icon}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>{s.label}</span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className={`w-12 h-0.5 rounded-full ${isPast ? 'bg-emerald-500' : 'bg-gray-800'}`}></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const renderChecklist = () => (
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {order?.Products.map((p, i) => {
                const verified = verifiedItems[p.name] || 0;
                const isComplete = verified >= p.quantity;
                return (
                    <div key={i} className={`group flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all duration-500 ${isComplete ? 'bg-emerald-500/10 border-emerald-500/20 shadow-[0_10px_30px_rgba(16,185,129,0.1)]' : 'bg-white/[0.03] border-white/5 hover:border-blue-500/30 shadow-inner'}`}>
                        <div className="relative">
                            <img src={convertGoogleDriveUrl(p.image)} className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-xl" alt={p.name} />
                            {isComplete && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-[#0f172a] animate-pop-in">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>
                                </div>
                            )}
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className={`font-black text-sm truncate tracking-tight transition-colors ${isComplete ? 'text-emerald-400' : 'text-white'}`}>{p.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pick Progress</span>
                                <div className="flex-grow h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 max-w-[100px]">
                                    <div className={`h-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${(verified / p.quantity) * 100}%` }}></div>
                                </div>
                                <span className={`text-[10px] font-black font-mono ${isComplete ? 'text-emerald-500' : 'text-blue-400'}`}>{verified}/{p.quantity}</span>
                            </div>
                        </div>
                        {!isComplete && (
                            <button onClick={() => verifyItem(p.name)} className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all group-hover:scale-110">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3}/></svg>
                            </button>
                        )}
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

    // Barcode Integration
    const handleBarcodeScan = useCallback((code: string) => {
        const foundProduct = order?.Products.find(p => {
            const masterP = appData.masterProducts?.find(mp => mp.ProductName === p.name);
            return masterP?.Barcode && masterP.Barcode.trim() === code.trim();
        });
        if (foundProduct) verifyItem(foundProduct.name);
    }, [order, appData.masterProducts, verifyItem]);

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
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
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
    }, [stopCamera, uploading]);

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

    const handleCopyName = () => { if (order) navigator.clipboard.writeText(order['Customer Name']).then(() => alert('ចម្លងឈ្មោះបានជោគជ័យ')); };
    const handleCopyPhone = () => { if (order) navigator.clipboard.writeText(order['Customer Phone']).then(() => alert('ចម្លងលេខទូរស័ព្ទបានជោគជ័យ')); };

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

    if (!order) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in overflow-y-auto">
            <style>{`
                @keyframes scan-y { 0% { top: 0; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                .animate-scan-y { position: absolute; animation: scan-y 3s linear infinite; }
                @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .animate-bounce-slow { animation: bounce-slow 2s infinite ease-in-out; }
                @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
            `}</style>
            
            <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] w-full max-w-6xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col my-auto relative max-h-none md:max-h-[95vh]">
                
                {/* Detailed Header */}
                <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center relative bg-gradient-to-r from-blue-600/10 via-transparent to-transparent flex-shrink-0">
                    <div className="flex items-center gap-5">
                        {page ? (
                            <img 
                                src={convertGoogleDriveUrl(page.PageLogoURL)} 
                                className="w-14 h-14 rounded-2xl border border-white/10 shadow-2xl object-cover" 
                                alt="Page Logo" 
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-xl">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2}/></svg>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Smart Packaging Hub</h3>
                                <div className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[8px] font-black text-blue-400 uppercase tracking-widest">AI Core v2.0</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                <button onClick={() => navigator.clipboard.writeText(order['Order ID']).then(() => alert('Copied ID'))} className="text-blue-400 font-mono text-xs font-bold hover:text-white transition-colors flex items-center gap-1 group/id bg-blue-500/5 px-2 py-0.5 rounded-lg border border-blue-500/10">
                                    #{order['Order ID'].substring(0, 15)}
                                    <svg className="w-3.5 h-3.5 opacity-0 group-hover/id:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth={2}/></svg>
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg shadow-lg tracking-wider">Team: {order.Team}</span>
                                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase rounded-lg border border-purple-500/20">{order.Page}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={uploading} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all border border-white/5 shadow-xl active:scale-90 flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto no-scrollbar space-y-6 flex-grow custom-scrollbar">
                    {renderStepIndicator()}
                    
                    {uploading && undoTimer === null && (
                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-[2rem] p-4 animate-pulse mb-4 shadow-inner">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <Spinner size="sm" />
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Synchronizing Proof with Global Stream...</span>
                                </div>
                                <span className="text-xs font-mono font-black text-blue-400">{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-950 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.5)]" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full">
                        {/* LEFT COLUMN: Order Details & Checklist */}
                        <div className="flex flex-col gap-6">
                            <div className="bg-white/[0.03] rounded-[2.5rem] p-8 border border-white/5 space-y-8 shadow-inner relative overflow-hidden flex-shrink-0">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                                <div className="flex items-start gap-6 relative z-10">
                                    <div className="w-16 h-16 bg-blue-600/20 rounded-[1.5rem] flex items-center justify-center text-blue-500 border border-blue-500/20 flex-shrink-0 shadow-2xl">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                    <div className="min-w-0 flex-grow space-y-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <p className="text-white font-black text-2xl truncate tracking-tight">{order['Customer Name']}</p>
                                            <div className="flex gap-2">
                                                <button onClick={handleCopyName} className="p-2.5 bg-white/5 hover:bg-blue-600 text-gray-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-lg active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {phoneCarrier && <img src={convertGoogleDriveUrl(phoneCarrier.CarrierLogoURL)} className="w-6 h-6 object-contain" alt="Carrier" />}
                                            <p className="text-blue-400 font-mono text-lg font-black tracking-tight">{order['Customer Phone']}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-900/80 p-5 rounded-3xl border border-white/5 shadow-inner">
                                    <p className="text-white text-base font-black tracking-tight leading-snug">{order.Location}</p>
                                </div>
                            </div>

                            <div className="flex-grow">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em]">Items Manifest</h4>
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isOrderVerified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                        {isOrderVerified ? 'All Items Verified' : 'Awaiting Verification'}
                                    </span>
                                </div>
                                {renderChecklist()}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Camera / Proof / Labels */}
                        <div className="flex flex-col gap-6">
                            {step === 'VERIFYING' && <FastPackScanner onScan={handleBarcodeScan} />}

                            {step === 'CAPTURING' && (
                                <div className="bg-[#1a2235] rounded-[2.5rem] p-6 border border-white/5 flex-grow flex flex-col shadow-inner">
                                    <div className="flex items-center justify-between mb-6 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_15px_#3b82f6] animate-pulse"></div>
                                            <p className="text-[11px] font-black text-white uppercase tracking-[0.25em]">Neural Visual Tracking</p>
                                        </div>
                                        <button onClick={() => setIsAiEnabled(!isAiEnabled)} className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-3 shadow-xl active:scale-95 ${isAiEnabled ? 'bg-blue-600 text-white border-blue-400/50 shadow-blue-900/40' : 'bg-gray-800 text-gray-500 border-white/10'}`}>
                                            <div className={`w-2 h-2 rounded-full ${isAiEnabled ? (isAiLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400') : 'bg-gray-600'}`}></div>
                                            {isAiLoading ? 'Warming Up...' : (isAiEnabled ? 'AI Active' : 'AI Offline')}
                                        </button>
                                    </div>
                                    
                                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                    <canvas ref={canvasRef} className="hidden" />

                                    <div className="relative flex-grow min-h-[400px] group/cam">
                                        {previewImage ? (
                                            <div className="absolute inset-0 group rounded-[3rem] overflow-hidden border-4 border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.2)] bg-black cursor-pointer" onClick={() => showFullImage(previewImage)}>
                                                <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                                                <button onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }} className="absolute top-6 right-6 w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/20 active:scale-90 z-20"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600/90 backdrop-blur-md text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] border border-white/30 shadow-2xl z-10 animate-fade-in-up">Digital Proof Locked</div>
                                            </div>
                                        ) : isCameraActive ? (
                                            <div className="absolute inset-0 rounded-[3rem] overflow-hidden border-2 border-blue-500/50 shadow-[0_0_60px_rgba(37,99,235,0.15)] bg-black">
                                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: `scale(${zoom})` }} />
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden"><div className="w-full h-[2px] bg-blue-500/50 absolute top-0 left-0 animate-scan-y shadow-[0_0_15px_#3b82f6]"></div></div>
                                                {countdown !== null && (
                                                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
                                                        <div className="w-32 h-32 rounded-full border-8 border-emerald-500 flex items-center justify-center bg-black/60 shadow-[0_0_80px_rgba(16,185,129,0.6)]">
                                                            <span className="text-7xl font-black text-white">{countdown}</span>
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
                                                        <div className={`absolute inset-0 border-4 rounded-[2.5rem] transition-all duration-500 ${detection.isHand ? 'border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.6)]' : 'border-blue-500/60 shadow-[0_0_25px_rgba(59,130,246,0.3)]'}`}>
                                                            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest whitespace-nowrap border shadow-xl ${detection.isHand ? 'bg-amber-600 text-white border-white/20' : 'bg-blue-600 text-white border-white/20'}`}>
                                                                {detection.isHand ? '✋ Hands in Frame' : '📦 Target Locked'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Auto-Capture Progress Overlay */}
                                                {autoCaptureProgress > 0 && (
                                                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 h-2 bg-black/60 rounded-full border border-white/10 overflow-hidden z-20">
                                                        <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${autoCaptureProgress}%` }}></div>
                                                    </div>
                                                )}

                                                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-10 z-40 px-6">
                                                    <button onClick={stopCamera} className="w-14 h-14 bg-black/60 backdrop-blur-xl text-white rounded-2xl flex items-center justify-center border border-white/10 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                                                    <button onClick={capturePhoto} className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-[8px] border-blue-600/30 shadow-2xl active:scale-95"><div className="w-16 h-16 bg-blue-600 rounded-full" /></button>
                                                    <div className="w-14 h-14 bg-black/40 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10"><span className="text-[10px] font-black text-blue-400 font-mono">{zoom.toFixed(1)}x</span></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={startCamera} className="w-full h-full border-4 border-dashed border-blue-500/20 rounded-[3rem] flex flex-col items-center justify-center gap-6 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group shadow-inner">
                                                <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl border border-white/10 transform transition-transform group-hover:scale-110">
                                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2.5}/></svg>
                                                </div>
                                                <p className="text-xl font-black text-white uppercase tracking-tighter italic">Activate Proof Cam</p>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {step === 'LABELING' && (
                                <div className="bg-[#1a2235] rounded-[2.5rem] p-8 border border-white/5 flex-grow flex flex-col shadow-inner justify-center items-center gap-10">
                                    <div className="w-32 h-32 bg-emerald-500/20 rounded-[2.5rem] flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg>
                                    </div>
                                    <div className="text-center space-y-4">
                                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Packaging Finalized</h3>
                                        <p className="text-gray-500 text-sm font-bold uppercase tracking-[0.2em]">Ready for Label Generation</p>
                                    </div>
                                    {fullPrinterURL && (
                                        <button onClick={() => window.open(fullPrinterURL, '_blank')} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl flex justify-center items-center gap-4 border border-white/10 transition-all active:scale-95 group">
                                            <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={2.5}/></svg>
                                            Print Shipping Label
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Aesthetic Footer with Sticky Actions */}
                <div className="p-8 md:p-10 bg-[#0f172a] border-t border-white/10 flex flex-col md:flex-row gap-6 flex-shrink-0 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                    <button onClick={onClose} disabled={uploading} className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-3xl font-black uppercase text-xs tracking-[0.3em] transition-all active:scale-[0.98] border border-white/5 shadow-2xl">បោះបង់ (Cancel)</button>
                    
                    {step === 'VERIFYING' && (
                        <button onClick={() => setStep('CAPTURING')} disabled={!isOrderVerified} className={`flex-[2.5] py-5 rounded-3xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 relative overflow-hidden group ${!isOrderVerified ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'}`}>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <svg className="w-7 h-7 relative z-10 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            <span className="relative z-10">បន្ទាប់: ថតរូបកញ្ចប់ (Next Step)</span>
                        </button>
                    )}

                    {step === 'CAPTURING' && (
                        <button onClick={() => setStep('LABELING')} disabled={!previewImage} className={`flex-[2.5] py-5 rounded-3xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 relative overflow-hidden group ${!previewImage ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'}`}>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <svg className="w-7 h-7 relative z-10 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            <span className="relative z-10">បន្ទាប់: បោះពុម្ពប័ណ្ណ (Next Step)</span>
                        </button>
                    )}

                    {step === 'LABELING' && (
                        <button onClick={handleSubmit} disabled={uploading} className={`flex-[2.5] py-5 rounded-3xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 relative overflow-hidden group ${uploading ? 'bg-gray-800 text-gray-500' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'}`}>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            {uploading && undoTimer === null ? <Spinner size="sm" /> : <><svg className="w-7 h-7 relative z-10 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M5 13l4 4L19 7" /></svg><span className="relative z-10">បញ្ចប់ការវេចខ្ចប់ & រក្សាទុក (Finalize)</span></>}
                        </button>
                    )}
                </div>
            </div>

            {/* UNDO / GRACE PERIOD OVERLAY - Highest Z-Index */}
            {undoTimer !== null && (
                <OrderGracePeriod 
                    timer={undoTimer}
                    maxTimer={maxUndoTimer}
                    onUndo={handleUndo}
                    isUndoing={isUndoing}
                    accentColor="orange"
                    title="កំពុងរៀបចំ..."
                    subtitle="ទិន្នន័យវេចខ្ចប់នឹងត្រូវបានរក្សាទុកក្នុងពេលបន្តិចទៀតនេះ។ អ្នកអាចចុចបោះបង់ ប្រសិនបើមានការភាន់ច្រឡំ។"
                />
            )}

        </div>
    );
};

export default FastPackModal;
